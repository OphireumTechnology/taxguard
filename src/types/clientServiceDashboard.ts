export interface ClientServiceRequest {
  id?: string;
  requestId?: string;
  caseKey: string;
  clientId?: string;
  clientName?: string;
  title: string;
  status: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  priority?: string;
  category?: string;
  [key: string]: any;
}

export interface ClientServiceRequestDetail extends ClientServiceRequest {
  tenantId?: string;
  description?: string;
  comments?: Array<any>;
  [key: string]: any;
}

export interface ClientServiceConversation {
  id?: string;
  threadId?: string;
  tenantId?: string;
  caseKey?: string;
  clientId?: string;
  clientName?: string;
  subject?: string;
  unread?: number;
  lastMessageAt?: string;
  messages?: Array<any>;
  [key: string]: any;
}

export interface ClientServiceCase {
  caseKey: string;
  clientId: string;
  clientName: string;
  engagementId?: string;
  taxYear?: number;
  status?: string;
  stage?: number;
  [key: string]: any;
}

export interface ClientServiceSnapshot {
  requests: ClientServiceRequest[];
  threads: ClientServiceConversation[];
  followUps: Array<{
    id: string;
    caseKey: string;
    status: string;
    dueDate?: string;
    title?: string;
    [key: string]: any;
  }>;
  escalations: Array<{
    id: string;
    caseKey?: string;
    title?: string;
    severity?: string;
    [key: string]: any;
  }>;
  cases?: ClientServiceCase[];
  [key: string]: any;
}
