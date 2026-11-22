import { api } from './api';

export const AUTHORITY_LEVELS = ['STATUTE', 'REGULATION', 'RULING', 'CASE_LAW', 'GUIDANCE', 'INTERNAL'] as const;
export type AuthorityLevel = (typeof AUTHORITY_LEVELS)[number] | string;

export const AUTHORITY_TYPES = ['statute', 'regulation', 'ruling', 'case_law', 'publication', 'form_instruction', 'notice'] as const;

export const AUTHORITY_LABELS: Record<string, string> = {
  STATUTE: 'Statute (IRC / State Code)',
  REGULATION: 'Treasury Regulation',
  RULING: 'Revenue Ruling / Procedure',
  CASE_LAW: 'Tax Court / Judicial Precedent',
  GUIDANCE: 'IRS Notice / Publication',
  INTERNAL: 'Firm Technical Policy',
};

export const CONCLUSION_TYPES = [
  'INCOME_INCLUSION',
  'FILING_STATUS',
  'INCOME_CHARACTERIZATION',
  'DEDUCTION_ALLOWANCE',
  'CREDIT_ELIGIBILITY',
  'ENTITY_ELECTION',
  'STATE_NEXUS',
] as const;

export type ConclusionLinkType = 'EVIDENCE' | 'DOCUMENT' | 'WORKPAPER' | 'CALCULATION' | 'RESEARCH' | 'RESEARCH_MEMO' | string;

export const RISK_OUTCOME_LABELS: Record<string, string> = {
  LOW: 'Low Risk',
  MODERATE: 'Moderate Risk',
  HIGH: 'High Risk — Reviewer Escalation',
  BLOCKED: 'Blocked — Resolution Required',
};

export const RISK_REASON_LABELS: Record<string, string> = {
  MATERIAL_VARIANCE: 'Material year-over-year variance',
  MISSING_SUBSTANTIATION: 'Missing primary substantiation',
  STALE_CONCLUSION: 'Tax conclusion requires re-verification',
  UNRESOLVED_DIAGNOSTIC: 'Open critical diagnostic',
};

export const RETURN_PROBLEM_LABELS: Record<string, string> = {
  MISSING_INPUT: 'Missing required input',
  UNMAPPED_LINE: 'Unmapped schedule line',
  BALANCE_MISMATCH: 'Book-to-tax mismatch',
  STALE_CALCULATION: 'Calculation out of date',
};

export const RETURN_RISK_REASON_LABELS: Record<string, string> = {
  ...RISK_REASON_LABELS,
  ...RETURN_PROBLEM_LABELS,
};

export type FinalOutcome = 'AUTHORIZED' | 'RETURNED' | 'HOLD' | 'REJECTED' | string;
export type ReturnStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED' | 'SUPERSEDED' | 'STALE';

export interface TaxSource {
  id?: string;
  source_id: string;
  jurisdiction: string;
  jurisdiction_code: string;
  authority_type: string;
  authorityLevel?: AuthorityLevel;
  citation: string;
  title: string;
  issuer?: string;
  url?: string;
  sha256?: string;
  tax_years: number[];
  status: string;
  registered_by?: string;
  verified_by?: string | null;
  synthetic?: boolean;
  [key: string]: any;
}

export interface ResearchMemo {
  id: string;
  title: string;
  summary?: string;
  authorityLevel?: AuthorityLevel;
  sources?: TaxSource[];
  status: string;
  createdAt?: string;
  [key: string]: any;
}

export interface StaleSourceEntry {
  type: string;
  ref: string;
  reason?: string;
  [key: string]: any;
}

export interface TaxConclusion {
  id?: string;
  conclusionId: string;
  version: number;
  type: string;
  title?: string;
  statement: string;
  summary?: string;
  amount?: string | null;
  status: string;
  stale: StaleSourceEntry[];
  staleReason?: string;
  preparedBy?: string;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  [key: string]: any;
}

export interface ConclusionInput {
  type: string;
  title?: string;
  summary?: string;
  statement?: string;
  amount?: string | null;
  links?: Array<{ type: ConclusionLinkType; ref: string }>;
  [key: string]: any;
}

export interface ConclusionReadiness {
  ready: boolean;
  conclusions?: number;
  blockers: Array<{ version: number; reasons: string[]; [key: string]: any }>;
  [key: string]: any;
}

export interface ConclusionTrace {
  conclusionId?: string;
  conclusion: TaxConclusion;
  sources: Array<{
    type: ConclusionLinkType;
    ref: string;
    snapshot: Record<string, any>;
    current: Record<string, any>;
    detail?: any;
  }>;
  versions: TaxConclusion[];
  audit: Array<{ action: string; version?: number; actorUid: string; at: string }>;
  formLines: Array<{ formId: string; line: string }>;
  links?: Array<{ id: string; linkType: ConclusionLinkType; refId: string; label?: string }>;
  [key: string]: any;
}

