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
  updatedAt?: string;
  [key: string]: any;
}

export interface ReviewerArtifact {
  id: string;
  title?: string;
  name?: string;
  type?: string;
  category?: string;
  status?: string;
  confidence?: number;
  createdAt?: string;
  createdBy?: string;
  [key: string]: any;
}

export interface ReviewerReturn extends ReviewScope {
  id: string;
  status: string;
  createdBy?: string;
  preparerCertifiedBy?: string;
  formType?: string;
  diagnostics?: Array<{
    id?: string;
    code?: string;
    severity: string;
    message?: string;
    resolved?: boolean;
  }>;
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
    preparerUid?: string;
    reviewerUid?: string;
    openExceptions: number;
    [key: string]: any;
  };
  returns?: ReviewerReturn[];
  artifacts?: ReviewerArtifact[];
  documents?: ReviewerArtifact[];
  workpapers?: ReviewerArtifact[];
  exceptions?: any[];
  aiFindings?: any[];
  reviewNotes?: any[];
  auditHistory?: any[];
  [key: string]: any;
}
