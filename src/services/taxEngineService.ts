export const AUTHORITY_TYPES = ['irc', 'treasury_reg', 'revenue_ruling', 'publication', 'state_statute'] as const;
export const AUTHORITY_LEVELS = ['AUTHORITATIVE', 'SECONDARY', 'INTERNAL_GUIDANCE', 'AI_INFERENCE'] as const;
export type AuthorityLevel = (typeof AUTHORITY_LEVELS)[number];
export const AUTHORITY_LABELS: Record<AuthorityLevel, string> = {
  AUTHORITATIVE: 'Authoritative Source',
  SECONDARY: 'Secondary Authority',
  INTERNAL_GUIDANCE: 'Internal Guidance',
  AI_INFERENCE: 'AI Inference (Reasoning Only)',
};

export const RETURN_PROBLEM_LABELS: Record<string, string> = {
  STALE_MAPPING: 'Form mapping is stale',
  DIAGNOSTIC_ERROR: 'Blocking diagnostic detected',
  UNVERIFIED_RULE: 'Tax rule set is unapproved',
};

export const RISK_OUTCOME_LABELS: Record<string, string> = {
  LOW: 'Low Risk',
  MEDIUM: 'Medium Risk',
  HIGH: 'High Risk',
  BLOCKING: 'Blocking Risk',
};

export const RISK_REASON_LABELS: Record<string, string> = {
  UNSUPPORTED_POSITION: 'Unsupported tax position',
  MATERIAL_AMOUNT: 'Material dollar amount at stake',
};

export const RETURN_RISK_REASON_LABELS: Record<string, string> = {
  UNSUPPORTED_POSITION: 'Unsupported tax position',
  UNRESOLVED_DIAGNOSTIC: 'Unresolved critical diagnostic',
  STALE_INPUTS: 'Stale calculation inputs',
};

export const CONCLUSION_TYPES = ['INCOME_INCLUSION', 'FILING_POSITION', 'DEDUCTION_ELIGIBILITY', 'BASIS_CALCULATION', 'STATE_NEXUS'] as const;
export type ConclusionLinkType = 'EVIDENCE' | 'CALCULATION' | 'RESEARCH' | 'WORKPAPER' | 'SOURCE' | string;

export class TaxEngineRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string
  ) {
    super(message || code);
  }
}

export interface TaxSource {
  source_id: string;
  jurisdiction: 'federal' | 'state' | string;
  jurisdiction_code: string;
  authority_type: string;
  title: string;
  issuer: string;
  citation: string;
  url?: string;
  tax_years: number[];
  status: 'PROPOSED' | 'PENDING' | 'VERIFIED' | string;
  synthetic?: boolean;
  registered_by?: string;
  verified_by?: string;
  [key: string]: any;
}

export interface RuleSetSummary {
  ruleSetId: string;
  taxYear: number;
  status: string;
  version: number;
  jurisdiction: string;
  jurisdictionCode: string;
  returnFamily: string;
  preparedBy: string;
  reviewedBy?: string;
  synthetic?: boolean;
  [key: string]: any;
}

export interface RuleSetDetail extends RuleSetSummary {
  contentSha256: string;
  sourceIds: string[];
  reviewNote?: string;
  definition: {
    parameters?: Array<{
      key: string;
      filingStatus?: string;
      value: string | number;
      unit?: string;
      sourceId?: string;
      citation?: string;
    }>;
    [key: string]: any;
  };
  rules?: any[];
  [key: string]: any;
}

export interface RuleSetCoverage {
  total: number;
  covered: number;
  missingOutputs: string[];
  missingFilingStatuses: string[];
  [key: string]: any;
}

export interface RuleSetTests {
  passed: number;
  failed: number;
  cases: any[];
  tests: Array<{
    testId: string;
    name: string;
    filingStatus?: string;
    expected: Record<string, unknown>;
    sourceId: string;
    citation: string;
  }>;
  testsSha256?: string;
  latestRun?: {
    passedCount: number;
    testCount: number;
    testsSha256?: string;
    engineVersion: string;
    runBy: string;
    runAt: string;
    results: Array<{
      testId: string;
      passed: boolean;
      error?: string;
      mismatches?: Array<{ output: string; expected: unknown; actual: unknown }>;
    }>;
  } | null;
  [key: string]: any;
}

