export type CollectionDocumentStatus =
  | 'missing'
  | 'uploaded'
  | 'processing'
  | 'needs_review'
  | 'verified'
  | 'rejected'
  | 'not_applicable'
  | 'withdrawn'
  | string;

export interface ChecklistRequirement {
  id: string;
  name: string;
  category: string;
  required: boolean;
  status: CollectionDocumentStatus;
  description?: string;
  taxYear?: number;
  uploadedDocumentIds?: string[];
  [key: string]: any;
}

export interface StageTwoUploadedDocument {
  id?: string;
  documentId?: string;
  clientId?: string;
  engagementId?: string;
  taxYear?: number;
  requirementId?: string;
  fileName?: string;
  originalFileName?: string;
  category?: string;
  claimedCategory?: string;
  status?: CollectionDocumentStatus;
  sha256?: string;
  sizeBytes?: number;
  fileSizeBytes?: number;
  mimeType?: string;
  uploadedAt?: string;
  [key: string]: any;
}

export interface CollectionReadinessReport {
  ready: boolean;
  completionPercent: number;
  requiredTotal: number;
  requiredSatisfied: number;
  missingCount: number;
  openExceptionsCount: number;
  [key: string]: any;
}

export interface TaxYearCollectionWorkspaceContext {
  clientId: string;
  engagementId?: string;
  taxYear: number;
  entityType?: string;
  requirements: ChecklistRequirement[];
  documents: StageTwoUploadedDocument[];
  readiness: CollectionReadinessReport;
  [key: string]: any;
}

export const StageTwoCollectionService: any = {
  getWorkspaceContext(clientId: string, taxYear = 2025): TaxYearCollectionWorkspaceContext {
    return {
      clientId,
      taxYear,
      requirements: [],
      documents: [],
      readiness: {
        ready: false,
        completionPercent: 0,
        requiredTotal: 0,
        requiredSatisfied: 0,
        missingCount: 0,
        openExceptionsCount: 0,
      },
    };
  },
  getDocuments(_clientId: string, _taxYear = 2025): StageTwoUploadedDocument[] {
    return [];
  },
  getChecklist(_clientId: string, _taxYear = 2025): ChecklistRequirement[] {
    return [];
  },
};
