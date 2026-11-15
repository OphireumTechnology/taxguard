export type AuthorityLevel =
  | 'AUTHORITATIVE'
  | 'SECONDARY'
  | 'INTERNAL_GUIDANCE'
  | 'AI_INFERENCE'
  | string;
export type AuthorityType = AuthorityLevel;

export const AUTHORITY_LEVELS: AuthorityLevel[] = [
  'AUTHORITATIVE',
  'SECONDARY',
  'INTERNAL_GUIDANCE',
  'AI_INFERENCE',
];
export const AUTHORITY_TYPES = AUTHORITY_LEVELS;
export const AUTHORITY_LABELS: Record<string, string> = {
  AUTHORITATIVE: 'Authoritative Primary Law',
  SECONDARY: 'Secondary Authority & Commentary',
  INTERNAL_GUIDANCE: 'Firm Internal Tax Guidance',
  AI_INFERENCE: 'AI Inference (Non-Authoritative)',
};

export const CONCLUSION_TYPES = [
  'INCOME_INCLUSION',
  'INCOME_CLASSIFICATION',
  'DEDUCTION_ALLOWABILITY',
  'CREDIT_ELIGIBILITY',
  'FILING_REQUIREMENT',
  'ENTITY_ELECTION',
  'DISCLOSURE_POSITION',
] as const;

export type ConclusionLinkType = 'EVIDENCE' | 'CALCULATION' | 'RESEARCH' | 'WORKPAPER' | string;

export const RISK_OUTCOME_LABELS: Record<string, string> = {
  LOW: 'Low Risk',
  MODERATE: 'Moderate Risk',
  HIGH: 'High Risk — Reviewer Sign-off Required',
  CRITICAL: 'Critical — Blocked Pending Resolution',
  BLOCKED: 'Blocked — Human Review Required',
};

export const RISK_REASON_LABELS: Record<string, string> = {
  MISSING_EVIDENCE: 'Supporting evidence incomplete',
  MATERIAL_JUDGMENT: 'Material tax judgment requires review',
  UNVERIFIED_AUTHORITY: 'Tax authority pending verification',
  DIAGNOSTIC_WARNING: 'Diagnostic validation warning',
};

export const RETURN_RISK_REASON_LABELS: Record<string, string> = {
  ...RISK_REASON_LABELS,
  UNRESOLVED_DIAGNOSTIC: 'Unresolved return diagnostic',
  UNSUPPORTED_POSITION: 'Tax position lacks verified authority',
};

export const RETURN_PROBLEM_LABELS: Record<string, string> = {
  BLOCKING_DIAGNOSTIC: 'Blocking diagnostic detected',
  STALE_CONCLUSION: 'Referenced tax conclusion is stale',
  MISSING_SIGNATURE: 'Client authorization pending',
};

export type FinalOutcome = 'AUTHORIZED' | 'DECLINED' | string;

export interface TaxSource {
  source_id: string;
  id?: string;
  title: string;
  citation: string;
  authority_type: AuthorityLevel;
  authorityLevel?: AuthorityLevel;
  jurisdiction: string;
  jurisdiction_code: string;
  tax_years: number[];
  status: string;
  registered_by: string;
  verified_by?: string | null;
  url?: string;
  sha256?: string;
  synthetic?: boolean;
  [key: string]: any;
}

export interface RuleSetSummary {
  ruleSetId: string;
  id?: string;
  jurisdiction: string;
  jurisdictionCode: string;
  returnFamily: string;
  taxYear: number;
  version: string | number;
  status: string;
  preparedBy: string;
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
  missingOutputs: string[];
  missingFilingStatuses: string[];
  totalRules?: number;
  verifiedRules?: number;
  coveragePercent?: number;
  [key: string]: any;
}

export interface RuleSetTests {
  tests: Array<{
    testId: string;
    name: string;
    filingStatus?: string;
    expected: Record<string, any>;
    sourceId: string;
    citation: string;
  }>;
  testsSha256: string;
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
      mismatches?: Array<{ output: string; expected: any; actual?: any }>;
    }>;
  } | null;
  [key: string]: any;
}

