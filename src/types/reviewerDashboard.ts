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
  caseStatus: string;
  reviewStatus: string;
  activeStage: number;
  highRisk: boolean;
  openExceptions: number;
  dueDate?: string;
  [key: string]: any;
}

export interface ReviewerReturn {
  id: string;
  tenantId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  version?: number;
  status: string;
  createdBy?: string;
  preparerCertifiedBy?: string;
  diagnostics?: Array<{
    id: string;
    severity: string;
    resolved: boolean;
    message?: string;
    returnId?: string;
    jurisdiction?: string;
    code?: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export interface ReviewerArtifact {
  id: string;
  kind: string;
  title: string;
  status?: string;
  createdAt?: string;
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
  returns: ReviewerReturn[];
  exceptions: any[];
  resolutions: any[];
  documents: any[];
  reconciliations: any[];
  stages: any[];
  records: any[];
  extractedFields: any[];
  history: any[];
  workpapers: any[];
  aiFindings: any[];
  [key: string]: any;
}
