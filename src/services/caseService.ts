/** Browser client for /api/cases (durable 18-stage case workflow). */
import { getStoredToken } from './api';
import { apiEndpoint } from '../config/apiEndpoint';

export class CaseRequestError extends Error {
  constructor(public readonly status: number, public readonly code?: string, public readonly failedChecks: string[] = []) { super(code || 'CASE_REQUEST_FAILED'); }
}
export interface CaseQueueItem { caseId: string; clientId: string; clientName: string | null; engagementId: string; taxYear: number; returnFamily: string | null; status: string;
  activeStage: number; preparerUid: string; reviewerUid: string; version: number; myRole: 'preparer' | 'reviewer' | 'manager'; awaitingReviewer: boolean;
  blockedDependency: string | null; nextDeadline: string | null; openTasks: number }
export interface CaseDetail {
  case: { caseId: string; clientId: string; engagementId: string; taxYear: number; returnFamily: string | null; status: string; holdReason: string | null; activeStage: number;
    preparerUid: string; reviewerUid: string; version: number };
  stagePolicy: { evidence: 'SYSTEM_VERIFIED' | 'HUMAN_ATTESTED' | 'BLOCKED'; checklist?: string[]; dependency?: string };
  pendingChecks: Record<string, boolean> | null;
  stages: Array<{ stage: number; status: string; approvedBy: string | null; approvedAt: string | null; evidenceType: string | null }>;
  events: Array<{ action: string; fromStage: number | null; toStage: number; evidenceType: string | null; reason: string | null; actorUid: string; actorRole: string; at: string }>;
  notes: Array<{ noteId: string; body: string; authorUid: string; createdAt: string }>;
}
async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const token = getStoredToken();
  if (!token) throw new CaseRequestError(401, 'AUTH_REQUIRED');
  const response = await fetch(apiEndpoint('/api/cases' + path), { method, cache: 'no-store', credentials: 'omit',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => null);
  if (getStoredToken() !== token) throw new CaseRequestError(409, 'SESSION_CHANGED');
  if (!response.ok) throw new CaseRequestError(response.status, typeof data?.code === 'string' ? data.code : undefined, Array.isArray(data?.failedChecks) ? data.failedChecks : []);
  return data as T;
}
const id = (caseId: string) => '/' + encodeURIComponent(caseId);
export const caseService = {
  queue: (filter: { role?: string } = {}) => request<{ items: CaseQueueItem[]; nextCursor: string | null }>('GET', filter.role ? '/?role=' + encodeURIComponent(filter.role) : '/'),
  detail: (caseId: string) => request<CaseDetail>('GET', id(caseId)),
  create: (input: { clientId: string; engagementId: string; taxYear: number; returnFamily: string }, key: string) => request<{ caseId: string }>('POST', '/', input, key),
  advance: (caseId: string, fromStage: number, version: number, attestation?: { confirmed: string[]; statement: string }) =>
    request<{ activeStage: number; version: number }>('POST', id(caseId) + '/advance', { fromStage, version, attestation }),
  returnTo: (caseId: string, toStage: number, version: number, reason: string) => request('POST', id(caseId) + '/return', { toStage, version, reason }),
  hold: (caseId: string, hold: boolean, version: number, reason: string) => request('POST', id(caseId) + '/hold', { hold, version, reason }),
  /** Managers and administrators: move the case's preparer or reviewer to a person who already holds that live assignment. */
  restaff: (caseId: string, role: 'preparer' | 'reviewer', userId: string, version: number, reason: string) =>
    request<{ role: string; previousUid: string; newUid: string; version: number }>('POST', id(caseId) + '/team', { role, userId, version, reason }),
};
/** People who may take over a case role: they already hold that live assignment for the case's engagement and year. */
export function restaffCandidates(team: ReadonlyArray<{ role: string; userId: string; engagementId: string | null; taxYear: number | null }>,
  target: { engagementId: string; taxYear: number; preparerUid: string; reviewerUid: string }, role: 'preparer' | 'reviewer'): string[] {
  const current = role === 'preparer' ? target.preparerUid : target.reviewerUid;
  return [...new Set(team.filter(t => t.role === role && (t.engagementId === null || t.engagementId === target.engagementId)
    && (t.taxYear === null || t.taxYear === target.taxYear) && t.userId !== current).map(t => t.userId))].sort();
}
export const STAGE_NAMES = ['Onboard', 'Collect', 'Validate', 'Record', 'Reconcile', 'Review', 'Report', 'Plan', 'Prepare Taxes', 'Approve', 'Sign', 'File',
  'Government Feedback', 'Resolve', 'Monitor', 'Archive', 'Renew', 'Repeat'];
