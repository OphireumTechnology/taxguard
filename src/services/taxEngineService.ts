/** Browser client for /api/tax-engine: source-of-law records and versioned rule sets (proposal 033). The server decides
 * every permission (reviewers verify and approve; the maker never checks their own work); this client only relays. */
import { getStoredToken } from './api';
import { apiEndpoint } from '../config/apiEndpoint';

export class TaxEngineRequestError extends Error {
  constructor(public readonly status: number, public readonly code?: string, public readonly detail?: string) { super(code || 'TAX_ENGINE_REQUEST_FAILED'); }
}
export const AUTHORITY_TYPES = ['statute', 'regulation', 'form_instructions', 'publication', 'revenue_procedure', 'revenue_ruling', 'notice',
  'state_statute', 'state_regulation', 'state_guidance', 'synthetic_test'] as const;
export interface TaxSource { source_id: string; jurisdiction: 'federal' | 'state'; jurisdiction_code: string; authority_type: string; title: string; issuer: string;
  citation: string; url: string | null; tax_years: number[]; synthetic: boolean; document_sha256: string | null; status: 'PROPOSED' | 'VERIFIED' | 'RETIRED';
  registered_by: string; registered_at: string; verified_by: string | null; verified_at: string | null }
export interface NewTaxSource { sourceId: string; jurisdiction: 'federal' | 'state'; jurisdictionCode: string; authorityType: string; title: string; issuer: string;
  citation: string; url?: string; taxYears: number[] }
export interface RuleSetSummary { ruleSetId: string; jurisdiction: string; jurisdictionCode: string; returnFamily: string; taxYear: number; version: number;
  contentSha256: string; sourceIds: string[]; synthetic: boolean; status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';
  preparedBy: string; createdAt: string; submittedAt: string | null; reviewedBy: string | null; reviewedAt: string | null; reviewNote: string | null }
