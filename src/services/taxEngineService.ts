import { getStoredToken } from './api';

export const AUTHORITY_LEVELS = [
  'AUTHORITATIVE',
  'SECONDARY',
  'INTERNAL_GUIDANCE',
  'AI_INFERENCE',
] as const;

export type AuthorityLevel = (typeof AUTHORITY_LEVELS)[number];

export const AUTHORITY_LABELS: Record<AuthorityLevel, string> = {
  AUTHORITATIVE: 'Authoritative primary law',
  SECONDARY: 'Secondary commentary',
  INTERNAL_GUIDANCE: 'Internal practice guidance',
  AI_INFERENCE: 'AI inference (non-authoritative)',
};

export const AUTHORITY_TYPES = [
  'statute',
  'regulation',
  'revenue_ruling',
  'revenue_procedure',
  'notice',
  'publication',
  'form_instructions',
  'case_law',
] as const;

export const CONCLUSION_TYPES = [
  'INCOME_INCLUSION',
  'DEDUCTION_ELIGIBILITY',
  'CREDIT_ELIGIBILITY',
  'CHARACTER_DETERMINATION',
  'FILING_STATUS',
  'NEXUS_JURISDICTION',
  'BASIS_ADJUSTMENT',
  'EXCLUSION',
] as const;

export const RISK_OUTCOME_LABELS: Record<string, string> = {
  LOW_RISK_CLEARED: 'Cleared (within materiality policy)',
  HUMAN_REVIEW_REQUIRED: 'Human review required',
  PARTNER_SIGN_OFF_REQUIRED: 'Partner sign-off required',
  BLOCKED: 'Blocked',
};

export const RISK_REASON_LABELS: Record<string, string> = {
  BELOW_MATERIALITY: 'Amount at stake is below approved materiality threshold.',
  ABOVE_MATERIALITY: 'Amount at stake meets or exceeds materiality threshold.',
  UNSUPPORTED_POSITION: 'Tax position lacks verified authoritative support.',
  NO_APPROVED_POLICY: 'No approved materiality policy is configured.',
};

export const RETURN_RISK_REASON_LABELS: Record<string, string> = {
  RETURN_HUMAN_REVIEW_REQUIRED: 'Independent human review is required.',
  RETURN_VERIFICATION_FAILED: 'Draft return calculation verification found a discrepancy.',
  RETURN_VERIFICATION_MISSING: 'Draft return calculations have not been verified.',
  RETURN_OPEN_DIAGNOSTICS: 'Case has open blocking or error diagnostics.',
  RETURN_UNAPPROVED_RESEARCH: 'Referenced research memo is not approved.',
  RETURN_ABOVE_MATERIALITY: 'Amount at stake exceeds practice materiality threshold.',
  RETURN_STALE_INPUTS: 'One or more underlying inputs changed after assembly.',
};

export const RETURN_PROBLEM_LABELS: Record<string, string> = {
  MAPPING_STALE: 'Underlying form mapping is stale.',
  CONCLUSION_STALE: 'Underlying conclusion is stale.',
  TEMPLATE_SUPERSEDED: 'Return template has been superseded.',
  DIAGNOSTICS_OPEN: 'Case has blocking diagnostics.',
};

export class TaxEngineRequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string = 'TAX_ENGINE_ERROR', message?: string) {
    super(message || code);
    this.name = 'TaxEngineRequestError';
    this.status = status;
    this.code = code;
  }
}

export function taxEngineMessage(err: unknown): string {
  if (err instanceof TaxEngineRequestError) {
    return err.message || err.code;
  }
  if (err instanceof Error) return err.message;
  return 'Tax engine request failed.';
}

