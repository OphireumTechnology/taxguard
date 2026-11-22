export interface PracticeTask {
  id: string;
  tenantId: string;
  clientId: string;
  engagementId?: string;
  caseId?: string;
  taxYear?: number;
  taskType: string;
  title?: string;
  status: string;
  priority?: string;
  assignedUserId?: string;
  dueDate?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface PracticeDeadline {
  id: string;
  tenantId: string;
  clientId: string;
  caseId?: string;
  taxYear: number;
  category: string;
  authorityType?: string;
  status: string;
  escalationLevel: number;
  dueDate: string;
  createdAt: string;
  [key: string]: any;
}
