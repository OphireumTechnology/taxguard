/** Browser client for /api/practice (client and engagement management). */
import { getStoredToken } from './api';
import { apiEndpoint } from '../config/apiEndpoint';

export class PracticeRequestError extends Error {
  constructor(public readonly status: number, public readonly code?: string) { super(code || 'PRACTICE_REQUEST_FAILED'); }
}
export interface PracticeClientRow { clientId: string; name: string | null; email: string | null; clientType: string; status: string; engagements: number;
  team: Array<{ role: string; userId: string; engagementId: string | null; taxYear: number | null }>; openTasks: number; nextDeadline: string | null }
export interface PracticeEngagement { engagementId: string; title: string; type: string; status: string; description: string | null; version: number; createdAt: string;
  taxYears: Array<{ taxYear: number; status: string }> }
export interface PracticeTask { taskId: string; title: string; status: string; priority: string; assignedUserId: string | null; dueDate: string | null; dependencies: string[];
  engagementId: string | null; version: number }
export interface PracticeClientDetail {
  client: { clientId: string; name: string | null; email: string | null; phone: string | null; clientType: string; status: string; statusReason: string | null };
  engagements: PracticeEngagement[];
  team: Array<{ assignmentId: string; role: string; userId: string; engagementId: string; taxYear: number; assignedBy: string; effectiveFrom: string }>;
  assignmentHistory: Array<{ role: string; previousUserId: string | null; newUserId: string; changedBy: string; reason: string; at: string }>;
  tasks: PracticeTask[];
  deadlines: Array<{ deadlineId: string; title: string; category: string; dueDate: string; authorityType: string; status: string; taxYear: number | null; caseId: string | null;
    provenance?: { sourceCitation?: string | null } }>;
  notes: Array<{ noteId: string; body: string; authorUid: string; authorRole: string; createdAt: string; engagementId: string | null }>;
  activity: Array<{ action: string; actorUid: string; actorRole: string | null; at: string }>;
}
export const ENGAGEMENT_TRANSITIONS: Record<string, string[]> = { draft: ['active', 'cancelled'], active: ['on_hold', 'completed', 'cancelled'], on_hold: ['active', 'cancelled'] };
export const newPracticeKey = () => 'pm-' + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2));

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const token = getStoredToken();
  if (!token) throw new PracticeRequestError(401, 'AUTH_REQUIRED');
  const response = await fetch(apiEndpoint('/api/practice' + path), { method, cache: 'no-store', credentials: 'omit',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => null);
  if (getStoredToken() !== token) throw new PracticeRequestError(409, 'SESSION_CHANGED');
  if (!response.ok) throw new PracticeRequestError(response.status, typeof data?.code === 'string' ? data.code : undefined);
  return data as T;
}
const c = (clientId: string) => '/clients/' + encodeURIComponent(clientId);
export interface MyWork { actorRole: string;
  cases: Array<{ caseId: string; clientId: string; clientName: string | null; taxYear: number; activeStage: number; status: string; myRole: 'preparer' | 'reviewer'; evidence: string; awaitingMe: boolean; updatedAt: string }>;
  documentsToReview: Array<{ documentId: string; version: number; clientId: string; fileName: string; taxYear: number; uploadedAt: string }>;
  requestsOutstanding: Array<{ requestId: string; clientId: string; title: string; taxYear: number; status: string; required: boolean; dueDate: string | null; overdue: boolean }>;
  entriesAwaitingMyReview: Array<{ entryId: string; clientId: string; entryNumber: string; description: string; postingDate: string }>;
  entriesReturnedToMe: Array<{ entryId: string; clientId: string; entryNumber: string; description: string }>;
  bookToTaxAwaitingReview: number; definitions: Record<string, string> }
export interface PracticeSummary { taxYear: number | null; asOf: string; casesByStage: Array<{ stage: number; active: number; onHold: number }>;
  deadlines: { dueThisWeek: number; overdue: number }; tasks: { open: number; overdue: number; waitingOnClient: number; readyForReview: number };
  documentRequests: { open: number; submitted: number; overdue: number; requiredOutstanding: number }; documentsAwaitingReview: number; documentsAwaitingScan: number;
  receivables: { openInvoices: number; balanceDue: string; pastDue: number; awaitingApproval: number }; staffCaseCounts: Array<{ userId: string; asPreparer: number; asReviewer: number }>;
  definitions: Record<string, string> }
