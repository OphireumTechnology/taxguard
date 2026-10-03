/**
 * TaxGuard Secure Client Communications Service
 * Enforces client isolation, strict CLIENT_VISIBLE vs INTERNAL_ONLY visibility boundaries,
 * thread categorization, and conversation audit trails.
 */

import { randomUUID } from 'node:crypto';
import {
  CommunicationThread,
  CommunicationMessage,
  MessageVisibility
} from './types';

export class ClientCommunicationService {
  private threads = new Map<string, CommunicationThread>();
  private messages: CommunicationMessage[] = [];

  /**
   * Create or retrieve a communication thread
   */
  async createThread(params: {
    tenantId: string;
    clientId: string;
    subject: string;
    category?: CommunicationThread['category'];
    createdBy: string;
    engagementId?: string;
    caseId?: string;
  }): Promise<CommunicationThread> {
    const id = `thread_${randomUUID()}`;
    const now = new Date().toISOString();

    const thread: CommunicationThread = {
      id,
      tenantId: params.tenantId,
      clientId: params.clientId,
      engagementId: params.engagementId,
      caseId: params.caseId,
      subject: params.subject,
      category: params.category || 'GENERAL',
      status: 'ACTIVE',
      createdBy: params.createdBy,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.threads.set(id, thread);
    return thread;
  }

  /**
   * Post a message to a thread
   */
  async postMessage(params: {
    threadId: string;
    tenantId: string;
    clientId: string;
    senderId: string;
    senderRole: string;
    visibility: MessageVisibility;
    content: string;
    attachments?: CommunicationMessage['attachments'];
  }): Promise<CommunicationMessage> {
    const thread = this.threads.get(params.threadId);
    if (!thread) throw new Error(`THREAD_NOT_FOUND: ${params.threadId}`);
    if (thread.tenantId !== params.tenantId || thread.clientId !== params.clientId) {
      throw new Error('TENANT_OR_CLIENT_MISMATCH: Unauthorized message dispatch across boundary.');
    }

    // Client users CANNOT post INTERNAL_ONLY messages
    if (params.senderRole === 'client' && params.visibility === 'INTERNAL_ONLY') {
      throw new Error('CLIENT_CANNOT_POST_INTERNAL_NOTE: Clients are restricted to client-visible messaging.');
    }

    const id = `msg_${randomUUID()}`;
    const now = new Date().toISOString();

    const message: CommunicationMessage = {
      id,
      threadId: params.threadId,
      tenantId: params.tenantId,
      clientId: params.clientId,
      senderId: params.senderId,
      senderRole: params.senderRole,
      visibility: params.visibility,
      content: params.content,
      attachments: params.attachments || [],
      isRead: false,
      createdAt: now,
    };

    this.messages.push(message);

    thread.lastMessageAt = now;
    thread.updatedAt = now;
    this.threads.set(params.threadId, thread);

    return message;
  }

  /**
   * Get thread messages respecting visibility rules:
   * Clients ONLY see CLIENT_VISIBLE messages.
   * Staff/Admin see all messages including INTERNAL_ONLY notes.
   */
  getThreadMessages(
    threadId: string,
    tenantId: string,
    callerRole: string,
    callerClientId?: string
  ): CommunicationMessage[] {
    const thread = this.threads.get(threadId);
    if (!thread || thread.tenantId !== tenantId) {
      return [];
    }

    if (callerRole === 'client' && thread.clientId !== callerClientId) {
      return []; // Forbidden cross-client access
    }

    let threadMsgs = this.messages.filter((m) => m.threadId === threadId && m.tenantId === tenantId);

    if (callerRole === 'client') {
      // STRICT FILTER: remove all internal-only notes
      threadMsgs = threadMsgs.filter((m) => m.visibility === 'CLIENT_VISIBLE');
    }

    return threadMsgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  /**
   * Query threads for a client or tenant
   */
  queryThreads(params: {
    tenantId: string;
    clientId?: string;
    status?: CommunicationThread['status'];
    callerRole: string;
    callerClientId?: string;
  }): CommunicationThread[] {
    let list = Array.from(this.threads.values()).filter((t) => t.tenantId === params.tenantId);

    if (params.callerRole === 'client') {
      // Force filter to client's own threads
      list = list.filter((t) => t.clientId === params.callerClientId);
    } else if (params.clientId) {
      list = list.filter((t) => t.clientId === params.clientId);
    }

    if (params.status) {
      list = list.filter((t) => t.status === params.status);
    }

    return list.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }

  clear(): void {
    this.threads.clear();
    this.messages = [];
  }
}

export const globalClientCommunicationService = new ClientCommunicationService();
