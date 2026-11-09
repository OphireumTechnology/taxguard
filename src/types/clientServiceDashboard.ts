export interface ClientServiceRequest {
  id: string;
  caseKey: string;
  status: 'OPEN' | 'VIEWED' | 'RESPONDED' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED' | string;
  dueDate?: string;
  createdAt?: string;
  title?: string;
  clientId?: string;
}

export interface ClientServiceThread {
  id: string;
  unread: number;
  subject?: string;
  clientId?: string;
}

export interface ClientServiceFollowUp {
  id: string;
  caseKey: string;
  status: string;
  dueDate?: string;
  notes?: string;
}

export interface ClientServiceEscalation {
  id: string;
  title: string;
  severity?: string;
  dueDate?: string;
}

export interface ClientServiceCase {
  id: string;
  clientId?: string;
  engagementId?: string;
  taxYear?: number;
  clientName: string;
  status: string;
  stage: number;
  assignedTo?: string;
}

export interface ClientServiceConversation {
  id: string;
  clientId: string;
  subject: string;
  unread: boolean;
  messages: any[];
}

export interface ClientServiceRequestDetail extends ClientServiceRequest {
  clientName?: string;
  description?: string;
}

export interface ClientServiceSnapshot {
  requests: ClientServiceRequest[];
  threads: ClientServiceThread[];
  followUps: ClientServiceFollowUp[];
  escalations: ClientServiceEscalation[];
  cases?: ClientServiceCase[];
}
