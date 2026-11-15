export interface PracticeManagerCase {
  id: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  stage: number;
  status: string;
  owners: string[];
  dueDates: string[];
  waiting: boolean;
  review: boolean;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface PracticeManagerStaffMember {
  id: string;
  role: string;
  name?: string;
  [key: string]: unknown;
}

export interface PracticeManagerDeadline {
  id: string;
  clientId: string;
  taxYear: number;
  category: string;
  authority: string;
  dueDate: string;
  status: string;
  escalation: number;
  owner?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface PracticeManagerSnapshot {
  tenantId: string;
  cases: PracticeManagerCase[];
  staff: PracticeManagerStaffMember[];
  deadlines: PracticeManagerDeadline[];
  [key: string]: unknown;
}
