export type AccountingDocumentClassification =
  | 'FORM_W2'
  | 'FORM_1099'
  | 'BANK_STATEMENT'
  | 'INVOICE'
  | 'EXPENSE_RECEIPT'
  | 'TAX_DOCUMENT'
  | 'NON_ACCOUNTING'
  | 'OTHER_ACCOUNTING';

export interface CanonicalAccountingExtractionEnvelope {
  documentId?: string;
  documentType: AccountingDocumentClassification | string;
  entityName?: string;
  vendorName?: string;
  payerName?: string;
  payerTINMasked?: string;
  invoiceNumber?: string;
  grossAmount?: number;
  wageAmount?: number;
  withholdingAmount?: number;
  taxYear?: number;
  currency?: string;
  periodStart?: string;
  periodEnd?: string;
  totalAmount?: number;
  confidence?: number;
  lineItems?: Array<{
    description: string;
    amount: number;
    category?: string;
    date?: string;
  }>;
  extractedFields?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AccountingReviewQueueItem {
  id: string;
  documentId: string;
  filename: string;
  classification: AccountingDocumentClassification;
  confidence: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  reason?: string;
  extraction?: Partial<CanonicalAccountingExtractionEnvelope>;
  createdAt: string;
  [key: string]: unknown;
}
