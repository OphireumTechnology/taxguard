/**
 * TaxGuard Client Request Center Service
 * Unifies document requests, questionnaires, transaction clarifications,
 * missing receipts, and signature requests into a single coherent lifecycle.
 */

import { randomUUID } from 'node:crypto';
import {
  ClientRequestItem,
  RequestType,
  RequestStatus,
  TaskPriority
} from './types';

export class ClientRequestService {
  private requests = new Map<string, ClientRequestItem>();

  /**
   * Create a new request directed to a client
   */
  async createRequest(params: {
    tenantId: string;
    clientId: string;
    requestType: RequestType;
    title: string;
    description?: string;
    priority?: TaskPriority;
    dueDate?: string;
    createdBy: string;
    engagementId?: string;
    caseId?: string;
  }): Promise<ClientRequestItem> {
    const id = `req_${randomUUID()}`;
    const now = new Date().toISOString();

    const request: ClientRequestItem = {
      id,
      tenantId: params.tenantId,
      clientId: params.clientId,
      engagementId: params.engagementId,
      caseId: params.caseId,
      requestType: params.requestType,
      title: params.title,
      description: params.description,
      status: 'OPEN',
      priority: params.priority || 'MEDIUM',
      dueDate: params.dueDate,
      createdBy: params.createdBy,
      assignedToClientId: params.clientId,
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };

    this.requests.set(id, request);
    return request;
  }

  /**
   * Mark a request as VIEWED by client
   */
  async markViewed(requestId: string, clientId: string): Promise<ClientRequestItem> {
    const request = this.requests.get(requestId);
    if (!request) throw new Error(`REQUEST_NOT_FOUND: ${requestId}`);
    if (request.clientId !== clientId) {
      throw new Error('CLIENT_MISMATCH: Cannot access requests belonging to another client.');
    }

    if (request.status === 'OPEN') {
      request.status = 'VIEWED';
      request.updatedAt = new Date().toISOString();
      this.requests.set(requestId, request);
    }
    return request;
  }

  /**
   * Client responds to request
   */
  async submitResponse(params: {
    requestId: string;
    clientId: string;
    responseText?: string;
    responseData?: Record<string, unknown>;
    attachments?: ClientRequestItem['attachments'];
  }): Promise<ClientRequestItem> {
    const request = this.requests.get(params.requestId);
    if (!request) throw new Error(`REQUEST_NOT_FOUND: ${params.requestId}`);
    if (request.clientId !== params.clientId) {
      throw new Error('CLIENT_MISMATCH: Cannot respond to requests belonging to another client.');
    }

    if (request.status === 'RESOLVED' || request.status === 'CLOSED') {
      throw new Error('REQUEST_ALREADY_CLOSED: Cannot update a resolved request.');
    }

    const now = new Date().toISOString();
    request.responseText = params.responseText;
    request.responseData = params.responseData;
    if (params.attachments && params.attachments.length > 0) {
      request.attachments = [...request.attachments, ...params.attachments];
    }
    request.status = 'RESPONDED';
    request.updatedAt = now;

    this.requests.set(params.requestId, request);
    return request;
  }

  /**
   * Staff reviewer marks request as UNDER_REVIEW or RESOLVED
   */
  async resolveRequest(
    requestId: string,
    resolvedByUid: string,
    status: 'RESOLVED' | 'UNDER_REVIEW' | 'CLOSED'
  ): Promise<ClientRequestItem> {
    const request = this.requests.get(requestId);
    if (!request) throw new Error(`REQUEST_NOT_FOUND: ${requestId}`);

    const now = new Date().toISOString();
    request.status = status;
    request.resolvedAt = status === 'RESOLVED' || status === 'CLOSED' ? now : undefined;
    request.resolvedBy = resolvedByUid;
    request.updatedAt = now;

    this.requests.set(requestId, request);
    return request;
  }

  /**
   * Query requests with role-based filtering
   */
  queryRequests(params: {
    tenantId: string;
    clientId?: string;
    status?: RequestStatus;
    requestType?: RequestType;
    callerRole: string;
    callerClientId?: string;
  }): ClientRequestItem[] {
    let list = Array.from(this.requests.values()).filter((r) => r.tenantId === params.tenantId);

    if (params.callerRole === 'client') {
      list = list.filter((r) => r.clientId === params.callerClientId);
    } else if (params.clientId) {
      list = list.filter((r) => r.clientId === params.clientId);
    }

    if (params.status) list = list.filter((r) => r.status === params.status);
    if (params.requestType) list = list.filter((r) => r.requestType === params.requestType);

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  clear(): void {
    this.requests.clear();
  }
}

export const globalClientRequestService = new ClientRequestService();