export interface ResearchMemo {
  memo_id: string;
  id?: string;
  caseId?: string;
  question: string;
  status: string;
  prepared_by: string;
  reviewed_by?: string | null;
  created_at: string;
  returnUse: string;
  conclusion?: string | null;
  review_note?: string | null;
  version: number;
  citations: Array<{
    citation_no: number;
    authority_level: AuthorityLevel;
    source_id?: string | null;
    reference?: string | null;
    note: string;
    added_by: string;
  }>;
  [key: string]: any;
}

export interface TaxConclusion {
  conclusionId: string;
  id?: string;
  caseId?: string;
  type: string;
  version: number;
  status: string;
  statement: string;
  amount?: string | null;
  preparedBy: string;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  stale: Array<{ type: string; ref: string; reason?: string }>;
  [key: string]: any;
}

export interface ConclusionInput {
  type: string;
  statement: string;
  amount: string | null;
  links: Array<{ type: ConclusionLinkType; ref: string }>;
}

export interface ConclusionReadiness {
  ready: boolean;
  conclusions: number;
  blockers: Array<{ version: number; reasons: string[] }>;
  [key: string]: any;
}

export interface ConclusionTrace {
  conclusion: TaxConclusion;
  sources: Array<{
    type: ConclusionLinkType;
    ref: string;
    snapshot: Record<string, any>;
    current: Record<string, any>;
    detail?: Record<string, any>;
  }>;
  versions: Array<{
    conclusionId: string;
    version: number;
    status: string;
    reviewedBy?: string | null;
  }>;
  audit: Array<{
    action: string;
    version?: number;
    actorUid: string;
    at: string;
  }>;
  formLines: Array<{ formId: string; line: string }>;
  [key: string]: any;
}

export interface FormRule {
  ruleId: string;
  formId: string;
  formVersion: string;
  version: number;
  lines: number;
  status: string;
  returnFamily: string;
  jurisdiction: string;
  jurisdictionCode: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  [key: string]: any;
}

export interface FormMapping {
  mappingId: string;
  formId: string;
  formVersion: string;
  version: number;
  status: string;
  stale: string[];
  replayed?: boolean;
  mappedBy: string;
  createdAt: string;
  ruleVersion: number;
  ruleSha256: string;
  missing: Array<{ line: string }>;
  values?: Array<{
    schedule: string;
    line: string;
    field: string;
    value: string;
    valueType: string;
    sources: Array<{
      conclusionId: string;
      conclusionVersion: number;
      conclusionType: string;
      value: string;
      runId: string;
      ruleSetId: string;
      ruleSetVersion: number;
      ruleSetSha256: string;
      evidence: Array<{ ref: string }>;
    }>;
  }>;
  [key: string]: any;
}

export interface ReturnTemplate {
  templateRuleId: string;
  templateId: string;
  version: number;
  forms: number;
  status: string;
  returnFamily: string;
  jurisdiction: string;
  jurisdictionCode: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  [key: string]: any;
}