export interface CalculationRun {
  id: string;
  status: string;
  ruleSetId?: string;
  createdAt?: string;
  outputs?: Record<string, any>;
  [key: string]: any;
}

export interface RunLineage {
  runId: string;
  inputs: any[];
  sources?: any[];
  [key: string]: any;
}

export interface FormRule {
  id: string;
  formCode?: string;
  lineCode?: string;
  description?: string;
  status?: string;
  [key: string]: any;
}

export interface FormMapping {
  id?: string;
  mappingId?: string;
  formCode?: string;
  formId?: string;
  formVersion?: string;
  version?: number;
  status: ReturnStatus;
  stale: any[];
  lines?: any[];
  values?: any[];
  problems?: any[];
  [key: string]: any;
}

export interface ReturnTemplate {
  id?: string;
  templateRuleId: string;
  templateId: string;
  version: number;
  forms: number;
  returnFamily: string;
  jurisdiction: string;
  jurisdictionCode: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: string;
  formCode?: string;
  taxYear?: number;
  title?: string;
  [key: string]: any;
}

export interface ReturnVersion {
  id?: string;
  returnVersionId: string;
  templateId: string;
  templateVersion: number | string;
  templateSha256: string;
  version: number;
  formCode?: string;
  status: ReturnStatus;
  stale: any[];
  forms: Array<{
    formId: string;
    formVersion: string;
    mappingId: string;
    mappingVersion: number;
    valuesSha256?: string;
    [key: string]: any;
  }>;
  missing: Array<{ formId: string; formVersion: string }>;
  preparedBy: string;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  lineage?: Array<{
    mappingId: string;
    formId: string;
    formVersion: string;
    version: number;
    values?: Array<{
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
  problems?: any[];
  lines?: any[];
  createdAt: string;
  [key: string]: any;
}

export interface CaseDiagnostics {
  items: any[];
  blockingCount?: number;
  [key: string]: any;
}

export interface RiskAssessment {
  outcome: string;
  reasons: string[];
  score?: number;
  [key: string]: any;
}

export interface QcQueueItem {
  id?: string;
  returnVersionId?: string;
  caseId: string;
  status: string;
  [key: string]: any;
}

export interface QcContext {
  item?: QcQueueItem;
  checks?: any[];
  [key: string]: any;
}

export interface QcResultInput {
  outcome: string;
  notes?: string;
  [key: string]: any;
}

export interface FinalQueueItem {
  id?: string;
  returnVersionId?: string;
  caseId: string;
  status: string;
  [key: string]: any;
}

export interface FinalContext {
  item?: FinalQueueItem;
  readiness?: any;
  [key: string]: any;
}

export interface ReviewQueueItem {
  id?: string;
  returnVersionId?: string;
  caseId: string;
  status: string;
  stale: any[];
  risk: any;
  verification: any;
  riskReasons?: string[];
  [key: string]: any;
}

export interface SignatureContext {
  status: string;
  packageId?: string;
  releasedAt?: string;
  [key: string]: any;
}

export interface ComparisonLine {
  formId?: string;
  formVersion?: string;
  priorFormVersion?: string;
  schedule?: string;
  line?: string;
  field?: string;
  lineCode?: string;
  label?: string;
  kind?: string;
  variance?: boolean;
  priorCents?: number;
  currentCents?: number;
  deltaCents?: number;
  [key: string]: any;
}

export interface ReturnComparison {
  templateId?: string;
  varianceCheck?: string;
  variancePolicyVersion?: number;
  previousVersion?: { version: number; lines: ComparisonLine[] } | null;
  priorYear: {
    taxYear: number;
    status: string;
    templateId?: string;
    version?: number;
    stale?: boolean;
    lines: ComparisonLine[];
  };
  currentYear?: number;
  lines?: ComparisonLine[];
  [key: string]: any;
}

export interface RuleSetSummary {
  id?: string;
  ruleSetId: string;
  code?: string;
  jurisdiction: string;
  jurisdictionCode: string;
  returnFamily: string;
  taxYear: number;
  version: number;
  status: string;
  preparedBy?: string;
  reviewedBy?: string | null;
  synthetic?: boolean;
  [key: string]: any;
}

export interface RuleSetDetail extends RuleSetSummary {
  contentSha256: string;
  sourceIds: string[];
  reviewNote?: string | null;
  definition: {
    parameters?: Array<{
      key: string;
      filingStatus?: string | null;
      value: string | number;
      unit?: string | null;
      sourceId?: string | null;
      citation?: string | null;
    }>;
    [key: string]: any;
  };
  rules?: any[];
  sources?: TaxSource[];
}

export interface RuleSetCoverage {
  total?: number;
  covered?: number;
  missingOutputs: string[];
  missingFilingStatuses: string[];
  gaps?: any[];
  [key: string]: any;
}

export interface RuleSetTests {
  passed?: number;
  failed?: number;
  testsSha256?: string;
  tests: Array<{
    testId: string;
    name: string;
    filingStatus?: string | null;
    sourceId: string;
    citation: string;
    expected: Record<string, any>;
    [key: string]: any;
  }>;
  latestRun?: {
    passedCount: number;
    testCount: number;
    testsSha256?: string;
    engineVersion?: string;
    runBy?: string;
    runAt: string;
    results: Array<{
      testId: string;
      passed: boolean;
      error?: string | null;
      mismatches?: Array<{ output: string; expected: any; actual?: any }>;
    }>;
  } | null;
  cases?: any[];
  [key: string]: any;
}

export class TaxEngineRequestError extends Error {
  constructor(public readonly code: string, message?: string, public readonly status?: number) {
    super(message || code);
    this.name = 'TaxEngineRequestError';
  }
}

export function dollarsToCents(input: string | number): number | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) && input >= 0 ? Math.round(input * 100) : null;
  }
  const trimmed = String(input ?? '').trim().replace(/[$,]/g, '');
  if (!trimmed || !/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) && num >= 0 ? Math.round(num * 100) : null;
}

