import { apiRequest, ApiRequestError } from './api';

export class CommunicationRequestError extends ApiRequestError {}

export type MessageVisibility = 'client_visible' | 'internal_only' | string;
export type ThreadCategory = 'general' | 'documents' | 'tax_return' | 'billing' | 'advisory' | string;

export const THREAD_CATEGORIES: Array<[ThreadCategory, string]> = [
  ['GENERAL', 'General Inquiry'],
  ['DOCUMENTS', 'Documents & Verification'],
  ['TAX_RETURN', 'Tax Return Preparation'],
  ['BILLING', 'Billing & Invoices'],
  ['ADVISORY', 'Tax Strategy & Advisory'],
];

export interface CommMessage {
  id: string;
  threadId: string;
  senderId?: string;
  senderName?: string;
  senderRole?: string;
  body: string;
  visibility?: MessageVisibility;
  createdAt: string;
  [key: string]: any;
}

export interface CommThread {
  id: string;
  clientId?: string;
  subject: string;
  category?: ThreadCategory;
  status?: string;
  unreadCount?: number;
  messages?: CommMessage[];
  updatedAt?: string;
  [key: string]: any;
}

export function newCommKey(prefix = 'comm'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function communicationErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Secure messaging is temporarily unavailable.';
}

export const communicationsService: Record<string, (...args: any[]) => Promise<any>> = new Proxy(
  {
    threads: (clientId?: string, signal?: AbortSignal) =>
      apiRequest(`/api/communications/threads${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`, {
        signal,
      }),
    listThreads: (_params?: any) => apiRequest('/api/communications/threads'),
    getThread: (id: string) => apiRequest(`/api/communications/threads/${encodeURIComponent(id)}`),
    createThread: (payload: any) =>
      apiRequest('/api/communications/threads', { method: 'POST', body: JSON.stringify(payload) }),
    sendMessage: (threadId: string, payload: any) =>
      apiRequest(`/api/communications/threads/${encodeURIComponent(threadId)}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  } as Record<string, (...args: any[]) => Promise<any>>,
  {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return async (..._args: any[]) => apiRequest(`/api/communications/${prop}`);
    },
  }
);
