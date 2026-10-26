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
  /** Tax research memos for one case. The server enforces scope, authority levels and maker-checker; research never feeds a return. */
  caseResearch: (caseId: string) => request<{ items: ResearchMemo[]; returnUse: 'BLOCKED' }>('GET', '/cases' + id(caseId) + '/research').then(r => r.items),
  openResearch: (caseId: string, question: string) => request<ResearchMemo>('POST', '/cases' + id(caseId) + '/research', { question }),
  citeResearch: (memoId: string, citation: NewResearchCitation) => request<ResearchMemo>('POST', '/research' + id(memoId) + '/citations', citation),
  submitResearch: (memoId: string, conclusion: string, version: number) => request<ResearchMemo>('POST', '/research' + id(memoId) + '/submit', { conclusion, version }),
  reviewResearch: (memoId: string, decision: 'approve' | 'reject', note: string, version: number) =>
    request<ResearchMemo>('POST', '/research' + id(memoId) + '/' + decision, { note, version }),
};
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
    CASE_NOT_FOUND: 'This case is not available to you.',
    TAX_ENGINE_UNAVAILABLE: 'The tax rules service is not enabled in this environment.',
    TAX_ENGINE_STORE_UNAVAILABLE: 'The tax rules service is not enabled in this environment.',
  };
  if (error.code === 'TAX_SOURCE_NOT_VERIFIED') return `Submit refused: source ${error.detail ?? ''} is not verified yet.`.replace('  ', ' ');
  return (error.code && known[error.code]) || (error.status === 403 ? 'Your role is not authorized for this action.' : 'The tax rules service did not confirm this action.');
}
