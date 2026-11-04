import { INITIAL_MESSAGES } from '../data/mockData';
import type { Message } from '../types';

export const THREAD_CATEGORIES = ['GENERAL', 'TAX_INQUIRY', 'DOCUMENT_REQUEST', 'BILLING'] as const;
export type ThreadCategory = typeof THREAD_CATEGORIES[number];
export type MessageVisibility = 'CLIENT_VISIBLE' | 'INTERNAL_ONLY';

export class CommunicationRequestError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'CommunicationRequestError';
    this.status = status;
  }
}

export function communicationErrorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Communication service error.';
}

export function newCommKey(): string {
  return 'comm_key_' + Math.random().toString(36).slice(2) + '_' + Date.now();
}

export interface CommThread {
  threadId: string;
  subject: string;
  category: ThreadCategory;
  updatedAt: string;
  unreadCount?: number;
  status?: 'ACTIVE' | 'ARCHIVED';
}

export interface CommMessage {
  messageId: string;
  senderName: string;
  senderRole: string;
  body: string;
  createdAt: string;
  visibility: MessageVisibility;
}

export const communicationsService = {
  getMessages: async (engagementId?: string): Promise<Message[]> => INITIAL_MESSAGES,
  sendMessage: async (msg: Partial<Message>): Promise<{ success: boolean; message: Message }> => {
    const newMsg: Message = {
      ...(INITIAL_MESSAGES[0] as any),
      ...msg,
      id: 'msg_' + Date.now(),
      timestamp: new Date().toISOString()
    };
    return { success: true, message: newMsg };
  },
  threads: async (clientId?: string): Promise<CommThread[]> => [
    { threadId: 'thr_1', subject: '2025 Tax Return Preparation Updates', category: 'GENERAL', updatedAt: new Date().toISOString(), unreadCount: 0 }
  ],
  thread: async (clientId: string, threadId: string): Promise<{ thread: CommThread; messages: CommMessage[] }> => ({
    thread: { threadId, subject: '2025 Tax Return Preparation Updates', category: 'GENERAL', updatedAt: new Date().toISOString() },
    messages: [
      { messageId: 'm1', senderName: 'Desmond Hinds', senderRole: 'accountant', body: 'Welcome to your secure client communications portal.', createdAt: new Date().toISOString(), visibility: 'CLIENT_VISIBLE' }
    ]
  }),
  createThread: async (...args: any[]) => ({ success: true, threadId: 'thr_' + Date.now() }),
  reply: async (...args: any[]) => ({ success: true }),
  archiveThread: async (...args: any[]) => ({ success: true })
};
