export type AccountingDocumentClassification = string;

export interface AccountingDocumentRecord {
  id: string;
  clientId?: string;
  fileName: string;
  classification?: AccountingDocumentClassification;
  status?: string;
  uploadedAt?: string;
  [key: string]: any;
}

export interface CanonicalAccountingExtractionEnvelope {
  id?: string;
  documentId?: string;
  classification?: AccountingDocumentClassification;
  confidence?: number;
  extractedFields?: Record<string, any>;
  warnings?: string[];
  [key: string]: any;
}

export interface AccountingReviewQueueItem {
  id: string;
  documentId?: string;
  clientId?: string;
  fileName?: string;
  classification?: AccountingDocumentClassification;
  status?: string;
  envelope?: CanonicalAccountingExtractionEnvelope;
  [key: string]: any;
}
