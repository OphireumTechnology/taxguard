import { getStoredToken } from './api';

export class TaxEngineRequestError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = 'TaxEngineRequestError';
    this.status = status;
    this.code = code;
  }
}

export const AUTHORITY_TYPES = ['STATUTE', 'REGULATION', 'REVENUE_RULING', 'IRS_PUBLICATION', 'CASE_LAW', 'STATE_GUIDANCE'] as const;
export const AUTHORITY_LEVELS = ['PRIMARY', 'SECONDARY', 'INTERNAL_POLICY'] as const;
export const AUTHORITY_LABELS: Record<string, string> = {
  PRIMARY: 'Primary authority',
  SECONDARY: 'Secondary authority',
  INTERNAL_POLICY: 'Internal policy',
};

export const CONCLUSION_TYPES = ['INCOME', 'DEDUCTION', 'CREDIT', 'FILING_POSITION', 'ENTITY_ELECTION', 'BASIS', 'OTHER'] as const;
export const RISK_OUTCOME_LABELS: Record<string, string> = {
  LOW: 'Low risk',
  MODERATE: 'Moderate risk',
  HIGH: 'High risk',
  REQUIRES_ESCALATION: 'Requires senior review',
};
export const RISK_REASON_LABELS: Record<string, string> = {
  MATERIAL_AMOUNT: 'Exceeds materiality threshold',
  UNSUPPORTED_POSITION: 'Unsupported or unverified tax position',
  PRIOR_YEAR_VARIANCE: 'Significant variance from prior year',
};
export const RETURN_RISK_REASON_LABELS: Record<string, string> = {
  ...RISK_REASON_LABELS,
  UNRESOLVED_DIAGNOSTICS: 'Unresolved return diagnostics',
  MISSING_CONCLUSION: 'Missing approved conclusion',
  HIGH_MATERIALITY: 'High materiality balance',
};
export const RETURN_PROBLEM_LABELS: Record<string, string> = {
  STALE_SOURCE: 'Underlying workpapers or conclusions changed',
  MISSING_SIGNATURE: 'Missing required approval signature',
  DIAGNOSTIC_ERROR: 'Blocking return diagnostic present',
  RULE_MISMATCH: 'Tax rule set version outdated',
};

export type AuthorityLevel = (typeof AUTHORITY_LEVELS)[number] | string;
export type ConclusionLinkType = 'SOURCE' | 'WORKPAPER' | 'DOCUMENT' | 'CALCULATION' | 'MEMO' | string;
export type FinalOutcome = 'APPROVE' | 'RETURN' | 'REJECT' | string;

export interface TaxSource {
  source_id: string;
  title: string;
  citation?: string;
  jurisdiction?: string;
  jurisdictionCode?: string;
  authorityType?: string;
  authorityLevel?: AuthorityLevel;
  verified?: boolean;
  sha256?: string;
  [key: string]: any;
}

export interface RuleSetSummary {
  ruleSetId: string;
  name?: string;
  taxYear: number;
  returnFamily?: string;
  status: string;
  version?: number;
  [key: string]: any;
}

export interface RuleSetCoverage {
  ruleSetId: string;
  coveredCount?: number;
  totalCount?: number;
  percentage?: number;
  [key: string]: any;
}

export interface RuleSetTests {
  tests: Array<{
    testId: string;
    name: string;
    sourceId?: string;
    citation?: string;
    passed?: boolean;
    [key: string]: any;
  }>;
  passedCount?: number;
  failedCount?: number;
  [key: string]: any;
}

export interface RuleSetDetail extends RuleSetSummary {
  ruleSet?: RuleSetSummary;
  coverage?: RuleSetCoverage | null;
  tests?: RuleSetTests | null;
  [key: string]: any;
}

export interface CalculationRun {
  runId: string;
  caseId?: string;
  ruleSetId?: string;
  status: string;
  createdAt?: string;
  [key: string]: any;
}

export interface RunLineage {
  runId: string;
  inputs?: Array<Record<string, any>>;
  outputs?: Array<Record<string, any>>;
  evidence?: Array<Record<string, any>>;
  [key: string]: any;
}

export interface TaxConclusion {
  conclusionId: string;
  caseId?: string;
  type: string;
  title?: string;
  summary?: string;
  statement?: string;
  status: string;
  stale?: Array<{ type: string; ref: string; reason: string; [key: string]: any }>;
  version?: number;
  [key: string]: any;
}

