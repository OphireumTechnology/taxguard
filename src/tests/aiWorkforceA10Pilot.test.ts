import { PgWorkforceEnvironment } from '../server/ai/workforce/productionWorkforceEnvironment';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
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

  async completeA10Job(advisory: WorkforceAdvisoryOutput & { job_id: string }): Promise<WorkforceJobRecord> {
    const job = await this.updateJobStatus(advisory.scope.tenant_id, advisory.job_id, 'COMPLETED', {
      advisory_id: advisory.advisory_id, error_code: null,
    });
    await this.saveAdvisory(advisory);
    return job;
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
  store?: SqlWorkforceStore;
}) {
  const store = overrides?.store ?? new InMemoryTransactionalWorkforceStore();

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
  it('matches a custom retry key only to the same evidence selection', async () => {
    const h = createPilotHarness();
    const input = { request_id: 'custom-key', scope: BASE_SCOPE, evidence_source_ids: [SRC_1, SRC_2], idempotency_key: 'review-retry' };
    const first = await h.service.submitDuplicateCheckJob('tok_preparer', input);
    const retry = await h.service.submitDuplicateCheckJob('tok_preparer', input);
    expect(retry).toEqual({ job: first.job, created: false });
    await expect(h.service.submitDuplicateCheckJob('tok_preparer', { ...input, evidence_source_ids: [SRC_3] }))
      .rejects.toMatchObject({ code: 'WORKFORCE_IDEMPOTENCY_CONFLICT', status: 409 });
  });

  it('does not save an advisory after the case leaves Stage Three during processing', async () => {
    const h = createPilotHarness();
    const { job } = await h.service.submitDuplicateCheckJob('tok_preparer', {
      request_id: 'advanced-case', scope: BASE_SCOPE, evidence_source_ids: [SRC_1, SRC_2],
    });
    const activeCase = (await h.env.loadCase(BASE_SCOPE.tenant_id, BASE_SCOPE))!;
    vi.spyOn(h.env, 'loadCase').mockResolvedValueOnce(activeCase)
      .mockResolvedValueOnce({ ...activeCase, active_stage: 4 });

    await expect(h.service.processDuplicateCheckJob('tok_preparer', BASE_SCOPE.tenant_id, job.job_id))
      .rejects.toMatchObject({ code: 'WORKFORCE_STAGE_MISMATCH' });
    expect(await h.store.listCaseAdvisories(BASE_SCOPE.tenant_id, BASE_SCOPE.tax_case_id, 'A10')).toEqual([]);
  });

  it('does not save the advisory if the worker session is revoked during processing', async () => {
    const h = createPilotHarness();
    const { job } = await h.service.submitDuplicateCheckJob('tok_preparer', {
      request_id: 'revoked-worker', scope: BASE_SCOPE, evidence_source_ids: [SRC_1, SRC_2],
    });
    const actor = h.actors.get('tok_preparer')!;
    const verify = h.env.verifyActor.bind(h.env);
    vi.spyOn(h.env, 'verifyActor').mockImplementationOnce(verify)
      .mockResolvedValueOnce({ ...actor, session_revoked: true });

    await expect(h.service.processDuplicateCheckJob('tok_preparer', BASE_SCOPE.tenant_id, job.job_id))
      .rejects.toMatchObject({ code: 'WORKFORCE_SESSION_REVOKED', status: 401 });
    expect(await h.store.listCaseAdvisories(BASE_SCOPE.tenant_id, BASE_SCOPE.tax_case_id, 'A10')).toEqual([]);
    const retried = await h.service.processDuplicateCheckJob('tok_preparer', BASE_SCOPE.tenant_id, job.job_id);
    expect(retried.job.status).toBe('COMPLETED');
  });

  it('refuses to generate an advisory when the queued evidence fingerprint is missing', async () => {
    const h = createPilotHarness();
    const { job } = await h.service.submitDuplicateCheckJob('tok_preparer', {
      request_id: 'missing-fingerprint', scope: BASE_SCOPE, evidence_source_ids: [SRC_1, SRC_2],
    });
    const { evidence_fingerprint: _, ...metadata } = job.metadata_payload;
    vi.spyOn(h.store, 'getJob').mockResolvedValueOnce({ ...job, metadata_payload: metadata });

    await expect(h.service.processDuplicateCheckJob('tok_preparer', BASE_SCOPE.tenant_id, job.job_id))
      .rejects.toMatchObject({ code: 'STALE_EVIDENCE_CONFLICT', status: 409 });
    expect(await h.store.listCaseAdvisories(BASE_SCOPE.tenant_id, BASE_SCOPE.tax_case_id, 'A10')).toEqual([]);
    expect((await h.store.getJob(BASE_SCOPE.tenant_id, job.job_id))?.status).toBe('STALE');
  });

  it('keeps stale jobs terminal and allows a new check against updated evidence', async () => {
    const h = createPilotHarness();
    const submit = () => h.service.submitDuplicateCheckJob('tok_preparer', {
      request_id: 'stale-job-test',
      scope: BASE_SCOPE,
      evidence_source_ids: [SRC_1, SRC_2],
    });
    const { job } = await submit();
    const evidence = await h.env.loadEvidence(BASE_SCOPE.tenant_id, BASE_SCOPE, [SRC_1, SRC_2]);
    h.setEvidence(evidence.map(row => ({ ...row, document_version: row.document_version + 1 })));
    const process = () => h.service.processDuplicateCheckJob('tok_preparer', BASE_SCOPE.tenant_id, job.job_id);

    await expect(process()).rejects.toMatchObject({ code: 'STALE_EVIDENCE_CONFLICT' });
    expect(await h.store.getJob(BASE_SCOPE.tenant_id, job.job_id)).toMatchObject({ status: 'STALE' });

    const update = vi.spyOn(h.store, 'updateJobStatus');
    await expect(process()).rejects.toMatchObject({ code: 'STALE_EVIDENCE_CONFLICT' });
    expect(update).not.toHaveBeenCalled();
    const replacement = await submit();
    expect(replacement.created).toBe(true);
    expect(replacement.job.job_id).not.toBe(job.job_id);
  });

  it('only inspects advisories in the authorized client and tax year', async () => {
    const h = createPilotHarness();
    const { job } = await h.service.submitDuplicateCheckJob('tok_preparer', {
      request_id: 'scope-filter-job',
      scope: BASE_SCOPE,
      evidence_source_ids: [SRC_1, SRC_2],
    });
    const { advisory } = await h.service.processDuplicateCheckJob('tok_preparer', BASE_SCOPE.tenant_id, job.job_id);
    vi.spyOn(h.store, 'listCaseAdvisories').mockResolvedValue([
      { ...advisory, advisory_id: 'wrong-year', scope: { ...BASE_SCOPE, tax_year: BASE_SCOPE.tax_year - 1 } },
      { ...advisory, advisory_id: 'wrong-client', scope: { ...BASE_SCOPE, client_id: 'former-client' } },
      advisory,
    ]);
    const decisions = vi.spyOn(h.store, 'listAdvisoryDecisions');

    const inspection = await h.service.getCaseDuplicateAdvisories('tok_reviewer', BASE_SCOPE);

    expect(inspection.map(item => item.advisory.advisory_id)).toEqual([advisory.advisory_id]);
    expect(decisions.mock.calls).toEqual([[BASE_SCOPE.tenant_id, advisory.advisory_id]]);
  });

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

    await expect(h.service.processDuplicateCheckJob('tok_unassigned', BASE_SCOPE.tenant_id, first.job.job_id))
      .rejects.toMatchObject({ code: 'WORKFORCE_STAFF_ASSIGNMENT_REQUIRED', status: 403 });
    expect(await h.store.getJob(BASE_SCOPE.tenant_id, first.job.job_id)).toEqual(first.job);

    // 2. Worker processes job and produces bounded advisory without assessing fraud or mutating records
    const processed = await h.service.processDuplicateCheckJob('tok_preparer', BASE_SCOPE.tenant_id, first.job.job_id);
    expect(processed.job.status).toBe('COMPLETED');
    await expect(h.service.processDuplicateCheckJob('tok_unassigned', BASE_SCOPE.tenant_id, first.job.job_id))
      .rejects.toMatchObject({ code: 'WORKFORCE_STAFF_ASSIGNMENT_REQUIRED', status: 403 });
    const replay = await h.service.processDuplicateCheckJob('tok_preparer', BASE_SCOPE.tenant_id, first.job.job_id);
    expect(replay).toEqual(processed);
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

    const [makerInspection] = await h.service.getCaseDuplicateAdvisories('tok_preparer', BASE_SCOPE);
    expect(makerInspection).toMatchObject({
      live_decision_available: false,
      live_decision_block_reason: 'WORKFORCE_MAKER_CHECKER_SELF_REVIEW_DENIED',
    });
    const [reviewerInspection] = await h.service.getCaseDuplicateAdvisories('tok_reviewer', BASE_SCOPE);
    expect(reviewerInspection).toMatchObject({
      live_decision_available: true,
      live_decision_block_reason: null,
    });

    const activeCase = (await h.env.loadCase(BASE_SCOPE.tenant_id, BASE_SCOPE))!;
    h.setCase({ ...activeCase, active_stage: 4 });
    const [advancedInspection] = await h.service.getCaseDuplicateAdvisories('tok_reviewer', BASE_SCOPE);
    expect(advancedInspection).toMatchObject({
      advisory: { advisory_id: processed.advisory.advisory_id },
      live_decision_available: false,
      live_decision_block_reason: 'WORKFORCE_STAGE_MISMATCH',
    });
    h.setCase(activeCase);

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

  it.each([
    ['production', 'true', false],
    ['test', '', false],
    ['test', 'true', true],
  ] as const)('checks the A10 synthetic gate in %s with flag %j', (nodeEnv, flag, expected) => {
    vi.stubEnv('NODE_ENV', nodeEnv);
    vi.stubEnv('TAXGUARD_ALLOW_A10_SYNTHETIC_STAGING_DECISIONS', flag);
    try {
      const env = new PgWorkforceEnvironment({
        async transaction() { throw new Error('Unexpected SQL query'); },
      }, async () => null);
      expect(env.getSyntheticStagingConfig().allow_a10_synthetic_staging_decisions).toBe(expected);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('requires the designated reviewer and a matching active SQL case assignment', async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE TABLE taxguard_case_assignments (
          id integer, tenant_id text, case_id text, uid text, role text, active boolean, assigned_at timestamptz
        );
        CREATE TABLE taxguard_staff_assignments (
          tenant_id text, user_id text, client_id text, engagement_id text, tax_year integer, role text,
          status text, effective_from timestamptz, effective_to timestamptz
        );
        CREATE TABLE taxguard_clients (tenant_id text, client_id text, status text);
      `);
      const harness = createPilotHarness();
      const actor = harness.actors.get('tok_reviewer')!;
      const record = (await harness.env.loadCase(BASE_SCOPE.tenant_id, BASE_SCOPE))!;
      await db.query("INSERT INTO taxguard_case_assignments VALUES (1, $1, $2, $3, 'reviewer', true, now())",
        [record.tenant_id, record.tax_case_id, actor.uid]);
      await db.query("INSERT INTO taxguard_staff_assignments VALUES ($1, $2, $3, $4, $5, 'reviewer', 'ACTIVE', now(), NULL)",
        [record.tenant_id, actor.uid, record.client_id, record.engagement_id, record.tax_year]);
      await db.query("INSERT INTO taxguard_clients VALUES ($1, $2, 'active')", [record.tenant_id, record.client_id]);
      const env = new PgWorkforceEnvironment({
        transaction: run => db.transaction(tx => run({
          query: (sql, values) => tx.query(sql, [...(values ?? [])]),
        })),
      }, async () => null);
      expect(await env.isStaffAssigned(actor, record)).toBe(true);
      expect(await env.isStaffAssigned(actor, { ...record, reviewer_uid: 'other-reviewer' })).toBe(false);
      await db.exec("UPDATE taxguard_case_assignments SET role = 'preparer'");
      expect(await env.isStaffAssigned(actor, record)).toBe(false);
      await db.exec("UPDATE taxguard_case_assignments SET role = 'reviewer', active = false");
      expect(await env.isStaffAssigned(actor, record)).toBe(false);
    } finally {
      await db.close();
    }
  });

  it('loads only enabled stop controls for the selected tenant through the SQL adapter', async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE TABLE ai_kill_switches (
          tenant_id text, scope text, agent_id text, tool_id text, workflow_stage integer, enabled boolean
        );
        INSERT INTO ai_kill_switches VALUES
          ('tenant_destria', 'AGENT', 'A10', NULL, NULL, true),
          ('tenant_destria', 'TOOL', NULL, 'document.read', NULL, true),
          ('tenant_destria', 'WORKFLOW', NULL, NULL, 3, true),
          ('tenant_destria', 'GLOBAL', NULL, NULL, NULL, false),
          ('tenant_other', 'GLOBAL', NULL, NULL, NULL, true);
      `);
      const env = new PgWorkforceEnvironment({
        transaction: run => db.transaction(tx => run({
          query: (sql, values) => tx.query(sql, [...(values ?? [])]),
        })),
      }, async () => null);
      expect(await env.getKillSwitches(BASE_SCOPE.tenant_id)).toEqual({
        global_stop: false,
        stopped_agents: ['A10'],
        stopped_tools: ['document.read'],
        stopped_stages: [3],
      });
    } finally {
      await db.close();
    }
  });

  it('loads evidence only while the vault version and hash match the source pin', async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE TABLE taxguard_documents (
          id uuid PRIMARY KEY, version integer, hash text, status text, quarantine_status text,
          tenant_id text, client_id text, case_id text, tax_year integer
        );
        CREATE TABLE ai_evidence_sources (
          source_id uuid PRIMARY KEY, document_record_id uuid, document_version integer,
          source_hash text, tenant_id text, client_id text, tax_case_id text, tax_year integer
        );
      `);
      const { tenant_id, client_id, tax_case_id, tax_year } = BASE_SCOPE;
      const params = [DOC_REC_1, HASH_DUPLICATE, tenant_id, client_id, tax_case_id, tax_year];
      await db.query("INSERT INTO taxguard_documents VALUES ($1, 1, $2, 'RELEASED', 'CLEAN', $3, $4, $5, $6)", params);
      await db.query('INSERT INTO ai_evidence_sources VALUES ($7, $1, 1, $2, $3, $4, $5, $6)', [...params, SRC_1]);
      const env = new PgWorkforceEnvironment({
        transaction: run => db.transaction(tx => run({
          query: (sql, values) => tx.query(sql, [...(values ?? [])]),
        })),
      }, async () => null);
      const load = () => env.loadEvidence(tenant_id, BASE_SCOPE, [SRC_1]);
      expect(await load()).toMatchObject([{ source_id: SRC_1, document_version: 1 }]);

      await db.exec('UPDATE taxguard_documents SET version = 2');
      expect(await load()).toEqual([]);
      await db.query('UPDATE taxguard_documents SET version = 1, hash = $1', [HASH_UNIQUE]);
      expect(await load()).toEqual([]);
    } finally {
      await db.close();
    }
  });

  it('persists the exact reviewed evidence versions through the migrated SQL store', async () => {
    const db = new PGlite();
    try {
      await db.exec(readFileSync('supabase/migrations/20261122120000_ai_workforce_jobs_and_decisions.sql', 'utf8'));
      let failCompletion = false;
      const store = new SqlWorkforceStore({
        transaction: run => db.transaction(tx => run({
          query: (sql, params) => {
            if (failCompletion && sql.includes('UPDATE ai_workforce_jobs') && params?.[2] === 'COMPLETED') {
              throw new Error('synthetic completion failure');
            }
            return tx.query(sql, [...(params ?? [])]);
          },
        })),
      });
      const { service } = createPilotHarness({
        store,
        synthetic: { allow_a10_synthetic_staging_decisions: true },
      });
      const submission = {
        request_id: 'sql-pilot-submit', scope: BASE_SCOPE, evidence_source_ids: [SRC_1, SRC_2],
      };
      const { job } = await service.submitDuplicateCheckJob('tok_preparer', submission);
      const repeated = await service.submitDuplicateCheckJob('tok_preparer', submission);
      expect(repeated).toMatchObject({ created: false, job: { job_id: job.job_id } });
      failCompletion = true;
      await expect(service.processDuplicateCheckJob('tok_preparer', BASE_SCOPE.tenant_id, job.job_id))
        .rejects.toThrow('synthetic completion failure');
      expect(await store.listCaseAdvisories(BASE_SCOPE.tenant_id, BASE_SCOPE.tax_case_id, 'A10')).toEqual([]);
      failCompletion = false;
      const { advisory } = await service.processDuplicateCheckJob('tok_preparer', BASE_SCOPE.tenant_id, job.job_id);
      const review = {
        request_id: 'sql-pilot-review', scope: BASE_SCOPE, advisory_id: advisory.advisory_id,
        expected_evidence_fingerprint: advisory.evidence_fingerprint,
        decision: 'ACKNOWLEDGE' as const, rationale: 'Reviewed both synthetic evidence versions.',
      };
      const decisions = await Promise.allSettled([
        service.recordDuplicateDecision('tok_reviewer', review),
        service.recordDuplicateDecision('tok_reviewer', { ...review, request_id: 'sql-pilot-second-review' }),
      ]);
      expect(decisions.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      expect(decisions.filter(result => result.status === 'rejected')).toMatchObject([
        { reason: { code: 'CONCURRENT_DECISION_CONFLICT', status: 409 } },
      ]);
      const [inspection] = await service.getCaseDuplicateAdvisories('tok_reviewer', BASE_SCOPE);
      expect(inspection.decisions).toMatchObject([{
        bound_evidence_fingerprint: advisory.evidence_fingerprint,
        bound_evidence_versions: advisory.evidence_pins,
        reviewer_uid: 'staff_rev_1',
      }]);
    } finally {
      await db.close();
    }
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
