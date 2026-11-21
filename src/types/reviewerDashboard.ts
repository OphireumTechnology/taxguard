export interface ReviewScope {
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
}

export interface ReviewerQueueCase {
  id: string;
  scope: ReviewScope;
  clientName?: string;
  reviewerUid: string;
  preparerUid?: string;
  activeStage: number;
  caseStatus: string;
  reviewStatus: string;
  highRisk: boolean;
  openExceptions: number;
  dueDate?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface ReviewerDiagnostic {
  id?: string;
  code?: string;
  severity: string;
  resolved: boolean;
  message?: string;
  [key: string]: any;
}

export interface ReviewerReturn extends ReviewScope {
  id: string;
  version?: number;
  status: string;
  createdBy: string;
  preparerCertifiedBy?: string;
  diagnostics?: ReviewerDiagnostic[];
  [key: string]: any;
}

export interface ReviewerArtifact {
  id: string;
  type: string;
  title?: string;
  name?: string;
  status?: string;
  createdAt?: string;
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
  documents?: Array<Record<string, any>>;
  exceptions?: Array<Record<string, any>>;
  notes?: Array<Record<string, any>>;
  audit?: Array<Record<string, any>>;
  [key: string]: any;
}
