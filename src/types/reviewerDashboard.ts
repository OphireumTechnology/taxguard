export interface ReviewScope {
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
}

export interface ReviewerQueueCase {
  id: string;
  scope: ReviewScope;
  reviewerUid?: string;
  activeStage: number;
  caseStatus: string;
  reviewStatus: string;
  highRisk?: boolean;
  openExceptions: number;
  dueDate?: string;
  clientName?: string;
}

export interface ReviewerReturn {
  id: string;
  scope: ReviewScope;
  status: string;
}

export interface ReviewerSnapshot {
  cases: ReviewerQueueCase[];
  metrics?: Record<string, number>;
}
