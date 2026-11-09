export interface PracticeManagerCase {
  id: string;
  status: string;
  stage: number;
  owners: string[];
  dueDates: string[];
  waiting: boolean;
  review: boolean;
  updatedAt?: string;
  clientName?: string;
  engagementTitle?: string;
}

export interface PracticeManagerDeadline {
  id: string;
  dueDate: string;
  status: string;
  escalation: number;
  title?: string;
}

export interface PracticeManagerStaff {
  id: string;
  name: string;
  role: string;
  email?: string;
  capacity?: number;
}

export interface PracticeManagerSnapshot {
  cases: PracticeManagerCase[];
  deadlines: PracticeManagerDeadline[];
  staff: PracticeManagerStaff[];
}
