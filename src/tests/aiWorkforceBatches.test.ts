import { describe, expect, it } from 'vitest';
import {
  ALL_WORKFORCE_AGENT_SPECS,
  WorkforceDispatcher,
} from '../server/ai/workforce/WorkforceDispatcher';
import { invokeApprovedGateway } from '../server/ai/workforce/gatewayBridge';
import {
  WorkforceError,
  type AuthorizedDocumentEvidence,
  type KillSwitchState,
  type OcrProviderConfig,
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

const DOC_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DOC_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const HASH_A = '1'.repeat(64);
const HASH_B = '2'.repeat(64);

const SCOPE: AICaseScope = {
  tenant_id: 'tenant_destria',
  client_id: 'client_200',
  tax_case_id: 'case_2025_200',
  tax_year: 2025,
};

class BatchTestStore implements WorkforceStore {
  readonly advisories = new Map<string, WorkforceAdvisoryOutput>();
  readonly decisions = new Map<string, WorkforceHumanDecisionRecord[]>();

  async createOrGetJob(job: Omit<WorkforceJobRecord, 'created_at' | 'updated_at'>) {
    const now = new Date().toISOString();
    return { job: { ...job, created_at: now, updated_at: now }, created: true };
  }
  async getJob() {
    return null;
  }
  async updateJobStatus(_t: string, _j: string, _s: WorkforceJobStatus): Promise<WorkforceJobRecord> {
    throw new WorkforceError('WORKFORCE_JOB_NOT_FOUND', 404);
  }
  async completeA10Job(advisory: WorkforceAdvisoryOutput & { job_id: string }): Promise<WorkforceJobRecord> {
    throw new Error('A10 is outside this test store');
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

function createDispatcherHarness() {
  const store = new BatchTestStore();
  let activeStage = 3;
  let killSwitches: KillSwitchState = {
    global_stop: false,
    stopped_agents: [],
    stopped_stages: [],
    stopped_tools: [],
  };
  let ocrConfig: OcrProviderConfig = {
    configured: false,
    approved_provider_id: null,
    provider_version: null,
    lineage_signing_enabled: false,
  };

  const actors: Record<string, WorkforceActor> = {
    cpa_exec: {
      uid: 'staff_cpa_exec',
      tenant_id: 'tenant_destria',
      role: 'cpa',
      status: 'active',
      assigned_case_ids: [SCOPE.tax_case_id],
    },
    cpa_reviewer: {
      uid: 'staff_cpa_rev',
      tenant_id: 'tenant_destria',
      role: 'cpa',
      status: 'active',
      assigned_case_ids: [SCOPE.tax_case_id],
    },
    admin_exec: {
      uid: 'staff_admin_exec',
      tenant_id: 'tenant_destria',
      role: 'admin',
      status: 'active',
      assigned_case_ids: [SCOPE.tax_case_id],
    },
    compliance_reviewer: {
      uid: 'staff_compliance_rev',
      tenant_id: 'tenant_destria',
      role: 'compliance',
      status: 'active',
      assigned_case_ids: [SCOPE.tax_case_id],
    },
    operations_exec: {
      uid: 'staff_ops_exec',
      tenant_id: 'tenant_destria',
      role: 'operations',
      status: 'active',
      assigned_case_ids: [SCOPE.tax_case_id],
    },
    other_tenant: {
      uid: 'staff_external',
      tenant_id: 'tenant_other',
      role: 'cpa',
      status: 'active',
      assigned_case_ids: [SCOPE.tax_case_id],
    },
  };

  const evidence: AuthorizedDocumentEvidence[] = [
    {
      source_id: DOC_1,
      document_record_id: 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa',
      document_version: 1,
      source_hash: HASH_A,
      document_status: 'RELEASED',
      quarantine_status: 'CLEAN',
      ...SCOPE,
    },
    {
      source_id: DOC_2,
      document_record_id: 'bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb',
      document_version: 1,
      source_hash: HASH_B,
      document_status: 'VERIFIED',
      quarantine_status: 'CLEAN',
      ...SCOPE,
    },
  ];

  let evidenceLoads = 0;
  const env: WorkforceEnvironment = {
    async verifyActor(token) {
      return actors[token] ?? null;
    },
    async loadCase(tenantId, scope): Promise<WorkforceCaseRecord | null> {
      if (tenantId !== SCOPE.tenant_id || scope.tax_case_id !== SCOPE.tax_case_id) return null;
      return {
        ...SCOPE,
        case_record_id: 'case_rec_200',
        engagement_id: 'eng_200',
        active_stage: activeStage,
        status: 'ACTIVE',
        preparer_uid: 'staff_cpa_exec',
        reviewer_uid: 'staff_cpa_rev',
        client_uid: SCOPE.client_id,
      };
    },
    async isStaffAssigned(actor, c) {
      return Boolean(actor.assigned_case_ids?.includes(c.tax_case_id));
    },
    async loadEvidence(tenantId, _scope, sourceIds) {
      evidenceLoads += 1;
      return evidence.filter(e => e.tenant_id === tenantId && sourceIds.includes(e.source_id));
    },
    async getKillSwitches() {
      return killSwitches;
    },
    getOcrProviderConfig() {
      return ocrConfig;
    },
    getSyntheticStagingConfig() {
      return { allow_a10_synthetic_staging_decisions: true, synthetic_reviewer_roles: ['cpa', 'reviewer'] };
    },
    isLlmGatewayConfigured() {
      return false;
    },
  };

  return {
    dispatcher: new WorkforceDispatcher(env, store),
    evidenceLoads: () => evidenceLoads,
    store,
    setStage: (s: number) => {
      activeStage = s;
    },
    setKillSwitches: (ks: KillSwitchState) => {
      killSwitches = ks;
    },
    setOcrConfig: (cfg: OcrProviderConfig) => {
      ocrConfig = cfg;
    },
  };
}

describe('TaxGuard 6-Batch Workforce Execution (All 61 Agents A00–A60)', () => {
  it('executes every active agent across Batches 1–6 deterministically and enforces fail-closed A39', async () => {
    const h = createDispatcherHarness();
    let executedCount = 0;

    for (const spec of ALL_WORKFORCE_AGENT_SPECS) {
      const stage = spec.workflow_stages[0] ?? 1;
      h.setStage(stage);

      const execToken = spec.allowed_roles.includes('cpa')
        ? 'cpa_exec'
        : spec.allowed_roles.includes('admin')
          ? 'admin_exec'
          : 'operations_exec';

      const PAYLOAD_BY_AGENT: Partial<Record<AgentId, Record<string, unknown>>> = {
        A13: { bank_ending_balance_cents: 500000, ledger_ending_balance_cents: 500000 },
        A14: {
          lines: [
            { account_code: '1010-Cash', debit_cents: 150000, credit_cents: 0 },
            { account_code: '4000-Revenue', debit_cents: 0, credit_cents: 150000 },
          ],
        },
        A15: {
          total_assets_cents: 1000000,
          total_liabilities_cents: 400000,
          total_equity_cents: 600000,
          total_revenue_cents: 800000,
          total_expenses_cents: 500000,
        },
        A16: { book_net_income_cents: 300000, business_meals_cents: 20000 },
        A17: { tax_issue: 'Ordinary business expense deductibility', authority_citations: ['IRC § 162(a)'] },
        A18: { filing_status: 'SINGLE', gross_income_cents: 9500000 },
        A20: { entity_type: 'S_CORP', owner_count: 2 },
        A24: { cost_basis_cents: 1000000, recovery_period_years: 5 },
        A25: { form_941_total_wages_cents: 25000000, form_w3_total_wages_cents: 25000000 },
        A27: { baseline_tax_cents: 2200000, scenario_tax_cents: 1950000 },
        A28: { computed_total_tax_cents: 1800000, total_payments_and_credits_cents: 1900000, reported_refund_cents: 100000 },
        A38: { included_forms: ['FORM_1040', 'SCHEDULE_B'] },
        A40: { rejection_code: 'IND-031-04' },
        A41: { notice_code: 'CP2000', notice_date: '2026-04-01' },
        A42: { original_tax_cents: 1500000, corrected_tax_cents: 1620000, amendment_reason: 'Late-received corrected 1099-B brokerage statement' },
        A43: { topic: 'Missing 1099-INT statement', requested_items: ['2025 Form 1099-INT'] },
        A44: { preferred_slots_iso: ['2026-05-01T14:00:00Z'], meeting_purpose: 'Tax Review Consultation' },
        A45: { task_title: 'Verify Schedule K-1 basis carryforward' },
        A47: { line_items: [{ description: 'Form 1040 Preparation', amount_cents: 75000 }] },
        A48: { invoice_total_cents: 75000, payments_received_cents: 75000 },
      };

      const basePayload: Record<string, unknown> = PAYLOAD_BY_AGENT[spec.agent_id] ?? {};

      if (spec.agent_id === 'A39') {
        await expect(
          h.dispatcher.executeAgent(execToken, {
            request_id: `req-${spec.agent_id}`,
            agent_id: 'A39',
            scope: SCOPE,
            workflow_stage: stage,
            evidence_source_ids: [],
            payload: {},
          }),
        ).rejects.toMatchObject({
          code: 'AI_AGENT_RESERVED_PENDING_OWNER_DEFINITION',
          status: 503,
        });
        continue;
      }

      const advisory = await h.dispatcher.executeAgent(execToken, {
        request_id: `req-${spec.agent_id}`,
        agent_id: spec.agent_id,
        scope: SCOPE,
        workflow_stage: stage,
        evidence_source_ids: spec.requires_evidence ? [DOC_1, DOC_2] : [],
        payload: basePayload,
      });

      expect(advisory.agent_id).toBe(spec.agent_id);
      expect(advisory.human_review_required).toBe(true);
      expect(advisory.authoritative_mutation).toBe(false);
      expect(advisory.external_submission_allowed).toBe(false);
      expect(advisory.permitted_decisions.length).toBeGreaterThan(0);

      // Verify independent human decision recording for each executed advisory
      const reviewToken =
        advisory.required_reviewer_role === 'CPA_EA'
          ? 'cpa_reviewer'
          : spec.batch_id === 'BATCH_6_ADMIN_GOVERNANCE'
            ? 'compliance_reviewer'
            : 'cpa_reviewer';

      const decision = await h.dispatcher.recordHumanDecision(reviewToken, {
        request_id: `dec-${spec.agent_id}`,
        advisory_id: advisory.advisory_id,
        scope: SCOPE,
        expected_evidence_fingerprint: advisory.evidence_fingerprint,
        decision: advisory.permitted_decisions[0],
        rationale: `Independent staff review recorded for ${spec.agent_id} deterministic advisory.`,
      });
      expect(decision.authoritative_mutation).toBe(false);
      expect(decision.advisory_id).toBe(advisory.advisory_id);
      executedCount += 1;
    }

    expect(executedCount).toBe(60);
  });

  it.each([
    [[], 'WORKFORCE_INVALID_EVIDENCE_SELECTION'],
    [Array(51).fill(DOC_1), 'WORKFORCE_INVALID_EVIDENCE_SELECTION'],
    [[DOC_1, DOC_1], 'WORKFORCE_DUPLICATE_EVIDENCE_IDS'],
    [['invalid'], 'WORKFORCE_INVALID_EVIDENCE_ID'],
  ] as const)('rejects invalid OCR evidence before lookup (%j)', async (sourceIds, code) => {
    const h = createDispatcherHarness();
    h.setStage(3);
    await expect(h.dispatcher.executeAgent('cpa_exec', {
      request_id: 'req-a07-invalid-evidence',
      agent_id: 'A07',
      scope: SCOPE,
      workflow_stage: 3,
      evidence_source_ids: sourceIds,
      payload: {},
    })).rejects.toMatchObject({ code });
    expect(h.evidenceLoads()).toBe(0);
  });

  it('reports A09 document coverage as unknown without expected requirements', async () => {
    const h = createDispatcherHarness();
    h.setStage(3);
    const advisory = await h.dispatcher.executeAgent('operations_exec', {
      request_id: 'req-a09-no-expectations',
      agent_id: 'A09',
      scope: SCOPE,
      workflow_stage: 3,
      evidence_source_ids: [],
      payload: { expected_document_types: [] },
    });
    expect(advisory.status).toBe('EVIDENCE_REQUIRED');
    expect(advisory.findings).toMatchObject([{ code: 'EXPECTED_DOCUMENT_REQUIREMENTS_MISSING' }]);
  });

  it('requires pinned evidence to satisfy expected A09 document types', async () => {
    const h = createDispatcherHarness();
    h.setStage(3);
    const advisory = await h.dispatcher.executeAgent('operations_exec', {
      request_id: 'req-a09-expected-documents',
      agent_id: 'A09',
      scope: SCOPE,
      workflow_stage: 3,
      evidence_source_ids: [],
      payload: { expected_document_types: ['w2', 'W2'], received_document_types: ['W2'] },
    });
    expect(advisory.status).toBe('EVIDENCE_REQUIRED');
    expect(advisory.structured_data.missing_documents).toEqual(['W2']);
  });

  it('enforces domain-specific invariants across Batches 1–6 (A07 OCR gate, A14 balance, A17/A18 authority, OV-09/OV-10/OV-05)', async () => {
    const h = createDispatcherHarness();

    // Batch 1: A07 returns UNAVAILABLE_HUMAN_REVIEW_REQUIRED when OCR provider is unconfigured
    h.setStage(3);
    const a07Unconfigured = await h.dispatcher.executeAgent('cpa_exec', {
      request_id: 'req-a07-off',
      agent_id: 'A07',
      scope: SCOPE,
      workflow_stage: 3,
      evidence_source_ids: [DOC_1],
      payload: {},
    });
    expect(a07Unconfigured.status).toBe('UNAVAILABLE_HUMAN_REVIEW_REQUIRED');

    // A07 with configured approved OCR provider validates lineage hashes
    h.setOcrConfig({
      configured: true,
      approved_provider_id: 'taxguard-ocr-approved',
      provider_version: '2.1.0',
      lineage_signing_enabled: true,
    });
    const a07Configured = await h.dispatcher.executeAgent('cpa_exec', {
      request_id: 'req-a07-on',
      agent_id: 'A07',
      scope: SCOPE,
      workflow_stage: 3,
      evidence_source_ids: [DOC_1],
      payload: {
        provider_extractions: [
          { field_name: 'wages_box_1', value: '85000.00', source_id: DOC_1, source_hash: HASH_A, confidence: 0.99 },
        ],
      },
    });
    expect(a07Configured.status).toBe('ADVISORY');

    // Batch 2: A14 rejects unbalanced journals with 400 and never posts to ledger
    h.setStage(5);
    await expect(
      h.dispatcher.executeAgent('cpa_exec', {
        request_id: 'req-a14-bad',
        agent_id: 'A14',
        scope: SCOPE,
        workflow_stage: 5,
        evidence_source_ids: [],
        payload: {
          lines: [
            { account_code: '1010-Cash', debit_cents: 50000, credit_cents: 0 },
            { account_code: '4000-Revenue', debit_cents: 0, credit_cents: 40000 },
          ],
        },
      }),
    ).rejects.toMatchObject({ code: 'JOURNAL_ENTRY_UNBALANCED', status: 400 });

    await expect(h.dispatcher.executeAgent('cpa_exec', {
      request_id: 'req-a14-overflow',
      agent_id: 'A14',
      scope: SCOPE,
      workflow_stage: 5,
      evidence_source_ids: [],
      payload: { lines: [
        { account_code: '1010-Cash', debit_cents: Number.MAX_SAFE_INTEGER, credit_cents: 0 },
        { account_code: '1010-Cash', debit_cents: 1, credit_cents: 0 },
        { account_code: '4000-Revenue', debit_cents: 0, credit_cents: Number.MAX_SAFE_INTEGER },
        { account_code: '4000-Revenue', debit_cents: 0, credit_cents: 2 },
      ] },
    })).rejects.toMatchObject({ code: 'JOURNAL_ENTRY_TOTAL_OUT_OF_RANGE', status: 400 });

    const reconciliation = {
      request_id: 'req-a13-precision',
      agent_id: 'A13' as const,
      scope: SCOPE,
      workflow_stage: 5,
      evidence_source_ids: [],
      payload: {
        bank_ending_balance_cents: Number.MAX_SAFE_INTEGER,
        ledger_ending_balance_cents: Number.MAX_SAFE_INTEGER - 1,
        deposits_in_transit_cents: 2,
        outstanding_checks_cents: 2,
      },
    };
    const exact = await h.dispatcher.executeAgent('cpa_exec', reconciliation);
    expect(exact.structured_data).toMatchObject({ variance_cents: 1 });
    await expect(h.dispatcher.executeAgent('cpa_exec', {
      ...reconciliation,
      request_id: 'req-a13-invalid-adjustment',
      payload: { ...reconciliation.payload, deposits_in_transit_cents: '2' },
    })).rejects.toMatchObject({ code: 'ACCOUNTING_INVALID_CENT_AMOUNTS', status: 400 });

    h.setStage(6);
    await expect(h.dispatcher.executeAgent('cpa_exec', {
      request_id: 'req-a15-overflow',
      agent_id: 'A15',
      scope: SCOPE,
      workflow_stage: 6,
      evidence_source_ids: [],
      payload: {
        total_assets_cents: Number.MAX_SAFE_INTEGER,
        total_liabilities_cents: Number.MAX_SAFE_INTEGER,
        total_equity_cents: 2,
        total_revenue_cents: 100,
        total_expenses_cents: 10,
      },
    })).rejects.toMatchObject({ code: 'FINANCIAL_STATEMENT_INVALID_TOTALS', status: 400 });

    const bridge = {
      request_id: 'req-a16-exact',
      agent_id: 'A16' as const,
      scope: SCOPE,
      workflow_stage: 6,
      evidence_source_ids: [],
      payload: { book_net_income_cents: Number.MAX_SAFE_INTEGER, penalties_cents: 2, tax_depreciation_cents: 2 },
    };
    expect((await h.dispatcher.executeAgent('cpa_exec', bridge)).structured_data)
      .toMatchObject({ advisory_taxable_income_cents: Number.MAX_SAFE_INTEGER });
    await expect(h.dispatcher.executeAgent('cpa_exec', {
      ...bridge, request_id: 'req-a16-overflow', payload: { ...bridge.payload, tax_depreciation_cents: 0 },
    })).rejects.toMatchObject({ code: 'BOOK_TO_TAX_INVALID_ADJUSTMENTS', status: 400 });

    h.setStage(5);
    const a14Good = await h.dispatcher.executeAgent('cpa_exec', {
      request_id: 'req-a14-ok',
      agent_id: 'A14',
      scope: SCOPE,
      workflow_stage: 5,
      evidence_source_ids: [],
      payload: {
        lines: [
          { account_code: '1010-Cash', debit_cents: 50000, credit_cents: 0 },
          { account_code: '4000-Revenue', debit_cents: 0, credit_cents: 50000 },
        ],
      },
    });
    expect(a14Good.structured_data.posted_to_ledger).toBe(false);

    // Batch 3: A17 missing authority routes to EVIDENCE_REQUIRED
    h.setStage(8);
    const a17Missing = await h.dispatcher.executeAgent('cpa_exec', {
      request_id: 'req-a17-missing',
      agent_id: 'A17',
      scope: SCOPE,
      workflow_stage: 8,
      evidence_source_ids: [],
      payload: { tax_issue: 'Uncited deduction position', authority_citations: [] },
    });
    expect(a17Missing.status).toBe('EVIDENCE_REQUIRED');

    // Batch 4: A33 never auto-approves (OV-09), A38 keeps live e-file disabled (OV-10)
    h.setStage(12);
    const a33 = await h.dispatcher.executeAgent('cpa_exec', {
      request_id: 'req-a33',
      agent_id: 'A33',
      scope: SCOPE,
      workflow_stage: 12,
      evidence_source_ids: [],
      payload: { gross_income_cents: 5000000 },
    });
    expect(a33.structured_data.auto_approval_permitted).toBe(false);

    h.setStage(17);
    const a38 = await h.dispatcher.executeAgent('cpa_exec', {
      request_id: 'req-a38',
      agent_id: 'A38',
      scope: SCOPE,
      workflow_stage: 17,
      evidence_source_ids: [],
      payload: { included_forms: ['FORM_1040'] },
    });
    expect(a38.structured_data.live_transmission_performed).toBe(false);

    // Batch 5: A43 never sends outbound comms, A47 never charges payments (OV-10)
    h.setStage(2);
    const a43 = await h.dispatcher.executeAgent('cpa_exec', {
      request_id: 'req-a43',
      agent_id: 'A43',
      scope: SCOPE,
      workflow_stage: 2,
      evidence_source_ids: [],
      payload: { topic: 'Missing 1099-INT', requested_items: ['1099-INT'] },
    });
    expect(a43.structured_data.outbound_sent).toBe(false);

    h.setStage(15);
    const a47 = await h.dispatcher.executeAgent('operations_exec', {
      request_id: 'req-a47',
      agent_id: 'A47',
      scope: SCOPE,
      workflow_stage: 15,
      evidence_source_ids: [],
      payload: { line_items: [{ description: 'Tax preparation fee', amount_cents: 45000 }] },
    });
    expect(a47.structured_data.payment_charged).toBe(false);

    // Batch 6: A55 never mutates permissions
    const a55 = await h.dispatcher.executeAgent('admin_exec', {
      request_id: 'req-a55',
      agent_id: 'A55',
      scope: SCOPE,
      workflow_stage: 1,
      evidence_source_ids: [],
      payload: { roles_checked: 6 },
    });
    expect(a55.structured_data.permissions_mutated).toBe(false);
  });

  it('honors the stage stop on the assigned case before loading evidence', async () => {
    const h = createDispatcherHarness();
    h.setStage(3);
    h.setKillSwitches({ global_stop: false, stopped_agents: [], stopped_stages: [3], stopped_tools: [] });
    await expect(h.dispatcher.executeAgent('cpa_exec', {
      request_id: 'req-a07-stage-stop',
      agent_id: 'A07',
      scope: SCOPE,
      workflow_stage: 2,
      evidence_source_ids: [DOC_1],
      payload: {},
    })).rejects.toMatchObject({ code: 'WORKFORCE_KILL_SWITCH_ACTIVE' });
    expect(h.evidenceLoads()).toBe(0);
  });

  it('enforces kill switches, cross-tenant denial, unauthorized roles, and raw secret/SSN payload blocking', async () => {
    const h = createDispatcherHarness();
    h.setStage(1);

    // Raw SSN blocked
    await expect(
      h.dispatcher.executeAgent('cpa_exec', {
        request_id: 'req-ssn',
        agent_id: 'A00',
        scope: SCOPE,
        workflow_stage: 1,
        evidence_source_ids: [],
        payload: { note: 'Taxpayer 123-45-6789' },
      }),
    ).rejects.toMatchObject({ code: 'WORKFORCE_SENSITIVE_CONTENT_BLOCKED', status: 400 });

    // Raw document bytes key blocked
    await expect(
      h.dispatcher.executeAgent('cpa_exec', {
        request_id: 'req-raw',
        agent_id: 'A00',
        scope: SCOPE,
        workflow_stage: 1,
        evidence_source_ids: [],
        payload: { raw_document: 'JVBERi0xLjQ=' },
      }),
    ).rejects.toMatchObject({ code: 'WORKFORCE_RAW_CONTENT_OR_SECRET_FORBIDDEN', status: 400 });

    // Cross-tenant denied
    await expect(
      h.dispatcher.executeAgent('other_tenant', {
        request_id: 'req-xt',
        agent_id: 'A00',
        scope: SCOPE,
        workflow_stage: 1,
        evidence_source_ids: [],
        payload: {},
      }),
    ).rejects.toMatchObject({ code: 'WORKFORCE_CROSS_TENANT_DENIED', status: 403 });

    // Unauthorized role denied (operations staff cannot run Batch 6 admin agent A55)
    await expect(
      h.dispatcher.executeAgent('operations_exec', {
        request_id: 'req-role',
        agent_id: 'A55',
        scope: SCOPE,
        workflow_stage: 1,
        evidence_source_ids: [],
        payload: {},
      }),
    ).rejects.toMatchObject({ code: 'WORKFORCE_ROLE_DENIED', status: 403 });

    // Global kill switch blocks execution
    h.setKillSwitches({
      global_stop: true,
      stopped_agents: [],
      stopped_stages: [],
      stopped_tools: [],
    });
    await expect(
      h.dispatcher.executeAgent('cpa_exec', {
        request_id: 'req-ks',
        agent_id: 'A00',
        scope: SCOPE,
        workflow_stage: 1,
        evidence_source_ids: [],
        payload: {},
      }),
    ).rejects.toMatchObject({ code: 'WORKFORCE_KILL_SWITCH_ACTIVE', status: 403 });
  });

  it('enforces approved server-side LLM gateway bridge policy, budgets, timeouts, schema validation, and unconfigured fallback', async () => {
    const config = {
      agent_id: 'A00' as const,
      prompt_id: 'taxguard-a00-routing',
      prompt_version: '1.0.0',
      model_id: 'approved-local-model',
      model_version: '2025-01',
      data_classification_limit: 'FINANCIAL_DATA' as const,
      token_budget: 1000,
      cost_budget_usd: 0.05,
      timeout_ms: 200,
    };

    // Unconfigured provider returns explicit UNAVAILABLE_HUMAN_REVIEW_REQUIRED
    const unconfigured = await invokeApprovedGateway({
      config,
      requestedDataClasses: ['FINANCIAL_DATA'],
      structuredInput: { case_stage: 1 },
      validateOutput: x => x as { recommendation: string },
      transport: null,
    });
    expect(unconfigured).toEqual({
      status: 'UNAVAILABLE_HUMAN_REVIEW_REQUIRED',
      reason_code: 'AI_PROVIDER_NOT_CONFIGURED',
      human_review_required: true,
    });

    // Protected data classes refused
    await expect(
      invokeApprovedGateway({
        config,
        requestedDataClasses: ['SYSTEM_SECRET'],
        structuredInput: {},
        validateOutput: x => x,
        transport: null,
      }),
    ).rejects.toMatchObject({ code: 'AI_PROTECTED_DATA_DENIED', status: 403 });

    // Budget exceeded fails safely to UNAVAILABLE_HUMAN_REVIEW_REQUIRED
    const overBudget = await invokeApprovedGateway({
      config,
      requestedDataClasses: ['FINANCIAL_DATA'],
      structuredInput: {},
      validateOutput: x => x,
      transport: {
        provider: 'approved-test-gw',
        async invoke() {
          return { raw_text: '{"ok":true}', tokens_used: 5000, estimated_cost_usd: 0.01 };
        },
      },
    });
    expect(overBudget.status).toBe('UNAVAILABLE_HUMAN_REVIEW_REQUIRED');
    if (overBudget.status === 'UNAVAILABLE_HUMAN_REVIEW_REQUIRED') {
      expect(overBudget.reason_code).toBe('AI_PROVIDER_BUDGET_EXCEEDED');
    }

    // Invalid output fails safely to UNAVAILABLE_HUMAN_REVIEW_REQUIRED
    const invalidOutput = await invokeApprovedGateway({
      config,
      requestedDataClasses: ['FINANCIAL_DATA'],
      structuredInput: {},
      validateOutput: (parsed): { summary: string } => {
        if (!parsed || typeof (parsed as any).summary !== 'string') throw new Error('bad');
        return parsed as { summary: string };
      },
      transport: {
        provider: 'approved-test-gw',
        async invoke() {
          return { raw_text: '{"wrong":1}', tokens_used: 120, estimated_cost_usd: 0.005 };
        },
      },
    });
    expect(invalidOutput.status).toBe('UNAVAILABLE_HUMAN_REVIEW_REQUIRED');
    if (invalidOutput.status === 'UNAVAILABLE_HUMAN_REVIEW_REQUIRED') {
      expect(invalidOutput.reason_code).toBe('AI_PROVIDER_INVALID_OUTPUT');
    }

    // Valid response passes schema validation
    const ok = await invokeApprovedGateway<{ summary: string }>({
      config,
      requestedDataClasses: ['FINANCIAL_DATA'],
      structuredInput: { case_stage: 1 },
      validateOutput: (parsed): { summary: string } => {
        if (!parsed || typeof (parsed as any).summary !== 'string') throw new Error('bad');
        return parsed as { summary: string };
      },
      transport: {
        provider: 'approved-test-gw',
        async invoke() {
          return { raw_text: '{"summary":"Advisory routing prepared"}', tokens_used: 150, estimated_cost_usd: 0.004 };
        },
      },
    });
    expect(ok.status).toBe('OK');
    if (ok.status === 'OK') {
      expect(ok.data.summary).toBe('Advisory routing prepared');
    }
  });
});
