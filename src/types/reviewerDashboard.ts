export interface ReviewScope {
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
}

export interface ReviewerQueueCase {
  id: string;
  scope: ReviewScope;
  reviewerUid: string;
  preparerUid?: string;
  clientName?: string;
  activeStage: number;
  caseStatus: string;
  reviewStatus: string;
  highRisk: boolean;
  openExceptions: number;
  dueDate?: string;
  [key: string]: any;
}

export interface ReviewerReturn extends ReviewScope {
  id: string;
  status: string;
  createdBy: string;
  preparerCertifiedBy?: string;
  diagnostics?: Array<{ id?: string; code?: string; severity: string; resolved?: boolean; message?: string; [key: string]: any }>;
  [key: string]: any;
}

export interface ReviewerArtifact {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  [key: string]: any;
}

export interface ReviewerSnapshot {
  scope: ReviewScope;
  decisionsAvailable: boolean;
  independentReviewer: boolean;
  case: {
    id?: string;
    status: string;
    activeStage: number;
    reviewerUid: string;
    preparerUid?: string;
    openExceptions: number;
    [key: string]: any;
  };
  returns?: ReviewerReturn[];
  artifacts?: ReviewerArtifact[];
  [key: string]: any;
}
