export interface PracticeManagerCase {
  id: string;
  clientId: string;
  clientName?: string;
  engagementId?: string;
  status: string;
  stage: number;
  taxYear: number;
  dueDates: string[];
  waiting: boolean;
  review: boolean;
  owners: string[];
  updatedAt?: string;
  [key: string]: any;
}

export interface PracticeManagerDeadline {
  id?: string;
  caseId?: string;
  status: string;
  dueDate?: string;
  escalation: number;
  [key: string]: any;
}

export interface PracticeManagerStaff {
  id: string;
  name: string;
  role: string;
  assigned?: number;
  due?: number;
  overdue?: number;
  review?: number;
  [key: string]: any;
}

export interface PracticeManagerSnapshot {
  tenantId: string;
  cases: PracticeManagerCase[];
  deadlines: PracticeManagerDeadline[];
  staff: PracticeManagerStaff[];
  [key: string]: any;
}
