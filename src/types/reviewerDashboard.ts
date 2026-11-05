export interface ReviewScope {
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
}

export interface ReturnDiagnostic {
  id?: string;
  code?: string;
  severity: string;
  message?: string;
  resolved: boolean;
  [key: string]: any;
}

export interface ReviewerReturn {
  id?: string;
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  createdBy: string;
  status: string;
  preparerCertifiedBy?: string;
  diagnostics?: ReturnDiagnostic[];
  [key: string]: any;
}

export interface ReviewerQueueCase {
  id: string;
  scope: ReviewScope;
  reviewerUid: string;
  preparerUid?: string;
  activeStage: number;
  caseStatus: string;
  reviewStatus: string;
  highRisk?: boolean;
  openExceptions: number;
  dueDate?: string;
  clientName?: string;
  [key: string]: any;
}

export interface ReviewerSnapshot {
  scope: ReviewScope;
  decisionsAvailable: boolean;
  independentReviewer: boolean;
  case: {
    reviewerUid: string;
    preparerUid: string;
    status: string;
    activeStage: number;
    openExceptions: number;
    [key: string]: any;
  };
  returns?: ReviewerReturn[];
  artifacts?: ReviewerArtifact[];
  [key: string]: any;
}

export interface ReviewerArtifact {
  id: string;
  name: string;
  type: string;
  status: string;
  url?: string;
  [key: string]: any;
}
