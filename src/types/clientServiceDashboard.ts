export interface ClientServiceCase {
  id: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  stage: number;
  status: string;
  documents: Record<string, number>;
}

export interface ClientServiceRequest {
  id: string;
  caseKey: string;
  type: string;
  status: string;
  priority: string;
  createdAt?: string;
  dueDate?: string;
}

export interface ClientServiceThread {
  id: string;
  caseKey: string;
  category: string;
  status: string;
  unread: number;
  lastMessageAt?: string;
}

export interface ClientServiceFollowUp {
  id: string;
  caseKey: string;
  type: string;
  status: string;
  dueDate?: string;
  owner?: string;
}

export interface ClientServiceEscalation {
  id: string;
  caseKey: string;
  category: string;
  level: number;
  createdAt?: string;
  status: string;
}

export interface ClientServiceConversation {
  tenantId: string;
  caseKey: string;
  threadId: string;
  messages: Array<{
    id: string;
    role: string;
    createdAt: string;
    content: string;
    read: boolean;
  }>;
}

export interface ClientServiceRequestDetail {
  tenantId: string;
  caseKey: string;
  requestId: string;
  title: string;
  description?: string;
  status: string;
}

export interface ClientServiceSnapshot {
  tenantId: string;
  cases: ClientServiceCase[];
  requests: ClientServiceRequest[];
  threads: ClientServiceThread[];
  followUps: ClientServiceFollowUp[];
  escalations: ClientServiceEscalation[];
}