export interface ReturnVersion {
  returnVersionId: string;
  id?: string;
  caseId?: string;
  taxYear?: number;
  templateId: string;
  version: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED' | 'SUPERSEDED';
  stale: Array<{ reason: string; formId?: string; [key: string]: any }>;
  replayed?: boolean;
  preparedBy: string;
  createdAt: string;
  templateVersion: number;
  templateSha256: string;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  forms: Array<{
    formId: string;
    formVersion: string;
    mappingId: string;
    mappingVersion: number;
    valuesSha256?: string;
  }>;
  missing: Array<{ formId: string; formVersion: string }>;
  lineage?: Array<{
    mappingId: string;
    formId: string;
    formVersion: string;
    version: number;
    values: Array<{
      schedule: string;
      line: string;
      field: string;
      value: string;
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
  [key: string]: any;
}

export interface CaseDiagnostics {
  diagnosedAt: string | null;
  ready: boolean;
  blocking: number;
  errors: number;
  diagnostics: Array<{
    diagnostic_id: string;
    severity: string;
    rule_code: string;
    rule_version: number;
    status: string;
    message: string;
    detected_at: string;
    acknowledged_by?: string | null;
    acknowledgement_note?: string | null;
  }>;
  [key: string]: any;
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
  [key: string]: any;
}

export interface CalculationRun {
  run_id: string;
  id?: string;
  status: string;
  taxYear?: number;
  created_at: string;
  outputs: Record<string, any>;
  requested_by: string;
  reviewed_by?: string | null;
  review_note?: string | null;
  synthetic?: boolean;
  [key: string]: any;
}

export interface RunLineage {
  runId: string;
  recorded: boolean;
  complete: boolean;
  citations: Array<{
    factPath: string;
    value?: string | number | null;
    ref: string;
    resolution: unknown;
  }>;
  [key: string]: any;
}

export interface QcQueueItem {
  assignmentId: string;
  returnVersionId: string;
  caseId: string;
  templateId: string;
  version: number;
  taxYear: number;
  latestOutcome: 'QC_PASSED' | 'QC_RETURNED' | null;
  [key: string]: any;
}

export interface QcContext {
  returnVersion: ReturnVersion;
  verification?: { result: string } | null;
  risk?: { outcome: string; reasonCodes: string[] } | null;
  checklist?: {
    checklistVersion: number;
    items: Array<{ code: string; text: string }>;
  } | null;
  [key: string]: any;
}

export interface QcResultInput {
  code: string;
  result: 'PASS' | 'FAIL';
  note?: string;
}

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
  readiness: {
    ready: boolean;
    finalAuthorization?: boolean;
    [key: string]: any;
  };
  attestation?: {
    attestationVersion: number;
    text: string;
  } | null;
  [key: string]: any;
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
  verification?: { result: string } | null;
  risk?: { outcome: string; reasonCodes: string[] } | null;
  [key: string]: any;
}

export interface ComparisonLine {
  kind: string;
  variance?: boolean;
  formId: string;
  formVersion: string;
  priorFormVersion?: string;
  schedule: string;
  line: string;
  field: string;
  priorValue?: string;
  currentValue?: string;
  [key: string]: any;
}

export interface ReturnComparison {
  templateId: string;
  varianceCheck: string;
  variancePolicyVersion?: number;
  previousVersion?: {
    version: number;
    lines: ComparisonLine[];
  } | null;
  priorYear: {
    taxYear: number;
    status: string;
    templateId?: string;
    version?: number;
    stale?: boolean;
    lines: ComparisonLine[];
  };
  [key: string]: any;
}

export interface SignatureContext {
  caseId?: string;
  readiness: {
    signaturePackage?: {
      package?: {
        releasedBy: string;
        signerUids: string[];
        consentVersion: number;
      } | null;
    };
    [key: string]: any;
  };
  releasable: {
    releasable: boolean;
    [key: string]: any;
  };
  consent?: {
    consentVersion: number;
    text: string;
  } | null;
  candidates: Array<{ uid: string; name?: string }>;
  [key: string]: any;
}

export class TaxEngineRequestError extends Error {
  constructor(public readonly status: number, public readonly code: string, message?: string) {
    super(message ?? code);
  }
}

export function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test((value || '').trim());
}

export function dollarsToCents(dollars: number | string): number | null {
  const raw = typeof dollars === 'number' ? String(dollars) : String(dollars ?? '').trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) && num >= 0 ? Math.round(num * 100) : null;
}

export function parseAssignments(raw: string): Array<[string, number]> | null {
  const lines = (raw || '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const entries: Array<[string, number]> = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const idx = line.indexOf('=');
    if (idx <= 0) return null;
    const key = line.slice(0, idx).trim();
    const val = Number(line.slice(idx + 1).trim());
    if (!key || !Number.isFinite(val) || seen.has(key)) return null;
    seen.add(key);
    entries.push([key, val]);
  }
  return entries;
}

export function taxEngineMessage(err: unknown): string {
  if (err instanceof TaxEngineRequestError) return err.message;
  return err instanceof Error ? err.message : 'Tax engine request failed.';
}

export function conclusionBadge(k: TaxConclusion | string): string {
  if (typeof k === 'string') return (k || 'DRAFT').replace(/_/g, ' ');
  if (k.stale && k.stale.length > 0 && k.status !== 'SUPERSEDED') return 'STALE';
  return (k.status || 'DRAFT').replace(/_/g, ' ');
}

export function evidenceText(item: unknown): string {
  return typeof item === 'string' ? item : JSON.stringify(item ?? {});
}

export function staleReason(reason?: string): string {
  return reason || 'Underlying facts or authority rules changed since last review.';
}

