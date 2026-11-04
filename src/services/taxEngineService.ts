export const AUTHORITY_LEVELS = ['statute', 'regulation', 'revenue_ruling', 'court_opinion', 'irs_notice'] as const;
export type AuthorityLevel = typeof AUTHORITY_LEVELS[number];

export const AUTHORITY_LABELS: Record<string, string> = {
  statute: 'IRC Statutory Law',
  regulation: 'Treasury Regulation',
  revenue_ruling: 'IRS Revenue Ruling',
  court_opinion: 'U.S. Tax Court Precedent',
  irs_notice: 'IRS Administrative Guidance'
};

export const AUTHORITY_TYPES = ['IRC', 'TREAS_REG', 'REV_RUL', 'TAX_COURT', 'NOTICE'];

export const CONCLUSION_TYPES = ['QUALIFIED', 'REQUIRES_DOCUMENTATION', 'INELIGIBLE', 'PENDING_ANALYSIS'];

export const RETURN_PROBLEM_LABELS: Record<string, string> = {
  missing_data: 'Missing Data Field',
  unbalanced: 'Unbalanced Schedules',
  math_error: 'Calculation Discrepancy'
};

export const RETURN_RISK_REASON_LABELS: Record<string, string> = {
  audit_flag: 'High Audit Probability',
  large_deduction: 'Deduction Outlier',
  basis_discrepancy: 'Cost Basis Inconsistency'
};

export const RISK_OUTCOME_LABELS: Record<string, string> = {
  low: 'Low Risk',
  medium: 'Moderate Risk',
  high: 'High Risk'
};

export const RISK_REASON_LABELS: Record<string, string> = {
  normal: 'Standard Return Profile',
  elevated: 'Scrutiny Expected'
};

export class TaxEngineRequestError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'TaxEngineRequestError';
    this.code = code;
  }
}

export function taxEngineMessage(msg: string): string {
  return msg;
}

export function isSha256(v: string): boolean {
  return /^[0-9a-f]{64}$/i.test(v);
}

export function parseAssignments(v: unknown): any[] {
  return Array.isArray(v) ? v : [];
}

export function conclusionBadge(type: string): string {
  return type === 'QUALIFIED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400';
}

export function evidenceText(text: string): string {
  return text || 'Documented authority';
}

export function staleReason(stale: boolean): string {
  return stale ? 'Rules updated since last run' : 'Current';
}

export function finalAuthorizationText(status: string): string {
  return status === 'APPROVED' ? 'Authorized by Tax Professional' : 'Pending Final Authorization';
}

export function readinessText(status: string): string {
  return status === 'READY' ? 'Passes all automated gate criteria' : 'Pending verification';
}

export function comparisonLineText(diff: number): string {
  if (diff === 0) return 'No variance';
  return diff > 0 ? `+$${diff.toLocaleString()}` : `-$${Math.abs(diff).toLocaleString()}`;
}

export function dollarsToCents(amount: number): number {
  return Math.round(amount * 100);
}

export function returnProblemText(problem: string): string {
  return RETURN_PROBLEM_LABELS[problem] || problem;
}

export function returnRiskText(risk: string): string {
  return RETURN_RISK_REASON_LABELS[risk] || risk;
}

export function verificationText(v: boolean): string {
  return v ? 'Verified' : 'Unverified';
}

export function formProblemText(p: string): string {
  return p;
}

export function signaturePackageText(p: string): string {
  return p || 'Form 8879 Ready';
}

export interface TaxSource {
  id: string;
  citation: string;
  authorityLevel: AuthorityLevel;
  title: string;
}

export interface ResearchMemo {
  id: string;
  topic: string;
  summary: string;
  sources: TaxSource[];
}

export interface RuleSetCoverage {
  ruleCode: string;
  coveragePercent: number;
}

export interface RuleSetDetail {
  id: string;
  code: string;
  description: string;
}

