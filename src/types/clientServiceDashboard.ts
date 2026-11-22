export interface ClientServiceCase {
  id?: string;
  clientId?: string;
  clientName?: string;
  status?: string;
  stage?: any;
  taxYear?: number;
  [key: string]: any;
}

export interface ClientServiceRequest {
  id: string;
  clientId?: string;
  caseKey?: string;
  subject?: string;
  status?: string;
  priority?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface ClientServiceRequestDetail extends ClientServiceRequest {
  messages?: any[];
  attachments?: any[];
}

export interface ClientServiceConversation {
  id?: string;
  clientId?: string;
  subject?: string;
  unreadCount?: number;
  lastMessageAt?: string;
  [key: string]: any;
}

export interface ClientServiceSnapshot {
  cases?: ClientServiceCase[];
  requests?: ClientServiceRequest[];
  conversations?: ClientServiceConversation[];
  threads?: any[];
  summary?: Record<string, any>;
  [key: string]: any;
}