export function finalAuthorizationText(r: any): string {
  if (typeof r === 'string') return (r || 'PENDING').replace(/_/g, ' ');
  return String(r?.finalAuthorization?.status || r?.status || 'required').replace(/_/g, ' ');
}

export function readinessText(r: any): string {
  if (typeof r === 'string') return (r || 'NOT_READY').replace(/_/g, ' ');
  return r?.ready ? 'ready' : 'not ready';
}

export function returnProblemText(problem: string | { reason: string; formId?: string }): string {
  const reason = typeof problem === 'string' ? problem : problem.reason;
  const label = RETURN_PROBLEM_LABELS[reason] ?? reason.replace(/_/g, ' ');
  return typeof problem === 'object' && problem.formId ? `${label} (${problem.formId})` : label;
}

export function returnRiskText(r: any): string {
  const risk = typeof r === 'string' ? r : String(r?.outcome || 'BLOCKED');
  return RISK_OUTCOME_LABELS[risk] ?? risk.replace(/_/g, ' ');
}

export function verificationText(r: any): string {
  const status = typeof r === 'string' ? r : String(r?.result || r?.status || 'UNVERIFIED');
  return status.replace(/_/g, ' ').toLowerCase();
}

export function formProblemText(problem: string): string {
  return problem.replace(/_/g, ' ');
}

export function comparisonLineText(line: ComparisonLine): string {
  return `${line.formId} ${line.schedule} ${line.line} (${line.field}): ${line.priorValue ?? '—'} → ${line.currentValue ?? '—'}`;
}

export function signaturePackageText(r: any): string {
  if (typeof r === 'string') return (r || 'NOT_RELEASED').replace(/_/g, ' ');
  return String(r?.signaturePackage?.status || 'not released').replace(/_/g, ' ').toLowerCase();
}

