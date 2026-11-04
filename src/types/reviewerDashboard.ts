export type ReviewScope = 'federal' | 'state' | 'compliance' | 'book_to_tax' | 'all';

export interface ReviewerQueueCase {
  id: string;
  clientId: string;
  clientName: string;
  taxYear: number;
  stage: number;
  status: string;
  assignedAccountantName: string;
  assignedReviewerName?: string;
  riskScore?: number;
  updatedAt: string;
}

export interface ReviewerReturn {
  id: string;
  caseId: string;
  version: number;
  formType: string;
  taxYear: number;
  status: string;
  summaryMetrics?: Record<string, number | string>;
}

export interface ReviewerArtifact {
  id: string;
  title: string;
  type: string;
  status: string;
  url?: string;
}

export interface ReviewerSnapshot {
  pendingReviewCount: number;
  approvedCount: number;
  flaggedCount: number;
  activeCases: ReviewerQueueCase[];
  recentArtifacts?: ReviewerArtifact[];
}
