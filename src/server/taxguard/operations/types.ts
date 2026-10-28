
export interface PracticeTask {
  taskId: string;
  tenantId: string;
  clientId?: string;
  caseId?: string;
  engagementId?: string;
  title: string;
  description?: string;
  taskType?: string;
  priority?: string;
  status: string;
  assignedTo?: string;
  version: number;
}

export interface PracticeDeadline {
  deadlineId: string;
  tenantId: string;
  clientId?: string;
  caseId?: string;
  engagementId?: string;
  title: string;
  dueDate: string;
  status: string;
  category?: string;
  authorityType?: string;
}
