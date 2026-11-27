/** Browser client for /api/ai-workforce (61-agent application workforce A00–A60 & A10 pilot). */
import { getStoredToken } from './api';
import { apiEndpoint } from '../config/apiEndpoint';
import type { AgentId } from '../ai/types';
import type { WorkforceMatrixRow, WorkforceMatrixTotals } from '../ai/workforceMatrix';

export class AiWorkforceRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'AiWorkforceRequestError';
  }
}

export interface ClientWorkforceScope {
  tenant_id: string;
  client_id: string;
  tax_case_id: string;
  tax_year: number;
}

export interface ClientWorkforceFinding {
  code: string;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  summary: string;
  evidence_source_ids: string[];
  authority_citations?: string[];
  recommended_human_action: string;
}

export interface ClientWorkforceAdvisory {
  advisory_id: string;
  job_id: string | null;
  agent_id: AgentId;
  agent_name: string;
  batch_id: string;
  workflow_stage: number;
  scope: ClientWorkforceScope;
  status: string;
  summary: string;
  findings: ClientWorkforceFinding[];
  structured_data: Record<string, unknown>;
  evidence_pins: Array<{
    source_id: string;
    document_record_id: string;
    document_version: number;
    source_hash: string;
  }>;
  evidence_fingerprint: string;
  authority_citations: string[];
  required_reviewer_role: string;
  permitted_decisions: string[];
  output_audience: string;
  human_review_required: true;
  authoritative_mutation: false;
  external_submission_allowed: false;
  created_at: string;
  requested_by: string;
}

export interface ClientWorkforceDecision {
  bound_evidence_fingerprint?: string;
  bound_evidence_versions?: ClientWorkforceAdvisory['evidence_pins'];
  decision_id: string;
  advisory_id: string;
  agent_id: AgentId;
  reviewer_uid: string;
  reviewer_role: string;
  decision: string;
  rationale: string;
  synthetic_staging_gate_used: boolean;
  recorded_at: string;
}

export interface ClientA10InspectionItem {
  advisory: ClientWorkforceAdvisory;
  decisions: ClientWorkforceDecision[];
  stale_evidence: boolean;
  stale_reason: string | null;
  live_decision_available: boolean;
  live_decision_block_reason: string | null;
}

export interface ClientA10JobRecord {
  job_id: string;
  idempotency_key: string;
  status: string;
  advisory_id: string | null;
  error_code: string | null;
  created_at: string;
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const token = getStoredToken();
  if (!token) throw new AiWorkforceRequestError(401, 'WORKFORCE_AUTH_REQUIRED');

  const response = await fetch(apiEndpoint('/api/ai-workforce' + path), {
    method,
    cache: 'no-store',
    credentials: 'omit',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const data = await response.json().catch(() => null);
  if (getStoredToken() !== token) {
    throw new AiWorkforceRequestError(409, 'SESSION_CHANGED');
  }
  if (!response.ok) {
    throw new AiWorkforceRequestError(
      response.status,
      typeof data?.code === 'string' ? data.code : 'AI_WORKFORCE_UNAVAILABLE',
      data?.details && typeof data.details === 'object' ? data.details : undefined,
    );
  }
  return data as T;
}

export const aiWorkforceService = {
  getMatrix: () =>
    request<{ rows: WorkforceMatrixRow[]; totals: WorkforceMatrixTotals }>('GET', '/matrix'),

  executeAgent: (
    agentId: AgentId,
    input: {
      request_id: string;
      scope: ClientWorkforceScope;
      workflow_stage: number;
      evidence_source_ids?: string[];
      payload?: Record<string, unknown>;
    },
  ) =>
    request<{ advisory: ClientWorkforceAdvisory }>(
      'POST',
      '/agents/' + encodeURIComponent(agentId) + '/execute',
      input,
    ),

  submitA10Job: (input: {
    request_id: string;
    idempotency_key?: string;
    scope: ClientWorkforceScope;
    evidence_source_ids: string[];
  }) => request<{ job: ClientA10JobRecord; created: boolean }>('POST', '/a10/jobs', input),

  processA10Job: (jobId: string, tenantId: string) =>
    request<{ job: ClientA10JobRecord; advisory: ClientWorkforceAdvisory }>(
      'POST',
      '/a10/jobs/' + encodeURIComponent(jobId) + '/process',
      { tenant_id: tenantId },
    ),

  listA10CaseAdvisories: (scope: ClientWorkforceScope) => {
    const qs = new URLSearchParams({
      tenant_id: scope.tenant_id,
      client_id: scope.client_id,
      tax_year: String(scope.tax_year),
      agent_id: 'A10',
    }).toString();
    return request<{ items: ClientA10InspectionItem[] }>(
      'GET',
      '/cases/' + encodeURIComponent(scope.tax_case_id) + '/advisories?' + qs,
    );
  },

  listCaseAdvisories: (scope: ClientWorkforceScope, agentId?: AgentId) => {
    const params: Record<string, string> = {
      tenant_id: scope.tenant_id,
      client_id: scope.client_id,
      tax_year: String(scope.tax_year),
    };
    if (agentId) params.agent_id = agentId;
    const qs = new URLSearchParams(params).toString();
    return request<{ items: ClientWorkforceAdvisory[] }>(
      'GET',
      '/cases/' + encodeURIComponent(scope.tax_case_id) + '/advisories?' + qs,
    );
  },

  recordDecision: (
    advisoryId: string,
    input: {
      request_id: string;
      agent_id: AgentId;
      scope: ClientWorkforceScope;
      expected_evidence_fingerprint: string;
      decision: string;
      rationale: string;
    },
  ) =>
    request<{ decision: ClientWorkforceDecision }>(
      'POST',
      '/advisories/' + encodeURIComponent(advisoryId) + '/decisions',
      input,
    ),
};

export function workforceErrorMessage(error: unknown): string {
  if (error instanceof AiWorkforceRequestError) {
    const map: Record<string, string> = {
      A10_LIVE_DECISION_PENDING_OWNER_APPROVAL:
        'Live A10 human decision recording is unavailable until the owner approves A10’s reviewer role policy.',
      AI_AGENT_RESERVED_PENDING_OWNER_DEFINITION:
        'Agent A39 is reserved and unassigned pending owner definition (OV-01).',
      STALE_EVIDENCE_CONFLICT:
        'Underlying document version, status, or quarantine state changed after this advisory was created. Re-run the check before deciding.',
      WORKFORCE_JOB_ALREADY_FINAL:
        'This check has already finished. Review the current advisories before starting another check.',
      CONCURRENT_DECISION_CONFLICT:
        'A human decision has already been recorded for this advisory.',
      WORKFORCE_MAKER_CHECKER_SELF_REVIEW_DENIED:
        'Maker-checker separation requires an independent reviewer distinct from the requester.',
      WORKFORCE_STAFF_ASSIGNMENT_REQUIRED:
        'You must hold an active staff assignment on this client, engagement, and tax year.',
      WORKFORCE_DATABASE_UNAVAILABLE:
        'The AI workforce database store is not configured in this environment.',
    };
    return map[error.code] ?? `AI workforce request refused (${error.code}).`;
  }
  return 'The AI workforce service is currently unavailable.';
}
