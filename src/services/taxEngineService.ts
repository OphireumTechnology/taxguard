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
