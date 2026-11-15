export interface PracticeManagerCase {
  id: string;
  clientId: string;
  clientName: string;
  taxYear: number;
  status: 'DRAFT' | 'ACTIVE' | 'BLOCKED' | 'IN_REVIEW' | 'READY' | 'APPROVED' | 'FILED' | 'RESOLVED' | string;
  stage: number;
  owners: string[];
  dueDates: string[];
  waiting: boolean;
  review: boolean;
  updatedAt?: string;
  [key: string]: any;
}

export interface PracticeManagerSnapshot {
  tenantId: string;
  cases: PracticeManagerCase[];
  deadlines: Array<{ id: string; caseId?: string; status: string; escalation: number; dueDate?: string; [key: string]: any }>;
  staff: Array<{ id: string; name: string; role: string; [key: string]: any }>;
  [key: string]: any;
}