export const stageLabel = (n: number) => `${String(n).padStart(2, '0')} ${STAGE_NAMES[n - 1] ?? ''}`;
const DEPENDENCIES: Record<string, string> = {
  VERIFIED_TAX_ENGINE_REQUIRED: 'Blocked: tax preparation requires a verified tax engine (owner decision H07).',
  E_SIGNATURE_INTEGRATION_REQUIRED: 'Blocked: signatures require a commissioned e-signature integration.',
  FILING_NOT_AUTHORIZED: 'Blocked: electronic filing is not authorized.', UPSTREAM_STAGES_BLOCKED: 'Blocked until earlier stages are available.',
};
export const dependencyLabel = (code?: string | null) => (code && DEPENDENCIES[code]) || 'Blocked by an external dependency.';
// Server-derived gate checks (taxguard_case_system_checks and taxguard_case_evidence_checks), in plain language.
// Attestation items are snake_case and read as written.
const CHECKS: Record<string, string> = {
  clientActive: 'the client is active', engagementActive: 'the engagement is active', taxYearActive: 'the tax year is active',
  preparerAssigned: 'a preparer is assigned', reviewerAssigned: 'a reviewer is assigned', independentReviewer: 'the reviewer is not the preparer',
  clientOnboardingCompleted: 'client onboarding is approved', postedEntries: 'journal entries are posted', ledgerBalanced: 'the ledger balances',
  noEntriesAwaitingReview: 'no journal entry is awaiting review', allBankTransactionsPosted: 'every bank transaction is posted',
  closedReconciliation: 'a reconciliation is closed', noReconciliationInProgress: 'no reconciliation is in progress',
  approvedWorkpaperRecorded: 'an approved book-to-tax workpaper is recorded', requiredDocumentRequestsResolved: 'required document requests are resolved',
  noDocumentsAwaitingScan: 'no document is awaiting its scan', noDocumentsAwaitingReview: 'no document is awaiting review',
  noOutstandingReplacementRequests: 'no requested replacement is outstanding', noUndecidedExtractionProposals: 'every proposed extracted value is accepted, corrected or rejected',
};
export const checkLabel = (check: string) => CHECKS[check] ?? check.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').toLowerCase();
export function caseMessage(error: unknown): string {
  if (!(error instanceof CaseRequestError)) return 'The case service did not confirm this action. Refresh and try again.';
  if (error.code === 'STAGE_GATE_NOT_MET') return 'Stage requirements are not met: ' + (error.failedChecks.map(checkLabel).join('; ') || 'see the case detail') + '.';
  if (error.code?.startsWith('STAGE_BLOCKED_')) return dependencyLabel(error.code.slice('STAGE_BLOCKED_'.length));
  const known: Record<string, string> = {
    STAGE_ATTESTATION_REQUIRES_REVIEWER: 'Only the case reviewer can attest this stage.', STAGE_RETURN_REQUIRES_REVIEWER: 'Only the reviewer or a manager can return a case.',
    CASE_VERSION_CONFLICT: 'The case changed since it was loaded. Refresh and try again.', CASE_NOT_ACTIVE: 'The case is on hold or closed.',
    STAGE_SEQUENCE_INVALID: 'Stages advance one at a time from the current stage.', CASE_TEAM_INCOMPLETE: 'Assign an independent preparer and reviewer first.',
    CASE_STORE_UNAVAILABLE: 'Case workflow is not enabled in this environment.', STATUS_REASON_REQUIRED: 'Enter a reason of 5 to 500 characters.',
    RETURN_REASON_REQUIRED: 'Enter a reason of at least 10 characters.',
    CASE_ASSIGNEE_NOT_ASSIGNED: 'That person no longer holds this role for the case\'s engagement and tax year. Refresh the team and try again.',
    ASSIGNMENT_SEGREGATION_OF_DUTIES: 'Not allowed: the reviewer must be independent of anyone who prepared this case.',
    PRACTICE_MANAGER_REQUIRED: 'Only a practice manager or administrator can change the case team.',
    CASE_INPUT_INVALID: 'Choose a different person and enter a reason of 10 to 500 characters.',
  };
  return (error.code && known[error.code]) || (error.status === 403 ? 'Your role is not authorized for this action.' : 'The case service did not confirm this action.');
}
