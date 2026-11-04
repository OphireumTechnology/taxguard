export interface AccountingDocumentClassification {
  category: string;
  confidence: number;
  detectedEntity: string;
}

export interface CanonicalAccountingExtractionEnvelope {
  documentId: string;
  extractedLines: Array<{ accountCode: string; description: string; amount: number }>;
  balanced: boolean;
}

export interface AccountingReviewQueueItem {
  id: string;
  clientId: string;
  documentName: string;
  status: string;
  receivedAt: string;
}
