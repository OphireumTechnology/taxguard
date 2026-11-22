export interface PracticeTask {
  id: string;
  clientId?: string;
  title: string;
  status: string;
  priority?: string;
  assigneeId?: string;
  dueDate?: string;
  [key: string]: any;
}

export interface PracticeDeadline {
  id: string;
  clientId?: string;
  title: string;
  dueDate: string;
  authority?: string;
  category?: string;
  status?: string;
  [key: string]: any;
}