export function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test((value || '').trim());
}

export function parseAssignments(raw: string): Array<[string, string]> | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const entries: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const line of trimmed.split('\n')) {
    const clean = line.trim();
    if (!clean) continue;
    const idx = clean.indexOf('=');
    if (idx <= 0) return null;
    const key = clean.slice(0, idx).trim();
    const val = clean.slice(idx + 1).trim();
    if (!key || !val || seen.has(key)) return null;
    seen.add(key);
    entries.push([key, val]);
  }
  return entries.length > 0 ? entries : null;
}

export function conclusionBadge(input: string | TaxConclusion): string {
  if (typeof input === 'string') return (input || 'draft').replace(/_/g, ' ');
  if (Array.isArray(input.stale) && input.stale.length > 0 && input.status !== 'SUPERSEDED') return 'STALE';
  return (input.status || 'DRAFT').replace(/_/g, ' ');
}

export function evidenceText(item: any): string {
  return item?.label || item?.title || item?.refId || item?.ref || item?.id || 'Evidence record';
}

export function staleReason(reason?: string): string {
  return reason ? reason.replace(/_/g, ' ') : 'Requires re-verification';
}

export function readinessText(state: any): string {
  if (typeof state === 'string') return state.replace(/_/g, ' ');
  return state?.ready ? 'Ready' : 'Action Required';
}

export function returnProblemText(code: any): string {
  const key = typeof code === 'string' ? code : code?.code || code?.reason || '';
  return RETURN_PROBLEM_LABELS[key] || String(key).replace(/_/g, ' ');
}

export function returnRiskText(code: any): string {
  if (code && typeof code === 'object') {
    const outcome = code.outcome || code.status || 'ASSESSED';
    return RISK_OUTCOME_LABELS[outcome] || String(outcome).replace(/_/g, ' ');
  }
  return RETURN_RISK_REASON_LABELS[String(code)] || String(code || '').replace(/_/g, ' ');
}

export function formProblemText(code: any): string {
  const key = typeof code === 'string' ? code : code?.code || code?.reason || '';
  return String(key).replace(/_/g, ' ');
}

export function verificationText(status: any): string {
  const key = typeof status === 'string' ? status : status?.status || status?.outcome || 'unverified';
  return String(key).replace(/_/g, ' ');
}

export function finalAuthorizationText(status: any): string {
  const key = typeof status === 'string' ? status : status?.finalAuthorization || status?.status || 'pending';
  return String(key).replace(/_/g, ' ');
}

export function signaturePackageText(status: any): string {
  const key = typeof status === 'string' ? status : status?.status || 'not_released';
  return String(key).replace(/_/g, ' ');
}

export function comparisonLineText(line: ComparisonLine): string {
  return line?.label || [line?.formId, line?.schedule, line?.line, line?.field].filter(Boolean).join(' ') || line?.lineCode || 'Line item';
}

export function taxEngineMessage(err: unknown, fallback = 'Tax engine service unavailable.'): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const taxEngineService: Record<string, (...args: any[]) => Promise<any>> = new Proxy(
  {},
  {
    get(_target, prop: string) {
      return (...args: any[]) =>
        api.request(`/api/tax-engine/${encodeURIComponent(prop)}`, {
          method: args.length > 1 ? 'POST' : 'GET',
          ...(args.length > 1 ? { body: JSON.stringify({ args }) } : {}),
        });
    },
  }
);
