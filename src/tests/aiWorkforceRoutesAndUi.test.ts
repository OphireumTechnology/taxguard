import express from 'express';
import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAiWorkforceRouter } from '../server/routes/ai-workforce.routes';
import {
  WorkforceError,
  type AuthorizedDocumentEvidence,
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
import { aiWorkforceService } from '../services/aiWorkforceService';
import { AiWorkforceMatrixView } from '../components/admin/AiWorkforceMatrixView';
import { StageThreeDuplicateAdvisoryPanel } from '../components/workspace/StageThreeDuplicateAdvisoryPanel';
import { CaseAiWorkforcePanel } from '../components/workspace/CaseAiWorkforcePanel';

const SCOPE: AICaseScope = {
  tenant_id: 'tenant_destria',
  client_id: 'client_300',
  tax_case_id: 'case_2025_300',
  tax_year: 2025,
};

const SRC_A = '44444444-4444-4444-8444-444444444444';
const SRC_B = '55555555-5555-4555-8555-555555555555';
const HASH_SAME = 'c'.repeat(64);

class RouteTestStore implements WorkforceStore {
  readonly jobs = new Map<string, WorkforceJobRecord>();
  readonly advisories = new Map<string, WorkforceAdvisoryOutput>();
  readonly decisions = new Map<string, WorkforceHumanDecisionRecord[]>();

  async createOrGetJob(job: Omit<WorkforceJobRecord, 'created_at' | 'updated_at'>) {
    for (const existing of this.jobs.values()) {
      if (existing.tenant_id === job.tenant_id && existing.agent_id === job.agent_id && existing.idempotency_key === job.idempotency_key) {
        return { job: existing, created: false };
      }
    }
    const now = new Date().toISOString();
    const created: WorkforceJobRecord = { ...job, created_at: now, updated_at: now };
    this.jobs.set(created.job_id, created);
    return { job: created, created: true };
  }
  async getJob(tenantId: string, jobId: string) {
    const j = this.jobs.get(jobId);
    return j && j.tenant_id === tenantId ? j : null;
  }
  async updateJobStatus(tenantId: string, jobId: string, status: WorkforceJobStatus, patch?: { advisory_id?: string | null; error_code?: string | null }) {
    const j = await this.getJob(tenantId, jobId);
    if (!j) throw new WorkforceError('WORKFORCE_JOB_NOT_FOUND', 404);
    const updated: WorkforceJobRecord = {
      ...j,
      status,
      advisory_id: patch?.advisory_id !== undefined ? patch.advisory_id : j.advisory_id,
      error_code: patch?.error_code !== undefined ? patch.error_code : j.error_code,
      updated_at: new Date().toISOString(),
    };
    this.jobs.set(jobId, updated);
    return updated;
  }
  async saveAdvisory(advisory: WorkforceAdvisoryOutput) {
    this.advisories.set(advisory.advisory_id, advisory);
    return advisory;
  }
  async getAdvisory(tenantId: string, advisoryId: string) {
    const adv = this.advisories.get(advisoryId);
    return adv && adv.scope.tenant_id === tenantId ? adv : null;
  }
  async listCaseAdvisories(tenantId: string, taxCaseId: string, agentId?: AgentId) {
    return [...this.advisories.values()].filter(
      a => a.scope.tenant_id === tenantId && a.scope.tax_case_id === taxCaseId && (!agentId || a.agent_id === agentId),
    );
  }
  async recordDecisionAtomic(decision: WorkforceHumanDecisionRecord) {
    const existing = this.decisions.get(decision.advisory_id) ?? [];
    if (existing.length > 0) throw new WorkforceError('CONCURRENT_DECISION_CONFLICT', 409);
    this.decisions.set(decision.advisory_id, [decision]);
    return decision;
  }
  async listAdvisoryDecisions(tenantId: string, advisoryId: string) {
    return (this.decisions.get(advisoryId) ?? []).filter(d => d.tenant_id === tenantId);
  }
}

describe('AI Workforce HTTP Routes & Website UI Integration', () => {
  let server: http.Server;
  let baseUrl = '';
  let allowSynthetic = false;

  const store = new RouteTestStore();
  const actors: Record<string, WorkforceActor> = {
    prep_tok: {
      uid: 'prep_300',
      tenant_id: SCOPE.tenant_id,
      role: 'accountant',
      status: 'active',
      assigned_case_ids: [SCOPE.tax_case_id],
    },
    rev_tok: {
      uid: 'rev_300',
      tenant_id: SCOPE.tenant_id,
      role: 'reviewer',
      status: 'active',
      assigned_case_ids: [SCOPE.tax_case_id],
    },
  };

  const evidence: AuthorizedDocumentEvidence[] = [
    {
      source_id: SRC_A,
      document_record_id: '44444444-aaaa-4444-8444-444444444444',
      document_version: 1,
      source_hash: HASH_SAME,
      document_status: 'RELEASED',
      quarantine_status: 'CLEAN',
      ...SCOPE,
    },
    {
      source_id: SRC_B,
      document_record_id: '55555555-bbbb-4555-8555-555555555555',
      document_version: 1,
      source_hash: HASH_SAME,
      document_status: 'VERIFIED',
      quarantine_status: 'CLEAN',
      ...SCOPE,
    },
  ];

  const env: WorkforceEnvironment = {
    async verifyActor(token) {
      return actors[token] ?? null;
    },
    async loadCase(tenantId, scope): Promise<WorkforceCaseRecord | null> {
      if (tenantId !== SCOPE.tenant_id || scope.tax_case_id !== SCOPE.tax_case_id) return null;
      return {
        ...SCOPE,
        case_record_id: 'rec_300',
        engagement_id: 'eng_300',
        active_stage: 3,
        status: 'ACTIVE',
        preparer_uid: 'prep_300',
        reviewer_uid: 'rev_300',
        client_uid: SCOPE.client_id,
      };
    },
    async isStaffAssigned(actor, c) {
      return Boolean(actor.assigned_case_ids?.includes(c.tax_case_id));
    },
    async loadEvidence(tenantId, _scope, sourceIds) {
      return evidence.filter(e => e.tenant_id === tenantId && sourceIds.includes(e.source_id));
    },
    async getKillSwitches() {
      return { global_stop: false, stopped_agents: [], stopped_stages: [], stopped_tools: [] };
    },
    getOcrProviderConfig() {
      return { configured: false, approved_provider_id: null, provider_version: null, lineage_signing_enabled: false };
    },
    getSyntheticStagingConfig() {
      return { allow_a10_synthetic_staging_decisions: allowSynthetic, synthetic_reviewer_roles: ['reviewer'] };
    },
    isLlmGatewayConfigured() {
      return false;
    },
  };

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      '/api/ai-workforce',
      createAiWorkforceRouter({
        getRuntime: () => ({ env, store }),
        authenticate: (req: any, _res, next) => {
          const auth = req.headers.authorization;
          req.token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : '';
          req.user = { tenantId: SCOPE.tenant_id };
          next();
        },
      }),
    );

    await new Promise<void>(resolve => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}/api/ai-workforce`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close(err => (err ? reject(err) : resolve()));
    });
  });

  it('serves the 61-row matrix over GET /matrix with honest lifecycle totals', async () => {
    const res = await fetch(`${baseUrl}/matrix`, { headers: { Authorization: 'Bearer prep_tok' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.rows).toHaveLength(61);
    expect(body.totals).toEqual({
      totalRows: 61,
      designed: 61,
      locallyImplemented: 60,
      reservedFailClosed: 1,
      websiteIntegrated: 60,
      stagingAccepted: 0,
      productionCommissioned: 0,
    });
  });

  it('executes bounded agents over HTTP and fails closed on reserved A39', async () => {
    const resA00 = await fetch(`${baseUrl}/agents/A00/execute`, {
      method: 'POST',
      headers: { Authorization: 'Bearer prep_tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: 'http-a00-1',
        scope: SCOPE,
        workflow_stage: 3,
        evidence_source_ids: [],
        payload: {},
      }),
    });
    expect(resA00.status).toBe(201);
    const bodyA00 = (await resA00.json()) as any;
    expect(bodyA00.advisory.agent_id).toBe('A00');
    expect(bodyA00.advisory.human_review_required).toBe(true);

    const resA39 = await fetch(`${baseUrl}/agents/A39/execute`, {
      method: 'POST',
      headers: { Authorization: 'Bearer prep_tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: 'http-a39-1',
        scope: SCOPE,
        workflow_stage: 3,
        evidence_source_ids: [],
        payload: {},
      }),
    });
    expect(resA39.status).toBe(503);
    const bodyA39 = (await resA39.json()) as any;
    expect(bodyA39.code).toBe('AI_AGENT_RESERVED_PENDING_OWNER_DEFINITION');
  });

  it('completes the A10 HTTP workflow including live 503 block, synthetic 201 commit, and 409 conflict', async () => {
    const subRes = await fetch(`${baseUrl}/a10/jobs`, {
      method: 'POST',
      headers: { Authorization: 'Bearer prep_tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: 'http-a10-sub',
        scope: SCOPE,
        evidence_source_ids: [SRC_A, SRC_B],
      }),
    });
    expect(subRes.status).toBe(201);
    const subBody = (await subRes.json()) as any;
    expect(subBody.created).toBe(true);

    const procRes = await fetch(`${baseUrl}/a10/jobs/${subBody.job.job_id}/process`, {
      method: 'POST',
      headers: { Authorization: 'Bearer prep_tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: SCOPE.tenant_id }),
    });
    expect(procRes.status).toBe(200);
    const procBody = (await procRes.json()) as any;
    expect(procBody.advisory.structured_data.duplicate_group_count).toBe(1);

    const listRes = await fetch(
      `${baseUrl}/cases/${SCOPE.tax_case_id}/advisories?tenant_id=${SCOPE.tenant_id}&client_id=${SCOPE.client_id}&tax_year=${SCOPE.tax_year}&agent_id=A10`,
      { headers: { Authorization: 'Bearer rev_tok' } },
    );
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as any;
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0].live_decision_available).toBe(false);

    // Live blocked with 503
    const liveDecRes = await fetch(`${baseUrl}/advisories/${procBody.advisory.advisory_id}/decisions`, {
      method: 'POST',
      headers: { Authorization: 'Bearer rev_tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: 'http-dec-live',
        agent_id: 'A10',
        scope: SCOPE,
        expected_evidence_fingerprint: procBody.advisory.evidence_fingerprint,
        decision: 'ACKNOWLEDGE',
        rationale: 'Live production decision must be blocked pending owner approval.',
      }),
    });
    expect(liveDecRes.status).toBe(503);

    // Synthetic staging enabled -> 201 then 409 conflict
    allowSynthetic = true;
    const synthDecRes = await fetch(`${baseUrl}/advisories/${procBody.advisory.advisory_id}/decisions`, {
      method: 'POST',
      headers: { Authorization: 'Bearer rev_tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: 'http-dec-synth',
        agent_id: 'A10',
        scope: SCOPE,
        expected_evidence_fingerprint: procBody.advisory.evidence_fingerprint,
        decision: 'ACKNOWLEDGE',
        rationale: 'Synthetic staging test verification of A10 decision persistence.',
      }),
    });
    expect(synthDecRes.status).toBe(201);

    const reopened = await fetch(
      `${baseUrl}/cases/${SCOPE.tax_case_id}/advisories?tenant_id=${SCOPE.tenant_id}&client_id=${SCOPE.client_id}&tax_year=${SCOPE.tax_year}&agent_id=A10`,
      { headers: { Authorization: 'Bearer rev_tok' } },
    );
    expect(reopened.status).toBe(200);
    expect(await reopened.json()).toMatchObject({ items: [{
      live_decision_available: false,
      live_decision_block_reason: 'CONCURRENT_DECISION_CONFLICT',
      decisions: [{
        decision: 'ACKNOWLEDGE',
        reviewer_uid: 'rev_300',
        bound_evidence_fingerprint: procBody.advisory.evidence_fingerprint,
      }],
    }] });

    const conflictRes = await fetch(`${baseUrl}/advisories/${procBody.advisory.advisory_id}/decisions`, {
      method: 'POST',
      headers: { Authorization: 'Bearer rev_tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: 'http-dec-conflict',
        agent_id: 'A10',
        scope: SCOPE,
        expected_evidence_fingerprint: procBody.advisory.evidence_fingerprint,
        decision: 'ESCALATE',
        rationale: 'Concurrent duplicate decision must return 409 conflict.',
      }),
    });
    expect(conflictRes.status).toBe(409);
  });

  it('exports frontend service and website UI panels cleanly', () => {
    expect(typeof aiWorkforceService.getMatrix).toBe('function');
    expect(typeof aiWorkforceService.executeAgent).toBe('function');
    expect(typeof aiWorkforceService.submitA10Job).toBe('function');
    expect(typeof aiWorkforceService.processA10Job).toBe('function');
    expect(typeof aiWorkforceService.listA10CaseAdvisories).toBe('function');
    expect(typeof aiWorkforceService.recordDecision).toBe('function');
    expect(typeof AiWorkforceMatrixView).toBe('function');
    expect(typeof StageThreeDuplicateAdvisoryPanel).toBe('function');
    expect(typeof CaseAiWorkforcePanel).toBe('function');
  });
});
