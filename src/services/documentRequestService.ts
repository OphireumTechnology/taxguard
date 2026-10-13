/** Browser client for document requests, checklists and client notifications under /api/vault. */
import { getStoredToken } from './api';
import { apiEndpoint } from '../config/apiEndpoint';
import { VaultRequestError, newVaultKey } from './vaultService';

export interface DocumentRequestItem { requestId: string; clientId: string; engagementId: string; taxYear: number; title: string; instructions: string | null; category: string;
  acceptedTypes: string[]; minDocuments: number; required: boolean; dueDate: string | null; overdue: boolean; status: string; rowVersion: number;
  documents: Array<{ documentId: string; version: number; fileName: string; status: string }>; createdBy?: string; resolutionReason?: string | null; clientName?: string }
export interface ClientNotification { notificationId: string; kind: string; requestId: string | null; title: string; channel: string; deliveryStatus: string; createdAt: string; readAt: string | null }
export interface ChecklistTemplate { templateId: string; name: string; items: Array<{ title: string; category: string; required?: boolean }>; status: string; version: number }

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, key?: string): Promise<T> {
  const token = getStoredToken();
  if (!token) throw new VaultRequestError(401, 'AUTH_REQUIRED');
  const response = await fetch(apiEndpoint('/api/vault' + path), { method, cache: 'no-store', credentials: 'omit',
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(key ? { 'Idempotency-Key': key } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => null);
  if (getStoredToken() !== token) throw new VaultRequestError(409, 'SESSION_CHANGED');
  if (!response.ok) throw new VaultRequestError(response.status, typeof data?.code === 'string' ? data.code : undefined);
  return data as T;
}
const c = (clientId: string) => '/clients/' + encodeURIComponent(clientId);
const r = (requestId: string) => '/requests/' + encodeURIComponent(requestId);

export const documentRequestService = {
  list: (clientId: string, taxYear?: number) => request<{ items: DocumentRequestItem[] }>('GET', c(clientId) + '/requests' + (taxYear ? `?taxYear=${taxYear}` : '')),
  create: (clientId: string, input: { engagementId: string; taxYear: number; title: string; category: string; required: boolean; dueDate?: string; instructions?: string }, key = newVaultKey()) =>
    request<DocumentRequestItem & { created: boolean }>('POST', c(clientId) + '/requests', input, key),
  applyTemplate: (clientId: string, templateId: string, engagementId: string, taxYear: number, dueDate?: string) =>
    request<{ created: number }>('POST', c(clientId) + '/requests/apply-template', { templateId, engagementId, taxYear, dueDate: dueDate || undefined }),
  link: (clientId: string, requestId: string, documentId: string, version: number) => request<DocumentRequestItem>('POST', c(clientId) + r(requestId) + '/link', { documentId, version }),
  resolve: (clientId: string, requestId: string, action: 'waive' | 'cancel', reason: string, rowVersion: number) =>
    request<DocumentRequestItem>('POST', c(clientId) + r(requestId) + '/' + action, { reason, rowVersion }),
  remind: (clientId: string, requestId: string) => request<{ remindedAt: string }>('POST', c(clientId) + r(requestId) + '/remind'),
  missing: (taxYear?: number, overdueOnly = false) => request<{ items: DocumentRequestItem[]; summary: Array<{ clientId: string; engagementId: string; taxYear: number; open: number; submitted: number; overdue: number; requiredOutstanding: number }> }>(
    'GET', '/requests/missing?' + new URLSearchParams({ ...(taxYear ? { taxYear: String(taxYear) } : {}), ...(overdueOnly ? { overdueOnly: 'true' } : {}) })),
  templates: () => request<{ items: ChecklistTemplate[] }>('GET', '/request-templates'),
  saveTemplate: (template: { templateId: string; name: string; items: ChecklistTemplate['items'] }) => request<ChecklistTemplate>('POST', '/request-templates', template),
  notifications: (clientId: string) => request<{ unread: number; items: ClientNotification[] }>('GET', c(clientId) + '/notifications'),
  markRead: (clientId: string, notificationId: string) => request<{ read: boolean }>('POST', c(clientId) + '/notifications/' + encodeURIComponent(notificationId) + '/read'),
};

const STATUS_TEXT: Record<string, string> = { OPEN: 'Needed', SUBMITTED: 'Received — awaiting review', FULFILLED: 'Complete', WAIVED: 'No longer needed', CANCELLED: 'Withdrawn' };
export const requestStatusText = (status: string) => STATUS_TEXT[status] ?? status.toLowerCase();
const MESSAGES: Record<string, string> = {
  DOC_REQUEST_REQUIREMENT_NOT_MET: 'This file does not meet the request (category or file type). Upload the requested document type.',
  DOC_REQUEST_SCOPE_MISMATCH: 'This file belongs to a different engagement or tax year.', DOC_REQUEST_CLOSED: 'This request is already closed.',
  DOC_REQUEST_WAIVER_REQUIRES_REVIEWER: 'Only the reviewer or a manager can waive a required request.', DOC_REQUEST_MANAGER_REQUIRED: 'A practice manager must do this.',
  DOC_REQUEST_VERSION_CONFLICT: 'The request changed since it was loaded. Refresh and retry.', DOC_REQUEST_REMINDER_TOO_SOON: 'A reminder was already sent in the last 24 hours.',
  ENGAGEMENT_YEAR_NOT_OPEN: 'Select an open engagement and tax year.', DOC_REQUEST_INPUT_INVALID: 'Check the title, category, reason and dates, then retry.',
  DOC_REQUEST_TEMPLATE_NOT_FOUND: 'That checklist is not available.', DOC_REQUEST_STAFF_REQUIRED: 'This action is for practice staff.',
  DOCUMENT_VAULT_UNAVAILABLE: 'Secure document storage is not enabled in this environment.',
};
export function requestMessage(error: unknown): string {
  if (error instanceof VaultRequestError && error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error instanceof VaultRequestError && (error.status === 403 || error.status === 404)) return 'You are not authorized for this request.';
  return 'The request service did not confirm this action. Try again.';
}