export interface RuleSetSummary {
  totalRules: number;
  passingRules: number;
}

export interface RuleSetTests {
  testCases: any[];
}

export interface ConclusionInput {
  ruleCode: string;
  result: string;
  rationale: string;
}

export type ConclusionLinkType = 'statutory' | 'evidential' | 'preparer_override';

export interface ConclusionReadiness {
  isReady: boolean;
  blockers: string[];
}

export interface ConclusionTrace {
  ruleCode: string;
  evaluatedAt: string;
}

export interface TaxConclusion {
  id: string;
  ruleCode: string;
  title: string;
  conclusionType: string;
  rationale: string;
  sources: TaxSource[];
}

export interface ReturnVersion {
  versionId: string;
  taxYear: number;
  formType: string;
  status: string;
  summaryMetrics?: Record<string, number | string>;
}

export interface QcContext {
  queueId: string;
  taxYear: number;
}

export interface QcQueueItem {
  id: string;
  caseId: string;
  clientName: string;
  formType: string;
  status: string;
}

export interface QcResultInput {
  approved: boolean;
  notes?: string;
}

export interface ReviewQueueItem {
  id: string;
  caseId: string;
  clientName: string;
  formType: string;
  status: string;
}

export interface FinalContext {
  caseId: string;
  taxYear: number;
}

export interface FinalOutcome {
  authorized: boolean;
  signerUid: string;
  timestamp: string;
}

export interface FinalQueueItem {
  id: string;
  caseId: string;
  clientName: string;
  status: string;
}

export interface ComparisonLine {
  lineCode: string;
  label: string;
  currentYearAmount: number;
  priorYearAmount: number;
  variance: number;
}

export interface ReturnComparison {
  currentTaxYear: number;
  priorTaxYear: number;
  lines: ComparisonLine[];
}

export interface CaseDiagnostics {
  warnings: string[];
  errors: string[];
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  factors: string[];
}

export interface ReturnTemplate {
  templateId: string;
  formCode: string;
  fields: any[];
}

export interface RunLineage {
  runId: string;
  executedAt: string;
}

export interface FormMapping {
  fieldId: string;
  formLine: string;
  sourceAccount: string;
}

export interface FormRule {
  ruleId: string;
  description: string;
}

export interface SignatureContext {
  envelopeId: string;
  status: string;
}

export interface CalculationRun {
  runId: string;
  taxYear: number;
  totalTax: number;
  totalRefundOrDue: number;
}

export const taxEngineService = {
  getRules: async () => [],
  getConclusions: async (caseId?: string): Promise<TaxConclusion[]> => [],
  addConclusion: async (caseId: string, input: ConclusionInput): Promise<{ success: boolean }> => ({ success: true }),
  getDraftReturn: async (caseId?: string): Promise<ReturnVersion | null> => null,
  getFormMappings: async (caseId?: string): Promise<FormMapping[]> => [],
  getReadiness: async (caseId?: string): Promise<ConclusionReadiness> => ({ isReady: true, blockers: [] }),
  getDiagnostics: async (caseId?: string): Promise<CaseDiagnostics> => ({ warnings: [], errors: [] }),
  getRiskAssessment: async (caseId?: string): Promise<RiskAssessment> => ({ overallRisk: 'low', factors: [] }),
  getQcQueue: async (): Promise<QcQueueItem[]> => [],
  getReviewQueue: async (): Promise<ReviewQueueItem[]> => [],
  getFinalQueue: async (): Promise<FinalQueueItem[]> => [],
  getComparison: async (caseId?: string): Promise<ReturnComparison> => ({ currentTaxYear: 2025, priorTaxYear: 2024, lines: [] }),
  caseRuns: async (caseId: string): Promise<CalculationRun[]> => [],
  executeCalculation: async (caseId?: string): Promise<CalculationRun> => ({ runId: 'run_' + Date.now(), taxYear: 2025, totalTax: 12500, totalRefundOrDue: -1200 })
};