export interface RuleSetDetail extends RuleSetSummary { definition: { parameters?: Array<{ key: string; value: string; unit?: string; sourceId?: string; citation?: string; filingStatus?: string }>; [k: string]: unknown } }
export interface RuleSetCoverage { ruleSetId: string; contentSha256: string; missingOutputs: string[]; missingFilingStatuses: string[] }

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const token = getStoredToken();
  if (!token) throw new TaxEngineRequestError(401, 'AUTH_REQUIRED');
  const response = await fetch(apiEndpoint('/api/tax-engine' + path), { method, cache: 'no-store', credentials: 'omit',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => null);
  if (getStoredToken() !== token) throw new TaxEngineRequestError(409, 'SESSION_CHANGED');
  if (!response.ok) throw new TaxEngineRequestError(response.status, typeof data?.code === 'string' ? data.code : undefined, typeof data?.detail === 'string' ? data.detail : undefined);
  return data as T;
}
const id = (v: string) => '/' + encodeURIComponent(v);
export const taxEngineService = {
  sources: () => request<{ items: TaxSource[] }>('GET', '/sources').then(r => r.items),
  registerSource: (source: NewTaxSource) => request<TaxSource>('POST', '/sources', source),
  verifySource: (sourceId: string, documentSha256: string) => request<TaxSource>('POST', '/sources' + id(sourceId) + '/verify', { documentSha256 }),
  ruleSets: (taxYear?: number) => request<{ items: RuleSetSummary[] }>('GET', '/rule-sets' + (taxYear ? '?taxYear=' + taxYear : '')).then(r => r.items),
  ruleSet: (ruleSetId: string) => request<RuleSetDetail>('GET', '/rule-sets' + id(ruleSetId)),
  coverage: (ruleSetId: string) => request<RuleSetCoverage>('GET', '/rule-sets' + id(ruleSetId) + '/coverage'),
  transition: (ruleSetId: string, action: 'submit' | 'approve' | 'reject', note?: string) =>
    request<RuleSetSummary>('POST', '/rule-sets' + id(ruleSetId) + '/' + action, note ? { note } : {}),
  tests: (ruleSetId: string) => request<RuleSetTests>('GET', '/rule-sets' + id(ruleSetId) + '/tests'),
  /** The server validates, hashes and versions the definition; nothing here is treated as tax law until approved. */
  draftRuleSet: (definition: unknown) => request<RuleSetSummary>('POST', '/rule-sets', { definition }),
  addTest: (ruleSetId: string, test: NewRuleTest) => request<{ testId: string }>('POST', '/rule-sets' + id(ruleSetId) + '/tests', test),
  removeTest: (ruleSetId: string, testId: string) => request('POST', '/rule-sets' + id(ruleSetId) + '/tests' + id(testId) + '/remove', {}),
  /** The server evaluates every test with the deterministic engine and records the run; the browser computes nothing. */
  runTests: (ruleSetId: string) => request<{ testCount: number; passedCount: number; allPassed: boolean }>('POST', '/rule-sets' + id(ruleSetId) + '/run-tests', {}),
  caseRuns: (caseId: string) => request<{ items: CalculationRun[]; returnUse: 'BLOCKED' }>('GET', '/cases' + id(caseId) + '/runs').then(r => r.items),
  reviewRun: (runId: string, decision: 'approve' | 'reject', note: string) => request<CalculationRun>('POST', '/runs' + id(runId) + '/' + decision, { note }),
  runLineage: (runId: string) => request<RunLineage>('GET', '/runs' + id(runId) + '/lineage'),
  caseConclusions: (caseId: string) => request<{ items: TaxConclusion[] }>('GET', '/cases' + id(caseId) + '/conclusions').then(r => r.items),
  proposeConclusion: (caseId: string, body: ConclusionInput) => request<TaxConclusion>('POST', '/cases' + id(caseId) + '/conclusions', body),
  reviseConclusion: (conclusionId: string, body: Partial<ConclusionInput>) => request<TaxConclusion>('POST', '/conclusions' + id(conclusionId) + '/revise', body),
  submitConclusion: (conclusionId: string) => request<TaxConclusion>('POST', '/conclusions' + id(conclusionId) + '/submit'),
  reviewConclusion: (conclusionId: string, decision: 'approve' | 'return' | 'reject', note: string) =>
    request<TaxConclusion>('POST', '/conclusions' + id(conclusionId) + '/' + decision, { note }),
  traceConclusion: (conclusionId: string) => request<ConclusionTrace>('GET', '/conclusions' + id(conclusionId) + '/trace'),
  conclusionReadiness: (caseId: string) => request<ConclusionReadiness>('GET', '/cases' + id(caseId) + '/conclusions/readiness'),
  /** Deterministic form mapping: the server derives every value from approved, current conclusions; the browser sends only the rule. */
  formRules: (taxYear?: number) => request<{ items: FormRule[] }>('GET', '/form-rules' + (taxYear ? '?taxYear=' + taxYear : '')).then(r => r.items),
  caseFormMappings: (caseId: string) => request<{ items: FormMapping[] }>('GET', '/cases' + id(caseId) + '/form-mappings').then(r => r.items),
  mapForm: (caseId: string, ruleId: string) => request<FormMapping>('POST', '/cases' + id(caseId) + '/form-mappings', { ruleId }),
  formMapping: (mappingId: string) => request<FormMapping>('GET', '/form-mappings' + id(mappingId)),
  returnTemplates: (taxYear?: number) => request<{ items: ReturnTemplate[] }>('GET', '/return-templates' + (taxYear ? '?taxYear=' + taxYear : '')).then(r => r.items),
  caseReturns: (caseId: string) => request<{ items: ReturnVersion[] }>('GET', '/cases' + id(caseId) + '/returns').then(r => r.items),
  prepareReturn: (caseId: string, templateRuleId: string) => request<ReturnVersion>('POST', '/cases' + id(caseId) + '/returns', { templateRuleId }),
  returnVersion: (returnVersionId: string) => request<ReturnVersion>('GET', '/returns' + id(returnVersionId)),
  transitionReturn: (returnVersionId: string, action: 'submit' | 'approve' | 'return', note?: string) =>
    request<ReturnVersion>('POST', '/returns' + id(returnVersionId) + '/' + action, note === undefined ? {} : { note }),
  verifyReturn: (returnVersionId: string) => request<ReturnVerification>('POST', '/returns' + id(returnVersionId) + '/verify', {}),
  returnVerifications: (returnVersionId: string) => request<{ items: ReturnVerification[] }>('GET', '/returns' + id(returnVersionId) + '/verifications').then(r => r.items),
  /** Risk of a return version: the server reads every signal; a person states only the amount at stake. Never better than human review. */
  assessReturnRisk: (returnVersionId: string, amountCents: number) => request<ReturnRiskAssessment>('POST', '/returns' + id(returnVersionId) + '/risk', { amountCents }),
  returnRisk: (returnVersionId: string) => request<{ items: ReturnRiskAssessment[]; returnUse: 'BLOCKED' }>('GET', '/returns' + id(returnVersionId) + '/risk').then(r => r.items),
  /** Independent quality control (proposal 20261019170000): a manager assigns a third person, who records PASS/FAIL per item of the practice's checklist. */
  assignQc: (returnVersionId: string, qcUid: string) => request<QcAssignment>('POST', '/returns' + id(returnVersionId) + '/qc-assignment', { qcUid }),
  revokeQc: (returnVersionId: string, reason: string) => request<QcAssignment>('POST', '/returns' + id(returnVersionId) + '/qc-assignment/revoke', { reason }),
  qcQueue: () => request<{ items: QcQueueItem[]; returnUse: 'BLOCKED' }>('GET', '/qc/queue').then(r => r.items),
  qcContext: (returnVersionId: string) => request<QcContext>('GET', '/returns' + id(returnVersionId) + '/qc-context'),
  recordQc: (returnVersionId: string, results: QcResultInput[], note?: string) =>
    request<QcReview>('POST', '/returns' + id(returnVersionId) + '/qc', note === undefined ? { results } : { results, note }),
  qcReviews: (returnVersionId: string) => request<{ items: QcReview[]; returnUse: 'BLOCKED' }>('GET', '/returns' + id(returnVersionId) + '/qc-reviews').then(r => r.items),
  /** Final draft readiness: only an input to Stage 10 final authorization; nothing is signed or filed. */
  returnReadiness: (returnVersionId: string) => request<ReturnReadiness>('GET', '/returns' + id(returnVersionId) + '/readiness'),
  /** Stage 10 final authorization: a manager assigns an independent professional, who alone decides in a recent multi-factor
   *  session under the practice's approved attestation. Nothing is signed or filed. */
  assignFinalAuthorizer: (returnVersionId: string, authorizerUid: string) =>
    request<FinalAssignment>('POST', '/returns' + id(returnVersionId) + '/final-assignment', { authorizerUid }),
  revokeFinalAuthorizer: (returnVersionId: string, reason: string) =>
    request<FinalAssignment>('POST', '/returns' + id(returnVersionId) + '/final-assignment/revoke', { reason }),
  finalQueue: () => request<{ items: FinalQueueItem[]; returnUse: 'BLOCKED' }>('GET', '/final/queue').then(r => r.items),
  finalContext: (returnVersionId: string) => request<FinalContext>('GET', '/returns' + id(returnVersionId) + '/final-context'),
  decideFinal: (returnVersionId: string, decision: FinalDecisionInput) =>
    request<FinalDecision>('POST', '/returns' + id(returnVersionId) + '/final-authorization', decision),
  finalAuthorizations: (returnVersionId: string) =>
    request<{ items: FinalDecision[]; returnUse: 'BLOCKED' }>('GET', '/returns' + id(returnVersionId) + '/final-authorizations').then(r => r.items),
  /** Tax research memos for one case. The server enforces scope, authority levels and maker-checker; research never feeds a return. */
  caseResearch: (caseId: string) => request<{ items: ResearchMemo[]; returnUse: 'BLOCKED' }>('GET', '/cases' + id(caseId) + '/research').then(r => r.items),
  openResearch: (caseId: string, question: string) => request<ResearchMemo>('POST', '/cases' + id(caseId) + '/research', { question }),
  citeResearch: (memoId: string, citation: NewResearchCitation) => request<ResearchMemo>('POST', '/research' + id(memoId) + '/citations', citation),
  submitResearch: (memoId: string, conclusion: string, version: number) => request<ResearchMemo>('POST', '/research' + id(memoId) + '/submit', { conclusion, version }),
  reviewResearch: (memoId: string, decision: 'approve' | 'reject', note: string, version: number) =>
    request<ResearchMemo>('POST', '/research' + id(memoId) + '/' + decision, { note, version }),
  /** Readiness diagnostics for one case. The server runs the governed checks and decides who may acknowledge a finding. */
  caseDiagnostics: (caseId: string) => request<CaseDiagnostics>('GET', '/cases' + id(caseId) + '/diagnostics'),
  runDiagnostics: (caseId: string) => request<CaseDiagnostics>('POST', '/cases' + id(caseId) + '/diagnostics/run', {}),
  acknowledgeDiagnostic: (diagnosticId: string, note: string) => request<CaseDiagnostics>('POST', '/diagnostics' + id(diagnosticId) + '/acknowledge', { note }),
  /** Risk assessments for one case. A person states the amount at stake; thresholds come only from an approved practice policy. */
  caseRisk: (caseId: string) => request<{ items: RiskAssessment[]; returnUse: 'BLOCKED' }>('GET', '/cases' + id(caseId) + '/risk').then(r => r.items),
  assessRisk: (caseId: string, amountCents: number, unsupportedPosition: boolean) =>
    request<RiskAssessment>('POST', '/cases' + id(caseId) + '/risk', { amountCents, unsupportedPosition }),
};
export type DiagnosticSeverity = 'BLOCKING' | 'ERROR' | 'WARNING' | 'INFO';
export interface CaseDiagnostic { diagnostic_id: string; rule_code: string; rule_version: number; severity: DiagnosticSeverity; status: 'OPEN' | 'ACKNOWLEDGED';
  message: string; affected_type: string; affected_id: string; detected_at: string; acknowledged_by: string | null; acknowledged_at: string | null; acknowledgement_note: string | null }
