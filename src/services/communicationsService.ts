import { api } from './api';

export type ThreadCategory = 'general' | 'documents' | 'tax_return' | 'billing' | 'advisory' | string;
export type MessageVisibility = 'CLIENT_VISIBLE' | 'INTERNAL_STAFF' | string;

export interface CommThread {
  id: string;
  clientId?: string;
  subject: string;
  category: ThreadCategory;
  status: string;
  unreadCount?: number;
  lastMessageAt?: string;
  [key: string]: any;
}

export interface CommMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName?: string;
  senderRole?: string;
  content: string;
  visibility: MessageVisibility;
  createdAt: string;
  [key: string]: any;
}

export const THREAD_CATEGORIES: Array<[ThreadCategory, string]> = [
  ['general', 'General Inquiry'],
  ['documents', 'Document Collection'],
  ['tax_return', 'Tax Return Question'],
  ['billing', 'Billing & Invoices'],
  ['advisory', 'Tax Advisory'],
];

export class CommunicationRequestError extends Error {
  constructor(public readonly code: string, message?: string, public readonly status?: number) {
    super(message || code);
    this.name = 'CommunicationRequestError';
  }
}

export function newCommKey(): string {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function communicationErrorText(err: unknown, fallback = 'Messaging service unavailable.'): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const communicationsService: Record<string, (...args: any[]) => Promise<any>> = new Proxy(
  {
    listThreads: (query?: Record<string, any>, signal?: AbortSignal): Promise<any> =>
      api.request('/api/communications/threads', { query, signal }),
    threads: (clientId: string, signal?: AbortSignal): Promise<any> =>
      api.request('/api/communications/threads', { query: { clientId }, signal }),
    getMessages: (threadId: string, signal?: AbortSignal): Promise<any> =>
      api.request(`/api/communications/threads/${encodeURIComponent(threadId)}/messages`, { signal }),
    createThread: (payload: Record<string, any>): Promise<any> =>
      api.request('/api/communications/threads', { method: 'POST', body: JSON.stringify(payload) }),
    sendMessage: (threadId: string, payload: Record<string, any>): Promise<any> =>
      api.request(`/api/communications/threads/${encodeURIComponent(threadId)}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  } as Record<string, (...args: any[]) => Promise<any>>,
  {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return (...args: any[]): Promise<any> =>
        api.request(`/api/communications/${encodeURIComponent(prop)}`, {
          method: args.length > 1 ? 'POST' : 'GET',
          ...(args.length > 1 ? { body: JSON.stringify({ args }) } : {}),
        });
    },
  }
);
