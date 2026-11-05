export const AUTHORITY_LEVELS = ['statute', 'regulation', 'revenue_ruling', 'court_opinion', 'irs_notice', 'AUTHORITATIVE', 'SECONDARY', 'INTERNAL_GUIDANCE', 'AI_INFERENCE'] as const;
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
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'TaxEngineRequestError';
    this.code = code;
    this.status = status;
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

export function conclusionBadge(typeOrConclusion: any): string {
  if (typeof typeOrConclusion === 'object' && typeOrConclusion !== null) {
    return typeOrConclusion.status || 'PENDING';
  }
  return typeOrConclusion === 'QUALIFIED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400';
}

export function evidenceText(text: string): string {
  return text || 'Documented authority';
}

export function staleReason(stale: boolean | string): string {
  if (typeof stale === 'string') return stale;
  return stale ? 'Rules updated since last run' : 'Current';
}

export function finalAuthorizationText(status: string): string {
  return status === 'APPROVED' ? 'Authorized by Tax Professional' : 'Pending Final Authorization';
}

export function readinessText(status: string): string {
  return status === 'READY' ? 'Passes all automated gate criteria' : 'Pending verification';
}

export function comparisonLineText(lineOrDiff: any): string {
  if (typeof lineOrDiff === 'number') {
    if (lineOrDiff === 0) return 'No variance';
    return lineOrDiff > 0 ? `+$${lineOrDiff.toLocaleString()}` : `-$${Math.abs(lineOrDiff).toLocaleString()}`;
  }
  const label = lineOrDiff?.label || lineOrDiff?.lineCode || lineOrDiff?.line || 'Line';
  const curr = lineOrDiff?.currentYearAmount ?? 0;
  const prior = lineOrDiff?.priorYearAmount ?? 0;
  return `${label}: $${curr.toLocaleString()} (prior: $${prior.toLocaleString()})`;
}

export function dollarsToCents(amount: number | string): number {
  const n = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
  return Math.round(n * 100);
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
  id?: string;
  source_id?: string;
  sourceId?: string;
  citation?: string;
  authorityLevel?: AuthorityLevel | string;
  title?: string;
  synthetic?: boolean;
  jurisdiction?: string;
  jurisdictionCode?: string;
  taxYears?: string;
  [key: string]: any;
}

export interface ResearchMemo {
  id?: string;
  memo_id?: string;
  topic?: string;
  summary?: string;
  sources?: TaxSource[];
  review_note?: string;
  citations?: any[];
  status?: string;
  version?: number;
  [key: string]: any;
}

export interface RuleSetCoverage {
  ruleCode?: string;
  coveragePercent?: number;
  [key: string]: any;
}

export interface RuleSetDetail {
  id?: string;
  ruleSetId: string;
  code?: string;
  description?: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | string;
  taxYear: number;
  [key: string]: any;
}

export interface RuleSetSummary {
  ruleSetId: string;
  name?: string;
  taxYear?: number;
  status?: string;
  totalRules?: number;
  passingRules?: number;
  [key: string]: any;
}

export interface RuleSetTests {
  testsSha256?: string;
  tests: Array<{ testId: string; name: string; sourceId?: string; citation?: string; filingStatus?: string; expected?: any; result?: any; [key: string]: any }>;
  latestRun?: {
    passedCount: number;
    testCount: number;
    testsSha256: string;
    engineVersion: string;
    runBy: string;
    runAt: string;
    results?: Array<{ testId: string; passed: boolean; error?: string; mismatches?: Array<{ output: string; expected: any; actual?: any }>; [key: string]: any }>;
    [key: string]: any;
  } | null;
  [key: string]: any;
}

export interface ConclusionInput {
  ruleCode?: string;
  result?: string;
  rationale?: string;
  links?: any[];
  type?: string;
  [key: string]: any;
}

export type ConclusionLinkType = 'statutory' | 'evidential' | 'preparer_override' | 'CALCULATION' | 'RESEARCH' | 'WORKPAPER' | 'EVIDENCE' | string;

export interface ConclusionReadiness {
  isReady?: boolean;
  ready?: boolean;
  blockers: Array<{ version?: number | string; reasons: string[]; [key: string]: any }>;
  conclusions?: number | any[];
  [key: string]: any;
}