export interface ConclusionInput {
  type: string;
  title?: string;
  summary?: string;
  statement?: string;
  amount?: string;
  links?: Array<{
    type?: string;
    ref?: string;
    linkType?: ConclusionLinkType;
    targetId?: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export interface ConclusionReadiness {
  ready: boolean;
  blockingReasons?: string[];
  [key: string]: any;
}

export interface ConclusionTrace {
  conclusionId: string;
  evidence?: Array<Record<string, any>>;
  links?: Array<Record<string, any>>;
  [key: string]: any;
}

export interface FormRule {
  ruleId: string;
  formId: string;
  taxYear: number;
  returnFamily: string;
  status: string;
  version?: number;
  [key: string]: any;
}

export interface FormMapping {
  mappingId: string;
  formId: string;
  ruleId?: string;
  version: number;
  status: string;
  stale: string[];
  replayed?: boolean;
  lines?: Array<Record<string, any>>;
  problems?: Array<Record<string, any>>;
  [key: string]: any;
}

export interface ReturnTemplate {
  templateId: string;
  name?: string;
  taxYear: number;
  returnFamily: string;
  status: string;
  [key: string]: any;
}

export type ReturnVersionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'RETURNED'
  | 'APPROVED'
  | 'SUPERSEDED'
  | 'STALE';

export interface ReturnVersion {
  returnVersionId: string;
  caseId?: string;
  templateId: string;
  version: number;
  status: ReturnVersionStatus;
  stale: Array<{ type?: string; ref?: string; reason?: string; [key: string]: any }>;
  problems?: string[];
  verification?: Record<string, any> | null;
  readiness?: Record<string, any> | null;
  risk?: Record<string, any> | null;
  finalAuthorization?: Record<string, any> | null;
  lines?: Array<Record<string, any>>;
  [key: string]: any;
}

export interface CaseDiagnostics {
  findings: Array<{
    diagnostic_id: string;
    severity: string;
    code?: string;
    message: string;
    acknowledged?: boolean;
    [key: string]: any;
  }>;
  lastRunAt?: string;
  [key: string]: any;
}

export interface RiskAssessment {
  assessmentId?: string;
  outcome: string;
  reasons?: string[];
  materialityCents?: number;
  createdAt?: string;
  [key: string]: any;
}

export interface ResearchMemo {
  memo_id: string;
  question: string;
  conclusion?: string;
  status: string;
  version: number;
  citations?: Array<Record<string, any>>;
  [key: string]: any;
}

export interface QcQueueItem {
  returnVersionId: string;
  caseId?: string;
  clientName?: string;
  templateId?: string;
  version?: number;
  status?: string;
  riskReasons?: string[];
  [key: string]: any;
}

export interface QcContext {
  returnVersionId: string;
  checklist?: {
    checklistVersion?: string;
    items: Array<{
      code: string;
      text: string;
      id?: string;
      label?: string;
      required?: boolean;
      [key: string]: any;
    }>;
    [key: string]: any;
  } | null;
  [key: string]: any;
}

export interface QcResultInput {
  code?: string;
  result?: string;
  itemId?: string;
  status?: string;
  note?: string;
  [key: string]: any;
}

export interface FinalQueueItem {
  returnVersionId: string;
  caseId?: string;
  clientName?: string;
  templateId?: string;
  version?: number;
  status?: string;
  [key: string]: any;
}

export interface FinalContext {
  returnVersionId: string;
  attestation: {
    attestationVersion: string;
    text?: string;
  };
  readiness?: Record<string, any>;
  [key: string]: any;
}

export interface ReviewQueueItem {
  returnVersionId: string;
  caseId?: string;
  clientName?: string;
  templateId?: string;
  version?: number;
  status?: string;
  stale: Array<any>;
  verification: Record<string, any> | null;
  risk: Record<string, any> | null;
  riskReasons?: string[];
  [key: string]: any;
}

export interface ComparisonLine {
  lineCode: string;
  label?: string;
  priorCents?: number | null;
  currentCents?: number | null;
  deltaCents?: number | null;
  [key: string]: any;
}

export interface ReturnComparison {
  returnVersionId: string;
  priorReturnVersionId?: string | null;
  lines: ComparisonLine[];
  [key: string]: any;
}

export interface SignatureContext {
  returnVersionId: string;
  status: string;
  canRelease?: boolean;
  canWithdraw?: boolean;
  packageId?: string | null;
  [key: string]: any;
}

export function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test((value || '').trim());
}

export function dollarsToCents(input: string | number): number | null {
  const num = typeof input === 'number' ? input : Number(String(input).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

export function parseAssignments(text: string): Array<[string, number]> {
  const result: Array<[string, number]> = [];
  for (const line of (text || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [k, v] = trimmed.split('=').map(s => s.trim());
    if (k && v !== undefined && Number.isFinite(Number(v))) {
      result.push([k, Number(v)]);
    }
  }
  return result;
}

export function taxEngineMessage(error: unknown): string {
  if (error instanceof TaxEngineRequestError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'The tax engine could not complete this request.';
}

export function conclusionBadge(c: Pick<TaxConclusion, 'status' | 'stale'>): string {
  if (c.stale && c.stale.length > 0) return 'STALE';
  return c.status || 'DRAFT';
}

export function staleReason(code: string): string {
  return code ? code.replace(/_/g, ' ').toLowerCase() : 'source changed';
}

export function evidenceText(item: Record<string, any> | string): string {
  if (typeof item === 'string') return item;
  return String(item?.label || item?.title || item?.summary || item?.id || 'Evidence record');
}

export function formProblemText(problem: Record<string, any> | string): string {
  if (typeof problem === 'string') return problem.replace(/_/g, ' ');
  return String(problem?.message || problem?.code || 'Form mapping issue');
}

export function returnProblemText(
  problem: string | { type?: string; ref?: string; reason?: string; code?: string; message?: string; [key: string]: any }
): string {
  if (typeof problem === 'string') {
    return RETURN_PROBLEM_LABELS[problem] || problem.replace(/_/g, ' ');
  }
  const key = problem.code || problem.reason || problem.type || '';
  return (key && RETURN_PROBLEM_LABELS[key]) || problem.message || problem.reason || key.replace(/_/g, ' ') || 'Return issue';
}

export function verificationText(v: Record<string, any> | null | undefined): string {
  if (!v) return 'Not verified';
  return String(v.status || v.summary || 'Verified');
}

export function readinessText(r: Record<string, any> | null | undefined): string {
  if (!r) return 'Not evaluated';
  return r.ready ? 'Ready' : String(r.summary || 'Not ready');
}

export function returnRiskText(r: Record<string, any> | null | undefined): string {
  if (!r) return 'Not assessed';
  const outcome = String(r.outcome || 'UNKNOWN');
  return RISK_OUTCOME_LABELS[outcome] || outcome;
}

export function finalAuthorizationText(f: Record<string, any> | null | undefined): string {
  if (!f) return 'Not authorized';
  return String(f.outcome || f.status || 'Pending');
}

export function signaturePackageText(s: Record<string, any> | null | undefined): string {
  if (!s) return 'Not released';
  return String(s.status || 'Pending');
}

export function comparisonLineText(line: ComparisonLine): string {
  const cur = typeof line.currentCents === 'number' ? `$${(line.currentCents / 100).toFixed(2)}` : '—';
  const prev = typeof line.priorCents === 'number' ? `$${(line.priorCents / 100).toFixed(2)}` : '—';
  return `${line.label || line.lineCode}: ${cur} (prior: ${prev})`;
}

async function engineFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(url, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new TaxEngineRequestError(
      (body && (body.error || body.message)) || `Tax engine request failed (${res.status})`,
      res.status,
      body?.code
    );
  }
  return body as T;
}

export const taxEngineService = {
  sources: () => engineFetch<TaxSource[]>('/api/tax-engine/sources').then(r => (Array.isArray(r) ? r : [])),
  registerSource: (payload: Record<string, any>) =>
    engineFetch<TaxSource>('/api/tax-engine/sources', { method: 'POST', body: JSON.stringify(payload) }),
  verifySource: (sourceId: string, sha256: string) =>
    engineFetch<TaxSource>(`/api/tax-engine/sources/${encodeURIComponent(sourceId)}/verify`, {
      method: 'POST',
      body: JSON.stringify({ sha256 }),
    }),
  ruleSets: (taxYear?: number) =>
    engineFetch<RuleSetSummary[]>(
      `/api/tax-engine/rule-sets${taxYear ? `?taxYear=${encodeURIComponent(String(taxYear))}` : ''}`
    ).then(r => (Array.isArray(r) ? r : [])),
  ruleSet: (ruleSetId: string) =>
    engineFetch<RuleSetDetail>(`/api/tax-engine/rule-sets/${encodeURIComponent(ruleSetId)}`),
  assignQc: (returnVersionId: string, reviewerUid: string) =>
    engineFetch<{ qcUid?: string; [key: string]: any }>(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/qc-assign`, {
      method: 'POST',
      body: JSON.stringify({ reviewerUid }),
    }),
  assignFinalAuthorizer: (returnVersionId: string, authorizerUid: string) =>
    engineFetch<{ authorizerUid?: string; [key: string]: any }>(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/final-assign`, {
      method: 'POST',
      body: JSON.stringify({ authorizerUid }),
    }),
  coverage: (ruleSetId: string) =>
    engineFetch<RuleSetCoverage>(`/api/tax-engine/rule-sets/${encodeURIComponent(ruleSetId)}/coverage`),
  tests: (ruleSetId: string) =>
    engineFetch<RuleSetTests>(`/api/tax-engine/rule-sets/${encodeURIComponent(ruleSetId)}/tests`),
  draftRuleSet: (payload: unknown) =>
    engineFetch<RuleSetSummary>('/api/tax-engine/rule-sets', { method: 'POST', body: JSON.stringify(payload) }),
  addTest: (ruleSetId: string, payload: Record<string, any>) =>
    engineFetch<unknown>(`/api/tax-engine/rule-sets/${encodeURIComponent(ruleSetId)}/tests`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  removeTest: (ruleSetId: string, testId: string) =>
    engineFetch<unknown>(
      `/api/tax-engine/rule-sets/${encodeURIComponent(ruleSetId)}/tests/${encodeURIComponent(testId)}`,
      { method: 'DELETE' }
    ),
  runTests: (ruleSetId: string) =>
    engineFetch<unknown>(`/api/tax-engine/rule-sets/${encodeURIComponent(ruleSetId)}/tests/run`, {
      method: 'POST',
    }),
  transition: (ruleSetId: string, action: 'submit' | 'approve' | 'reject', note?: string) =>
    engineFetch<unknown>(`/api/tax-engine/rule-sets/${encodeURIComponent(ruleSetId)}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  caseRuns: (caseId: string) =>
    engineFetch<CalculationRun[]>(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/runs`).then(r =>
      Array.isArray(r) ? r : []
    ),
  reviewRun: (runId: string, decision: 'approve' | 'reject', note?: string) =>
    engineFetch<unknown>(`/api/tax-engine/runs/${encodeURIComponent(runId)}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, note }),
    }),
  runLineage: (runId: string) =>
    engineFetch<RunLineage>(`/api/tax-engine/runs/${encodeURIComponent(runId)}/lineage`),

  caseDiagnostics: (caseId: string) =>
    engineFetch<CaseDiagnostics>(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/diagnostics`),
  runDiagnostics: (caseId: string) =>
    engineFetch<CaseDiagnostics>(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/diagnostics/run`, {
      method: 'POST',
    }),
  acknowledgeDiagnostic: (diagnosticId: string, note: string) =>
    engineFetch<unknown>(`/api/tax-engine/diagnostics/${encodeURIComponent(diagnosticId)}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  caseRisk: (caseId: string) =>
    engineFetch<RiskAssessment[]>(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/risk`).then(r =>
      Array.isArray(r) ? r : []
    ),
  assessRisk: (caseId: string, materialityCents: number, unsupported: boolean) =>
    engineFetch<RiskAssessment>(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/risk`, {
      method: 'POST',
      body: JSON.stringify({ materialityCents, unsupported }),
    }),

  caseResearch: (caseId: string) =>
    engineFetch<ResearchMemo[]>(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/research`).then(r =>
      Array.isArray(r) ? r : []
    ),
  openResearch: (caseId: string, question: string) =>
    engineFetch<ResearchMemo>(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/research`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
  citeResearch: (memoId: string, payload: Record<string, any>) =>
    engineFetch<unknown>(`/api/tax-engine/research/${encodeURIComponent(memoId)}/citations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  submitResearch: (memoId: string, conclusion: string, version: number) =>
    engineFetch<unknown>(`/api/tax-engine/research/${encodeURIComponent(memoId)}/submit`, {
      method: 'POST',
      body: JSON.stringify({ conclusion, version }),
    }),
  reviewResearch: (memoId: string, decision: 'approve' | 'reject', note: string, version: number) =>
    engineFetch<unknown>(`/api/tax-engine/research/${encodeURIComponent(memoId)}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, note, version }),
    }),

  caseConclusions: (caseId: string) =>
    engineFetch<TaxConclusion[]>(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/conclusions`).then(r =>
      Array.isArray(r) ? r : []
    ),
  conclusionReadiness: (caseId: string) =>
    engineFetch<ConclusionReadiness>(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/conclusions/readiness`),
  traceConclusion: (conclusionId: string) =>
    engineFetch<ConclusionTrace>(`/api/tax-engine/conclusions/${encodeURIComponent(conclusionId)}/trace`),
  proposeConclusion: (caseId: string, payload: ConclusionInput) =>
    engineFetch<TaxConclusion>(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/conclusions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  reviseConclusion: (conclusionId: string, payload: ConclusionInput) =>
    engineFetch<TaxConclusion>(`/api/tax-engine/conclusions/${encodeURIComponent(conclusionId)}/revise`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  submitConclusion: (conclusionId: string) =>
    engineFetch<unknown>(`/api/tax-engine/conclusions/${encodeURIComponent(conclusionId)}/submit`, {
      method: 'POST',
    }),
  reviewConclusion: (conclusionId: string, decision: 'approve' | 'return' | 'reject', note: string) =>
    engineFetch<unknown>(`/api/tax-engine/conclusions/${encodeURIComponent(conclusionId)}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, note }),
    }),

  caseFormMappings: (caseId: string) =>
    engineFetch<FormMapping[]>(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/form-mappings`).then(r =>
      Array.isArray(r) ? r : []
    ),
  formRules: (taxYear: number) =>
    engineFetch<FormRule[]>(`/api/tax-engine/form-rules?taxYear=${encodeURIComponent(String(taxYear))}`).then(r =>
      Array.isArray(r) ? r : []
    ),
  formMapping: (mappingId: string) =>
    engineFetch<FormMapping>(`/api/tax-engine/form-mappings/${encodeURIComponent(mappingId)}`),
  mapForm: (caseId: string, ruleId: string) =>
    engineFetch<FormMapping>(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/form-mappings`, {
      method: 'POST',
      body: JSON.stringify({ ruleId }),
    }),

  caseReturns: (caseId: string) =>
    engineFetch<ReturnVersion[]>(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/returns`).then(r =>
      Array.isArray(r) ? r : []
    ),
  returnTemplates: (taxYear: number) =>
    engineFetch<ReturnTemplate[]>(
      `/api/tax-engine/return-templates?taxYear=${encodeURIComponent(String(taxYear))}`
    ).then(r => (Array.isArray(r) ? r : [])),
  prepareReturn: (caseId: string, templateId: string) =>
    engineFetch<ReturnVersion>(`/api/tax-engine/cases/${encodeURIComponent(caseId)}/returns`, {
      method: 'POST',
      body: JSON.stringify({ templateId }),
    }),
  returnVersion: (returnVersionId: string) =>
    engineFetch<ReturnVersion>(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}`),
  transitionReturn: (returnVersionId: string, action: string, note?: string) =>
    engineFetch<ReturnVersion>(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  verifyReturn: (returnVersionId: string) =>
    engineFetch<Record<string, any>>(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/verify`, {
      method: 'POST',
    }),
  assessReturnRisk: (returnVersionId: string, materialityCents: number) =>
    engineFetch<Record<string, any>>(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/risk`, {
      method: 'POST',
      body: JSON.stringify({ materialityCents }),
    }),
  returnReadiness: (returnVersionId: string) =>
    engineFetch<Record<string, any>>(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/readiness`, {
      method: 'POST',
    }),
  returnComparison: (returnVersionId: string) =>
    engineFetch<ReturnComparison>(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/comparison`),

  qcQueue: () => engineFetch<QcQueueItem[]>('/api/tax-engine/qc-queue').then(r => (Array.isArray(r) ? r : [])),
  qcContext: (returnVersionId: string) =>
    engineFetch<QcContext>(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/qc-context`),
  recordQc: (returnVersionId: string, results: QcResultInput[], note?: string) =>
    engineFetch<Record<string, any>>(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/qc`, {
      method: 'POST',
      body: JSON.stringify({ results, note }),
    }),

  finalQueue: () =>
    engineFetch<FinalQueueItem[]>('/api/tax-engine/final-queue').then(r => (Array.isArray(r) ? r : [])),
  finalContext: (returnVersionId: string) =>
    engineFetch<FinalContext>(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/final-context`),
  decideFinal: (returnVersionId: string, payload: Record<string, any>) =>
    engineFetch<Record<string, any>>(`/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/final`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  reviewQueue: () =>
    engineFetch<ReviewQueueItem[]>('/api/tax-engine/review-queue').then(r => (Array.isArray(r) ? r : [])),

  signatureContext: (returnVersionId: string) =>
    engineFetch<SignatureContext>(
      `/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/signature-package`
    ),
  releaseSignaturePackage: (returnVersionId: string, payload?: Record<string, any>) =>
    engineFetch<Record<string, any>>(
      `/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/signature-package/release`,
      { method: 'POST', body: JSON.stringify(payload ?? {}) }
    ),
  withdrawSignaturePackage: (returnVersionId: string, reason: string) =>
    engineFetch<Record<string, any>>(
      `/api/tax-engine/returns/${encodeURIComponent(returnVersionId)}/signature-package/withdraw`,
      { method: 'POST', body: JSON.stringify({ reason }) }
    ),
};
