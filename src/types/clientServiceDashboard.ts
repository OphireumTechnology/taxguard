export interface ClientServiceRequest {
  id: string;
  caseKey: string;
  status: string;
  dueDate?: string;
  createdAt?: string;
  clientName?: string;
}

export interface ClientServiceSnapshot {
  requests: ClientServiceRequest[];
  followUps: Array<{ caseKey: string; status: string; dueDate?: string }>;
  threads: Array<{ unread: number }>;
  escalations: any[];
}