export interface CaseDiagnostics { caseId: string; blocking: number; errors: number; ready: boolean; diagnosedAt: string | null; diagnostics: CaseDiagnostic[]; returnUse: 'BLOCKED' }
export type RiskOutcome = 'BLOCKED' | 'HUMAN_REVIEW_REQUIRED' | 'CONTINUE';
export interface RiskAssessment { assessment_id: string; case_id: string; tax_year: number; policy_version: number | null; amount_cents: number; unsupported_position: boolean;
  ai_confidence: number | null; materiality: 'IMMATERIAL' | 'MATERIAL' | 'UNKNOWN'; risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN'; outcome: RiskOutcome;
  reason_codes: string[]; assessed_by: string; assessed_at: string }
export const RISK_OUTCOME_LABELS: Record<RiskOutcome, string> = { BLOCKED: 'Blocked', HUMAN_REVIEW_REQUIRED: 'Human review required', CONTINUE: 'May continue under policy' };
export const RISK_REASON_LABELS: Record<string, string> = {
  DIAGNOSTICS_NOT_RUN: 'Readiness diagnostics have not been run.',
  DIAGNOSTIC_BLOCKING: 'A blocking readiness finding is open.',
  DIAGNOSTIC_ERRORS: 'Readiness errors are open.',
  NO_APPROVED_MATERIALITY_POLICY: 'The practice has no approved materiality policy, so a person reviews.',
  AMOUNT_MATERIAL: 'The amount is material under the practice policy.',
  AI_CONFIDENCE_BELOW_POLICY: 'AI confidence is below the practice minimum.',
  POLICY_REQUIRES_HUMAN_REVIEW: 'The practice policy requires human review.',
  UNSUPPORTED_POSITION: 'A position lacks support.',
};
export interface ReturnRiskAssessment { assessmentId: string; returnVersionId: string; caseId: string; taxYear: number; versionStatus: string; formsSha256: string;
  policyVersion: number | null; amountCents: number; materiality: 'IMMATERIAL' | 'MATERIAL' | 'UNKNOWN'; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  outcome: Exclude<RiskOutcome, 'CONTINUE'>; reasonCodes: string[]; assessedBy: string; assessedAt: string }
/** Reasons a return version's risk assessment can give (proposal 20261019160000); the materiality ones are shared with the case assessment. */
export const RETURN_RISK_REASON_LABELS: Record<string, string> = {
  RETURN_HUMAN_REVIEW_REQUIRED: 'Every return has human review (practice decision).',
  RETURN_VERSION_STALE: 'The version no longer matches its sources and must be prepared again.',
  RETURN_NOT_VERIFIED: 'The calculations have not been verified since submission.',
  RETURN_VERIFICATION_DISCREPANCY: 'The latest calculation verification found a discrepancy.',
  DIAGNOSTICS_NOT_CURRENT: 'Readiness diagnostics have not been run since this version was prepared.',
  DIAGNOSTIC_BLOCKING: 'A blocking readiness finding is open.',
  DIAGNOSTIC_ERRORS: 'Readiness errors are open.',
  DIAGNOSTIC_WARNINGS_OPEN: 'Readiness warnings are open and not acknowledged.',
  RESEARCH_UNRESOLVED: 'A research memo is still a draft or awaiting review.',
  RESEARCH_POSITION_UNSUPPORTED: 'An open research memo has no authoritative citation.',
  RESEARCH_AI_INFERENCE_ONLY: 'A research memo is supported only by AI inference.',
  NO_APPROVED_MATERIALITY_POLICY: 'The practice has no approved materiality policy, so materiality is unknown.',
  AMOUNT_MATERIAL: 'The amount is material under the practice policy.',
};
export function returnRiskText(r: Pick<ReturnRiskAssessment, 'outcome' | 'reasonCodes'>): string {
  return `${RISK_OUTCOME_LABELS[r.outcome].toLowerCase()}: ` + r.reasonCodes.map(c => (RETURN_RISK_REASON_LABELS[c] ?? c).replace(/\.$/, '')).join('; ');
}
export interface QcAssignment { assignmentId: string; returnVersionId: string; qcUid: string; assignedBy?: string; assignedAt?: string; revokedAt?: string }
export interface QcQueueItem { assignmentId: string; returnVersionId: string; caseId: string; taxYear: number; templateId: string; version: number; status: string;
  assignedAt: string; latestOutcome: QcOutcome | null }
export type QcOutcome = 'QC_PASSED' | 'QC_RETURNED';
export interface QcChecklistItem { code: string; text: string }
export interface QcContext { returnVersion: ReturnVersion; assignment: { assignmentId: string; qcUid: string; assignedBy: string; assignedAt: string } | null;
  checklist: { checklistVersion: number; items: QcChecklistItem[] } | null; verification: { verificationId: string; result: 'VERIFIED' | 'DISCREPANCY'; verifiedAt: string } | null;
  risk: ReturnRiskAssessment | null; returnUse: 'BLOCKED' }
export interface QcResultInput { code: string; result: 'PASS' | 'FAIL'; note?: string }
export interface QcReview { qcReviewId: string; checklistVersion: number; results: Array<QcResultInput & { text: string }>; outcome: QcOutcome; note: string | null;
  reviewedBy: string; reviewedAt: string }
export interface ReturnReadiness { returnVersionId: string; ready: boolean; reasons: string[]; riskAssessmentId: string | null; qcReviewId: string | null;
  finalAuthorization?: FinalStatus; stage10: 'FINAL_AUTHORIZATION_REQUIRED' | 'AUTHORIZED'; stage11?: 'NOT_STARTED' | 'CLIENT_SIGNATURE_REQUIRED';
  returnUse: 'BLOCKED' }
export type FinalOutcome = 'AUTHORIZED' | 'DECLINED';
export interface FinalDecision { authorizationId: string; outcome: FinalOutcome; note: string | null; attestationVersion: number; decidedBy: string; decidedAt: string;
  stage10?: ReturnReadiness['stage10']; stage11?: ReturnReadiness['stage11'] }
export interface FinalStatus { decision: FinalDecision | null; current: boolean; reasons: string[] }
export interface FinalAssignment { assignmentId: string; returnVersionId: string; authorizerUid: string; assignedBy?: string; assignedAt?: string; revokedAt?: string }
export interface FinalQueueItem { assignmentId: string; returnVersionId: string; caseId: string; taxYear: number; templateId: string; version: number; status: string;
  assignedAt: string; latestOutcome: FinalOutcome | null }
export interface FinalContext { returnVersion: ReturnVersion; readiness: ReturnReadiness;
  assignment: { assignmentId: string; authorizerUid: string; assignedBy: string; assignedAt: string } | null;
  attestation: { attestationVersion: number; text: string } | null; returnUse: 'BLOCKED' }
