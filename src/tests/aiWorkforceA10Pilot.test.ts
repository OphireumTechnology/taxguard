import { describe, expect, it, vi } from 'vitest';
import { A10DuplicateWorkflowService } from '../server/ai/workforce/a10DuplicateWorkflow';
import { SqlWorkforceStore } from '../server/ai/workforce/sqlWorkforceStore';
import {
  WorkforceError,
  type AuthorizedDocumentEvidence,
  type KillSwitchState,
  type SyntheticStagingPermissionConfig,
  type WorkforceActor,
  type WorkforceAdvisoryOutput,
  type WorkforceCaseRecord,
  type WorkforceEnvironment,
  type WorkforceHumanDecisionRecord,
  type WorkforceJobRecord,
  type WorkforceJobStatus,
  type WorkforceStore,
} from '../server/ai/workforce/contracts';
import type { AgentId, AICaseScope } from '../ai/types';

const HASH_DUPLICATE = 'a'.repeat(64);
const HASH_UNIQUE = 'b'.repeat(64);
const SRC_1 = '11111111-1111-4111-8111-111111111111';
const SRC_2 = '22222222-2222-4222-8222-222222222222';
const SRC_3 = '33333333-3333-4333-8333-333333333333';
const DOC_REC_1 = '11111111-aaaa-4111-8111-111111111111';
const DOC_REC_2 = '22222222-bbbb-4222-8222-222222222222';
const DOC_REC_3 = '33333333-cccc-4333-8333-333333333333';

const BASE_SCOPE: AICaseScope = {
  tenant_id: 'tenant_destria',
  client_id: 'client_100',
  tax_case_id: 'case_2025_100',
  tax_year: 2025,
};

class InMemoryTransactionalWorkforceStore implements WorkforceStore {
  readonly jobs = new Map<string, WorkforceJobRecord>();
  readonly advisories = new Map<string, WorkforceAdvisoryOutput>();
  readonly decisionsByAdvisory = new Map<string, WorkforceHumanDecisionRecord[]>();

  async createOrGetJob(
    job: Omit<WorkforceJobRecord, 'created_at' | 'updated_at'>,
  ): Promise<{ job: WorkforceJobRecord; created: boolean }> {
    for (const existing of this.jobs.values()) {
      if (
        existing.tenant_id === job.tenant_id &&
        existing.agent_id === job.agent_id &&
        existing.idempotency_key === job.idempotency_key
      ) {
        return { job: existing, created: false };
      }
    }
    const now = new Date().toISOString();
    const created: WorkforceJobRecord = { ...job, created_at: now, updated_at: now };
    this.jobs.set(created.job_id, created);
    return { job: created, created: true };
  }

  async getJob(tenantId: string, jobId: string): Promise<WorkforceJobRecord | null> {
    const job = this.jobs.get(jobId);
    return job && job.tenant_id === tenantId ? job : null;
  }

  async updateJobStatus(
    tenantId: string,
    jobId: string,
    status: WorkforceJobStatus,
    patch?: { advisory_id?: string | null; error_code?: string | null },
  ): Promise<WorkforceJobRecord> {
    const current = await this.getJob(tenantId, jobId);
    if (!current) throw new WorkforceError('WORKFORCE_JOB_NOT_FOUND', 404);
    const updated: WorkforceJobRecord = {
      ...current,
      status,
      advisory_id: patch?.advisory_id !== undefined ? patch.advisory_id : current.advisory_id,
      error_code: patch?.error_code !== undefined ? patch.error_code : current.error_code,
      updated_at: new Date().toISOString(),
    };
    this.jobs.set(jobId, updated);
    return updated;
  }

  async saveAdvisory(advisory: WorkforceAdvisoryOutput): Promise<WorkforceAdvisoryOutput> {
    this.advisories.set(advisory.advisory_id, advisory);
    return advisory;
  }

  async getAdvisory(tenantId: string, advisoryId: string): Promise<WorkforceAdvisoryOutput | null> {
    const adv = this.advisories.get(advisoryId);
    return adv && adv.scope.tenant_id === tenantId ? adv : null;
  }

