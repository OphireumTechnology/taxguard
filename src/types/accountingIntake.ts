export type AccountingDocumentClassification =
  | 'bank_statement'
  | 'credit_card_statement'
  | 'payroll_summary'
  | 'w2'
  | '1099'
  | 'invoice'
  | 'receipt'
  | 'tax_return'
  | 'general_ledger'
  | 'trial_balance'
  | 'unknown'
  | string;

export interface CanonicalAccountingExtractionEnvelope {
  documentId?: string;
  classification: AccountingDocumentClassification;
  confidence: number;
  extractedFields: Record<string, any>;
  lineItems?: any[];
  warnings?: string[];
  [key: string]: any;
}

export interface AccountingReviewQueueItem {
  id: string;
  documentId: string;
  clientId: string;
  taxYear: number;
  status: 'pending' | 'reviewed' | 'rejected' | string;
  classification: AccountingDocumentClassification;
  notes?: string;
  [key: string]: any;
}
