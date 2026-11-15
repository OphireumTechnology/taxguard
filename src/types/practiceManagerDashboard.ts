export interface PracticeManagerCase {
  id: string;
  clientName?: string;
  status: string;
  stage: number;
  dueDates: string[];
  owners: string[];
  waiting?: boolean;
  review?: boolean;
  updatedAt?: string;
  [key: string]: any;
}

export interface PracticeManagerSnapshot {
  cases: PracticeManagerCase[];
  staff: Array<{ id: string; name: string; role?: string; [key: string]: any }>;
  deadlines: Array<{ id: string; status: string; escalation: number; dueDate?: string; [key: string]: any }>;
  [key: string]: any;
}
