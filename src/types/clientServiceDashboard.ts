export interface ClientServiceRequest {
  id: string;
  caseKey: string;
  status: 'OPEN' | 'VIEWED' | 'RESPONDED' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED' | string;
  dueDate?: string;
  createdAt?: string;
  title?: string;
  description?: string;
  [key: string]: any;
}

export interface ClientServiceFollowUp {
  id: string;
  caseKey: string;
  status: string;
  dueDate?: string;
  [key: string]: any;
}

export interface ClientServiceConversation {
  id: string;
  caseKey?: string;
  unread: number;
  subject?: string;
  lastMessage?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface ClientServiceRequestDetail extends ClientServiceRequest {
  details?: Record<string, any>;
  attachments?: any[];
}

export interface ClientServiceCase {
  id: string;
  caseKey: string;
  clientName: string;
  status: string;
  [key: string]: any;
}

export interface ClientServiceSnapshot {
  tenantId?: string;
  requests: ClientServiceRequest[];
  followUps: ClientServiceFollowUp[];
  threads: ClientServiceConversation[];
  escalations: any[];
  cases?: ClientServiceCase[];
  [key: string]: any;
}