export interface CalculationRun {
  runId: string;
  caseId: string;
  status: string;
  createdAt: string;
  [key: string]: any;
}

export interface RunLineage {
  runId: string;
  inputs: any[];
  outputs: any[];
  [key: string]: any;
}

export interface ReturnTemplate {
  templateRuleId: string;
  templateId: string;
  taxYear: number;
  returnFamily: string;
  version: number;
  forms: number;
  jurisdiction: string;
  jurisdictionCode: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: string;
  [key: string]: any;
}

export interface FormMappingValueSource {
  conclusionId: string;
  conclusionVersion: number;
  conclusionType: string;
  value: string;
  runId: string;
  ruleSetId: string;
  ruleSetVersion: number;
  ruleSetSha256: string;
  evidence: Array<{ ref: string; [key: string]: any }>;
  [key: string]: any;
}

export interface FormMappingValue {
  schedule: string;
  line: string;
  field: string;
  value: string;
  valueType: string;
  sources: FormMappingValueSource[];
  [key: string]: any;
}

export interface FormRule {
  formRuleId: string;
  ruleId: string;
  formId: string;
  formVersion: string;
  version: number;
  lines: number;
  jurisdiction: string;
  jurisdictionCode: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  taxYear: number;
  returnFamily: string;
  status: string;
  [key: string]: any;
}

export interface FormMapping {
  mappingId: string;
  caseId: string;
  formRuleId: string;
  formId: string;
  formVersion: string;
  version: number;
  mappedBy: string;
  createdAt: string;
  ruleVersion: number;
  ruleSha256: string;
  status: string;
  stale: string[];
  missing: Array<{ line: string }>;
  replayed?: boolean;
  values?: FormMappingValue[];
  [key: string]: any;
}

export interface ReturnVersion {
  returnVersionId: string;
  caseId: string;
  templateId: string;
  version: number;
  taxYear: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED' | 'SUPERSEDED';
  stale: Array<{ reason: string; formId?: string; [key: string]: any }>;
  replayed?: boolean;
  qcUid?: string;
  authorizerUid?: string;
  preparedBy: string;
  createdAt: string;
  templateVersion: number;
  templateSha256: string;
  reviewedBy?: string;
  reviewNote?: string;
  forms: Array<{
    formId: string;
    formVersion: string;
    mappingId: string;
    mappingVersion: number;
    valuesSha256?: string;
  }>;
  missing: Array<{ formId: string; formVersion: string }>;
  lineage?: FormMapping[];
  [key: string]: any;
}

export interface CaseDiagnostics {
  findings: Array<{ diagnostic_id: string; severity: string; message: string; acknowledged?: boolean; [key: string]: any }>;
  [key: string]: any;
}

export interface RiskAssessment {
  assessmentId: string;
  outcome: string;
  amountCents: number;
  [key: string]: any;
}

export interface ResearchMemo {
  memo_id: string;
  caseId: string;
  question: string;
  status: string;
  version: number;
  prepared_by: string;
  created_at: string;
  returnUse: string;
  conclusion?: string;
  review_note?: string;
  reviewed_by?: string;
  citations: Array<{
    citation_no: number;
    authority_level: AuthorityLevel;
    source_id?: string;
    reference?: string;
    note: string;
    added_by: string;
  }>;
  [key: string]: any;
}

export type ConclusionInput = {
  type: string;
  statement: string;
  amount: string | null;
  links: Array<{ type: ConclusionLinkType; ref: string }>;
  [key: string]: any;
};

export interface TaxConclusion {
  conclusionId: string;
  type: string;
  version: number;
  statement: string;
  amount: string | null;
  summary?: string;
  status: string;
  preparedBy: string;
  reviewedBy?: string;
  reviewNote?: string;
  stale: Array<{ type: string; ref: string; reason: unknown }>;
  [key: string]: any;
}

export interface ConclusionReadiness {
  ready: boolean;
  conclusions: number;
  blockers: Array<{ version: number; reasons: string[]; [key: string]: any }>;
  [key: string]: any;
}

export interface ConclusionTrace {
  conclusionId: string;
  conclusion: TaxConclusion;
  sources: Array<{
    type: ConclusionLinkType;
    ref: string;
    snapshot: Record<string, any>;
    current: Record<string, any>;
    detail?: Record<string, any>;
  }>;
  versions: Array<{ conclusionId: string; version: number; status: string; reviewedBy?: string }>;
  audit: Array<{ action: string; version?: number; actorUid: string; at: string }>;
  formLines: Array<{ formId: string; line: string }>;
  links?: any[];
  [key: string]: any;
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
  [key: string]: any;
}

