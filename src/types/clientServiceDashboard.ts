export interface ClientServiceRequest {
  id?: string;
  requestId?: string;
  tenantId?: string;
  caseKey: string;
  title?: string;
  status: string;
  dueDate?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface ClientServiceRequestDetail extends ClientServiceRequest {
  description?: string;
  clientName?: string;
  assignedTo?: string;
  [key: string]: any;
}

export interface ClientServiceConversation {
  id?: string;
  threadId?: string;
  tenantId?: string;
  caseKey?: string;
  clientName?: string;
  unread?: number;
  lastMessageAt?: string;
  messages?: Array<Record<string, any>>;
  [key: string]: any;
}

export interface ClientServiceCase {
  caseKey: string;
  clientId?: string;
  clientName?: string;
  taxYear?: number;
  status?: string;
  [key: string]: any;
}

export interface ClientServiceSnapshot {
  requests: ClientServiceRequest[];
  threads: ClientServiceConversation[];
  followUps: Array<{ id: string; caseKey: string; status: string; dueDate?: string; [key: string]: any }>;
  escalations: Array<{ id: string; caseKey?: string; severity?: string; [key: string]: any }>;
  cases?: ClientServiceCase[];
  [key: string]: any;
}
