/** Browser client for /api/communications (durable client / staff messaging, proposal 039). */
import { getStoredToken } from './api';
import { apiEndpoint } from '../config/apiEndpoint';

export class CommunicationRequestError extends Error {
  constructor(public readonly status: number, public readonly code?: string) { super(code || 'COMM_REQUEST_FAILED'); }
}
export type ThreadCategory = 'GENERAL' | 'TAX_QUESTION' | 'DOCUMENT_QUERY' | 'INVOICING' | 'ADVISORY';
export type ThreadStatus = 'ACTIVE' | 'RESOLVED' | 'ARCHIVED';
export type MessageVisibility = 'CLIENT_VISIBLE' | 'INTERNAL_ONLY';
export interface CommThread { threadId: string; clientId: string; engagementId: string | null; subject: string; category: ThreadCategory; status: ThreadStatus;
  createdAt: string; lastMessageAt: string; messageCount: number; unread: number; awaitingStaffReply: boolean; createdBy?: string }
export interface CommMessage { messageId: string; threadId: string; senderRole: string; senderKind: 'client' | 'staff'; own: boolean; body: string;
  visibility: MessageVisibility; createdAt: string; senderUid?: string; replayed?: boolean }
export const THREAD_CATEGORIES: Array<[ThreadCategory, string]> = [['GENERAL', 'General'], ['TAX_QUESTION', 'Tax question'], ['DOCUMENT_QUERY', 'Document question'],
  ['INVOICING', 'Billing'], ['ADVISORY', 'Advisory']];
export const newCommKey = () => 'cm-' + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2));

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, idempotencyKey?: string, signal?: AbortSignal): Promise<T> {
  const token = getStoredToken();
  if (!token) throw new CommunicationRequestError(401, 'AUTH_REQUIRED');
  const response = await fetch(apiEndpoint('/api/communications' + path), { method, cache: 'no-store', credentials: 'omit', signal,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => null);
  if (getStoredToken() !== token) throw new CommunicationRequestError(409, 'SESSION_CHANGED');
  if (!response.ok) throw new CommunicationRequestError(response.status, typeof data?.code === 'string' ? data.code : undefined);
  return data as T;
}
const c = (clientId: string) => '/clients/' + encodeURIComponent(clientId);
const th = (clientId: string, threadId: string) => c(clientId) + '/threads/' + encodeURIComponent(threadId);

export const communicationsService = {
  threads: (clientId: string, signal?: AbortSignal) => request<CommThread[]>('GET', c(clientId) + '/threads', undefined, undefined, signal),
  thread: (clientId: string, threadId: string, signal?: AbortSignal) => request<{ thread: CommThread; messages: CommMessage[] }>('GET', th(clientId, threadId), undefined, undefined, signal),
  createThread: (clientId: string, input: { subject: string; body: string; category?: ThreadCategory; engagementId?: string; visibility?: MessageVisibility }, key: string) =>
    request<{ thread: CommThread; message: CommMessage }>('POST', c(clientId) + '/threads', input, key),
  post: (clientId: string, threadId: string, body: string, key: string, visibility?: MessageVisibility) =>
    request<CommMessage>('POST', th(clientId, threadId) + '/messages', { body, ...(visibility ? { visibility } : {}) }, key),
  markRead: (clientId: string, threadId: string) => request<{ threadId: string; unread: number }>('POST', th(clientId, threadId) + '/read'),
  setStatus: (clientId: string, threadId: string, status: ThreadStatus) => request<CommThread & { changed: boolean }>('POST', th(clientId, threadId) + '/status', { status }),
  inbox: (signal?: AbortSignal) => request<CommThread[]>('GET', '/inbox', undefined, undefined, signal),
};

/** Plain-language refusal for a communications error code. */
export function communicationErrorText(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'COMM_STORE_UNAVAILABLE': return 'Messaging is not available in this environment.';
    case 'COMM_THREAD_CLOSED': return 'This conversation is closed. Start a new conversation instead.';
    case 'COMM_THREAD_NOT_FOUND': case 'COMM_CLIENT_NOT_FOUND': return 'This conversation is not available to you.';
    case 'COMM_INTERNAL_STAFF_ONLY': case 'COMM_ACCESS_DENIED': case 'COMM_STAFF_REQUIRED': return 'You are not permitted to do this.';
    case 'COMM_MANAGER_REQUIRED': return 'Only a practice manager can archive a conversation.';
    case 'IDEMPOTENCY_KEY_REUSED': return 'This message conflicts with one already sent. Refresh and try again.';
    case 'SESSION_CHANGED': case 'AUTH_REQUIRED': return 'Your session changed. Sign in again.';
    default: return 'The server did not confirm this. Nothing was sent; try again.';
  }
}
