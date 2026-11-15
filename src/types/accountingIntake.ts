export type AccountingDocumentClassification =
  | 'BANK_STATEMENT'
  | 'CREDIT_CARD_STATEMENT'
  | 'INVOICE'
  | 'RECEIPT'
  | 'PAYROLL_REGISTER'
  | 'TAX_FORM_W2'
  | 'TAX_FORM_1099'
  | 'GENERAL_LEDGER'
  | 'TRIAL_BALANCE'
  | 'OTHER'
  | string;

export interface CanonicalAccountingExtractionEnvelope {
  documentId?: string;
  classification: AccountingDocumentClassification;
  taxYear: number;
  confidence: number;
  vendorOrInstitution?: string;
  totalAmount?: number;
  currency?: string;
  periodStart?: string;
  periodEnd?: string;
  fields: Record<string, unknown>;
  [key: string]: any;
}

export interface AccountingReviewQueueItem {
  id: string;
  filename: string;
  classification: AccountingDocumentClassification;
  confidence: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  createdAt: string;
  [key: string]: any;
}
