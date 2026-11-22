export type AccountingDocumentClassification =
  | 'w2'
  | '1099'
  | 'k1'
  | 'bank_statement'
  | 'receipt'
  | 'invoice'
  | 'trial_balance'
  | 'profit_loss'
  | 'balance_sheet'
  | 'unknown'
  | string;

export interface CanonicalAccountingExtractionEnvelope {
  id: string;
  documentId?: string;
  classification: AccountingDocumentClassification;
  confidence?: number;
  fields: Record<string, any>;
  warnings?: string[];
  extractedAt?: string;
  [key: string]: any;
}

export interface AccountingReviewQueueItem {
  id: string;
  clientId: string;
  documentId?: string;
  documentName?: string;
  classification?: AccountingDocumentClassification;
  status: string;
  confidence?: number;
  envelope?: CanonicalAccountingExtractionEnvelope;
  createdAt?: string;
  [key: string]: any;
}
