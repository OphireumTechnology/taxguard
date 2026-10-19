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
};
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
    TAX_ENGINE_ACCESS_DENIED: 'Your role cannot use the tax rules service.',
    TAX_ENGINE_UNAVAILABLE: 'The tax rules service is not enabled in this environment.',
    TAX_ENGINE_STORE_UNAVAILABLE: 'The tax rules service is not enabled in this environment.',
  };
  if (error.code === 'TAX_SOURCE_NOT_VERIFIED') return `Submit refused: source ${error.detail ?? ''} is not verified yet.`.replace('  ', ' ');
  return (error.code && known[error.code]) || (error.status === 403 ? 'Your role is not authorized for this action.' : 'The tax rules service did not confirm this action.');
}
