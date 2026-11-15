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
  preparerName?: string;
  priority?: string;
  activeStage: number;
  caseStatus: string;
  reviewStatus: string;
  highRisk: boolean;
  openExceptions: number;
  dueDate?: string;
  clientName?: string;
  returnType?: string;
  [key: string]: unknown;
}

export interface ReviewerDiagnostic {
  code?: string;
  severity: 'CRITICAL_BLOCKING' | 'WARNING' | 'INFO' | string;
  message: string;
  resolved?: boolean;
  [key: string]: unknown;
}

export interface ReviewerFormArtifact {
  formNumber: string;
  formName: string;
  lineItems: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ReviewerReturn extends ReviewScope {
  returnId: string;
  returnType?: string;
  jurisdiction: string;
  status: string;
  createdBy: string;
  preparerCertifiedBy?: string;
  forms?: ReviewerFormArtifact[];
  figures?: Record<string, unknown>;
  diagnostics?: ReviewerDiagnostic[];
  [key: string]: unknown;
}

export interface ReviewerArtifact {
  id: string;
  action?: string;
  outcome?: string;
  status?: string;
  notes?: string;
  rationale?: string;
  actorUid?: string;
  reviewer?: string;
  reviewedBy?: string;
  recordedBy?: string;
  timestamp?: string;
  recordedAt?: string;
  approvedAt?: string;
  revision?: string | number;
  code?: string;
  severity?: string;
  source?: string;
  formId?: string;
  documentId?: string;
  explanation?: string;
  message?: string;
  assignedTo?: string;
  responsibleParty?: string;
  resolutionEvidenceIds?: string[];
  resolution?: string;
  exceptionId?: string;
  reason?: string;
  category?: string;
  variance?: unknown;
  fileName?: string;
  version?: string | number;
  scanResult?: { clean?: boolean; verified?: boolean };
  stage?: number;
  requirementsMet?: boolean;
  provenance?: {
    sourceDocumentId?: string;
    sourceFieldId?: string;
    humanReviewer?: string;
  };
  sourceDocumentId?: string;
  sourceFieldId?: string;
  description?: string;
  normalizedValue?: unknown;
  field?: string;
  verifiedValue?: unknown;
  correctedValue?: unknown;
  proposedValue?: unknown;
  confidence?: number;
  proposal?: { purpose?: string; [key: string]: unknown };
  evidenceId?: string;
  [key: string]: unknown;
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
    [key: string]: unknown;
  };
  returns: ReviewerReturn[];
  exceptions: ReviewerArtifact[];
  resolutions: ReviewerArtifact[];
  documents: ReviewerArtifact[];
  reconciliations: ReviewerArtifact[];
  stages: ReviewerArtifact[];
  records: ReviewerArtifact[];
  extractedFields: ReviewerArtifact[];
  history: ReviewerArtifact[];
  workpapers: ReviewerArtifact[];
  aiFindings: ReviewerArtifact[];
  [key: string]: unknown;
}
