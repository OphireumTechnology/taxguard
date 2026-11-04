export interface PracticeManagerCase {
  id: string;
  clientId: string;
  clientName: string;
  taxYear: number;
  stage: number;
  stageName: string;
  accountantName: string;
  reviewerName?: string;
  status: string;
  daysInStage: number;
  dueDate: string;
}

export interface PracticeManagerSnapshot {
  activeEngagementsTotal: number;
  deadlineWarningCount: number;
  escalationCount: number;
  teamWorkloadUtilization: number;
  cases: PracticeManagerCase[];
}
