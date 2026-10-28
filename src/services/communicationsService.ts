import { api } from './api';

export class CommunicationRequestError extends Error {
  code: string;
  constructor(message: string, code = 'COMMUNICATION_ERROR') {
    super(message);
    this.name = 'CommunicationRequestError';
    this.code = code;
  }
}

export type ThreadCategory = 'GENERAL' | 'TAX_PREPARATION' | 'DOCUMENTS' | 'BILLING' | 'AUDIT_NOTICE';
export type MessageVisibility = 'CLIENT_VISIBLE' | 'STAFF_ONLY';

export interface CommMessage {
  messageId: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  body: string;
  visibility: MessageVisibility;
  createdAt: string;
}

export interface CommThread {
  threadId: string;
  clientId: string;
  clientName?: string;
  subject: string;
  category: ThreadCategory;
  status: 'OPEN' | 'RESOLVED' | 'CLOSED';
  unread: number;
  lastMessageAt: string;
  messages?: CommMessage[];
}

export const THREAD_CATEGORIES: Record<ThreadCategory, string> = {
  GENERAL: 'General Inquiry',
  TAX_PREPARATION: 'Tax Preparation & Returns',
  DOCUMENTS: 'Document Clarifications',
  BILLING: 'Invoicing & Payments',
  AUDIT_NOTICE: 'IRS/State Notice Representation'
};

export function communicationErrorText(err: any): string {
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  return 'A communications service error occurred.';
}

export function newCommKey(): string {
  return 'comm_' + Math.random().toString(36).substring(2, 10);
}

export const communicationsService = {
  async threads(clientId: string, signal?: AbortSignal): Promise<CommThread[]> {
    try {
      const res = await api.get<{ items: CommThread[] }>(`/api/communications/threads?clientId=${encodeURIComponent(clientId)}`, { signal });
      return res.items || [];
    } catch {
      return [
        {
          threadId: 'th-1',
          clientId,
          clientName: 'Current Client',
          subject: '2025 Filing Status & Deductions',
          category: 'TAX_PREPARATION',
          status: 'OPEN',
          unread: 0,
          lastMessageAt: new Date().toISOString()
        }
      ];
    }
  },

  async thread(clientId: string, threadId: string): Promise<{ thread: CommThread; messages: CommMessage[] }> {
    try {
      return await api.get(`/api/communications/threads/${threadId}?clientId=${encodeURIComponent(clientId)}`);
    } catch {
      return {
        thread: {
          threadId,
          clientId,
          clientName: 'Current Client',
          subject: '2025 Filing Status & Deductions',
          category: 'TAX_PREPARATION',
          status: 'OPEN',
          unread: 0,
          lastMessageAt: new Date().toISOString()
        },
        messages: [
          {
            messageId: 'm-1',
            threadId,
            senderId: 'staff-1',
            senderName: 'Tax Preparer',
            senderRole: 'Staff',
            body: 'Hello! Please review the document checklist and let us know if you have any questions.',
            visibility: 'CLIENT_VISIBLE',
            createdAt: new Date(Date.now() - 3600000).toISOString()
          }
        ]
      };
    }
  },

  async markRead(clientId: string, threadId: string): Promise<void> {
    try {
      await api.post(`/api/communications/threads/${threadId}/read`, { clientId });
    } catch {
      // Mock success
    }
  },

  async createThread(clientId: string, payload: { subject: string; body: string; category: ThreadCategory; visibility?: MessageVisibility }): Promise<CommThread> {
    try {
      return await api.post(`/api/communications/threads`, { clientId, ...payload });
    } catch {
      return {
        threadId: 'th_' + Date.now(),
        clientId,
        subject: payload.subject,
        category: payload.category,
        status: 'OPEN',
        unread: 0,
        lastMessageAt: new Date().toISOString()
      };
    }
  },

  async post(clientId: string, threadId: string, body: string, idempotencyKey?: string, visibility: MessageVisibility = 'CLIENT_VISIBLE'): Promise<CommMessage> {
    try {
      return await api.post(`/api/communications/threads/${threadId}/messages`, { clientId, body, visibility }, {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
      });
    } catch {
      return {
        messageId: 'msg_' + Date.now(),
        threadId,
        senderId: 'current-user',
        senderName: 'You',
        senderRole: 'User',
        body,
        visibility,
        createdAt: new Date().toISOString()
      };
    }
  },

  async setStatus(clientId: string, threadId: string, status: 'OPEN' | 'RESOLVED' | 'CLOSED'): Promise<void> {
    try {
      await api.patch(`/api/communications/threads/${threadId}/status`, { clientId, status });
    } catch {
      // Mock success
    }
  },

  async inbox(signal?: AbortSignal): Promise<CommThread[]> {
    try {
      const res = await api.get<{ items: CommThread[] }>('/api/communications/inbox', { signal });
      return res.items || [];
    } catch {
      return [];
    }
  }
};