export const practiceService = {
  myWork: () => request<MyWork>('GET', '/my-work'),
  summary: (taxYear?: number) => request<PracticeSummary>('GET', '/summary' + (taxYear ? `?taxYear=${taxYear}` : '')),
  listClients: (filter: { q?: string; status?: string; cursor?: string } = {}) => {
    const q = new URLSearchParams(Object.entries(filter).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== ''));
    return request<{ items: PracticeClientRow[]; nextCursor: string | null }>('GET', '/clients' + (q.toString() ? '?' + q : ''));
  },
  clientDetail: (clientId: string) => request<PracticeClientDetail>('GET', c(clientId)),
  setClientStatus: (clientId: string, status: 'active' | 'archived', reason: string) => request('POST', c(clientId) + '/status', { status, reason }),
  createEngagement: (clientId: string, input: { title: string; type: string; taxYears: number[]; description?: string }, key: string) => request<{ engagementId: string }>('POST', c(clientId) + '/engagements', input, key),
  setEngagementStatus: (clientId: string, engagementId: string, status: string, version: number, reason?: string) =>
    request('POST', c(clientId) + '/engagements/' + encodeURIComponent(engagementId) + '/status', { status, version, reason }),
  assign: (clientId: string, engagementId: string, input: { taxYear: number; role: string; userId: string; reason: string }, key: string) =>
    request('POST', c(clientId) + '/engagements/' + encodeURIComponent(engagementId) + '/team', input, key),
  addNote: (clientId: string, body: string, engagementId?: string) => request('POST', c(clientId) + '/notes', { body, engagementId }),
  createTask: (clientId: string, task: { title: string; assignedUserId?: string; dueDate?: string; engagementId?: string; priority?: string }, key: string) =>
    request('POST', c(clientId) + '/tasks', task, key),
  setTaskStatus: (clientId: string, taskId: string, status: string, version: number) => request('POST', c(clientId) + '/tasks/' + encodeURIComponent(taskId) + '/status', { status, version }),
  addTaxYear: (clientId: string, engagementId: string, taxYear: number) =>
    request('POST', c(clientId) + '/engagements/' + encodeURIComponent(engagementId) + '/tax-years', { taxYear }),
  /** Statutory deadlines must cite their source; TaxGuard never invents a statutory date. */
  addDeadline: (clientId: string, deadline: { title: string; category: string; dueDate: string; authorityType: string; sourceCitation?: string; taxYear?: number }, key: string) =>
    request('POST', c(clientId) + '/deadlines', deadline, key),
  resolveDeadline: (clientId: string, deadlineId: string, status: 'MET' | 'WAIVED', reason?: string) =>
    request('POST', c(clientId) + '/deadlines/' + encodeURIComponent(deadlineId) + '/resolve', { status, ...(reason ? { reason } : {}) }),
};
export const DEADLINE_CATEGORIES = ['client_request', 'internal_prep', 'review', 'signature', 'filing', 'estimated_payment', 'extension', 'notice_response',
  'bookkeeping_close', 'renewal'] as const;
export const DEADLINE_AUTHORITIES = ['INTERNAL', 'CLIENT_COMMITMENT', 'PROVIDER', 'ESTIMATED', 'MANUAL', 'STATUTORY'] as const;
const MESSAGES: Record<string, string> = {
  PRACTICE_MANAGER_REQUIRED: 'Only a practice manager or administrator can make this change.',
  PRACTICE_VERSION_CONFLICT: 'This record changed since it was loaded. Refresh and try again.',
  ENGAGEMENT_HAS_OPEN_TASKS: 'Complete or cancel the engagement\'s open tasks first.',
  CLIENT_HAS_OPEN_ENGAGEMENTS: 'Close the client\'s draft, active or on-hold engagements before archiving.',
  ASSIGNEE_ROLE_INCOMPATIBLE: 'That staff member\'s role cannot hold this assignment.',
  ASSIGNMENT_SEGREGATION_OF_DUTIES: 'The same person cannot be both preparer and reviewer for an engagement year.',
  TASK_DEPENDENCIES_OPEN: 'This task depends on tasks that are not complete.',
  STATUS_REASON_REQUIRED: 'Enter a reason of 5 to 500 characters.', ASSIGNMENT_REASON_REQUIRED: 'Enter a reason of 5 to 500 characters.',
  CLIENT_NOT_ACTIVE: 'This client is archived. Reactivate it before adding work.',
  PRACTICE_STORE_UNAVAILABLE: 'Client and engagement management is not enabled in this environment.',
  CLIENT_NOT_FOUND: 'That client was not found or is not assigned to you.',
  TAX_YEAR_EXISTS: 'That tax year is already part of the engagement.',
  ENGAGEMENT_CLOSED: 'This engagement is closed; tax years can no longer be added.',
  ENGAGEMENT_NOT_FOUND: 'That engagement was not found or is not assigned to you.',
  CASE_NOT_FOUND: 'That case was not found or is not assigned to you.',
  PRACTICE_INPUT_INVALID: 'Check the entries. A statutory deadline needs its source citation; years run from 2000 to 2100.',
  DEADLINE_ALREADY_RESOLVED: 'This deadline was already met or waived.',
  DEADLINE_NOT_FOUND: 'That deadline was not found or is not assigned to you.',
  DEADLINE_WAIVER_NOT_AUTHORIZED: 'Only a practice manager can waive a deadline, and statutory deadlines cannot be waived.',
};
export function practiceMessage(error: unknown): string {
  if (error instanceof PracticeRequestError && error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error instanceof PracticeRequestError && error.status === 403) return 'Your role is not authorized for this action.';
  return 'The practice service did not confirm this action. Refresh and try again.';
}