export interface ConclusionTrace {
  ruleCode?: string;
  evaluatedAt?: string;
  sources: Array<{ type: ConclusionLinkType; ref: string; snapshot?: any; current?: any; detail?: any; [key: string]: any }>;
  conclusion: { stale: Array<{ type: string; ref: string; reason: string; [key: string]: any }>; [key: string]: any };
  versions: Array<{ conclusionId: string; version: number; status: string; reviewedBy?: string; [key: string]: any }>;
  audit: Array<{ action: string; version?: number | string; actorUid: string; at: string; [key: string]: any }>;
  formLines: Array<{ formId: string; line: string; [key: string]: any }>;
  [key: string]: any;
}

export interface TaxConclusion {
  id?: string;
  conclusionId: string;
  ruleCode?: string;
  title?: string;
  conclusionType?: string;
  rationale?: string;
  statement?: string;
  amount?: string;
  preparedBy?: string;
  reviewedBy?: string;
  reviewNote?: string;
  status: 'DRAFT' | 'READY_FOR_REVIEW' | 'RETURNED' | 'REJECTED' | 'APPROVED' | string;
  stale: any[];
  sources?: TaxSource[];
  [key: string]: any;
}

export interface ReturnVersion {
  versionId?: string;
  returnVersionId?: string;
  caseId?: string;
  taxYear?: number;
  formType?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED' | 'SUPERSEDED';
  stale: any[];
  missing?: any[];
  forms?: any[];
  version?: number;
  templateId?: string;
  templateVersion?: string;
  templateSha256?: string;
  preparedBy?: string;
  reviewedBy?: string;
  reviewNote?: string;
  createdAt?: string;
  summaryMetrics?: Record<string, number | string>;
  [key: string]: any;
}