/** The decision a person makes. acknowledged must be true, and attestationVersion the text they were shown. */
export interface FinalDecisionInput { outcome: FinalOutcome; attestationVersion: number; acknowledged: true; note?: string }
export const FINAL_STATUS_REASON_LABELS: Record<string, string> = {
  NOT_READY: 'the version is no longer ready',
  FORMS_CHANGED: 'the forms changed',
  VERIFICATION_CHANGED: 'a newer calculation verification exists',
  DIAGNOSTICS_RERUN: 'diagnostics were run again',
  RISK_REASSESSED: 'risk was assessed again',
  QC_REVIEWED_AGAIN: 'quality control was recorded again',
  ATTESTATION_CHANGED: 'the practice approved a new attestation text',
};
/** Where Stage 10 stands for a version, in words. An authorization is never a signature or a filing. */
export function finalAuthorizationText(r: Pick<ReturnReadiness, 'stage10' | 'finalAuthorization'>): string {
  if (r.stage10 === 'AUTHORIZED') return 'final authorization given; the client signature (Stage 11) is next, and nothing is signed or filed';
  const st = r.finalAuthorization;
  if (!st?.decision) return 'final authorization required';
  if (st.current && st.decision.outcome === 'DECLINED') return 'final authorization declined: ' + (st.decision.note ?? 'no note');
  return 'final authorization required again: ' + st.reasons.map(c => FINAL_STATUS_REASON_LABELS[c] ?? c).join('; ');
}
export const READINESS_REASON_LABELS: Record<string, string> = {
  NOT_APPROVED: 'the draft review has not approved this version',
  STALE: 'the version no longer matches its sources',
  NOT_VERIFIED: 'the latest calculation verification is not VERIFIED',
  DIAGNOSTICS_NOT_CURRENT: 'diagnostics have not been run since approval',
  DIAGNOSTICS_OPEN: 'blocking or error diagnostics are open',
  RISK_NOT_CURRENT: 'no risk assessment since the latest approval and diagnostics run',
  RISK_BLOCKED: 'the current risk assessment is blocked',
  QC_NOT_RECORDED: 'no quality control review is recorded',
  QC_RETURNED: 'quality control returned the version',
  QC_NOT_CURRENT: 'the quality control review predates the current risk assessment, diagnostics or checklist',
};
export function readinessText(r: Pick<ReturnReadiness, 'ready' | 'reasons'>): string {
  return r.ready ? 'ready for Stage 10 final authorization by an authorized professional (nothing is signed or filed)'
    : 'not ready: ' + r.reasons.map(c => READINESS_REASON_LABELS[c] ?? c).join('; ');
}
/** Whole dollars and cents as entered by a person, to integer cents; anything else is null. */
export function dollarsToCents(text: string): number | null {
  const m = /^\s*(\d{1,13})(?:\.(\d{1,2}))?\s*$/.exec(text);
  return m ? Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0')) : null;
}
export const AUTHORITY_LEVELS = ['AUTHORITATIVE', 'SECONDARY', 'INTERNAL_GUIDANCE', 'AI_INFERENCE'] as const;
export type AuthorityLevel = typeof AUTHORITY_LEVELS[number];
/** How each authority level is shown. AI inference is never presented as tax authority. */
export const AUTHORITY_LABELS: Record<AuthorityLevel, string> = { AUTHORITATIVE: 'Authoritative (verified source)', SECONDARY: 'Secondary authority',
  INTERNAL_GUIDANCE: 'Internal guidance', AI_INFERENCE: 'AI inference — not tax authority' };
export interface ResearchCitation { citation_no: number; authority_level: AuthorityLevel; source_id: string | null; reference: string | null; note: string; added_by: string; added_at: string }
export interface ResearchMemo { memo_id: string; case_id: string; client_id: string; tax_year: number; question: string; conclusion: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'; prepared_by: string; reviewed_by: string | null; reviewed_at: string | null; review_note: string | null;
  version: number; created_at: string; citations: ResearchCitation[]; returnUse: 'BLOCKED' }
export interface NewResearchCitation { authorityLevel: AuthorityLevel; sourceId?: string; reference?: string; note: string }
export interface NewRuleTest { name: string; sourceId: string; citation: string; filingStatus?: string;
  inputs: Array<{ factPath: string; value: string; evidenceIds: string[] }>; expected: Record<string, string> }
/** Parses "path = value" lines (one per line). Returns null when any line is malformed or a key repeats. */
export function parseAssignments(text: string): Array<[string, string]> | null {
  const out: Array<[string, string]> = [];
  for (const raw of text.split('\n').map(l => l.trim()).filter(Boolean)) {
    const m = /^([A-Za-z0-9_.]{1,120})\s*=\s*(-?\d{1,15}(?:\.\d{1,4})?)$/.exec(raw);
    if (!m || out.some(([k]) => k === m[1])) return null;
    out.push([m[1], m[2]]);
  }
  return out.length ? out : null;
}
export interface RuleSetTests {
  testsSha256: string;
  tests: Array<{ testId: string; name: string; filingStatus: string | null; expected: Record<string, string>; sourceId: string; citation: string; createdBy: string }>;
  latestRun: { runId: string; testCount: number; passedCount: number; allPassed: boolean; engineVersion: string; runBy: string; runAt: string; testsSha256: string;
    results: Array<{ testId: string; passed: boolean; error?: string; mismatches?: Array<{ output: string; expected: string; actual: string | null }> }> } | null;
}
export interface CalculationRun { run_id: string; rule_set_id: string; tax_year: number; status: 'COMPUTED' | 'REVIEW_APPROVED' | 'REVIEW_REJECTED'; synthetic: boolean;
  engine_version: string; outputs: Record<string, string>; requested_by: string; created_at: string; reviewed_by: string | null; reviewed_at: string | null;
  review_note: string | null; returnUse: 'BLOCKED' }
export const isSha256 = (v: string) => /^[a-f0-9]{64}$/.test(v.trim());
/** What a cited evidence id resolved to (proposal 20261018190000): a decided extracted value, a reviewed document, or why not. */
export type EvidenceResolution = { unresolved: string } | { kind: 'DOCUMENT'; documentId: string; documentVersion: number; documentSha256: string }
  | { kind: 'EXTRACTION'; fieldId: string; fieldKey: string; decision: 'ACCEPTED' | 'CORRECTED'; decidedValue: string; decidedBy: string | null;
    documentId: string; documentVersion: number; documentSha256: string };
export interface RunLineage { runId: string; status: CalculationRun['status']; recorded: boolean; complete: boolean; returnUse: 'BLOCKED';
  citations: Array<{ factPath: string; value: string | null; ref: string; resolution: EvidenceResolution; recordedBy?: string; recordedAt?: string }> }
/** A governed tax determination for a case (proposal 20261019100000); never model output, never used for a return yet. */
export const CONCLUSION_TYPES = ['INCOME_INCLUSION', 'DEDUCTION', 'DEPRECIATION', 'CREDIT_ELIGIBILITY', 'FILING_STATUS', 'ENTITY_CLASSIFICATION', 'BASIS',
  'CAPITAL_GAIN_LOSS', 'CARRYFORWARD', 'STATE_ALLOCATION', 'BOOK_TO_TAX_ADJUSTMENT', 'OTHER'] as const;
export type ConclusionLinkType = 'EVIDENCE' | 'CALCULATION' | 'RESEARCH' | 'WORKPAPER';
export interface ConclusionInput { type: string; statement: string; amount?: string | null; links: Array<{ type: ConclusionLinkType; ref: string }> }
export interface TaxConclusion { conclusionId: string; lineageId: string; version: number; supersedesId: string | null; caseId: string; taxYear: number; type: string;
  statement: string; amount: string | null; status: 'DRAFT' | 'READY_FOR_REVIEW' | 'APPROVED' | 'RETURNED' | 'REJECTED' | 'SUPERSEDED'; preparedBy: string;
  reviewedBy: string | null; reviewedAt: string | null; reviewNote: string | null; createdAt: string;
  stale: Array<{ type: ConclusionLinkType; ref: string; reason: string }>; links: Array<{ type: ConclusionLinkType; ref: string; snapshot: Record<string, unknown> }>; returnUse: 'BLOCKED' }
