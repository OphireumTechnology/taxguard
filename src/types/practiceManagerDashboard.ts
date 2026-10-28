export interface PracticeManagerCase {
  id: string;
  status: string;
  stage: number;
  dueDates: string[];
  waiting: boolean;
  review: boolean;
  owners: string[];
}

export interface PracticeManagerStaff {
  id: string;
  name: string;
  role: string;
}

export interface PracticeManagerSnapshot {
  cases: PracticeManagerCase[];
  deadlines: Array<{ status: string; escalation: number }>;
  staff: PracticeManagerStaff[];
}