export interface QcContext {
  queueId: string;
  taxYear: number;
  checklist?: {
    checklistVersion: string;
    items: Array<{ id: string; label: string; passed: boolean; [key: string]: any }>;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface QcQueueItem {
  id: string;
  caseId: string;
  clientName: string;
  formType: string;
  status: string;
  [key: string]: any;
}

export interface QcResultInput {
  approved: boolean;
  notes?: string;
  note?: string;
  [key: string]: any;
}

export interface ReviewQueueItem {
  id: string;
  caseId: string;
  clientName: string;
  formType: string;
  status: string;
  risk?: any;
  stale?: any;
  verification?: any;
  templateId?: string;
  version?: string;
  returnVersionId?: string;
  taxYear?: number;
  preparedBy?: string;
  submittedAt?: string;
  [key: string]: any;
}

export interface FinalContext {
  caseId?: string;
  taxYear?: number;
  readiness?: any;
  attestation?: { attestationVersion: string; text: string } | null;
  returnVersion?: any;
  [key: string]: any;
}

export type FinalOutcome = 'AUTHORIZED' | 'DECLINED' | string | { authorized: boolean; signerUid?: string; timestamp?: string; outcome?: string; [key: string]: any };

export interface FinalQueueItem {
  id?: string;
  caseId: string;
  clientName?: string;
  status?: string;
  templateId?: string;
  version?: string;
  returnVersionId?: string;
  assignmentId?: string;
  taxYear?: number;
  latestOutcome?: any;
  [key: string]: any;
}

export interface ComparisonLine {
  lineCode?: string;
  label?: string;
  currentYearAmount?: number;
  priorYearAmount?: number;
  variance?: any;
  kind?: string;
  formId?: string;
  formVersion?: string;
  priorFormVersion?: string;
  schedule?: string;
  line?: string;
  field?: string;
  [key: string]: any;
}

export interface ReturnComparison {
  currentTaxYear?: number;
  priorTaxYear?: number;
  priorYear?: any;
  varianceCheck?: any;
  variancePolicyVersion?: string;
  previousVersion?: any;
  templateId?: string;
  lines: ComparisonLine[];
  [key: string]: any;
}

export interface CaseDiagnostics {
  warnings?: any;
  errors?: any;
  diagnosedAt?: string;
  ready?: boolean;
  blocking?: any;
  diagnostics?: any[];
  [key: string]: any;
}

export interface RiskAssessment {
  overallRisk?: 'low' | 'medium' | 'high';
  factors?: string[];
  assessment_id?: string;
  outcome?: string;
  amount_cents?: number;
  materiality?: string;
  risk_level?: string;
  policy_version?: string;
  assessed_by?: string;
  assessed_at?: string;
  reason_codes?: string[];
  [key: string]: any;
}

export interface ReturnTemplate {
  templateId?: string;
  templateRuleId?: string;
  formCode?: string;
  fields?: any[];
  version?: number;
  forms?: any[];
  jurisdiction?: string;
  jurisdictionCode?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  [key: string]: any;
}

export interface RunLineage {
  runId: string;
  executedAt: string;
  recorded?: boolean;
  complete?: boolean;
  citations?: any[];
  [key: string]: any;
}

export interface FormMapping {
  fieldId?: string;
  formLine?: string;
  sourceAccount?: string;
  mappingId?: string;
  version?: number;
  mappedBy?: string;
  createdAt?: string;
  ruleVersion?: string;
  ruleSha256?: string;
  status: string;
  stale: any[];
  missing: any[];
  values?: any[];
  formId?: string;
  formVersion?: string;
  [key: string]: any;
}

export interface FormRule {
  ruleId?: string;
  description?: string;
  formId?: string;
  formVersion?: string;
  version?: number;
  lines?: any[];
  jurisdiction?: string;
  jurisdictionCode?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  [key: string]: any;
}

export interface SignatureContext {
  envelopeId?: string;
  status?: string;
  readiness?: any;
  releasable?: { releasable: boolean };
  consent?: { consentVersion: string; text: string } | null;
  candidates?: Array<{ uid: string; name?: string }>;
  [key: string]: any;
}

export interface CalculationRun {
  runId?: string;
  run_id?: string;
  taxYear?: number;
  totalTax?: number;
  totalRefundOrDue?: number;
  created_at?: string;
  synthetic?: boolean;
  outputs?: Record<string, any>;
  status?: string;
  review_note?: string;
  requested_by?: string;
  reviewed_by?: string;
  [key: string]: any;
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
  qcQueue: async (): Promise<QcQueueItem[]> => [],
  qcContext: async (_returnVersionId: string): Promise<QcContext | null> => null,
  recordQc: async (..._args: any[]): Promise<{ success: boolean; outcome: 'QC_PASSED' | 'QC_RETURNED' }> => ({ success: true, outcome: 'QC_PASSED' }),
  getReviewQueue: async (): Promise<ReviewQueueItem[]> => [],
  reviewQueue: async (): Promise<ReviewQueueItem[]> => [],
  getFinalQueue: async (): Promise<FinalQueueItem[]> => [],
  finalQueue: async (): Promise<FinalQueueItem[]> => [],
  finalContext: async (_id: string): Promise<any> => null,
  decideFinal: async (_item: any, outcome?: any) => ({ success: true, outcome: typeof outcome === 'string' ? outcome : 'AUTHORIZED' }),
  getComparison: async (caseId?: string): Promise<ReturnComparison> => ({ currentTaxYear: 2025, priorTaxYear: 2024, lines: [] }),
  returnComparison: async (_caseId?: string): Promise<ReturnComparison> => ({ currentTaxYear: 2025, priorTaxYear: 2024, lines: [] }),
  runLineage: async (runId: string): Promise<RunLineage> => ({ runId, executedAt: new Date().toISOString(), recorded: true, complete: true, citations: [] }),
  signatureContext: async (_returnVersionId: string): Promise<SignatureContext> => ({ status: 'READY' }),
  caseRuns: async (caseId: string): Promise<CalculationRun[]> => [],
  caseReturns: async (_caseId: string): Promise<ReturnVersion[]> => [],
  sources: async (): Promise<TaxSource[]> => [],
  ruleSets: async (_taxYear?: number): Promise<RuleSetSummary[]> => [],
  ruleSet: async (_ruleSetId: string): Promise<RuleSetDetail | null> => null,
  ruleSetDetail: async (_ruleSetId: string): Promise<RuleSetDetail | null> => null,
  coverage: async (_ruleSetId: string): Promise<RuleSetCoverage | null> => null,
  tests: async (_ruleSetId: string): Promise<RuleSetTests | null> => null,
  verifySource: async (..._args: any[]) => ({ success: true }),
  registerSource: async (..._args: any[]) => ({ success: true }),
  draftRuleSet: async (..._args: any[]) => ({ success: true }),
  addTest: async (..._args: any[]) => ({ success: true }),
  removeTest: async (..._args: any[]) => ({ success: true }),
  runTests: async (..._args: any[]) => ({ success: true }),
  transition: async (..._args: any[]) => ({ success: true }),
  withdrawSignaturePackage: async (..._args: any[]) => ({ success: true }),
  releaseSignaturePackage: async (..._args: any[]) => ({ success: true }),
  reviewRun: async (..._args: any[]) => ({ success: true }),
  citeResearch: async (..._args: any[]) => ({ success: true }),
  submitResearch: async (..._args: any[]) => ({ success: true }),
  reviewResearch: async (..._args: any[]) => ({ success: true }),
  caseDiagnostics: async (_caseId?: string): Promise<CaseDiagnostics> => ({ diagnosedAt: new Date().toISOString(), ready: true, blocking: 0, errors: 0, warnings: [], diagnostics: [] }),
  runDiagnostics: async (..._args: any[]) => ({ success: true }),
  acknowledgeDiagnostic: async (..._args: any[]) => ({ success: true }),
  caseRisk: async (_caseId?: string): Promise<RiskAssessment[]> => [],
  assessRisk: async (..._args: any[]) => ({ success: true }),
  caseResearch: async (_caseId?: string): Promise<ResearchMemo[]> => [],
  openResearch: async (..._args: any[]) => ({ success: true }),
  prepareReturn: async (_caseId?: string, _template?: any) => ({ replayed: false, version: 1, templateId: 'Form 1040' }),
  transitionReturn: async (_returnVersionId?: string, _action?: string, _note?: string) => ({ version: 1, templateId: 'Form 1040', status: 'SUBMITTED' }),
  verifyReturn: async (_id?: string): Promise<boolean> => true,
  assessReturnRisk: async (_id?: string, _cents?: any): Promise<string> => 'normal',
  returnReadiness: async (_id?: string): Promise<string> => 'READY',
  assignQc: async (_id?: string, qcUid?: string): Promise<{ qcUid: string }> => ({ qcUid: qcUid || 'usr_qc' }),
  assignFinalAuthorizer: async (_id?: string, authorizerUid?: string): Promise<{ authorizerUid: string }> => ({ authorizerUid: authorizerUid || 'usr_authorizer' }),
  returnVersion: async (_id?: string): Promise<ReturnVersion | null> => null,
  caseFormMappings: async (_caseId?: string): Promise<FormMapping[]> => [],
  formRules: async (_taxYear?: number): Promise<FormRule[]> => [],
  formMapping: async (_id?: string): Promise<FormMapping | null> => null,
  submitConclusion: async (_conclusionId: string) => ({ success: true }),
  reviewConclusion: async (_conclusionId: string, _action: string, _note?: string) => ({ success: true }),
  returnTemplates: async (_taxYear?: number): Promise<ReturnTemplate[]> => [],
  mapForm: async (..._args: any[]) => ({ success: true, replayed: false, version: 1, formId: '1040' }),
  caseConclusions: async (_caseId?: string): Promise<TaxConclusion[]> => [],
  conclusionReadiness: async (_caseId?: string): Promise<ConclusionReadiness> => ({ isReady: true, ready: true, blockers: [], conclusions: [] }),
  traceConclusion: async (_id: string): Promise<ConclusionTrace | null> => null,
  reviseConclusion: async (..._args: any[]) => ({ success: true }),
  proposeConclusion: async (..._args: any[]) => ({ success: true }),
  executeCalculation: async (caseId?: string): Promise<CalculationRun> => ({ runId: 'run_' + Date.now(), taxYear: 2025, totalTax: 12500, totalRefundOrDue: -1200 })
};
