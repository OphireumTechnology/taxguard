import { apiRequest, ApiRequestError } from './api';

export class TaxEngineRequestError extends ApiRequestError {}

export const AUTHORITY_TYPES = ['IRC', 'TREASURY_REG', 'REV_RUL', 'REV_PROC', 'CASE_LAW', 'STATE_STATUTE', 'IRS_PUB'] as const;
export const AUTHORITY_LEVELS = ['primary', 'secondary', 'internal_guidance'] as const;
export type AuthorityLevel = (typeof AUTHORITY_LEVELS)[number] | string;

export const AUTHORITY_LABELS: Record<string, string> = {
  primary: 'Primary Authority',
  secondary: 'Secondary Authority',
  internal_guidance: 'Internal Guidance',
  IRC: 'Internal Revenue Code',
  TREASURY_REG: 'Treasury Regulation',
  REV_RUL: 'Revenue Ruling',
  REV_PROC: 'Revenue Procedure',
  CASE_LAW: 'Judicial Precedent',
  STATE_STATUTE: 'State Statute',
  IRS_PUB: 'IRS Publication',
};

export const CONCLUSION_TYPES = ['filing_position', 'deduction', 'credit', 'income_character', 'nexus', 'disclosure'] as const;
export type ConclusionLinkType = 'evidence' | 'source' | 'memo' | 'workpaper' | string;

export const RISK_OUTCOME_LABELS: Record<string, string> = {
  low: 'Low Risk',
  moderate: 'Moderate Risk',
  elevated: 'Elevated Risk',
  high: 'High Risk — Reviewer Sign-off Required',
};

export const RISK_REASON_LABELS: Record<string, string> = {
  material_variance: 'Material Variance Detected',
  missing_evidence: 'Supporting Evidence Incomplete',
  complex_entity: 'Multi-Entity / Pass-Through Complexity',
  prior_year_delta: 'Significant Year-over-Year Change',
};

export const RETURN_PROBLEM_LABELS: Record<string, string> = {
  missing_mapping: 'Unmapped Form Line',
  stale_calculation: 'Calculation Needs Refresh',
  unresolved_diagnostic: 'Open Return Diagnostic',
  pending_conclusion: 'Pending Tax Conclusion Approval',
};

export const RETURN_RISK_REASON_LABELS: Record<string, string> = {
  ...RISK_REASON_LABELS,
  ...RETURN_PROBLEM_LABELS,
};

export interface TaxSource {
  id: string;
  citation: string;
  title?: string;
  authorityType?: string;
  authorityLevel?: AuthorityLevel;
  sha256?: string;
  [key: string]: any;
}

export interface ResearchMemo {
  id: string;
  title: string;
  issue?: string;
  conclusion?: string;
  status: string;
  sources?: TaxSource[];
  [key: string]: any;
}

export interface TaxConclusion {
  id: string;
  type: string;
  title?: string;
  statement?: string;
  position?: string;
  status: string;
  stale: any;
  staleReason?: string;
  [key: string]: any;
}

export interface ConclusionInput {
  type?: string;
  title?: string;
  statement?: string;
  position?: string;
  amount?: any;
  links?: any;
  [key: string]: any;
}

export interface ConclusionReadiness {
  ready: boolean;
  approvedCount: number;
  pendingCount: number;
  staleCount: number;
  [key: string]: any;
}

export interface ConclusionTrace {
  conclusionId: string;
  links: Array<{ id: string; type: ConclusionLinkType; label: string; refId?: string; [key: string]: any }>;
  [key: string]: any;
}

export interface CalculationRun {
  id: string;
  caseId?: string;
  status: string;
  createdAt?: string;
  outputs?: Record<string, any>;
  [key: string]: any;
}

export interface RunLineage {
  runId: string;
  inputs: any[];
  rules: any[];
  [key: string]: any;
}

export interface CaseDiagnostics {
  items: any[];
  blockingCount: number;
  warningCount: number;
  [key: string]: any;
}

export interface RiskAssessment {
  level: string;
  outcome?: string;
  reasons?: string[];
  score?: number;
  [key: string]: any;
}

export interface FormRule {
  id: string;
  formCode: string;
  lineCode: string;
  expression?: string;
  status: string;
  [key: string]: any;
}

export interface FormMapping {
  id: string;
  formCode?: string;
  lineCode?: string;
  valueCents?: number;
  status: any;
  stale: any;
  problems?: string[];
  [key: string]: any;
}

export interface ReturnTemplate {
  id: string;
  formCode?: string;
  taxYear?: number;
  title?: string;
  [key: string]: any;
}

export interface ReturnVersion {
  id: string;
  caseId?: string;
  version?: number;
  versionNumber?: number;
  templateId?: string;
  formCode?: string;
  taxYear?: number;
  status: any;
  stale: any;
  lines?: any[];
  problems?: string[];
  [key: string]: any;
}

