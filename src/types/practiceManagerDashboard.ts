export interface PracticeManagerCase {
  id: string;
  clientId?: string;
  clientName?: string;
  engagementId?: string;
  taxYear?: number;
  status: string;
  stage: number;
  dueDates: string[];
  waiting: boolean;
  review: boolean;
  owners: string[];
  updatedAt?: string;
  [key: string]: any;
}

export interface PracticeManagerDeadline {
  id: string;
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
  email?: string;
  [key: string]: any;
}

export interface PracticeManagerSnapshot {
  cases: PracticeManagerCase[];
  deadlines: PracticeManagerDeadline[];
  staff: PracticeManagerStaff[];
  [key: string]: any;
}
