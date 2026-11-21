export type AccountingDocumentClassification =
  | 'BANK_STATEMENT'
  | 'CREDIT_CARD_STATEMENT'
  | 'INVOICE'
  | 'RECEIPT'
  | 'PAYROLL_REGISTER'
  | 'TRIAL_BALANCE'
  | 'PROFIT_AND_LOSS'
  | 'BALANCE_SHEET'
  | 'GENERAL_LEDGER'
  | 'TAX_FORM'
  | 'LOAN_STATEMENT'
  | 'UNKNOWN'
  | string;

export interface CanonicalAccountingExtractionEnvelope {
  documentId: string;
  classification: AccountingDocumentClassification;
  confidence?: number;
  periodStart?: string;
  periodEnd?: string;
  currency?: string;
  extractedFields: Record<string, any>;
  warnings?: string[];
  [key: string]: any;
}

export interface AccountingReviewQueueItem {
  id: string;
  documentId: string;
  fileName: string;
  classification: AccountingDocumentClassification;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'NEEDS_CORRECTION' | string;
  confidence?: number;
  flaggedReasons?: string[];
  envelope?: CanonicalAccountingExtractionEnvelope;
  createdAt?: string;
  [key: string]: any;
}
