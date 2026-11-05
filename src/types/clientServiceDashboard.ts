/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ClientServiceRequest {
  id: string;
  caseKey: string;
  status: 'OPEN' | 'VIEWED' | 'RESPONDED' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED' | string;
  dueDate?: string;
  createdAt?: string;
  title?: string;
  priority?: string;
}

export interface ClientServiceCase {
  id: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  documents: any[];
  clientName?: string;
  serviceTitle?: string;
}

export interface ClientServiceConversation {
  threadId: string;
  tenantId: string;
  caseKey: string;
  messages: any[];
}

export interface ClientServiceRequestDetail {
  requestId: string;
  tenantId: string;
  caseKey: string;
  details?: Record<string, any>;
}

export interface ClientServiceSnapshot {
  tenantId: string;
  requests: ClientServiceRequest[];
  followUps: Array<{ status: string; caseKey: string; dueDate?: string }>;
  threads: Array<{ unread: number }>;
  escalations: any[];
  cases: ClientServiceCase[];
}