  async listCaseAdvisories(
    tenantId: string,
    taxCaseId: string,
    agentId?: AgentId,
  ): Promise<readonly WorkforceAdvisoryOutput[]> {
    return [...this.advisories.values()].filter(
      a =>
        a.scope.tenant_id === tenantId &&
        a.scope.tax_case_id === taxCaseId &&
        (!agentId || a.agent_id === agentId),
    );
  }

  async recordDecisionAtomic(
    decision: WorkforceHumanDecisionRecord,
  ): Promise<WorkforceHumanDecisionRecord> {
    const advisory = await this.getAdvisory(decision.tenant_id, decision.advisory_id);
    if (!advisory) throw new WorkforceError('WORKFORCE_ADVISORY_NOT_FOUND', 404);
    if (advisory.evidence_fingerprint !== decision.bound_evidence_fingerprint) {
      throw new WorkforceError('STALE_EVIDENCE_CONFLICT', 409);
    }
    const existing = this.decisionsByAdvisory.get(decision.advisory_id) ?? [];
    if (existing.length > 0) {
      throw new WorkforceError('CONCURRENT_DECISION_CONFLICT', 409);
    }
    this.decisionsByAdvisory.set(decision.advisory_id, [decision]);
    return decision;
  }

  async listAdvisoryDecisions(
    tenantId: string,
    advisoryId: string,
  ): Promise<readonly WorkforceHumanDecisionRecord[]> {
    const rows = this.decisionsByAdvisory.get(advisoryId) ?? [];
    return rows.filter(r => r.tenant_id === tenantId);
  }
}

function createPilotHarness(overrides?: {
  synthetic?: Partial<SyntheticStagingPermissionConfig>;
  activeStage?: number;
}) {
  const store = new InMemoryTransactionalWorkforceStore();

  const actors = new Map<string, WorkforceActor>([
    [
      'tok_preparer',
      {
        uid: 'staff_prep_1',
        tenant_id: 'tenant_destria',
        role: 'accountant',
        status: 'active',
        assigned_case_ids: ['case_2025_100'],
      },
    ],
    [
      'tok_reviewer',
      {
        uid: 'staff_rev_1',
        tenant_id: 'tenant_destria',
        role: 'reviewer',
        status: 'active',
        assigned_case_ids: ['case_2025_100'],
      },
    ],
    [
      'tok_other_tenant',
      {
        uid: 'staff_other',
        tenant_id: 'tenant_other',
        role: 'reviewer',
        status: 'active',
        assigned_case_ids: ['case_2025_100'],
      },
    ],
    [
      'tok_unassigned',
      {
        uid: 'staff_unassigned',
        tenant_id: 'tenant_destria',
        role: 'reviewer',
        status: 'active',
        assigned_case_ids: [],
      },
    ],
  ]);

  let caseRecord: WorkforceCaseRecord = {
    ...BASE_SCOPE,
    case_record_id: 'rec_case_100',
    engagement_id: 'eng_100',
    active_stage: overrides?.activeStage ?? 3,
    status: 'ACTIVE',
    preparer_uid: 'staff_prep_1',
    reviewer_uid: 'staff_rev_1',
    client_uid: 'client_100',
  };

  let evidence: AuthorizedDocumentEvidence[] = [
    {
      source_id: SRC_1,
      document_record_id: DOC_REC_1,
      document_version: 1,
      source_hash: HASH_DUPLICATE,
      document_status: 'RELEASED',
      quarantine_status: 'CLEAN',
      ...BASE_SCOPE,
    },
    {
      source_id: SRC_2,
      document_record_id: DOC_REC_2,
      document_version: 1,
      source_hash: HASH_DUPLICATE,
      document_status: 'VERIFIED',
      quarantine_status: 'CLEAN',
      ...BASE_SCOPE,
    },
    {
      source_id: SRC_3,
      document_record_id: DOC_REC_3,
      document_version: 1,
      source_hash: HASH_UNIQUE,
      document_status: 'RELEASED',
      quarantine_status: 'CLEAN',
      ...BASE_SCOPE,
    },
  ];

  let killSwitches: KillSwitchState = {
    global_stop: false,
    stopped_agents: [],
    stopped_stages: [],
    stopped_tools: [],
  };

  let syntheticConfig: SyntheticStagingPermissionConfig = {
    allow_a10_synthetic_staging_decisions: false,
    ...overrides?.synthetic,
  };

  const env: WorkforceEnvironment = {
    async verifyActor(token) {
      return actors.get(token) ?? null;
    },
    async loadCase(tenantId, scope) {
      if (caseRecord.tenant_id !== tenantId || caseRecord.tax_case_id !== scope.tax_case_id) {
        return null;
      }
      return caseRecord;
    },
    async isStaffAssigned(actor, c) {
      return Boolean(actor.assigned_case_ids?.includes(c.tax_case_id));
    },
    async loadEvidence(tenantId, _scope, sourceIds) {
      return evidence.filter(e => e.tenant_id === tenantId && sourceIds.includes(e.source_id));
    },
    async getKillSwitches() {
      return killSwitches;
    },
    getOcrProviderConfig() {
      return { configured: false, approved_provider_id: null, provider_version: null, lineage_signing_enabled: false };
    },
    getSyntheticStagingConfig() {
      return syntheticConfig;
    },
    isLlmGatewayConfigured() {
      return false;
    },
  };

  return {
    store,
    env,
    service: new A10DuplicateWorkflowService(env, store),
    actors,
    setCase: (next: WorkforceCaseRecord) => {
      caseRecord = next;
    },
    setEvidence: (next: AuthorizedDocumentEvidence[]) => {
      evidence = next;
    },
    setKillSwitches: (next: KillSwitchState) => {
      killSwitches = next;
    },
    setSynthetic: (next: SyntheticStagingPermissionConfig) => {
      syntheticConfig = next;
    },
  };
}

