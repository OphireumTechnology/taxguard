export interface ClientServiceRequest {
  id: string;
  caseKey: string;
  clientId?: string;
  clientName?: string;
  title: string;
  status: 'OPEN' | 'VIEWED' | 'RESPONDED' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED' | string;
  dueDate?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface ClientServiceCase {
  caseKey: string;
  clientId: string;
  clientName: string;
  taxYear: number;
  status: string;
  stage?: number;
  documents?: any[];
  [key: string]: any;
}

export interface ClientServiceConversation {
  tenantId: string;
  caseKey: string;
  threadId: string;
  messages: Array<{ id: string; senderName: string; content: string; sentAt: string; [key: string]: any }>;
  [key: string]: any;
}

export interface ClientServiceRequestDetail {
  tenantId: string;
  caseKey: string;
  requestId: string;
  title: string;
  description: string;
  status: string;
  [key: string]: any;
}

export interface ClientServiceSnapshot {
  tenantId: string;
  cases: ClientServiceCase[];
  requests: ClientServiceRequest[];
  followUps: Array<{ id: string; caseKey: string; status: string; dueDate?: string; [key: string]: any }>;
  threads: Array<{ id: string; caseKey: string; unread: number; [key: string]: any }>;
  escalations: Array<{ id: string; caseKey: string; reason?: string; [key: string]: any }>;
  [key: string]: any;
}