export interface ConclusionTrace { conclusion: TaxConclusion; returnUse: 'BLOCKED';
  sources: Array<{ type: ConclusionLinkType; ref: string; snapshot: Record<string, any>; current: Record<string, any>; detail: Record<string, any> | null }>;
  versions: Array<{ conclusionId: string; version: number; status: string; reviewedBy: string | null; reviewedAt: string | null; createdAt: string }>;
  formLines: Array<{ formId: string; formVersion: string; line: string }>; audit: Array<{ action: string; actorUid: string; actorRole: string | null; at: string; version: number | null }> }
export interface ConclusionReadiness { caseId: string; ready: boolean; conclusions: number; blockers: Array<{ conclusionId: string; version: number; status: string; reasons: string[] }> }
/** The status a reviewer reads first: stale beats any review state, because a stale conclusion cannot be relied on. */
export function conclusionBadge(k: Pick<TaxConclusion, 'status' | 'stale'>): 'STALE' | 'APPROVED' | 'REVIEW REQUIRED' | 'BLOCKED' | 'DRAFT' | 'SUPERSEDED' {
  if (k.status === 'SUPERSEDED') return 'SUPERSEDED';
  if (k.stale.length > 0) return 'STALE';
  if (k.status === 'APPROVED') return 'APPROVED';
  if (k.status === 'READY_FOR_REVIEW') return 'REVIEW REQUIRED';
  if (k.status === 'REJECTED' || k.status === 'RETURNED') return 'BLOCKED';
  return 'DRAFT';
}
export const STALE_REASON_LABELS: Record<string, string> = {
  SOURCE_CHANGED: 'the source changed after it was linked', CALCULATION_REJECTED: 'the calculation run was rejected',
  CALCULATION_EVIDENCE_STALE: 'the calculation\'s own evidence no longer resolves', RESEARCH_REJECTED: 'the research was rejected',
  WORKPAPER_REJECTED: 'the workpaper was rejected', WORKPAPER_SUPERSEDED: 'a newer workpaper replaced it',
};
export const staleReason = (reason: string) => STALE_REASON_LABELS[reason] ?? EVIDENCE_REASON_LABELS[reason] ?? reason;
/** Parses "type|ref|reason" from TAX_CONCLUSION_SOURCE_UNRESOLVED. */
export function unresolvedSource(detail?: string): { type: string; ref: string; reason: string } | null {
  const p = (detail ?? '').split('|'); return p.length === 3 ? { type: p[0], ref: p[1], reason: p[2] } : null;
}
export const EVIDENCE_REASON_LABELS: Record<string, string> = {
  NOT_FOUND: 'no such evidence for this client', OUT_OF_SCOPE: 'belongs to another engagement or tax year', NOT_DECIDED: 'the extracted value is not decided yet',
  VALUE_REJECTED: 'the extracted value was rejected', DOCUMENT_SUPERSEDED: 'a newer version of the document replaced it',
  DOCUMENT_NOT_REVIEWED: 'the document is not reviewed', VALUE_MISMATCH: 'the decided value differs from the input',
  UNRECOGNISED_REFERENCE: 'cite extraction:<field id> or document:<document id>',
};
/** The server's detail for TAX_CALC_EVIDENCE_UNRESOLVED: comma-separated factPath|ref|reason. */
export function unresolvedCitations(detail?: string): Array<{ factPath: string; ref: string; reason: string }> {
  return (detail ?? '').split(',').map(s => s.split('|')).filter(p => p.length === 3).map(([factPath, ref, reason]) => ({ factPath, ref, reason }));
}
export function evidenceText(r: EvidenceResolution): string {
  if ('unresolved' in r) return 'Unresolved: ' + (EVIDENCE_REASON_LABELS[r.unresolved] ?? r.unresolved);
  const doc = `document ${r.documentId} v${r.documentVersion} (sha256 ${r.documentSha256.slice(0, 12)}…)`;
  return r.kind === 'DOCUMENT' ? 'Reviewed ' + doc : `${r.fieldKey} = ${r.decidedValue}, ${r.decision.toLowerCase()}${r.decidedBy ? ' by ' + r.decidedBy : ''}, from ${doc}`;
}

