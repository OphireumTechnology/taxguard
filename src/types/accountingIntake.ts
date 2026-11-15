export type AccountingDocumentClassification =
  | 'FORM_W2'
  | 'FORM_1099'
  | 'BANK_STATEMENT'
  | 'INVOICE'
  | 'EXPENSE_RECEIPT'
  | 'NON_ACCOUNTING'
  | 'TAX_DOCUMENT'
  | 'OTHER_ACCOUNTING'
  | string;

export interface CanonicalAccountingExtractionEnvelope {
  id?: string;
  documentId?: string;
  fileName?: string;
  documentType?: AccountingDocumentClassification;
  entityName?: string;
  taxYear?: number;
  currency?: string;
  vendorName?: string;
  payerName?: string;
  payerTINMasked?: string;
  invoiceNumber?: string;
  grossAmount?: number;
  wageAmount?: number;
  withholdingAmount?: number;
  classification?: AccountingDocumentClassification;
  extractedFields?: Record<string, any>;
  provenance?: Record<string, any>;
  isDuplicate?: boolean;
  duplicateOfId?: string;
  status?: string;
  [key: string]: any;
}

export interface AccountingReviewQueueItem {
  id: string;
  envelopeId?: string;
  fileName: string;
  category: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_clarification' | string;
  confidence?: number;
  issues?: string[];
  createdAt?: string;
  [key: string]: any;
}
