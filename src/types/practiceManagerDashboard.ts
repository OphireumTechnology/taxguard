export interface PracticeManagerCase {
  id: string;
  clientId?: string;
  clientName?: string;
  taxYear?: number;
  stage?: any;
  status?: string;
  assignedAccountantId?: string;
  assignedReviewerId?: string;
  dueDate?: string;
  [key: string]: any;
}

export interface PracticeManagerSnapshot {
  cases: PracticeManagerCase[];
  staffWorkload?: any[];
  escalations?: any[];
  summary?: Record<string, any>;
  [key: string]: any;
}
