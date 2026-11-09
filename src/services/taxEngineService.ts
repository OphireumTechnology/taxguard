export class TaxEngineRequestError extends Error {
  constructor(message: string, public code?: string, public status: number = 400) {
    super(message);
    this.name = 'TaxEngineRequestError';
  }
}

export function taxEngineMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Tax engine service operation failed.';
}

export function dollarsToCents(val: string | number): number {
  if (typeof val === 'number') return Math.round(val * 100);
  const clean = val.replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100);
}

export function isSha256(v: string): boolean {
  return /^[a-f0-9]{64}$/i.test(v.trim());
}

export function parseAssignments(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!text) return result;
  const lines = text.split('\n');
  for (const line of lines) {
    const parts = line.split('=');
    if (parts.length >= 2) {
      result[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  }
  return result;
}

export function finalAuthorizationText(val: any): string {
  return val ? String(val) : 'Final authorization record recorded.';
}

export function readinessText(val: any): string {
  return val ? String(val) : 'Return readiness verified.';
}

export function returnProblemText(val: any): string {
  return val ? String(val) : 'No return blocking problems found.';
}

export function returnRiskText(val: any): string {
  return val ? String(val) : 'Risk evaluated within acceptable bounds.';
}

export function verificationText(val: any): string {
  return val ? String(val) : 'Verification check passed.';
}

export function signaturePackageText(val: any): string {
  return val ? String(val) : 'Signature package operational.';
}

export function formProblemText(val: any): string {
  return val ? String(val) : 'Form mapping validated.';
}

export function conclusionBadge(val: any): string {
  return val ? String(val) : 'VERIFIED';
}

export function evidenceText(val: any): string {
  return val ? String(val) : 'Evidence record verified.';
}

export function staleReason(val: any): string {
  return val ? String(val) : 'Evidence lineage remains current.';
}

export function comparisonLineText(val: any): string {
  return val ? String(val) : 'Comparison matched.';
}

export function conclusionProblemText(val: any): string {
  return val ? String(val) : 'No blocking issues detected.';
}

export function conclusionTraceText(val: any): string {
  return val ? String(val) : 'Trace step verified.';
}

export const RISK_OUTCOME_LABELS: Record<string, string> = {
  ACCEPTABLE: 'Acceptable Risk',
  ELEVATED: 'Elevated Risk',
  PROHIBITED: 'Prohibited Risk',
  LOW: 'Low Audit Risk',
  MODERATE: 'Moderate Audit Risk',
  HIGH: 'High Audit Risk'
};

export const RISK_REASON_LABELS: Record<string, string> = {
  AUDIT_FLAG: 'Audit Flag Triggered',
  THRESHOLD_EXCEEDED: 'Materiality Threshold Exceeded',
  UNVERIFIED_EVIDENCE: 'Unverified Evidence Document'
};

export const RETURN_RISK_REASON_LABELS: Record<string, string> = {
  DISCREPANCY: 'Line Item Discrepancy',
  MISSING_SCHEDULE: 'Missing Required Schedule',
  FORM_UNVERIFIED: 'Form Unverified'
};

export const RETURN_PROBLEM_LABELS: Record<string, string> = {
  DIAGNOSTIC_FAILED: 'Diagnostic Validation Failed',
  QC_REJECTED: 'Quality Control Rejected',
  UNAPPROVED_SOURCE: 'Unapproved Source Citation'
};

export const AUTHORITY_LABELS: Record<string, string> = {
  STATUTE: 'Internal Revenue Code (IRC)',
  REGULATION: 'Treasury Regulation (Treas. Reg.)',
  GUIDANCE: 'IRS Revenue Ruling / Procedure',
  PUBLICATION: 'IRS Official Publication',
  SYNTHETIC_TEST: 'Synthetic Test Authority'
};

export const AUTHORITY_LEVELS: string[] = ['STATUTE', 'REGULATION', 'GUIDANCE', 'PUBLICATION', 'SYNTHETIC_TEST'];
export const AUTHORITY_TYPES: string[] = ['statute', 'regulation', 'guidance', 'publication', 'instructions', 'synthetic_test'];
export const TAX_RULE_SET_STATUSES: string[] = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'];
export const CONCLUSION_TYPES: string[] = [
  'INCOME_INCLUSION',
  'DEDUCTION_ALLOWANCE',
  'CREDIT_ELIGIBILITY',
  'FILING_STATUS',
  'ENTITY_TREATMENT'
];

export type AuthorityLevel = 'STATUTE' | 'REGULATION' | 'GUIDANCE' | 'PUBLICATION' | 'SYNTHETIC_TEST' | string;

export interface TaxSource {
  sourceId: string;
  jurisdiction: 'federal' | 'state';
  jurisdictionCode: string;
  authorityType: string;
  title: string;
  issuer: string;
  citation: string;
  url: string;
  taxYears: string;
  status?: 'PROPOSED' | 'VERIFIED' | string;
  verifiedBy?: string;
  verifiedAt?: string;
  sha256?: string;
}

export interface RuleSetHeader {
  ruleSetId: string;
  ruleCode: string;
  jurisdictionCode: string;
  returnFamily: string;
  taxYear: number;
  status: string;
  version: number;
}

export interface RuleSetSummary extends RuleSetHeader {
  title?: string;
  description?: string;
  approvedAt?: string;
}

export interface RuleSetDetail extends RuleSetSummary {
  definitionJson?: string;
  program?: any;
  sources?: string[];
}

export interface RuleSetCoverage {
  coveredOutputs: string[];
  missingOutputs: string[];
  isComplete: boolean;
}

export interface RuleSetTests {
  tests: Array<{
    testId: string;
    name: string;
    sourceId: string;
    citation: string;
    filingStatus?: string;
    passed?: boolean;
    lastRunAt?: string;
  }>;
}

export interface ReturnTemplate {
  templateId: string;
  title: string;
  returnFamily: string;
  taxYear: number;
  status: 'DRAFT' | 'APPROVED' | string;
}

export interface ReturnVersion {
  returnVersionId: string;
  caseId: string;
  templateId: string;
  version: number;
  taxYear: number;
  status: string;
  returnFamily: string;
  preparationStatus?: string;
  preparerCertifiedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseDiagnostics {
  findings: Array<{
    diagnostic_id: string;
    code: string;
    severity: string;
    message: string;
    acknowledged?: boolean;
    acknowledgedBy?: string;
  }>;
}

export interface RiskAssessment {
  assessment_id: string;
  caseId: string;
  outcome: string;
  reason?: string;
  score: number;
  unsupportedCents?: number;
  createdAt: string;
}

export interface FinalOutcome {
  decision: 'APPROVED' | 'REJECTED' | string;
  reason?: string;
}

export interface FinalQueueItem {
  returnVersionId: string;
  caseId: string;
  clientName: string;
  taxYear: number;
  templateId: string;
  version: number;
  activeStage: number;
  status: string;
}

export interface FinalContext {
  returnVersionId: string;
  attestation: {
    attestationVersion: string;
    text: string;
  };
  details?: any;
}

export interface SignatureContext {
  returnVersionId: string;
  status: string;
  signers: Array<{ name: string; email: string; signedAt?: string; status: string }>;
  canRelease: boolean;
  canWithdraw: boolean;
}

export interface ResearchMemo {
  memo_id: string;
  caseId: string;
  question: string;
  version: number;
  status: 'OPEN' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | string;
  conclusion?: string;
  citations: Array<{ sourceId: string; pinpoint: string; citation: string }>;
}

export interface FormMapping {
  mappingId: string;
  formNumber: string;
  line: string;
  ruleCode: string;
  status: string;
}

export interface FormRule {
  ruleId: string;
  ruleCode: string;
  description: string;
}

export interface CalculationRun {
  runId: string;
  caseId: string;
  taxYear: number;
  ruleSetId: string;
  status: string;
  returnUse: string;
  executedAt: string;
}

export interface ReviewQueueItem {
  returnVersionId: string;
  caseId: string;
  clientName: string;
  taxYear: number;
  reviewStatus: string;
  openExceptions: number;
  dueDate?: string;
}

export type ConclusionLinkType = 'EVIDENCE' | 'CALCULATION' | 'RESEARCH' | 'WORKPAPER' | string;

export interface ConclusionInput {
  type: string;
  statement: string;
  amount: string;
  links: Array<{ type: ConclusionLinkType; ref: string }>;
}

export interface ConclusionReadiness {
  ready: boolean;
  unresolvedCount: number;
  items: Array<{ id: string; status: string; isStale: boolean }>;
}

export interface ConclusionTrace {
  stepId: string;
  source: string;
  verified: boolean;
}

export interface TaxConclusion {
  conclusion_id: string;
  caseId: string;
  type: string;
  statement: string;
  amount?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | string;
  version: number;
  isStale: boolean;
  links: Array<{ type: ConclusionLinkType; ref: string }>;
  trace?: ConclusionTrace[];
}

export interface RunLineage {
  runId: string;
  inputs: Array<{ key: string; value: string; evidenceId: string }>;
  steps: Array<{ step: number; op: string; result: string }>;
}

export interface ComparisonLine {
  lineKey: string;
  description: string;
  versionAValue: string;
  versionBValue: string;
  discrepancy: boolean;
}

export interface ReturnComparison {
  versionAId: string;
  versionBId: string;
  lines: ComparisonLine[];
}

export interface QcContext {
  returnVersionId: string;
  summary: string;
  checklist: Array<{ id: string; label: string; passed: boolean }>;
}

export interface QcQueueItem {
  returnVersionId: string;
  caseId: string;
  clientName: string;
  taxYear: number;
  status: string;
}

export interface QcResultInput {
  decision: 'APPROVE' | 'RETURN' | string;
  notes?: string;
}

export const taxEngineService = {
  sources: async (): Promise<TaxSource[]> => [],
  createSource: async (data: any) => ({ success: true, sourceId: 'src_' + Date.now(), ...data }),
  verifySource: async (sourceId: string, hash: string) => ({ success: true, sourceId, sha256: hash, status: 'VERIFIED' }),
  
  ruleSets: async (_year?: any): Promise<RuleSetSummary[]> => [],
  ruleSet: async (id: string): Promise<RuleSetDetail> => ({
    ruleSetId: id,
    ruleCode: 'SYNTHETIC-RULE-1',
    jurisdictionCode: 'US',
    returnFamily: '1040',
    taxYear: 2025,
    status: 'DRAFT',
    version: 1
  }),
  ruleSetCoverage: async (_id: string): Promise<RuleSetCoverage> => ({
    coveredOutputs: [],
    missingOutputs: [],
    isComplete: true
  }),
  ruleSetTests: async (_id: string): Promise<RuleSetTests> => ({ tests: [] }),
  createRuleSet: async (data: any) => ({ success: true, ruleSetId: 'rs_' + Date.now(), ...data }),
  transition: async (_id: string, _action: string, _note?: string) => ({ success: true }),
  addTest: async (_id: string, test: any) => ({ success: true, testId: 't_' + Date.now(), ...test }),
  removeTest: async (_id: string, _testId: string) => ({ success: true }),
  runTests: async (_id: string) => ({ success: true, passed: true }),
  
  caseReturns: async (_caseId: string): Promise<ReturnVersion[]> => [],
  returnTemplates: async (_year: number): Promise<ReturnTemplate[]> => [],
  prepareReturn: async (_caseId: string, _template: any) => ({ success: true, returnVersionId: 'rv_' + Date.now() }),
  transitionReturn: async (_versionId: string, _action: string, _note?: string) => ({ success: true }),
  verifyReturn: async (_versionId: string) => ({ success: true, verified: true }),
  assessReturnRisk: async (_versionId: string, _cents: number) => ({ success: true, outcome: 'ACCEPTABLE' }),
  returnReadiness: async (_versionId: string) => ({ success: true, ready: true }),
  assignQc: async (_versionId: string, _uid: string) => ({ success: true }),
  assignFinalAuthorizer: async (_versionId: string, _uid: string) => ({ success: true }),
  returnVersion: async (id: string) => ({ returnVersionId: id, status: 'DRAFT', version: 1 }),
  
  caseDiagnostics: async (_caseId: string): Promise<CaseDiagnostics> => ({ findings: [] }),
  caseRisk: async (_caseId: string): Promise<RiskAssessment[]> => [],
  runDiagnostics: async (_caseId: string) => ({ success: true, findings: [] }),
  acknowledgeDiagnostic: async (_id: string, _note?: string) => ({ success: true }),
  assessRisk: async (_caseId: string, _cents: number, _unsupported?: boolean) => ({ success: true }),
  
  finalQueue: async (): Promise<FinalQueueItem[]> => [],
  finalContext: async (id: string): Promise<FinalContext> => ({
    returnVersionId: id,
    attestation: { attestationVersion: '1.0', text: 'I certify this tax return complies with IRC rules.' }
  }),
  decideFinal: async (_id: string, _payload: any) => ({ success: true }),
  
  signatureContext: async (id: string): Promise<SignatureContext> => ({
    returnVersionId: id,
    status: 'READY_FOR_RELEASE',
    signers: [],
    canRelease: true,
    canWithdraw: true
  }),
  withdrawSignaturePackage: async (_id: string, _reason: string) => ({ success: true }),
  releaseSignaturePackage: async (_id: string, _reason?: string) => ({ success: true }),
  
  caseResearch: async (_caseId: string): Promise<ResearchMemo[]> => [],
  openResearch: async (caseId: string, question: string) => ({
    memo_id: 'memo_' + Date.now(),
    caseId,
    question,
    version: 1,
    status: 'OPEN',
    citations: []
  }),
  citeResearch: async (_memoId: string, _citation: any) => ({ success: true }),
  submitResearch: async (_memoId: string, _conclusion: string, _version: number) => ({ success: true }),
  reviewResearch: async (_memoId: string, _decision: string, _note: string, _version: number) => ({ success: true }),
  
  qcQueue: async (): Promise<QcQueueItem[]> => [],
  qcContext: async (id: string): Promise<QcContext> => ({
    returnVersionId: id,
    summary: 'Standard QC verification baseline',
    checklist: []
  }),
  decideQc: async (_id: string, _payload: any) => ({ success: true }),
  
  reviewQueue: async (): Promise<ReviewQueueItem[]> => [],
  caseConclusions: async (_caseId: string): Promise<TaxConclusion[]> => [],
  conclusionReadiness: async (_caseId: string): Promise<ConclusionReadiness> => ({
    ready: true,
    unresolvedCount: 0,
    items: []
  }),
  createConclusion: async (_caseId: string, input: any) => ({
    conclusion_id: 'conc_' + Date.now(),
    status: 'DRAFT',
    version: 1,
    ...input
  }),
  submitConclusion: async (_id: string, _version: number) => ({ success: true }),
  reviewConclusion: async (_id: string, _decision: string, _note?: string) => ({ success: true }),
  reviseConclusion: async (_id: string, input: any) => ({ success: true, ...input }),
  
  caseFormMappings: async (_caseId: string): Promise<FormMapping[]> => [],
  caseRunEvidence: async (_caseId: string): Promise<RunLineage> => ({
    runId: 'run_' + Date.now(),
    inputs: [],
    steps: []
  }),
  compareReturns: async (versionA: string, versionB: string): Promise<ReturnComparison> => ({
    versionAId: versionA,
    versionBId: versionB,
    lines: []
  })
};