export interface FormRule { ruleId: string; jurisdiction: string; jurisdictionCode: string; effectiveFrom: string; effectiveTo: string | null; returnFamily: string; taxYear: number; formId: string; formVersion: string;
  version: number; contentSha256: string; sourceId: string; status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED'; lines: number }
export interface FormValueSource { conclusionId: string; conclusionVersion: number; conclusionType: string; value: string; runId: string; ruleSetId: string;
  ruleSetVersion: number; ruleSetSha256: string; evidence: Array<{ ref: string; snapshot: Record<string, unknown> }> }
export interface FormValue { schedule: string; line: string; field: string; valueType: 'MONEY' | 'INTEGER'; value: string; sources: FormValueSource[] }
export interface FormMappingProblem { reason: string; schedule?: string; line?: string; field?: string; conclusionId?: string; candidates?: number }
export interface FormMapping { mappingId: string; caseId: string; taxYear: number; formId: string; formVersion: string; version: number; status: 'CURRENT' | 'SUPERSEDED';
  ruleId: string; ruleVersion: number; ruleSha256: string; valuesSha256: string; missing: Array<{ schedule: string; line: string; field: string }>; mappedBy: string;
  createdAt: string; stale: FormMappingProblem[]; values?: FormValue[]; replayed?: boolean; returnUse: 'BLOCKED' }
export interface ReturnTemplate { templateRuleId: string; templateId: string; jurisdiction: string; jurisdictionCode: string; effectiveFrom: string;
  effectiveTo: string | null; returnFamily: string; taxYear: number; version: number; contentSha256: string; sourceId: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED'; forms: number }
export interface ReturnForm { formId: string; formVersion: string; mappingId: string; mappingVersion: number; valuesSha256: string }
export interface ReturnProblem { reason: string; formId?: string; formVersion?: string; mappingId?: string; blocking?: number }
export interface ReturnVerificationFinding { reason: string; runId?: string; formId?: string; line?: string; field?: string }
export interface ReturnVerification { verificationId: string; returnVersionId?: string; result: 'VERIFIED' | 'DISCREPANCY'; findings: ReturnVerificationFinding[];
  runs: Array<{ runId: string; ruleSetId: string; recordedOutputSha256: string; recomputedOutputSha256: string }>; engineVersion: string; verifiedBy: string; verifiedAt: string }
export const VERIFICATION_FINDING_LABELS: Record<string, string> = {
  RECALCULATION_MISMATCH: 'recalculating the run gives a different result',
  ENGINE_VERSION_CHANGED: 'the calculation engine version differs from the one the run used',
  RULE_SET_NOT_CURRENT: 'the run\'s rule set is no longer the approved version',
  RULE_SET_INTEGRITY: 'the run\'s rule set content does not match the hash it was pinned to',
  VALUE_SOURCE_MISMATCH: 'the value differs from the sum of the sources it cites',
};
export function verificationText(v: Pick<ReturnVerification, 'result' | 'findings' | 'runs'>): string {
  if (v.result === 'VERIFIED') return `verified: ${v.runs.length} calculation run${v.runs.length === 1 ? '' : 's'} recalculated with identical results`;
  return 'discrepancy: ' + v.findings.map(f => (f.runId ? `run ${f.runId.slice(0, 8)}` : `${f.formId ?? ''} line ${f.line ?? ''}`.trim()) + ': '
    + (VERIFICATION_FINDING_LABELS[f.reason] ?? f.reason)).join('; ');
}
export interface ReturnVersion { returnVersionId: string; caseId: string; taxYear: number; templateId: string; version: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED' | 'SUPERSEDED'; templateRuleId: string; templateVersion: number; templateSha256: string;
  forms: ReturnForm[]; formsSha256: string; missing: Array<{ formId: string; formVersion: string }>; preparedBy: string; createdAt: string;
  submittedAt: string | null; reviewedBy: string | null; reviewedAt: string | null; reviewNote: string | null; stale: ReturnProblem[];
  lineage?: FormMapping[]; replayed?: boolean; returnUse: 'BLOCKED' }
export const RETURN_PROBLEM_LABELS: Record<string, string> = {
  RETURN_FORM_MISSING: 'no current form mapping',
  RETURN_MAPPING_STALE: 'the form mapping is stale; map the form again',
  RETURN_MAPPING_RULE_NOT_APPROVED: 'the form mapping uses a rule that is no longer approved',
  RETURN_BLOCKING_DIAGNOSTICS: 'the case has blocking diagnostics',
  RETURN_MAPPING_CHANGED: 'the form was mapped again since this version',
  RETURN_FORM_WITHDRAWN: 'the form mapping is no longer current',
  RETURN_FORM_ADDED: 'an optional form now has a mapping',
  RETURN_TEMPLATE_SUPERSEDED: 'a newer return template was approved',
};
/** Why an approval authority check failed (proposal 20261019115000); nothing here grants or infers authority. */
export const AUTHORITY_REASON_LABELS: Record<string, string> = {
  NO_POLICY: 'No approval policy has been approved for this function yet.',
  NOT_CASE_REVIEWER: 'You are not the case\'s assigned reviewer.',
  NO_DESIGNATION: 'You have not been designated for this approval function.',
  DESIGNATION_UNDER_OLD_POLICY: 'Your designation was made under an earlier policy version.',
  NO_ELIGIBILITY: 'No verified professional eligibility is recorded for you.',
  ELIGIBILITY_REVOKED: 'Your recorded professional eligibility has been revoked.',
  ELIGIBILITY_NOT_YET_VALID: 'Your recorded professional eligibility is not valid yet.',
  ELIGIBILITY_EXPIRED: 'Your recorded professional eligibility has expired.',
  CREDENTIAL_NOT_ACCEPTED: 'Your credential type is not accepted for this function.',
  OUTSIDE_ELIGIBILITY_SCOPE: 'Your recorded eligibility does not cover this jurisdiction.',
};
export function returnProblemText(p: ReturnProblem): string {
  const where = p.formId ? `${p.formId} ${p.formVersion ?? ''}`.trim() + ': ' : '';
  const label = RETURN_PROBLEM_LABELS[p.reason] ?? (p.reason.startsWith('RETURN_TEMPLATE_') ? 'the return template is ' + p.reason.slice(16).toLowerCase() : p.reason);
  return where + label + (p.reason === 'RETURN_BLOCKING_DIAGNOSTICS' && p.blocking ? ` (${p.blocking})` : '');
}
export function returnProblems(detail?: string): ReturnProblem[] {
  try { const parsed = JSON.parse(detail ?? ''); return Array.isArray(parsed) ? parsed.filter(p => p && typeof p.reason === 'string') : []; } catch { return []; }
}
export const FORM_PROBLEM_LABELS: Record<string, string> = {
  SOURCE_MISSING: 'no approved conclusion of the required type',
  AMBIGUOUS_SOURCE: 'more than one approved conclusion could fill this line',
  SOURCE_STALE: 'the conclusion is stale',
  CALCULATION_SOURCE_REQUIRED: 'the conclusion has no single calculation run',
  CALCULATION_NOT_APPROVED: 'the conclusion\'s calculation run is not approved',
  VALUE_MISSING: 'the conclusion has no amount or the run has no such output',
  VALUE_TYPE: 'the value is not of the line\'s type',
  SOURCE_CHANGED: 'a source conclusion or its calculation changed',
  SOURCE_WITHDRAWN: 'the source conclusion is no longer approved',
  SOURCE_ADDED: 'a newly approved conclusion would fill this line',
  MAPPING_RULE_SUPERSEDED: 'a newer mapping rule was approved for this form',
};
export function formProblemText(p: FormMappingProblem): string {
  const where = p.line ? `${p.schedule && p.schedule !== 'MAIN' ? p.schedule + ' ' : ''}line ${p.line}${p.field ? ` (${p.field})` : ''}: ` : '';
  return where + (FORM_PROBLEM_LABELS[p.reason] ?? (p.reason.startsWith('MAPPING_RULE_') ? 'the mapping rule is ' + p.reason.slice(13).toLowerCase() : p.reason));
}
export function formProblems(detail?: string): FormMappingProblem[] {
  try { const parsed = JSON.parse(detail ?? ''); return Array.isArray(parsed) ? parsed.filter(p => p && typeof p.reason === 'string') : []; } catch { return []; }
}

export function taxEngineMessage(error: unknown): string {
  if (!(error instanceof TaxEngineRequestError)) return 'The tax rules service did not confirm this action. Refresh and try again.';
  const known: Record<string, string> = {
    TAX_CONTENT_REVIEWER_REQUIRED: 'Only a reviewer can verify sources or decide on rule sets.',
    MAKER_CHECKER_VIOLATION: 'Not allowed: a different person must check work they did not prepare.',
    TAX_SOURCE_EXISTS: 'A source with this identifier is already registered.',
    TAX_SOURCE_INPUT_INVALID: 'Check the source fields: identifier, citation, an https link and one to ten tax years; a document hash is 64 lowercase hex characters.',
    TAX_SOURCE_NOT_PROPOSED: 'This source is no longer awaiting verification.',
    TAX_RULE_SET_INPUT_INVALID: 'Enter a note of at least 10 characters for a rejection.',
    TAX_RULE_SET_NOT_FOUND: 'This rule set no longer exists or is not visible to you.',
    TAX_RULE_SET_NOT_DRAFT: 'Only a draft rule set can be submitted.',
    TAX_RULE_SET_NOT_PENDING: 'Only a rule set awaiting review can be approved or rejected.',
    TAX_RULE_SET_TESTS_REQUIRED: 'Approval needs source-cited verification tests on this rule set first.',
    TAX_RULE_SET_TESTS_NOT_RUN: 'Approval needs a recorded test run of the current tests.',
    TAX_RULE_SET_TESTS_FAILING: 'Approval refused: the latest test run has failures.',
    TAX_RULE_SET_COVERAGE_INCOMPLETE: 'Approval refused: the tests do not cover every output and filing status.',
    TAX_CONTENT_ROLE_REQUIRED: 'Your role cannot prepare tax content.',
    TAX_SOURCE_NOT_FOUND: 'This source no longer exists or is not visible to you.',
    TAX_RULE_SET_INTEGRITY: 'Refused: the stored rule set does not match its recorded content hash.',
    TAX_ENGINE_DEFINITION_INVALID: 'The rule set definition is not valid. Check its structure, steps, outputs and cited sources.',
    TAX_RULE_SET_DUPLICATE: 'An identical rule set is already recorded.',
    TAX_RULE_TEST_INPUT_INVALID: 'Check the test: a name, a cited source, inputs and expected outputs as "path = amount" lines.',
    TAX_RULE_TEST_IMMUTABLE: 'Tests can only change while the rule set is a draft.',
    TAX_RULE_TEST_NOT_FOUND: 'This test no longer exists.',
    TAX_CONCLUSION_PREPARER_REQUIRED: 'Only the case\'s preparer can propose, revise or submit a conclusion.',
    TAX_CONCLUSION_REVIEWER_REQUIRED: 'Only the case\'s independent reviewer can decide on a conclusion.',
    TAX_CONCLUSION_EVIDENCE_REQUIRED: 'A conclusion needs at least one verified evidence citation (extraction:<id> or document:<id>).',
    TAX_CONCLUSION_INPUT_INVALID: 'Check the conclusion: a type, a statement of 10 to 4,000 characters, an amount in dollars and cents if any, and a note of at least 10 characters to return or reject.',
    TAX_CONCLUSION_NOT_DRAFT: 'Only a draft conclusion can be submitted.', TAX_CONCLUSION_NOT_SUBMITTED: 'Only a conclusion awaiting review can be decided.',
    TAX_CONCLUSION_NOT_REVISABLE: 'This version cannot be revised (it is awaiting review, or a newer version exists).',
    TAX_CONCLUSION_NOT_FOUND: 'This conclusion is not available to you. Access follows your live assignment to the case.',
    TAX_FORM_MAPPING_PREPARER_REQUIRED: 'Only the case\'s preparer can map the case to a form.',
    TAX_FORM_MAPPING_NOT_FOUND: 'This form mapping is not available to you. Access follows your live assignment to the case.',
    TAX_FORM_MAPPING_EMPTY: 'Refused: the mapping rule produced no value for this case.',
    TAX_FORM_RULE_NOT_FOUND: 'This mapping rule no longer exists or is not visible to you.',
    TAX_FORM_RULE_NOT_APPROVED: 'Only an approved mapping rule can be used. A newer approval may have superseded this one.',
    TAX_FORM_RULE_SCOPE_MISMATCH: 'This mapping rule is for another tax year or return family than the case.',
    TAX_FORM_RULE_NOT_EFFECTIVE: 'This mapping rule is not in effect today (outside its effective dates). Nothing was written.',
    TAX_RETURN_PREPARER_REQUIRED: 'Only the case\'s preparer can prepare or submit the draft return.',
    TAX_RETURN_REVIEWER_REQUIRED: 'Only the case\'s independent reviewer can approve or return the draft return.',
    TAX_RETURN_NOT_FOUND: 'This draft return is not available to you. Access follows your live assignment to the case.',
    TAX_RETURN_TEMPLATE_NOT_FOUND: 'This return template no longer exists or is not visible to you.',
    TAX_RETURN_TEMPLATE_NOT_APPROVED: 'Only an approved return template can be used. A newer approval may have superseded this one.',
    TAX_RETURN_TEMPLATE_NOT_EFFECTIVE: 'This return template is not in effect today (outside its effective dates). Nothing was written.',
    TAX_RETURN_SCOPE_MISMATCH: 'This return template is for another tax year or return family than the case.',
    TAX_RETURN_NOT_DRAFT: 'Only a draft version can be submitted.',
    TAX_RETURN_VERIFIER_REQUIRED: 'Only the case\'s independent reviewer can verify the calculations of a draft return.',
    TAX_RETURN_SUPERSEDED: 'This version has been superseded; assess the current version.',
    TAX_RETURN_QC_ASSIGNER_REQUIRED: 'Only a practice manager can assign or revoke the quality control reviewer.',
    TAX_RETURN_QC_REVIEWER_REQUIRED: 'Only the assigned quality control reviewer can record quality control.',
    TAX_RETURN_QC_NOT_INDEPENDENT: 'The quality control reviewer must be a third person: not the preparer, the reviewer or the assigning manager.',
    TAX_RETURN_QC_ASSIGNEE_INVALID: 'That person is not an active staff member of this practice.',
    TAX_RETURN_QC_ALREADY_ASSIGNED: 'A quality control reviewer is already assigned to this version. Revoke that assignment first.',
    TAX_RETURN_QC_NOT_ASSIGNED: 'No quality control reviewer is assigned to this version.',
    TAX_RETURN_QC_CHECKLIST_REQUIRED: 'The practice has no approved quality control checklist, so quality control cannot be recorded.',
    TAX_RETURN_QC_INPUT_INVALID: 'Give PASS or FAIL for every checklist item; returning a version needs a note of at least 10 characters.',
    TAX_RETURN_NOT_APPROVED: 'Only an approved draft return version goes to quality control.',
    TAX_RETURN_FINAL_ASSIGNER_REQUIRED: 'Only a practice manager can assign or revoke the final authorizer.',
    TAX_RETURN_FINAL_AUTHORIZER_REQUIRED: 'Only the assigned final authorizer can authorize or decline this version.',
    TAX_RETURN_FINAL_NOT_INDEPENDENT: 'The final authorizer must be independent: not the preparer, the reviewer, the quality control reviewer or a manager who assigned them.',
    TAX_RETURN_FINAL_ASSIGNEE_INVALID: 'That person is not an active staff member of this practice.',
    TAX_RETURN_FINAL_ALREADY_ASSIGNED: 'A final authorizer is already assigned to this version. Revoke that assignment first.',
    TAX_RETURN_FINAL_NOT_ASSIGNED: 'No final authorizer is assigned to this version.',
    TAX_RETURN_FINAL_SESSION_REQUIRED: 'Final authorization needs your own multi-factor session. Sign in again with your authenticator.',
    STAFF_RECENT_SIGN_IN_REQUIRED: 'Sign in again: this action needs a recent sign-in.',
    STAFF_FRESH_SIGN_IN_REQUIRED: 'Sign in again: your sign-in predates a change to your membership.',
    TAX_RETURN_ATTESTATION_REQUIRED: 'The practice has no approved attestation text, so final authorization cannot be given.',
    TAX_RETURN_ATTESTATION_CHANGED: 'The attestation text changed while you were reviewing it. Read the new text before deciding.',
    TAX_RETURN_FINAL_ALREADY_DECIDED: 'A decision is already recorded on these inputs. A new decision needs a changed input, such as a new quality control review.',
    TAX_RETURN_FINAL_INPUT_INVALID: 'Confirm the acknowledgement; declining needs a note of at least 10 characters.',
    TAX_RETURN_NOT_SUBMITTED: 'Only a submitted version can be approved or returned.',
    TAX_RETURN_INPUT_INVALID: 'Enter a note of at least 10 characters to return the draft.',
    TAX_CALC_REVIEWER_REQUIRED: 'Only the case\'s independent reviewer can decide on a calculation run.',
    TAX_CALC_ALREADY_REVIEWED: 'This calculation run has already been reviewed.',
    TAX_CALC_INPUT_INVALID: 'Enter a review note of at least 10 characters.',
    TAX_CALC_CASE_NOT_FOUND: 'This case is not available to you.',
    TAX_CALC_RUN_NOT_FOUND: 'This calculation run no longer exists or is not visible to you.',
    TAX_ENGINE_ACCESS_DENIED: 'Your role cannot use the tax rules service.',
    RESEARCH_MEMO_NOT_FOUND: 'This research memo is not available to you. Access follows your live assignment to the case.',
    RESEARCH_INPUT_INVALID: 'Check the entry: a question or conclusion of at least 10 characters, a note of at least 5, and support that matches the authority level (a verified source for authoritative, a reference for secondary or internal guidance, nothing for AI inference).',
    RESEARCH_SOURCE_NOT_VERIFIED: 'Authoritative support must be a verified source that covers this tax year.',
    RESEARCH_AUTHORITY_REQUIRED: 'Approval refused: the memo needs at least one authoritative citation to a verified source. AI inference and secondary support are not enough.',
    RESEARCH_REVIEWER_REQUIRED: 'Only the case\'s independent reviewer can decide on research.',
    RESEARCH_MEMO_NOT_EDITABLE: 'Only the preparer can change a draft memo.',
    RESEARCH_MEMO_NOT_SUBMITTED: 'Only a submitted memo can be approved or rejected.',
    RESEARCH_VERSION_CONFLICT: 'This memo changed since it was loaded. Refresh and try again.',
    DIAGNOSTIC_NOT_FOUND: 'This finding is not available to you. Access follows your live assignment to the case.',
    DIAGNOSTIC_REVIEWER_REQUIRED: 'Only the case\'s reviewer or a practice manager can acknowledge a finding.',
    DIAGNOSTIC_NOT_WAIVABLE: 'Blocking and error findings cannot be acknowledged; fix the underlying record and run the diagnostics again.',
    DIAGNOSTIC_NOT_OPEN: 'This finding is no longer open. Refresh to see its current state.',
    DIAGNOSTIC_INPUT_INVALID: 'Enter an acknowledgement note of 10 to 1000 characters.',
    RISK_INPUT_INVALID: 'Enter the amount at stake in dollars and cents (zero or more).',
    CASE_NOT_FOUND: 'This case is not available to you.',
    TAX_ENGINE_UNAVAILABLE: 'The tax rules service is not enabled in this environment.',
    TAX_ENGINE_STORE_UNAVAILABLE: 'The tax rules service is not enabled in this environment.',
  };
  if (error.code === 'TAX_SOURCE_NOT_VERIFIED') return `Submit refused: source ${error.detail ?? ''} is not verified yet.`.replace('  ', ' ');
  if (error.code === 'TAX_CONCLUSION_SOURCE_UNRESOLVED') {
    const u = unresolvedSource(error.detail);
    return 'Refused: a cited source does not resolve for this case' + (u ? ` (${u.type.toLowerCase()} ${u.ref}: ${staleReason(u.reason)}).` : '.');
  }
  if (error.code === 'TAX_FORM_MAPPING_REFUSED') {
    const problems = formProblems(error.detail);
    return 'Mapping refused: nothing was written. ' + (problems.map(formProblemText).join('; ') || 'A line cannot be filled deterministically.') + '.';
  }
  if (error.code === 'TAX_FORM_RULE_APPROVER_REQUIRED') return 'Approval refused: approving a form-mapping rule needs verified professional eligibility and a designation under the practice\'s approved policy. '
    + (AUTHORITY_REASON_LABELS[error.detail ?? ''] ?? 'Your approval authority is not configured.');
  if (error.code === 'TAX_RETURN_TEMPLATE_APPROVER_REQUIRED') return 'Approval refused: approving a return template needs verified professional eligibility and a designation under the practice\'s approved policy. '
    + (AUTHORITY_REASON_LABELS[error.detail ?? ''] ?? 'Your approval authority is not configured.');
  if (error.code === 'TAX_RETURN_VERIFICATION_REQUIRED') return error.detail === 'DISCREPANCY'
    ? 'Approval refused: the latest calculation verification of this version found a discrepancy. Return it to the preparer.'
    : 'Approval refused: verify the calculations of this version first.';
  if (error.code === 'TAX_RETURN_QC_AUTHORITY_REQUIRED') return 'Quality control refused: it needs the QC authority under the practice\'s approved policy. '
    + (AUTHORITY_REASON_LABELS[error.detail ?? ''] ?? 'Your quality control authority is not configured.');
  if (error.code === 'TAX_RETURN_FINAL_AUTHORITY_REQUIRED') return 'Final authorization refused: it needs the final authorization authority under the practice\'s approved policy. '
    + (AUTHORITY_REASON_LABELS[error.detail ?? ''] ?? 'Your final authorization authority is not configured.');
  if (error.code === 'TAX_RETURN_NOT_READY') {
    let reasons: string[] = [];
    try { const parsed = JSON.parse(error.detail ?? '[]'); if (Array.isArray(parsed)) reasons = parsed.filter((x): x is string => typeof x === 'string'); } catch { /* unreadable detail */ }
    return 'Final authorization refused: the version is ' + (reasons.length ? readinessText({ ready: false, reasons }) : 'not ready') + '.';
  }
  if (error.code === 'TAX_RETURN_REVIEW_AUTHORITY_REQUIRED') return 'Approval refused: the Stage 09 draft review needs the case reviewer assignment under the practice\'s approved review policy. '
    + (AUTHORITY_REASON_LABELS[error.detail ?? ''] ?? 'Your review authority is not configured.');
  if (error.code === 'TAX_RETURN_PREPARATION_REFUSED') {
    const problems = returnProblems(error.detail);
    return 'Preparation refused: nothing was written. ' + (problems.map(returnProblemText).join('; ') || 'A required form cannot be assembled.') + '.';
  }
  if (error.code === 'TAX_RETURN_STALE') {
    const problems = returnProblems(error.detail);
    return 'Refused: this version is stale. ' + (problems.map(returnProblemText).join('; ') || 'Its inputs changed.') + '. Prepare the return again.';
  }
  if (error.code === 'TAX_CONCLUSION_STALE') return 'Refused: a source changed after it was linked. Revise the conclusion on the current, reviewed sources.';
  if (error.code === 'TAX_CONCLUSION_SOURCES_NOT_APPROVED') return 'Approval refused: every linked calculation run, research memo and workpaper must be approved first (' + (error.detail ?? '').replace(/,/g, ', ') + ').';
  if (error.code === 'TAX_CALC_EVIDENCE_UNRESOLVED') return 'Refused: every input must cite a reviewed document or a decided extracted value of this case. '
    + (unresolvedCitations(error.detail).map(u => `${u.factPath} (${u.ref}): ${EVIDENCE_REASON_LABELS[u.reason] ?? u.reason}`).join('; ') || 'No input cites evidence.');
  return (error.code && known[error.code]) || (error.status === 403 ? 'Your role is not authorized for this action.' : 'The tax rules service did not confirm this action.');
}