describe('A10 Duplicate/Fraud Indicator Agent — End-to-End Stage Three Pilot', () => {
  it('runs the full Stage 3 workflow: submit -> idempotent repeat -> process -> inspect -> owner-gated decision', async () => {
    const h = createPilotHarness();

    // 1. Authorized evidence selection -> idempotent job submission
    const first = await h.service.submitDuplicateCheckJob('tok_preparer', {
      request_id: 'req-a10-1',
      scope: BASE_SCOPE,
      evidence_source_ids: [SRC_1, SRC_2, SRC_3],
    });
    expect(first.created).toBe(true);
    expect(first.job.status).toBe('QUEUED');
    expect(first.job.metadata_payload).toMatchObject({
      purpose: 'DOCUMENT_DUPLICATE_CHECK',
      evidence_count: 3,
    });

    // Repeated submission with identical evidence returns existing job (idempotent)
    const repeat = await h.service.submitDuplicateCheckJob('tok_preparer', {
      request_id: 'req-a10-2',
      scope: BASE_SCOPE,
      evidence_source_ids: [SRC_3, SRC_1, SRC_2],
    });
    expect(repeat.created).toBe(false);
    expect(repeat.job.job_id).toBe(first.job.job_id);

    // 2. Worker processes job and produces bounded advisory without assessing fraud or mutating records
    const processed = await h.service.processDuplicateCheckJob('tok_preparer', BASE_SCOPE.tenant_id, first.job.job_id);
    expect(processed.job.status).toBe('COMPLETED');
    expect(processed.advisory.agent_id).toBe('A10');
    expect(processed.advisory.human_review_required).toBe(true);
    expect(processed.advisory.authoritative_mutation).toBe(false);
    expect(processed.advisory.external_submission_allowed).toBe(false);
    expect(processed.advisory.required_reviewer_role).toBe('PENDING_OWNER_APPROVAL');
    expect(processed.advisory.structured_data).toMatchObject({
      fraud_assessed: false,
      authoritative_mutation: false,
      document_deletion_performed: false,
      tax_record_altered: false,
      duplicate_group_count: 1,
    });

    // 3. Stage Three staff inspection confirms live production decision is blocked pending owner approval
    const inspectionsLive = await h.service.getCaseDuplicateAdvisories('tok_reviewer', BASE_SCOPE);
    expect(inspectionsLive).toHaveLength(1);
    expect(inspectionsLive[0].stale_evidence).toBe(false);
    expect(inspectionsLive[0].live_decision_available).toBe(false);
    expect(inspectionsLive[0].live_decision_block_reason).toBe('A10_LIVE_DECISION_PENDING_OWNER_APPROVAL');

    // Live production decision fails closed with 503 pending owner approval
    await expect(
      h.service.recordDuplicateDecision('tok_reviewer', {
        request_id: 'req-dec-live',
        advisory_id: processed.advisory.advisory_id,
        scope: BASE_SCOPE,
        expected_evidence_fingerprint: processed.advisory.evidence_fingerprint,
        decision: 'ACKNOWLEDGE',
        rationale: 'Verified two identical W-2 uploads; keeping primary record only.',
      }),
    ).rejects.toMatchObject({
      code: 'A10_LIVE_DECISION_PENDING_OWNER_APPROVAL',
      status: 503,
    });

    // 4. Enable explicit synthetic staging permission and complete decision path
    h.setSynthetic({
      allow_a10_synthetic_staging_decisions: true,
      synthetic_reviewer_roles: ['reviewer', 'senior_reviewer'],
      approval_ticket_ref: 'STAGING-A10-TEST',
    });

    // Maker-checker blocks self-review by preparer who submitted job
    await expect(
      h.service.recordDuplicateDecision('tok_preparer', {
        request_id: 'req-dec-self',
        advisory_id: processed.advisory.advisory_id,
        scope: BASE_SCOPE,
        expected_evidence_fingerprint: processed.advisory.evidence_fingerprint,
        decision: 'ACKNOWLEDGE',
        rationale: 'Preparer attempting self-review must be denied.',
      }),
    ).rejects.toMatchObject({
      code: 'WORKFORCE_MAKER_CHECKER_SELF_REVIEW_DENIED',
      status: 403,
    });

    const reviewer = h.actors.get('tok_reviewer')!;
    const verify = vi.spyOn(h.env, 'verifyActor')
      .mockResolvedValueOnce(reviewer)
      .mockResolvedValueOnce({ ...reviewer, role: 'bookkeeper' });
    await expect(h.service.recordDuplicateDecision('tok_reviewer', {
      request_id: 'req-role-changed',
      advisory_id: processed.advisory.advisory_id,
      scope: BASE_SCOPE,
      expected_evidence_fingerprint: processed.advisory.evidence_fingerprint,
      decision: 'ACKNOWLEDGE',
      rationale: 'Synthetic role change during evidence review.',
    })).rejects.toMatchObject({ code: 'WORKFORCE_REVIEWER_ROLE_DENIED', status: 403 });
    verify.mockRestore();

    // Independent reviewer commits bound human decision
    const decision = await h.service.recordDuplicateDecision('tok_reviewer', {
      request_id: 'req-dec-1',
      advisory_id: processed.advisory.advisory_id,
      scope: BASE_SCOPE,
      expected_evidence_fingerprint: processed.advisory.evidence_fingerprint,
      decision: 'ACKNOWLEDGE',
      rationale: 'Confirmed duplicate W-2 upload in Stage Three; marked duplicate for staff follow-up without deleting audit trail.',
    });
    expect(decision.advisory_id).toBe(processed.advisory.advisory_id);
    expect(decision.bound_evidence_fingerprint).toBe(processed.advisory.evidence_fingerprint);
    expect(decision.reviewer_uid).toBe('staff_rev_1');
    expect(decision.synthetic_staging_gate_used).toBe(true);
    expect(decision.authoritative_mutation).toBe(false);

    // 5. Concurrent second decision conflicts atomically with 409
    await expect(
      h.service.recordDuplicateDecision('tok_reviewer', {
        request_id: 'req-dec-2',
        advisory_id: processed.advisory.advisory_id,
        scope: BASE_SCOPE,
        expected_evidence_fingerprint: processed.advisory.evidence_fingerprint,
        decision: 'ESCALATE',
        rationale: 'Second concurrent reviewer trying to overwrite existing human decision.',
      }),
    ).rejects.toMatchObject({
      code: 'CONCURRENT_DECISION_CONFLICT',
      status: 409,
    });
  });

  it('rejects revoked access, cross-tenant, unassigned staff, wrong stage, quarantined, unverified, superseded, and stale evidence', async () => {
    const h = createPilotHarness({
      synthetic: { allow_a10_synthetic_staging_decisions: true },
    });

    // Cross-tenant denied
    await expect(
      h.service.submitDuplicateCheckJob('tok_other_tenant', {
        request_id: 'req-x-tenant',
        scope: BASE_SCOPE,
        evidence_source_ids: [SRC_1, SRC_2],
      }),
    ).rejects.toMatchObject({ code: 'WORKFORCE_CROSS_TENANT_DENIED', status: 403 });

    // Unassigned staff denied
    await expect(
      h.service.submitDuplicateCheckJob('tok_unassigned', {
        request_id: 'req-unassigned',
        scope: BASE_SCOPE,
        evidence_source_ids: [SRC_1, SRC_2],
      }),
    ).rejects.toMatchObject({ code: 'WORKFORCE_STAFF_ASSIGNMENT_REQUIRED', status: 403 });

    // Wrong workflow stage denied (must be Stage 3)
    h.setCase({
      ...BASE_SCOPE,
      case_record_id: 'rec_case_100',
      engagement_id: 'eng_100',
      active_stage: 2,
      status: 'ACTIVE',
      preparer_uid: 'staff_prep_1',
      reviewer_uid: 'staff_rev_1',
      client_uid: 'client_100',
    });
    await expect(
      h.service.submitDuplicateCheckJob('tok_preparer', {
        request_id: 'req-wrong-stage',
        scope: BASE_SCOPE,
        evidence_source_ids: [SRC_1, SRC_2],
      }),
    ).rejects.toMatchObject({ code: 'WORKFORCE_STAGE_MISMATCH', status: 403 });

    // Restore Stage 3 and test quarantined / draft / superseded documents
    h.setCase({
      ...BASE_SCOPE,
      case_record_id: 'rec_case_100',
      engagement_id: 'eng_100',
      active_stage: 3,
      status: 'ACTIVE',
      preparer_uid: 'staff_prep_1',
      reviewer_uid: 'staff_rev_1',
      client_uid: 'client_100',
    });

    h.setEvidence([
      {
        source_id: SRC_1,
        document_record_id: DOC_REC_1,
        document_version: 1,
        source_hash: HASH_DUPLICATE,
        document_status: 'RELEASED',
        quarantine_status: 'QUARANTINED',
        ...BASE_SCOPE,
      },
    ]);
    await expect(
      h.service.submitDuplicateCheckJob('tok_preparer', {
        request_id: 'req-quarantined',
        scope: BASE_SCOPE,
        evidence_source_ids: [SRC_1],
      }),
    ).rejects.toMatchObject({ code: 'WORKFORCE_EVIDENCE_QUARANTINED', status: 403 });

    h.setEvidence([
      {
        source_id: SRC_1,
        document_record_id: DOC_REC_1,
        document_version: 1,
        source_hash: HASH_DUPLICATE,
        document_status: 'DRAFT',
        quarantine_status: 'CLEAN',
        ...BASE_SCOPE,
      },
    ]);
    await expect(
      h.service.submitDuplicateCheckJob('tok_preparer', {
        request_id: 'req-draft',
        scope: BASE_SCOPE,
        evidence_source_ids: [SRC_1],
      }),
    ).rejects.toMatchObject({ code: 'WORKFORCE_EVIDENCE_NOT_RELEASED', status: 403 });

    h.setEvidence([
      {
        source_id: SRC_1,
        document_record_id: DOC_REC_1,
        document_version: 1,
        source_hash: HASH_DUPLICATE,
        document_status: 'SUPERSEDED',
        quarantine_status: 'CLEAN',
        ...BASE_SCOPE,
      },
    ]);
    await expect(
      h.service.submitDuplicateCheckJob('tok_preparer', {
        request_id: 'req-superseded',
        scope: BASE_SCOPE,
        evidence_source_ids: [SRC_1],
      }),
    ).rejects.toMatchObject({ code: 'WORKFORCE_EVIDENCE_SUPERSEDED', status: 409 });

    // Restore clean evidence, submit + process, then mutate document version -> stale evidence conflict
    h.setEvidence([
      {
        source_id: SRC_1,
        document_record_id: DOC_REC_1,
        document_version: 1,
        source_hash: HASH_DUPLICATE,
        document_status: 'RELEASED',
        quarantine_status: 'CLEAN',
        ...BASE_SCOPE,
      },
      {
        source_id: SRC_2,
        document_record_id: DOC_REC_2,
        document_version: 1,
        source_hash: HASH_DUPLICATE,
        document_status: 'VERIFIED',
        quarantine_status: 'CLEAN',
        ...BASE_SCOPE,
      },
    ]);
    const submitted = await h.service.submitDuplicateCheckJob('tok_preparer', {
      request_id: 'req-stale-flow',
      scope: BASE_SCOPE,
      evidence_source_ids: [SRC_1, SRC_2],
    });
    const processed = await h.service.processDuplicateCheckJob('tok_preparer', BASE_SCOPE.tenant_id, submitted.job.job_id);

    // Mutate document version after advisory was created
    h.setEvidence([
      {
        source_id: SRC_1,
        document_record_id: DOC_REC_1,
        document_version: 2,
        source_hash: HASH_UNIQUE,
        document_status: 'RELEASED',
        quarantine_status: 'CLEAN',
        ...BASE_SCOPE,
      },
      {
        source_id: SRC_2,
        document_record_id: DOC_REC_2,
        document_version: 1,
        source_hash: HASH_DUPLICATE,
        document_status: 'VERIFIED',
        quarantine_status: 'CLEAN',
        ...BASE_SCOPE,
      },
    ]);

    const inspected = await h.service.getCaseDuplicateAdvisories('tok_reviewer', BASE_SCOPE);
    expect(inspected[0].stale_evidence).toBe(true);
    expect(inspected[0].stale_reason).toContain('EVIDENCE_VERSION_CHANGED');

    await expect(
      h.service.recordDuplicateDecision('tok_reviewer', {
        request_id: 'req-stale-dec',
        advisory_id: processed.advisory.advisory_id,
        scope: BASE_SCOPE,
        expected_evidence_fingerprint: processed.advisory.evidence_fingerprint,
        decision: 'ACKNOWLEDGE',
        rationale: 'Attempting to decide on stale evidence must be rejected.',
      }),
    ).rejects.toMatchObject({ code: 'STALE_EVIDENCE_CONFLICT', status: 409 });

    // Revoked session denied immediately
    h.actors.set('tok_reviewer', {
      uid: 'staff_rev_1',
      tenant_id: 'tenant_destria',
      role: 'reviewer',
      status: 'active',
      assigned_case_ids: ['case_2025_100'],
      session_revoked: true,
    });
    await expect(
      h.service.getCaseDuplicateAdvisories('tok_reviewer', BASE_SCOPE),
    ).rejects.toMatchObject({ code: 'WORKFORCE_SESSION_REVOKED', status: 401 });
  });

  it('SqlWorkforceStore issues parameterized queries with FOR UPDATE locking for atomic decision recording', async () => {
    const executedSql: { text: string; params: readonly unknown[] }[] = [];
    const store = new SqlWorkforceStore({
      async transaction<T>(fn: (sql: { query: <R>(text: string, params?: readonly unknown[]) => Promise<{ rows: R[] }> }) => Promise<T>) {
        return fn({
          async query<R>(text: string, params: readonly unknown[] = []) {
            executedSql.push({ text, params });
            if (text.includes('FOR UPDATE')) {
              return { rows: [{ advisory_id: 'adv-1', evidence_fingerprint: 'fp-1' }] as unknown as R[] };
            }
            if (text.includes('FROM ai_workforce_decisions')) {
              return { rows: [] as R[] };
            }
            return { rows: [] as R[] };
          },
        });
      },
    });

    const record: WorkforceHumanDecisionRecord = {
      decision_id: 'dec-1',
      advisory_id: 'adv-1',
      tenant_id: 'tenant_destria',
      client_id: 'client_100',
      tax_case_id: 'case_2025_100',
      tax_year: 2025,
      agent_id: 'A10',
      bound_evidence_fingerprint: 'fp-1',
      bound_evidence_versions: [],
      reviewer_uid: 'staff_rev_1',
      reviewer_role: 'reviewer',
      decision: 'ACKNOWLEDGE',
      rationale: 'SQL transactional lock verification rationale.',
      synthetic_staging_gate_used: true,
      authoritative_mutation: false,
      recorded_at: new Date().toISOString(),
    };

    await store.recordDecisionAtomic(record);
    expect(executedSql.some(q => q.text.includes('FOR UPDATE') && q.params[0] === 'tenant_destria')).toBe(true);
    expect(executedSql.some(q => q.text.includes('INSERT INTO ai_workforce_decisions'))).toBe(true);
  });
});