export interface FinalContext {
  returnVersion: ReturnVersion;
  attestation?: { attestationVersion: string; text: string };
  readiness: {
    ready?: boolean;
    finalAuthorization?: unknown;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface QcQueueItem {
  returnVersionId: string;
  caseId: string;
  templateId: string;
  version: number;
  taxYear: number;
  [key: string]: any;
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
  checklist?: { checklistVersion?: string | number; items: Array<{ code: string; text: string }> };
  [key: string]: any;
}

export interface ReviewQueueItem {
  returnVersionId: string;
  caseId: string;
  templateId: string;
  version: number;
  taxYear: number;
  status: string;
  preparedBy: string;
  submittedAt: string;
  stale: boolean;
  verification?: { result: string } | null;
  risk?: { outcome: string; reasonCodes: string[] } | null;
  [key: string]: any;
}

export interface ComparisonLine {
  formId: string;
  formVersion: string;
  priorFormVersion?: string;
  schedule: string;
  line: string;
  field: string;
  kind: 'UNCHANGED' | 'CHANGED' | 'ADDED' | 'REMOVED' | string;
  variance?: boolean;
  previousValue?: string;
  currentValue?: string;
  [key: string]: any;
}

export interface ReturnComparison {
  templateId: string;
  varianceCheck: 'APPLIED' | 'NOT_CONFIGURED' | string;
  variancePolicyVersion?: string;
  previousVersion?: { version: number; lines: ComparisonLine[] } | null;
  priorYear: {
    status: 'AVAILABLE' | 'NOT_AVAILABLE' | string;
    taxYear: number;
    templateId?: string;
    version?: number;
    stale?: boolean;
    lines: ComparisonLine[];
  };
}

export interface SignatureContext {
  readiness: {
    signaturePackage?: {
      package?: {
        releasedBy: string;
        signerUids: string[];
        consentVersion: string;
      } | null;
    };
    [key: string]: any;
  };
  releasable: { releasable: boolean; reason?: string };
  consent?: { consentVersion: string; text: string } | null;
  candidates: Array<{ uid: string; name?: string }>;
}

export function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value.trim());
}

export function parseAssignments(raw: string): Array<[string, string]> | null {
  if (!raw.trim()) return null;
  const entries: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return null;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!key || seen.has(key)) return null;
    seen.add(key);
    entries.push([key, val]);
  }
  return entries.length ? entries : null;
}

export function dollarsToCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export function taxEngineMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'The tax engine service could not complete this request.';
}

export function conclusionBadge(c: { status?: string }): string {
  return c.status || 'DRAFT';
}

export function evidenceText(v: unknown): string {
  return typeof v === 'string' ? v : JSON.stringify(v ?? {});
}

export function staleReason(r: unknown): string {
  return typeof r === 'string' ? r : 'Inputs changed since creation.';
}

export function finalAuthorizationText(v: unknown): string {
  return typeof v === 'string' ? v : 'Pending final authorization';
}

export function readinessText(v: unknown): string {
  return typeof v === 'string' ? v : 'Readiness check complete';
}

export function returnProblemText(v: unknown): string {
  return typeof v === 'string' ? v : 'No return problems recorded';
}

export function returnRiskText(v: unknown): string {
  return typeof v === 'string' ? v : 'Risk assessment recorded';
}

export function verificationText(v: unknown): string {
  return typeof v === 'string' ? v : 'Verification recorded';
}

export function formProblemText(v: unknown): string {
  return typeof v === 'string' ? v : 'Form mapping verified';
}

export function comparisonLineText(line: ComparisonLine): string {
  return `${line.formId} ${line.schedule} Line ${line.line} (${line.field}): ${line.previousValue ?? '—'} → ${line.currentValue ?? '—'}`;
}

export function signaturePackageText(readiness: SignatureContext['readiness']): string {
  return readiness?.signaturePackage?.package ? 'Released for client signature' : 'Not yet released for signature';
}