export const taxEngineService = {
  sources: async (): Promise<TaxSource[]> => [],
  registerSource: async (input: any): Promise<TaxSource> => ({
    source_id: input?.sourceId || `src_${Date.now()}`,
    title: input?.title || '',
    citation: input?.citation || '',
    authority_type: input?.authorityType || 'AUTHORITATIVE',
    jurisdiction: input?.jurisdiction || 'federal',
    jurisdiction_code: input?.jurisdictionCode || 'US',
    tax_years: input?.taxYears || [2025],
    status: 'PROPOSED',
    registered_by: 'staff',
    ...input,
  }),
  verifySource: async (_sourceId: string, _sha256: string) => ({ success: true }),
  ruleSets: async (_year?: number): Promise<RuleSetSummary[]> => [],
  ruleSet: async (id: string): Promise<RuleSetDetail> => ({
    ruleSetId: id,
    jurisdiction: 'federal',
    jurisdictionCode: 'US',
    returnFamily: '1040',
    taxYear: 2025,
    version: '1.0.0',
    status: 'DRAFT',
    preparedBy: 'staff',
    contentSha256: '0'.repeat(64),
    sourceIds: [],
    definition: { parameters: [] },
  }),
  draftRuleSet: async (input: any): Promise<RuleSetSummary> => ({
    ruleSetId: `rs_${Date.now()}`,
    jurisdiction: input?.jurisdiction ?? 'federal',
    jurisdictionCode: input?.jurisdictionCode ?? 'US',
    returnFamily: input?.returnFamily ?? '1040',
    taxYear: input?.taxYear ?? 2025,
    version: '1.0.0',
    status: 'DRAFT',
    preparedBy: 'staff',
  }),
  coverage: async (_id: string): Promise<RuleSetCoverage> => ({
    missingOutputs: [],
    missingFilingStatuses: [],
  }),
  tests: async (_id: string): Promise<RuleSetTests> => ({
    tests: [],
    testsSha256: '0'.repeat(64),
    latestRun: null,
  }),
  addTest: async (_id: string, _test: any) => ({ success: true }),
  removeTest: async (_id: string, _testId: string) => ({ success: true }),
  runTests: async (_id: string) => ({ success: true }),
  transition: async (_id: string, _action: string, _note?: string) => ({ success: true }),
  caseResearch: async (_caseId: string): Promise<ResearchMemo[]> => [],
  openResearch: async (_caseId: string, question: string): Promise<ResearchMemo> => ({
    memo_id: `res_${Date.now()}`,
    question,
    status: 'DRAFT',
    prepared_by: 'staff',
    created_at: new Date().toISOString(),
    returnUse: 'BLOCKED',
    version: 1,
    citations: [],
  }),
  citeResearch: async (_memoId: string, _citation: any) => ({ success: true }),
  submitResearch: async (_memoId: string, _conclusion: string, _version: number) => ({ success: true }),
  reviewResearch: async (_memoId: string, _decision: string, _note: string, _version: number) => ({ success: true }),
  caseConclusions: async (_caseId: string): Promise<TaxConclusion[]> => [],
  conclusionReadiness: async (_caseId: string): Promise<ConclusionReadiness> => ({
    ready: false,
    conclusions: 0,
    blockers: [],
  }),
  proposeConclusion: async (_caseId: string, input: ConclusionInput): Promise<TaxConclusion> => ({
    conclusionId: `conc_${Date.now()}`,
    type: input.type,
    version: 1,
    status: 'DRAFT',
    statement: input.statement,
    amount: input.amount,
    preparedBy: 'staff',
    stale: [],
  }),
  submitConclusion: async (_id: string) => ({ success: true }),
  reviewConclusion: async (_id: string, _decision: string, _note?: string) => ({ success: true }),
  reviseConclusion: async (_id: string, _input: ConclusionInput) => ({ success: true }),
  traceConclusion: async (id: string): Promise<ConclusionTrace> => ({
    conclusion: {
      conclusionId: id,
      type: 'INCOME_INCLUSION',
      version: 1,
      status: 'DRAFT',
      statement: '',
      preparedBy: 'staff',
      stale: [],
    },
    sources: [],
    versions: [],
    audit: [],
    formLines: [],
  }),
  formRules: async (_taxYear?: number): Promise<FormRule[]> => [],
  caseFormMappings: async (_caseId: string): Promise<FormMapping[]> => [],
  formMapping: async (id: string): Promise<FormMapping> => ({
    mappingId: id,
    formId: 'Form 1040',
    formVersion: '2025',
    version: 1,
    status: 'CURRENT',
    stale: [],
    mappedBy: 'staff',
    createdAt: new Date().toISOString(),
    ruleVersion: 1,
    ruleSha256: '0'.repeat(64),
    missing: [],
    values: [],
  }),
  mapForm: async (_caseId: string, _ruleId: string): Promise<FormMapping> => ({
    mappingId: `fm_${Date.now()}`,
    formId: 'Form 1040',
    formVersion: '2025',
    version: 1,
    status: 'CURRENT',
    stale: [],
    mappedBy: 'staff',
    createdAt: new Date().toISOString(),
    ruleVersion: 1,
    ruleSha256: '0'.repeat(64),
    missing: [],
    values: [],
  }),
  returnTemplates: async (_taxYear?: number): Promise<ReturnTemplate[]> => [],
  caseReturns: async (_caseId: string): Promise<ReturnVersion[]> => [],
  returnVersion: async (id: string): Promise<ReturnVersion> => ({
    returnVersionId: id,
    templateId: '1040-2025',
    version: 1,
    status: 'DRAFT',
    stale: [],
    preparedBy: 'staff',
    createdAt: new Date().toISOString(),
    templateVersion: 1,
    templateSha256: '0'.repeat(64),
    forms: [],
    missing: [],
    lineage: [],
  }),
  prepareReturn: async (_caseId: string, templateRuleId: string): Promise<ReturnVersion> => ({
    returnVersionId: `ret_${Date.now()}`,
    templateId: templateRuleId || '1040-2025',
    version: 1,
    status: 'DRAFT',
    stale: [],
    preparedBy: 'staff',
    createdAt: new Date().toISOString(),
    templateVersion: 1,
    templateSha256: '0'.repeat(64),
    forms: [],
    missing: [],
    lineage: [],
  }),
  verifyReturn: async (_id: string) => ({ result: 'VERIFIED' }),
  transitionReturn: async (id: string, action: string, _note?: string): Promise<ReturnVersion> => ({
    returnVersionId: id,
    templateId: '1040-2025',
    version: 1,
    status: action === 'approve' ? 'APPROVED' : action === 'submit' ? 'SUBMITTED' : 'RETURNED',
    stale: [],
    preparedBy: 'staff',
    createdAt: new Date().toISOString(),
    templateVersion: 1,
    templateSha256: '0'.repeat(64),
    forms: [],
    missing: [],
  }),
  returnReadiness: async (_id: string) => ({ ready: false, finalAuthorization: { status: 'required' } }),
  assessReturnRisk: async (_id: string, _cents: number) => ({ outcome: 'BLOCKED' }),
  returnComparison: async (_returnVersionId: string): Promise<ReturnComparison> => ({
    templateId: '1040-2025',
    varianceCheck: 'NOT_CONFIGURED',
    previousVersion: null,
    priorYear: { taxYear: 2024, status: 'NOT_AVAILABLE', lines: [] },
  }),
  caseDiagnostics: async (_caseId: string): Promise<CaseDiagnostics> => ({
    diagnosedAt: null,
    ready: false,
    blocking: 0,
    errors: 0,
    diagnostics: [],
  }),
  runDiagnostics: async (_caseId: string): Promise<CaseDiagnostics> => ({
    diagnosedAt: new Date().toISOString(),
    ready: true,
    blocking: 0,
    errors: 0,
    diagnostics: [],
  }),
  acknowledgeDiagnostic: async (_id: string, _note: string) => ({ success: true }),
  caseRisk: async (_caseId: string): Promise<RiskAssessment[]> => [],
  assessRisk: async (_caseId: string, amountCents: number, _unsupported: boolean): Promise<RiskAssessment> => ({
    assessment_id: `risk_${Date.now()}`,
    outcome: 'BLOCKED',
    amount_cents: amountCents,
    materiality: 'LOW',
    risk_level: 'MODERATE',
    policy_version: null,
    assessed_by: 'staff',
    assessed_at: new Date().toISOString(),
    reason_codes: [],
  }),
  caseRuns: async (_caseId: string): Promise<CalculationRun[]> => [],
  reviewRun: async (_id: string, _decision: string, _note?: string) => ({ success: true }),
  runLineage: async (runId: string): Promise<RunLineage> => ({
    runId,
    recorded: false,
    complete: true,
    citations: [],
  }),
  qcQueue: async (): Promise<QcQueueItem[]> => [],
  qcContext: async (id: string): Promise<QcContext> => ({
    returnVersion: {
      returnVersionId: id,
      templateId: '1040-2025',
      version: 1,
      status: 'APPROVED',
      stale: [],
      preparedBy: 'staff',
      createdAt: new Date().toISOString(),
      templateVersion: 1,
      templateSha256: '0'.repeat(64),
      forms: [],
      missing: [],
    },
    verification: null,
    risk: null,
    checklist: null,
  }),
  assignQc: async (_id: string, uid: string) => ({ qcUid: uid }),
  recordQc: async (_id: string, list: QcResultInput[], _note?: string) => ({
    outcome: (list.some(i => i.result === 'FAIL') ? 'QC_RETURNED' : 'QC_PASSED') as 'QC_PASSED' | 'QC_RETURNED',
  }),
  finalQueue: async (): Promise<FinalQueueItem[]> => [],
  finalContext: async (id: string): Promise<FinalContext> => ({
    returnVersion: {
      returnVersionId: id,
      templateId: '1040-2025',
      version: 1,
      status: 'APPROVED',
      stale: [],
      preparedBy: 'staff',
      createdAt: new Date().toISOString(),
      templateVersion: 1,
      templateSha256: '0'.repeat(64),
      forms: [],
      missing: [],
    },
    readiness: { ready: false },
    attestation: null,
  }),
  assignFinalAuthorizer: async (_id: string, uid: string) => ({ authorizerUid: uid }),
  decideFinal: async (_id: string, input: { outcome: FinalOutcome; attestationVersion: number; acknowledged: boolean; note?: string }) => ({
    outcome: input.outcome,
  }),
  reviewQueue: async (): Promise<ReviewQueueItem[]> => [],
  signatureContext: async (id: string): Promise<SignatureContext> => ({
    caseId: id,
    readiness: { signaturePackage: { package: null } },
    releasable: { releasable: false },
    consent: null,
    candidates: [],
  }),
  releaseSignaturePackage: async (_id: string, _input: { consentVersion: number; acknowledged: boolean; signers: string[] }) => ({
    success: true,
  }),
  withdrawSignaturePackage: async (_id: string, _reason: string) => ({ success: true }),
};