export function dollarsToCents(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,\s]/g, '');
  if (!cleaned || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export function isSha256(v: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(v.trim());
}

export function parseAssignments(raw: string): Array<[string, string | number]> | null {
  const lines = raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  const seen = new Set<string>();
  const out: Array<[string, string | number]> = [];
  for (const line of lines) {
    const idx = line.indexOf('=');
    if (idx <= 0) return null;
    const key = line.slice(0, idx).trim();
    const valRaw = line.slice(idx + 1).trim();
    if (!key || !valRaw || seen.has(key)) return null;
    seen.add(key);
    const num = Number(valRaw);
    out.push([key, Number.isFinite(num) && valRaw !== '' ? num : valRaw]);
  }
  return out;
}

export function conclusionBadge(k: Pick<TaxConclusion, 'status' | 'stale'>): string {
  if (k.status === 'SUPERSEDED') return 'SUPERSEDED';
  if (k.stale && k.stale.length > 0) return 'STALE';
  return k.status;
}

export function evidenceText(resolution?: { status?: string; source?: string; verifiedBy?: string; documentId?: string; reason?: string } | null): string {
  if (!resolution) return 'unresolved evidence';
  if (resolution.status === 'VERIFIED' || resolution.status === 'RESOLVED') {
    return `verified${resolution.verifiedBy ? ` by ${resolution.verifiedBy}` : ''}${resolution.documentId ? ` (${resolution.documentId})` : ''}`;
  }
  if (resolution.reason) return resolution.reason.replace(/_/g, ' ').toLowerCase();
  return (resolution.status || 'unresolved').replace(/_/g, ' ').toLowerCase();
}

export function staleReason(reason: string): string {
  switch (reason) {
    case 'EVIDENCE_CHANGED':
      return 'verified evidence changed after link';
    case 'CALCULATION_CHANGED':
      return 'calculation run changed or was rejected';
    case 'RESEARCH_CHANGED':
      return 'research memo changed after link';
    case 'WORKPAPER_CHANGED':
      return 'workpaper changed after link';
    default:
      return reason.replace(/_/g, ' ').toLowerCase();
  }
}

export function verificationText(r: { result?: string; discrepancyCount?: number; verifiedAt?: string } | null | undefined): string {
  if (!r || !r.result) return 'not verified';
  if (r.result === 'VERIFIED') return 'verified cleanly';
  return `${r.result.toLowerCase()}${r.discrepancyCount ? ` (${r.discrepancyCount} discrepancies)` : ''}`;
}

export function returnRiskText(r: { outcome?: string; reasonCodes?: string[] } | null | undefined): string {
  if (!r || !r.outcome) return 'not assessed';
  const label = r.outcome.replace(/_/g, ' ').toLowerCase();
  const reasons = (r.reasonCodes ?? []).map(c => RETURN_RISK_REASON_LABELS[c] ?? c).join(' ');
  return reasons ? `${label} (${reasons})` : label;
}

export function returnProblemText(p: { code?: string; message?: string; formId?: string }): string {
  if (p.message) return p.message;
  if (p.code && RETURN_PROBLEM_LABELS[p.code]) return RETURN_PROBLEM_LABELS[p.code];
  return `${p.formId ? p.formId + ': ' : ''}${(p.code || 'stale').replace(/_/g, ' ').toLowerCase()}`;
}

export function formProblemText(p: { code?: string; message?: string; line?: string }): string {
  if (p.message) return p.message;
  return `${p.line ? `line ${p.line}: ` : ''}${(p.code || 'stale').replace(/_/g, ' ').toLowerCase()}`;
}

export function readinessText(r: { ready?: boolean; blockers?: string[] }): string {
  if (r.ready) return 'ready for Stage 10 authorization';
  if (r.blockers && r.blockers.length > 0) return `blocked (${r.blockers.join(', ')})`;
  return 'not ready';
}

export function finalAuthorizationText(r: { finalAuthorization?: { outcome?: string; authorizedBy?: string } | null }): string {
  const f = r.finalAuthorization;
  if (!f || !f.outcome) return 'pending independent authorization';
  return `${f.outcome.toLowerCase()}${f.authorizedBy ? ` by ${f.authorizedBy}` : ''}`;
}

export function signaturePackageText(r: {
  signaturePackage?: {
    eligible?: boolean;
    package?: { status?: string; releasedBy?: string } | null;
    reason?: string;
  } | null;
}): string {
  const s = r.signaturePackage;
  if (!s) return 'not released';
  if (s.package) {
    return `released${s.package.releasedBy ? ` by ${s.package.releasedBy}` : ''} (awaiting signature; e-sign disabled)`;
  }
  return s.eligible ? 'ready to release for client signature' : (s.reason || 'not eligible for signature release');
}

export function comparisonLineText(l: ComparisonLine): string {
  const prefix = `${l.formId} (${l.formVersion}) ${l.schedule} line ${l.line} ${l.field}`;
  if (l.kind === 'ADDED') return `${prefix}: added ${l.currentValue ?? ''}`;
  if (l.kind === 'REMOVED') return `${prefix}: removed (was ${l.priorValue ?? ''})`;
  return `${prefix}: ${l.priorValue ?? '—'} -> ${l.currentValue ?? '—'}${l.variance ? ' [variance flagged]' : ''}`;
}

export interface TaxSource {
  source_id: string;
  jurisdiction: 'federal' | 'state' | string;
  jurisdiction_code: string;
  authority_type: string;
  title: string;
  issuer: string;
  citation: string;
  url?: string | null;
  tax_years: number[];
  status: 'PROPOSED' | 'VERIFIED' | string;
  registered_by: string;
  verified_by?: string | null;
  synthetic?: boolean;
}

export interface ResearchCitation {
  citation_no: number;
  authority_level: AuthorityLevel;
  source_id?: string | null;
  reference?: string | null;
  note: string;
  added_by: string;
}

export interface ResearchMemo {
  memo_id: string;
  case_id: string;
  question: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | string;
  version: number;
  prepared_by: string;
  reviewed_by?: string | null;
  review_note?: string | null;
  conclusion?: string | null;
  returnUse: string;
  created_at: string;
  citations: ResearchCitation[];
}

export interface CaseDiagnosticItem {
  diagnostic_id: string;
  rule_code: string;
  rule_version: string | number;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKING' | string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | string;
  message: string;
  detected_at: string;
  acknowledged_by?: string | null;
  acknowledgement_note?: string | null;
}

export interface CaseDiagnostics {
  caseId: string;
  diagnosedAt: string | null;
  ready: boolean;
  blocking: number;
  errors: number;
  diagnostics: CaseDiagnosticItem[];
}

export interface RiskAssessment {
  assessment_id: string;
  outcome: string;
  amount_cents: number;
  materiality: string;
  risk_level: string;
  policy_version: number | null;
  assessed_by: string;
  assessed_at: string;
  reason_codes: string[];
}

export interface CalculationRun {
  run_id: string;
  case_id: string;
  status: 'COMPUTED' | 'APPROVED' | 'REJECTED' | string;
  outputs: Record<string, unknown>;
  requested_by: string;
  reviewed_by?: string | null;
  review_note?: string | null;
  created_at: string;
  synthetic?: boolean;
}

export interface RunLineage {
  runId: string;
  recorded: boolean;
  complete: boolean;
  citations: Array<{
    factPath: string;
    value: string | number | null;
    ref: string;
    resolution: { status?: string; verifiedBy?: string; documentId?: string; reason?: string };
  }>;
}

export type ConclusionLinkType = 'EVIDENCE' | 'CALCULATION' | 'RESEARCH' | 'WORKPAPER';

export interface ConclusionInput {
  type: string;
  statement: string;
  amount?: string | null;
  links: Array<{ type: ConclusionLinkType; ref: string }>;
}

export interface ConclusionReadiness {
  ready: boolean;
  conclusions: number;
  blockers: Array<{ conclusionId: string; version: number; reasons: string[] }>;
}

export interface TaxConclusion {
  conclusionId: string;
  caseId: string;
  version: number;
  type: string;
  statement: string;
  amount?: string | null;
  status: 'DRAFT' | 'READY_FOR_REVIEW' | 'APPROVED' | 'RETURNED' | 'REJECTED' | 'SUPERSEDED' | string;
  preparedBy: string;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  stale: Array<{ type: string; ref: string; reason: string }>;
}

export interface ConclusionTrace {
  conclusion: TaxConclusion;
  sources: Array<{
    type: ConclusionLinkType;
    ref: string;
    snapshot: Record<string, unknown>;
    current: Record<string, unknown>;
    detail?: {
      outputs?: Record<string, unknown>;
      inputs?: Array<{ factPath: string; ref: string; value: unknown; resolution?: any }>;
      question?: string;
      citations?: Array<{ authorityLevel: string; sourceId?: string; reference?: string }>;
    };
  }>;
  versions: Array<{ conclusionId: string; version: number; status: string; reviewedBy?: string | null }>;
  audit: Array<{ action: string; version?: number; actorUid: string; at: string }>;
  formLines: Array<{ formId: string; line: string }>;
}

export interface FormRule {
  ruleId: string;
  formId: string;
  formVersion: string;
  returnFamily: string;
  taxYear: number;
  version: number;
  lines: number;
  status: string;
  jurisdiction: string;
  jurisdictionCode: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface FormMappingValue {
  schedule: string;
  line: string;
  field: string;
  value: string | number;
  valueType: string;
  sources: Array<{
    conclusionId: string;
    conclusionVersion: number;
    conclusionType: string;
    value: string | number;
    runId: string;
    ruleSetId: string;
    ruleSetVersion: number;
    ruleSetSha256: string;
    evidence: Array<{ ref: string }>;
  }>;
}

export interface FormMapping {
  mappingId: string;
  caseId: string;
  formId: string;
  formVersion: string;
  version: number;
  status: 'CURRENT' | 'SUPERSEDED' | string;
  mappedBy: string;
  createdAt: string;
  ruleVersion: number;
  ruleSha256: string;
  stale: Array<{ code?: string; message?: string; line?: string }>;
  missing: Array<{ line: string }>;
  values?: FormMappingValue[];
  replayed?: boolean;
}

export interface ReturnTemplate {
  templateRuleId: string;
  templateId: string;
  returnFamily: string;
  taxYear: number;
  version: number;
  forms: number;
  status: string;
  jurisdiction: string;
  jurisdictionCode: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface ReturnVersion {
  returnVersionId: string;
  caseId: string;
  templateId: string;
  taxYear?: number;
  version: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED' | 'SUPERSEDED';
  preparedBy: string;
  createdAt: string;
  templateVersion: number;
  templateSha256: string;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  stale: Array<{ code?: string; message?: string; formId?: string; reason?: string }>;
  forms: Array<{ formId: string; formVersion: string; mappingId: string; mappingVersion: number; valuesSha256?: string }>;
  missing: Array<{ formId: string; formVersion: string }>;
  replayed?: boolean;
  lineage?: Array<{
    mappingId: string;
    formId: string;
    formVersion: string;
    version: number;
    values: Array<{
      schedule: string;
      line: string;
      field: string;
      value: string | number;
      sources: Array<{
        conclusionId: string;
        conclusionVersion: number;
        runId: string;
        ruleSetId: string;
        ruleSetVersion: number;
        evidence: Array<{ ref: string }>;
      }>;
    }>;
  }>;
}

export type FinalOutcome = 'AUTHORIZED' | 'DECLINED';

export interface FinalQueueItem {
  assignmentId: string;
  returnVersionId: string;
  caseId: string;
  templateId: string;
  version: number;
  taxYear: number;
  latestOutcome: FinalOutcome | null;
}

export interface FinalContext {
  returnVersion: ReturnVersion;
  readiness: {
    ready: boolean;
    blockers?: string[];
    finalAuthorization?: { outcome?: string; authorizedBy?: string } | null;
    signaturePackage?: any;
  };
  attestation: {
    attestationVersion: number;
    text: string;
  } | null;
}

export interface QcQueueItem {
  assignmentId: string;
  returnVersionId: string;
  caseId: string;
  templateId: string;
  version: number;
  taxYear: number;
  latestOutcome: 'QC_PASSED' | 'QC_RETURNED' | null;
}

export interface QcResultInput {
  code: string;
  result: 'PASS' | 'FAIL';
  note?: string;
}

export interface QcContext {
  returnVersion: ReturnVersion;
  verification?: { result: string } | null;
  risk?: { outcome: string; reasonCodes: string[] } | null;
  checklist: {
    checklistVersion: number;
    items: Array<{ code: string; text: string }>;
  } | null;
}

export interface ReviewQueueItem {
  returnVersionId: string;
  caseId: string;
  templateId: string;
  version: number;
  taxYear: number;
  preparedBy: string;
  submittedAt: string;
  stale: boolean;
  verification?: { result: 'VERIFIED' | string } | null;
  risk?: { outcome: string; reasonCodes: string[] } | null;
}

export interface ComparisonLine {
  formId: string;
  formVersion: string;
  priorFormVersion?: string | null;
  schedule: string;
  line: string;
  field: string;
  kind: 'UNCHANGED' | 'CHANGED' | 'ADDED' | 'REMOVED';
  currentValue?: string | number | null;
  priorValue?: string | number | null;
  variance?: boolean;
}

export interface ReturnComparison {
  returnVersionId: string;
  templateId: string;
  varianceCheck: 'APPLIED' | 'NOT_CONFIGURED' | string;
  variancePolicyVersion?: number | null;
  previousVersion: { version: number; lines: ComparisonLine[] } | null;
  priorYear: {
    taxYear: number;
    status: 'AVAILABLE' | 'NOT_AVAILABLE' | string;
    templateId?: string;
    version?: number;
    stale?: boolean;
    lines: ComparisonLine[];
  };
}

export interface SignatureContext {
  readiness: {
    ready: boolean;
    signaturePackage?: {
      eligible?: boolean;
      reason?: string;
      package?: {
        releasedBy: string;
        signerUids: string[];
        consentVersion: number;
      } | null;
    } | null;
  };
  releasable: { releasable: boolean };
  consent: { consentVersion: number; text: string } | null;
  candidates: Array<{ uid: string; name?: string }>;
}

export interface RuleSetSummary {
  ruleSetId: string;
  jurisdiction: string;
  jurisdictionCode: string;
  returnFamily: string;
  taxYear: number;
  version: number;
  status: string;
  preparedBy: string;
  reviewedBy?: string | null;
  synthetic?: boolean;
}

export interface RuleSetDetail extends RuleSetSummary {
  contentSha256: string;
  sourceIds: string[];
  reviewNote?: string | null;
  definition: {
    parameters?: Array<{
      key: string;
      filingStatus?: string;
      value: string | number;
      unit?: string;
      sourceId?: string;
      citation?: string;
    }>;
  };
}

export interface RuleSetCoverage {
  missingOutputs: string[];
  missingFilingStatuses: string[];
}

export interface RuleSetTests {
  testsSha256: string;
  tests: Array<{
    testId: string;
    name: string;
    filingStatus?: string;
    expected: Record<string, string | number>;
    sourceId: string;
    citation: string;
  }>;
  latestRun?: {
    passedCount: number;
    testCount: number;
    testsSha256: string;
    engineVersion: string;
    runBy: string;
    runAt: string;
    results: Array<{
      testId: string;
      passed: boolean;
      error?: string;
      mismatches?: Array<{ output: string; expected: unknown; actual?: unknown }>;
    }>;
  } | null;
}

async function engineFetch<T>(url: string, init?: RequestInit, fallback?: T): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    if (fallback !== undefined && (res.status === 404 || res.status === 503)) {
      return fallback;
    }
    const body = await res.json().catch(() => ({}));
    throw new TaxEngineRequestError(
      res.status,
      body?.code || 'TAX_ENGINE_ERROR',
      body?.error || body?.message || `Tax engine error (${res.status})`
    );
  }
  return (await res.json()) as T;
}

export const taxEngineService = {
  sources: async (): Promise<TaxSource[]> => {
    const r = await engineFetch<{ items?: TaxSource[] } | TaxSource[]>('/api/tax-engine/sources', undefined, []);
    return Array.isArray(r) ? r : r.items ?? [];
  },
  registerSource: async (input: {
    sourceId: string;
    jurisdiction: 'federal' | 'state';
    jurisdictionCode: string;
    authorityType: string;
    title: string;
    issuer: string;
    citation: string;
    url?: string;
    taxYears: number[];
  }) => engineFetch('/api/tax-engine/sources', { method: 'POST', body: JSON.stringify(input) }),
  verifySource: async (sourceId: string, sha256: string) =>
    engineFetch(`/api/tax-engine/sources/${encodeURIComponent(sourceId)}/verify`, {
      method: 'POST',
      body: JSON.stringify({ sha256 }),
    }),
  ruleSets: async (taxYear?: number): Promise<RuleSetSummary[]> => {
    const q = taxYear ? `?taxYear=${taxYear}` : '';
    const r = await engineFetch<{ items?: RuleSetSummary[] } | RuleSetSummary[]>(`/api/tax-engine/rule-sets${q}`, undefined, []);
    return Array.isArray(r) ? r : r.items ?? [];
  },
  ruleSet: async (ruleSetId: string): Promise<RuleSetDetail> =>
    engineFetch<RuleSetDetail>(`/api/tax-engine/rule-sets/${encodeURIComponent(ruleSetId)}`),
  draftRuleSet: async (definition: unknown) =>
    engineFetch('/api/tax-engine/rule-sets', { method: 'POST', body: JSON.stringify(definition) }),
  coverage: async (ruleSetId: string): Promise<RuleSetCoverage> =>
    engineFetch<RuleSetCoverage>(`/api/tax-engine/rule-sets/${encodeURIComponent(ruleSetId)}/coverage`),
  tests: async (ruleSetId: string): Promise<RuleSetTests> =>
    engineFetch<RuleSetTests>(`/api/tax-engine/rule-sets/${encodeURIComponent(ruleSetId)}/tests`),
  addTest: async (ruleSetId: string, payload: unknown) =>
    engineFetch(`/api/tax-engine/rule-sets/${encodeURIComponent(ruleSetId)}/tests`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  removeTest: async (ruleSetId: string, testId: string) =>
    engineFetch(`/api/tax-engine/rule-sets/${encodeURIComponent(ruleSetId)}/tests/${encodeURIComponent(testId)}`, {
      method: 'DELETE',
    }),
  runTests: async (ruleSetId: string) =>
    engineFetch(`/api/tax-engine/rule-sets/${encodeURIComponent(ruleSetId)}/tests/run`, { method: 'POST' }),
  transition: async (ruleSetId: string, action: 'submit' | 'approve' | 'reject', note?: string) =>
    engineFetch(`/api/tax-engine/rule-sets/${encodeURIComponent(ruleSetId)}/transition`, {
      method: 'POST',
      body: JSON.stringify({ action, ...(note ? { note } : {}) }),
    }),
  caseRuns: async (caseId: string): Promise<CalculationRun[]> => {
    const r = await engineFetch<{ items?: CalculationRun[] } | CalculationRun[]>(
      `/api/tax-engine/cases/${encodeURIComponent(caseId)}/runs`,
      undefined,
      []
    );
    return Array.isArray(r) ? r : r.items ?? [];
  },
  reviewRun: async (runId: string, decision: 'approve' | 'reject', note: string) =>
    engineFetch(`/api/tax-engine/runs/${encodeURIComponent(runId)}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, note }),
    }),
  runLineage: async (runId: string): Promise<RunLineage> =>
    engineFetch<RunLineage>(`/api/tax-engine/runs/${encodeURIComponent(runId)}/lineage`),
  caseResearch: async (caseId: string): Promise<ResearchMemo[]> => {
    const r = await engineFetch<{ items?: ResearchMemo[] } | ResearchMemo[]>(
      `/api/tax-engine/cases/${encodeURIComponent(caseId)}/research`,
      undefined,
      []
    );
    return Array.isArray(r) ? r : r.items ?? [];
  },
  openResearch: async (caseId: string, question: string) =>
    engineFetch(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/research`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
  citeResearch: async (
    memoId: string,
    citation: { authorityLevel: AuthorityLevel; sourceId?: string; reference?: string; note: string }
  ) =>
    engineFetch(`/api/tax-engine/research/${encodeURIComponent(memoId)}/citations`, {
      method: 'POST',
      body: JSON.stringify(citation),
    }),
  submitResearch: async (memoId: string, conclusion: string, version: number) =>
    engineFetch(`/api/tax-engine/research/${encodeURIComponent(memoId)}/submit`, {
      method: 'POST',
      body: JSON.stringify({ conclusion, version }),
    }),
  reviewResearch: async (memoId: string, decision: 'approve' | 'reject', note: string, version: number) =>
    engineFetch(`/api/tax-engine/research/${encodeURIComponent(memoId)}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, note, version }),
    }),
  caseDiagnostics: async (caseId: string): Promise<CaseDiagnostics> =>
    engineFetch<CaseDiagnostics>(
      `/api/tax-engine/cases/${encodeURIComponent(caseId)}/diagnostics`,
      undefined,
      { caseId, diagnosedAt: null, ready: false, blocking: 0, errors: 0, diagnostics: [] }
    ),
  runDiagnostics: async (caseId: string) =>
    engineFetch(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/diagnostics`, { method: 'POST' }),
  acknowledgeDiagnostic: async (diagnosticId: string, note: string) =>
    engineFetch(`/api/tax-engine/diagnostics/${encodeURIComponent(diagnosticId)}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  caseRisk: async (caseId: string): Promise<RiskAssessment[]> => {
    const r = await engineFetch<{ items?: RiskAssessment[] } | RiskAssessment[]>(
      `/api/tax-engine/cases/${encodeURIComponent(caseId)}/risk`,
      undefined,
      []
    );
    return Array.isArray(r) ? r : r.items ?? [];
  },
  assessRisk: async (caseId: string, amountCents: number, unsupportedPosition: boolean) =>
    engineFetch(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/risk`, {
      method: 'POST',
      body: JSON.stringify({ amountCents, unsupportedPosition }),
    }),
  caseConclusions: async (caseId: string): Promise<TaxConclusion[]> => {
    const r = await engineFetch<{ items?: TaxConclusion[] } | TaxConclusion[]>(
      `/api/tax-engine/cases/${encodeURIComponent(caseId)}/conclusions`,
      undefined,
      []
    );
    return Array.isArray(r) ? r : r.items ?? [];
  },
  conclusionReadiness: async (caseId: string): Promise<ConclusionReadiness> =>
    engineFetch<ConclusionReadiness>(
      `/api/tax-engine/cases/${encodeURIComponent(caseId)}/conclusions/readiness`,
      undefined,
      { ready: false, conclusions: 0, blockers: [] }
    ),
  traceConclusion: async (conclusionId: string): Promise<ConclusionTrace> =>
    engineFetch<ConclusionTrace>(`/api/tax-engine/conclusions/${encodeURIComponent(conclusionId)}/trace`),
  proposeConclusion: async (caseId: string, body: ConclusionInput) =>
    engineFetch(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/conclusions`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  reviseConclusion: async (conclusionId: string, body: ConclusionInput) =>
    engineFetch(`/api/tax-engine/conclusions/${encodeURIComponent(conclusionId)}/revise`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  submitConclusion: async (conclusionId: string) =>
    engineFetch(`/api/tax-engine/conclusions/${encodeURIComponent(conclusionId)}/submit`, { method: 'POST' }),
  reviewConclusion: async (conclusionId: string, decision: 'approve' | 'return' | 'reject', note?: string) =>
    engineFetch(`/api/tax-engine/conclusions/${encodeURIComponent(conclusionId)}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, ...(note ? { note } : {}) }),
    }),
  caseFormMappings: async (caseId: string): Promise<FormMapping[]> => {
    const r = await engineFetch<{ items?: FormMapping[] } | FormMapping[]>(
      `/api/tax-engine/cases/${encodeURIComponent(caseId)}/form-mappings`,
      undefined,
      []
    );
    return Array.isArray(r) ? r : r.items ?? [];
  },
  formRules: async (taxYear: number): Promise<FormRule[]> => {
    const r = await engineFetch<{ items?: FormRule[] } | FormRule[]>(
      `/api/tax-engine/form-rules?taxYear=${taxYear}`,
      undefined,
      []
    );
    return Array.isArray(r) ? r : r.items ?? [];
  },
  formMapping: async (mappingId: string): Promise<FormMapping> =>
    engineFetch<FormMapping>(`/api/tax-engine/form-mappings/${encodeURIComponent(mappingId)}`),
  mapForm: async (caseId: string, ruleId: string): Promise<FormMapping> =>
    engineFetch<FormMapping>(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/form-mappings`, {
      method: 'POST',
      body: JSON.stringify({ ruleId }),
    }),
  caseReturns: async (caseId: string): Promise<ReturnVersion[]> => {
    const r = await engineFetch<{ items?: ReturnVersion[] } | ReturnVersion[]>(
      `/api/tax-engine/cases/${encodeURIComponent(caseId)}/returns`,
      undefined,
      []
    );
    return Array.isArray(r) ? r : r.items ?? [];
  },
  returnTemplates: async (taxYear: number): Promise<ReturnTemplate[]> => {
    const r = await engineFetch<{ items?: ReturnTemplate[] } | ReturnTemplate[]>(
      `/api/tax-engine/return-templates?taxYear=${taxYear}`,
      undefined,
      []
    );
    return Array.isArray(r) ? r : r.items ?? [];
  },
  prepareReturn: async (caseId: string, templateRuleId: string): Promise<ReturnVersion> =>
    engineFetch<ReturnVersion>(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/returns`, {
      method: 'POST',
      body: JSON.stringify({ templateRuleId }),
    }),
  transitionReturn: async (returnVersionId: string, action: 'submit' | 'approve' | 'return', note?: string): Promise<ReturnVersion> =>
    engineFetch<ReturnVersion>(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/transition`, {
      method: 'POST',
      body: JSON.stringify({ action, ...(note ? { note } : {}) }),
    }),
  verifyReturn: async (returnVersionId: string): Promise<{ result: string; discrepancyCount?: number }> =>
    engineFetch(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/verify`, { method: 'POST' }),
  assessReturnRisk: async (returnVersionId: string, amountCents: number): Promise<{ outcome: string; reasonCodes?: string[] }> =>
    engineFetch(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/risk`, {
      method: 'POST',
      body: JSON.stringify({ amountCents }),
    }),
  returnReadiness: async (returnVersionId: string): Promise<FinalContext['readiness']> =>
    engineFetch(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/readiness`),
  assignQc: async (returnVersionId: string, qcUid: string): Promise<{ qcUid: string }> =>
    engineFetch(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/qc/assign`, {
      method: 'POST',
      body: JSON.stringify({ qcUid }),
    }),
  assignFinalAuthorizer: async (returnVersionId: string, authorizerUid: string): Promise<{ authorizerUid: string }> =>
    engineFetch(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/final/assign`, {
      method: 'POST',
      body: JSON.stringify({ authorizerUid }),
    }),
  returnVersion: async (returnVersionId: string): Promise<ReturnVersion> =>
    engineFetch<ReturnVersion>(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}`),
  returnComparison: async (returnVersionId: string): Promise<ReturnComparison> =>
    engineFetch<ReturnComparison>(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/comparison`),
  reviewQueue: async (): Promise<ReviewQueueItem[]> => {
    const r = await engineFetch<{ items?: ReviewQueueItem[] } | ReviewQueueItem[]>('/api/tax-engine/queues/review', undefined, []);
    return Array.isArray(r) ? r : r.items ?? [];
  },
  qcQueue: async (): Promise<QcQueueItem[]> => {
    const r = await engineFetch<{ items?: QcQueueItem[] } | QcQueueItem[]>('/api/tax-engine/queues/qc', undefined, []);
    return Array.isArray(r) ? r : r.items ?? [];
  },
  qcContext: async (returnVersionId: string): Promise<QcContext> =>
    engineFetch<QcContext>(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/qc`),
  recordQc: async (returnVersionId: string, results: QcResultInput[], note?: string): Promise<{ outcome: 'QC_PASSED' | 'QC_RETURNED' }> =>
    engineFetch(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/qc`, {
      method: 'POST',
      body: JSON.stringify({ results, ...(note ? { note } : {}) }),
    }),
  finalQueue: async (): Promise<FinalQueueItem[]> => {
    const r = await engineFetch<{ items?: FinalQueueItem[] } | FinalQueueItem[]>('/api/tax-engine/queues/final', undefined, []);
    return Array.isArray(r) ? r : r.items ?? [];
  },
  finalContext: async (returnVersionId: string): Promise<FinalContext> =>
    engineFetch<FinalContext>(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/final`),
  decideFinal: async (
    returnVersionId: string,
    payload: { outcome: FinalOutcome; attestationVersion: number; acknowledged: boolean; note?: string }
  ): Promise<{ outcome: FinalOutcome }> =>
    engineFetch(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/final`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  signatureContext: async (returnVersionId: string): Promise<SignatureContext> =>
    engineFetch<SignatureContext>(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/signature`),
  releaseSignaturePackage: async (
    returnVersionId: string,
    payload: { consentVersion: number; acknowledged: boolean; signers: string[] }
  ) =>
    engineFetch(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/signature/release`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  withdrawSignaturePackage: async (returnVersionId: string, reason: string) =>
    engineFetch(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/signature/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};
