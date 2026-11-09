export interface ReviewScope {
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
}

export interface ReviewerQueueCase {
  id: string;
  reviewerUid: string;
  preparerUid: string;
  caseStatus: string;
  reviewStatus: string;
  activeStage: number;
  highRisk: boolean;
  openExceptions: number;
  dueDate?: string;
  scope: ReviewScope;
}

export interface ReviewerReturnDiagnostic {
  severity: string;
  resolved: boolean;
  code?: string;
  message?: string;
}

export interface ReviewerReturn {
  status: string;
  createdBy: string;
  preparerCertifiedBy?: string;
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  diagnostics?: ReviewerReturnDiagnostic[];
}

export interface ReviewerArtifact {
  id: string;
  name: string;
  type: string;
  url?: string;
  uploadedAt: string;
}

export interface ReviewerSnapshot {
  scope: ReviewScope;
  decisionsAvailable: boolean;
  independentReviewer: boolean;
  case: {
    status: string;
    activeStage: number;
    reviewerUid: string;
    preparerUid: string;
    openExceptions: number;
  };
  returns?: ReviewerReturn[];
  queue?: ReviewerQueueCase[];
  artifacts?: ReviewerArtifact[];
}