export interface ComparisonLine {
  lineCode: string;
  label: string;
  priorCents?: number;
  currentCents?: number;
  deltaCents?: number;
  [key: string]: any;
}

export interface ReturnComparison {
  priorVersionId?: string;
  currentVersionId?: string;
  lines: ComparisonLine[];
  [key: string]: any;
}

export interface QcQueueItem {
  id: string;
  caseId: string;
  returnId?: string;
  clientName?: string;
  status: string;
  riskReasons?: string[];
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

export type FinalOutcome = 'approved' | 'rejected' | 'returned_for_revision' | string;

export interface FinalQueueItem {
  id: string;
  caseId: string;
  returnId?: string;
  clientName?: string;
  status: string;
  [key: string]: any;
}

export interface FinalContext {
  item?: FinalQueueItem;
  readiness?: any;
  [key: string]: any;
}

export interface ReviewQueueItem {
  id: string;
  caseId: string;
  clientName?: string;
  status: string;
  stale: any;
  risk: any;
  verification: any;
  riskReasons?: string[];
  [key: string]: any;
}

export interface SignatureContext {
  returnId?: string;
  status: string;
  releasedAt?: string;
  signedAt?: string;
  [key: string]: any;
}

export interface RuleSetSummary {
  id: string;
  name: string;
  taxYear: number;
  status: string;
  [key: string]: any;
}

export interface RuleSetDetail extends RuleSetSummary {
  rules?: any[];
  sources?: TaxSource[];
}

export interface RuleSetCoverage {
  totalRules: number;
  verifiedRules: number;
  percent: number;
  [key: string]: any;
}

export interface RuleSetTests {
  passed: number;
  failed: number;
  cases: any[];
  [key: string]: any;
}

export function dollarsToCents(dollars: number | string): number {
  const num = typeof dollars === 'string' ? Number(dollars.replace(/[^0-9.-]/g, '')) : dollars;
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

export function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test((value || '').trim());
}

export function parseAssignments(raw: string): Array<[string, any]> {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') return Object.entries(parsed);
    return [];
  } catch {
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf('=');
        return idx === -1 ? [line, ''] : [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      });
  }
}

export function taxEngineMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Tax engine service is currently unavailable.';
}

export function conclusionBadge(item: any): string {
  const status = typeof item === 'string' ? item : item?.status || 'draft';
  return String(status).replace(/_/g, ' ');
}

export function evidenceText(item: any): string {
  if (!item) return '';
  if (typeof item === 'string') return item;
  return item.label || item.title || item.documentName || item.id || 'Evidence Item';
}

export function staleReason(reason?: any): string {
  if (!reason) return 'Underlying inputs changed since approval.';
  return String(reason).replace(/_/g, ' ');
}

export function finalAuthorizationText(status: any): string {
  const val = typeof status === 'string' ? status : status?.status || 'pending';
  return String(val).replace(/_/g, ' ');
}

export function readinessText(status: any): string {
  const val = typeof status === 'string' ? status : status?.status || 'pending';
  return String(val).replace(/_/g, ' ');
}

export function returnProblemText(code: any): string {
  const key = typeof code === 'string' ? code : code?.code || '';
  return RETURN_PROBLEM_LABELS[key] || String(key).replace(/_/g, ' ');
}

export function returnRiskText(code: any): string {
  const key = typeof code === 'string' ? code : code?.code || code?.level || '';
  return RETURN_RISK_REASON_LABELS[key] || String(key).replace(/_/g, ' ');
}

export function verificationText(status: any): string {
  const val = typeof status === 'string' ? status : status?.status || 'unverified';
  return String(val).replace(/_/g, ' ');
}

export function formProblemText(code: any): string {
  const key = typeof code === 'string' ? code : code?.code || '';
  return RETURN_PROBLEM_LABELS[key] || String(key).replace(/_/g, ' ');
}

export function comparisonLineText(line: ComparisonLine): string {
  return `${line.lineCode} — ${line.label}`;
}

export function signaturePackageText(status: any): string {
  const val = typeof status === 'string' ? status : status?.status || 'not_released';
  return String(val).replace(/_/g, ' ');
}

export const taxEngineService: Record<string, (...args: any[]) => Promise<any>> = new Proxy(
  {
    listRuleSets: () => apiRequest('/api/tax-engine/rule-sets'),
    getReviewQueue: () => apiRequest('/api/tax-engine/review-queue'),
    getQcQueue: () => apiRequest('/api/tax-engine/qc-queue'),
    getFinalQueue: () => apiRequest('/api/tax-engine/final-authorization-queue'),
  } as Record<string, (...args: any[]) => Promise<any>>,
  {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return async (..._args: any[]) => apiRequest(`/api/tax-engine/${prop}`);
    },
  }
);
