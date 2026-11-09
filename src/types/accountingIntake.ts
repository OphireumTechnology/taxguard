export type AccountingDocumentClassification =
  | 'BANK_STATEMENT'
  | 'CREDIT_CARD_STATEMENT'
  | 'INVOICE'
  | 'RECEIPT'
  | 'PAYROLL_REPORT'
  | 'TAX_DOCUMENT'
  | 'OTHER_ACCOUNTING'
  | 'NON_ACCOUNTING'
  | string;

export interface CanonicalAccountingExtractionEnvelope {
  documentId?: string;
  vendorName?: string;
  invoiceDate?: string;
  totalAmount?: number;
  taxAmount?: number;
  currency?: string;
  lineItems?: Array<{ description: string; amount: number; quantity?: number }>;
  extractedFields?: Record<string, any>;
  confidence?: number;
  [key: string]: any;
}

export interface AccountingReviewQueueItem {
  id: string;
  documentId: string;
  filename: string;
  status: string;
  classification: AccountingDocumentClassification;
  reviewNotes?: string;
  [key: string]: any;
}