const emptyReturnVersion = (returnVersionId: string, caseId = '', templateId = '1040', status: ReturnVersion['status'] = 'DRAFT'): ReturnVersion => ({
  returnVersionId,
  caseId,
  templateId,
  version: 1,
  taxYear: 2025,
  status,
  stale: [],
  preparedBy: 'system',
  createdAt: new Date().toISOString(),
  templateVersion: 1,
  templateSha256: '0'.repeat(64),
  forms: [],
  missing: [],
  lineage: [],
});

const emptyFormMapping = (mappingId: string, caseId = '', formRuleId = ''): FormMapping => ({
  mappingId,
  caseId,
  formRuleId,
  formId: '1040',
  formVersion: '2025',
  version: 1,
  mappedBy: 'system',
  createdAt: new Date().toISOString(),
  ruleVersion: 1,
  ruleSha256: '0'.repeat(64),
  status: 'MAPPED',
  stale: [],
  missing: [],
  values: [],
});

const emptyConclusion = (conclusionId: string, body: ConclusionInput): TaxConclusion => ({
  conclusionId,
  type: body.type,
  version: 1,
  statement: body.statement,
  amount: body.amount,
  summary: body.statement,
  status: 'DRAFT',
  preparedBy: 'system',
  stale: [],
});

export const taxEngineService = {
  sources: async () => [] as TaxSource[],
  verifySource: async (_sourceId: string, _sha256: string) => ({ success: true }),
  registerSource: async (_input: Record<string, any>) => ({ success: true }),
  ruleSets: async (_taxYear?: number) => [] as RuleSetSummary[],
  ruleSet: async (ruleSetId: string): Promise<RuleSetDetail> => ({
    ruleSetId,
    taxYear: 2025,
    status: 'DRAFT',
    version: 1,
    jurisdiction: 'federal',
    jurisdictionCode: 'US',
    returnFamily: '1040',
    preparedBy: 'system',
    contentSha256: '0'.repeat(64),
    sourceIds: [],
    definition: { parameters: [] },
    rules: [],
  }),
  draftRuleSet: async (_definition: unknown) => ({ success: true }),
  coverage: async (_ruleSetId: string): Promise<RuleSetCoverage> => ({
    total: 0,
    covered: 0,
    missingOutputs: [],
    missingFilingStatuses: [],
  }),
  tests: async (_ruleSetId: string): Promise<RuleSetTests> => ({
    passed: 0,
    failed: 0,
    cases: [],
    tests: [],
    latestRun: null,
  }),
  removeTest: async (_ruleSetId: string, _testId: string) => ({ success: true }),
  runTests: async (_ruleSetId: string) => ({ success: true }),
  addTest: async (_ruleSetId: string, _input: Record<string, any>) => ({ success: true }),
  transition: async (_ruleSetId: string, _action: string, _note?: string) => ({ success: true }),
  caseReturns: async (_caseId: string) => [] as ReturnVersion[],
  returnTemplates: async (_taxYear?: number) => [] as ReturnTemplate[],
  prepareReturn: async (caseId: string, templateId: string): Promise<ReturnVersion> => ({
    ...emptyReturnVersion('rv_' + Date.now(), caseId, templateId, 'DRAFT'),
    replayed: false,
  }),
  transitionReturn: async (returnVersionId: string, _action: string, _note?: string): Promise<ReturnVersion> =>
    emptyReturnVersion(returnVersionId, '', '1040', 'SUBMITTED'),
  verifyReturn: async (_returnVersionId: string) => ({ status: 'VERIFIED' }),
  assessReturnRisk: async (_returnVersionId: string, _cents: number) => ({ outcome: 'LOW' }),
  returnReadiness: async (_returnVersionId: string) => ({ ready: true }),
  assignQc: async (_returnVersionId: string, qcUid: string) => ({ qcUid }),
  assignFinalAuthorizer: async (_returnVersionId: string, authorizerUid: string) => ({ authorizerUid }),
  returnVersion: async (returnVersionId: string): Promise<ReturnVersion> => emptyReturnVersion(returnVersionId),
  caseFormMappings: async (_caseId: string) => [] as FormMapping[],
  formRules: async (_taxYear?: number) => [] as FormRule[],
  formMapping: async (mappingId: string): Promise<FormMapping> => emptyFormMapping(mappingId),
  mapForm: async (caseId: string, formRuleId: string): Promise<FormMapping> =>
    emptyFormMapping('fm_' + Date.now(), caseId, formRuleId),
  caseResearch: async (_caseId: string) => [] as ResearchMemo[],
  openResearch: async (caseId: string, question: string): Promise<ResearchMemo> => ({
    memo_id: 'memo_' + Date.now(),
    caseId,
    question,
    status: 'DRAFT',
    version: 1,
    prepared_by: 'system',
    created_at: new Date().toISOString(),
    returnUse: 'BLOCKED',
    citations: [],
  }),
  citeResearch: async (_memoId: string, _citation: any) => ({ success: true }),
  submitResearch: async (_memoId: string, _conclusion: string, _version: number) => ({ success: true }),
  reviewResearch: async (_memoId: string, _decision: string, _note: string, _version: number) => ({ success: true }),
  reviewQueue: async () => [] as ReviewQueueItem[],
  runLineage: async (runId: string): Promise<RunLineage> => ({ runId, inputs: [], outputs: [] }),
  caseDiagnostics: async (_caseId: string): Promise<CaseDiagnostics> => ({ findings: [] }),
  caseRisk: async (_caseId: string) => [] as RiskAssessment[],
  runDiagnostics: async (_caseId: string) => ({ findings: [] }),
  acknowledgeDiagnostic: async (_diagnosticId: string, _note: string) => ({ success: true }),
  assessRisk: async (_caseId: string, amountCents: number, _unsupported: boolean): Promise<RiskAssessment> => ({
    assessmentId: 'ra_' + Date.now(),
    outcome: 'LOW',
    amountCents,
  }),
  signatureContext: async (_returnVersionId: string): Promise<SignatureContext> => ({
    readiness: {},
    releasable: { releasable: false, reason: 'Signature provider unavailable offline' },
    consent: null,
    candidates: [],
  }),
  withdrawSignaturePackage: async (_returnVersionId: string, _reason: string) => ({ success: true }),
  releaseSignaturePackage: async (_returnVersionId: string, _payload: any) => ({ success: true }),
  qcQueue: async () => [] as QcQueueItem[],
  qcContext: async (returnVersionId: string): Promise<QcContext> => ({
    returnVersion: emptyReturnVersion(returnVersionId),
    checklist: { checklistVersion: '1', items: [] },
  }),
  recordQc: async (_returnVersionId: string, _results: QcResultInput[], _note?: string) => ({ outcome: 'QC_PASSED' as const }),
  finalQueue: async () => [] as FinalQueueItem[],
  finalContext: async (returnVersionId: string): Promise<FinalContext> => ({
    returnVersion: emptyReturnVersion(returnVersionId),
    readiness: { ready: false },
  }),
  decideFinal: async (_returnVersionId: string, input: { outcome: FinalOutcome; [key: string]: any }) => ({ outcome: input.outcome }),
  caseConclusions: async (_caseId: string) => [] as TaxConclusion[],
  conclusionReadiness: async (_caseId: string): Promise<ConclusionReadiness> => ({ ready: true, conclusions: 0, blockers: [] }),
  traceConclusion: async (conclusionId: string): Promise<ConclusionTrace> => ({
    conclusionId,
    conclusion: emptyConclusion(conclusionId, { type: 'INCOME_INCLUSION', statement: '', amount: null, links: [] }),
    sources: [],
    versions: [],
    audit: [],
    formLines: [],
    links: [],
  }),
  proposeConclusion: async (_caseId: string, body: ConclusionInput): Promise<TaxConclusion> =>
    emptyConclusion('conc_' + Date.now(), body),
  reviseConclusion: async (conclusionId: string, body: ConclusionInput): Promise<TaxConclusion> =>
    emptyConclusion(conclusionId, body),
  submitConclusion: async (_conclusionId: string) => ({ success: true }),
  reviewConclusion: async (_conclusionId: string, _decision: string, _note: string) => ({ success: true }),
  caseRuns: async (_caseId: string) => [] as CalculationRun[],
  reviewRun: async (_runId: string, _decision: string, _note: string) => ({ success: true }),
  returnComparison: async (_returnVersionId: string): Promise<ReturnComparison> => ({
    templateId: '1040',
    varianceCheck: 'NOT_CONFIGURED',
    previousVersion: null,
    priorYear: { status: 'NOT_AVAILABLE', taxYear: 2024, lines: [] },
  }),
};
