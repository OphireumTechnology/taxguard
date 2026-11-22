export interface ClientServiceCase {
  id: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  stage: number;
  status: string;
  documents: Record<string, number>;
  [key: string]: any;
}

export interface ClientServiceRequest {
  id: string;
  caseKey: string;
  type: string;
  status: string;
  priority?: string;
  createdAt?: string;
  dueDate?: string;
  [key: string]: any;
}

export interface ClientServiceRequestDetail {
  tenantId: string;
  caseKey: string;
  requestId: string;
  title: string;
  description?: string;
  status: string;
  [key: string]: any;
}

export interface ClientServiceConversation {
  tenantId: string;
  caseKey: string;
  threadId: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    read: boolean;
    createdAt: string;
  }>;
  [key: string]: any;
}

export interface ClientServiceSnapshot {
  tenantId: string;
  cases: ClientServiceCase[];
  requests: ClientServiceRequest[];
  threads: Array<{
    id: string;
    caseKey: string;
    category?: string;
    status: string;
    lastMessageAt?: string;
    messageCount: number;
    unread: number;
  }>;
  followUps: Array<{
    id: string;
    caseKey: string;
    type: string;
    status: string;
    priority?: string;
    createdAt?: string;
    dueDate?: string;
    owner?: string;
  }>;
  escalations: Array<{
    id: string;
    caseKey: string;
    category: string;
    status: string;
    level: number;
    dueDate: string;
    createdAt?: string;
  }>;
  capabilities: {
    appointments: boolean;
    mutations: boolean;
    sla: boolean;
    ai: boolean;
    privateDocuments: boolean;
  };
  [key: string]: any;
}
