/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Stage 02: AI Accounting Document Collection & Extraction Agent
 * Shared Type Definitions & Canonical Contracts
 */

export type AccountingDocumentClassification =
  | 'TAX_DOCUMENT'
  | 'BANK_STATEMENT'
  | 'CREDIT_CARD_STATEMENT'
  | 'INVOICE'
  | 'SALES_RECEIPT'
  | 'EXPENSE_RECEIPT'
  | 'PURCHASE_ORDER'
  | 'PAYROLL'
  | 'GENERAL_LEDGER'
  | 'TRIAL_BALANCE'
  | 'PROFIT_AND_LOSS'
  | 'BALANCE_SHEET'
  | 'CASH_FLOW_STATEMENT'
  | 'ACCOUNTS_RECEIVABLE'
  | 'ACCOUNTS_PAYABLE'
  | 'LOAN_STATEMENT'
  | 'MORTGAGE_STATEMENT'
  | 'INVESTMENT_STATEMENT'
  | 'BROKERAGE_STATEMENT'
  | 'INSURANCE_DOCUMENT'
  | 'ASSET_PURCHASE'
  | 'FIXED_ASSET_RECORD'
  | 'DEPRECIATION_SCHEDULE'
  | 'RENTAL_PROPERTY_RECORD'
  | 'BUSINESS_CONTRACT'
  | 'FORM_W2'
  | 'FORM_1099'
  | 'FORM_1098'
  | 'FORM_1095'
  | 'K1'
  | 'PRIOR_TAX_RETURN'
  | 'ENTITY_DOCUMENT'
  | 'PAYMENT_PROCESSOR_STATEMENT'
  | 'ECOMMERCE_STATEMENT'
  | 'OTHER_ACCOUNTING'
  | 'NON_ACCOUNTING'
  | 'UNKNOWN';

export const ACCOUNTING_CLASSIFICATIONS: AccountingDocumentClassification[] = [
  'TAX_DOCUMENT',
  'BANK_STATEMENT',
  'CREDIT_CARD_STATEMENT',
  'INVOICE',
  'SALES_RECEIPT',
  'EXPENSE_RECEIPT',
  'PURCHASE_ORDER',
  'PAYROLL',
  'GENERAL_LEDGER',
  'TRIAL_BALANCE',
  'PROFIT_AND_LOSS',
  'BALANCE_SHEET',
  'CASH_FLOW_STATEMENT',
  'ACCOUNTS_RECEIVABLE',
  'ACCOUNTS_PAYABLE',
  'LOAN_STATEMENT',
  'MORTGAGE_STATEMENT',
  'INVESTMENT_STATEMENT',
  'BROKERAGE_STATEMENT',
  'INSURANCE_DOCUMENT',
  'ASSET_PURCHASE',
  'FIXED_ASSET_RECORD',
  'DEPRECIATION_SCHEDULE',
  'RENTAL_PROPERTY_RECORD',
  'BUSINESS_CONTRACT',
  'FORM_W2',
  'FORM_1099',
  'FORM_1098',
  'FORM_1095',
  'K1',
  'PRIOR_TAX_RETURN',
  'ENTITY_DOCUMENT',
  'PAYMENT_PROCESSOR_STATEMENT',
  'ECOMMERCE_STATEMENT',
  'OTHER_ACCOUNTING',
  'NON_ACCOUNTING',
  'UNKNOWN'
];

export interface CanonicalAccountingExtractionEnvelope {
  documentType: AccountingDocumentClassification;
  accountingCategory: string;
  isAccountingRelevant: boolean;
  entityName?: string;
  taxpayerName?: string;
  taxYear?: number;
  accountingPeriod?: string;
  documentDate?: string;
  statementStartDate?: string;
  statementEndDate?: string;
  currency?: string;

  payerName?: string;
  payerTINMasked?: string;
  payeeName?: string;
  payeeTINMasked?: string;

  vendorName?: string;
  customerName?: string;

  invoiceNumber?: string;
  transactionReference?: string;

  grossAmount?: number;
  netAmount?: number;
  taxAmount?: number;
  withholdingAmount?: number;
  interestAmount?: number;
  dividendAmount?: number;
  wageAmount?: number;
  compensationAmount?: number;

  incomeAmount?: number;
  expenseAmount?: number;

  beginningBalance?: number;
  endingBalance?: number;

  accountLastFour?: string;
  paymentMethod?: string;

  accountingSuggestedCategory?: string;

  sourceDocumentId: string;
  sourcePage?: number;
  sourceRegion?: string;

  extractionMethod: 'DETERMINISTIC_PARSER' | 'OCR_STRUCTURED' | 'AI_REASONING_GATEWAY' | 'MANUAL_ENTRY';
  model: string;
  confidence: number;

  isAiProposedOnly: true;
}

export interface ExtractedAccountingTransaction {
  transactionId: string;
  sourceDocumentId: string;
  date: string;
  description: string;
  merchantPayee?: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  reference?: string;
  accountLastFour?: string;
  currency: string;

  // AI-Proposed Categorization (strictly non-authoritative until review)
  proposedCategory?: string;
  proposedExpenseCategory?: string;
  proposedIncomeCategory?: string;
  possibleVendor?: string;
  possibleCustomer?: string;
  businessPersonal?: 'BUSINESS' | 'PERSONAL' | 'UNCERTAIN';
  possibleDeductible?: boolean;
  possibleTransfer?: boolean;
  possibleDuplicate?: boolean;
  confidence: number;
  isAiProposedOnly: true;
}

export type DuplicateStatus =
  | 'UNIQUE'
  | 'EXACT_DUPLICATE'
  | 'POSSIBLE_DUPLICATE'
  | 'RELATED_DOCUMENT'
  | 'REVISED_DOCUMENT';

export interface DuplicateDetectionResult {
  status: DuplicateStatus;
  primaryDocumentId?: string;
  confidence: number;
  matchedSignals: string[];
  explanation: string;
  requiresReview: boolean;
}

export type DocumentRelationshipType =
  | 'INVOICE_TO_PAYMENT'
  | 'RECEIPT_TO_CARD_TRANSACTION'
  | 'BANK_TX_TO_INVOICE'
  | 'FORM_1099_TO_INCOME_LEDGER'
  | 'FORM_W2_TO_PAYROLL_INCOME'
  | 'FORM_1098_TO_MORTGAGE_EXPENSE'
  | 'K1_TO_PASSTHROUGH_ACTIVITY'
  | 'PAYMENT_PROCESSOR_TO_SALES'
  | 'DEPOSIT_TO_SALES_RECEIPT'
  | 'VENDOR_BILL_TO_PAYMENT';

export interface DocumentRelationshipRecord {
  relationshipId: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  relationshipType: DocumentRelationshipType;
  confidence: number;
  proposedByAi: boolean;
  humanConfirmed: boolean;
  confirmedBy?: string;
  confirmedAt?: string;
  notes?: string;
}

export type IntakeSourceType =
  | 'LOCAL_UPLOAD'
  | 'GOOGLE_DRIVE'
  | 'EMAIL'
  | 'DOCUMENT_VAULT'
  | 'ACCOUNTING_CONNECTOR';

export interface CandidateDocument {
  id: string;
  sourceType: IntakeSourceType;
  sourceProvider: string;
  sourceObjectId: string;
  sourceMessageId?: string;
  originalFilename: string;
  originalMimeType: string;
  fileSizeBytes: number;
  originalCreatedAt: string;
  suggestedCategory?: string;
  accountingRelevant?: boolean;
  previewMetadata?: Record<string, unknown>;
  selected?: boolean;
}

export interface ImportedDocument {
  documentId: string;
  sourceType: IntakeSourceType;
  sourceProvider: string;
  sourceObjectId: string;
  sourceMessageId?: string;
  originalFilename: string;
  originalMimeType: string;
  fileSizeBytes: number;
  originalCreatedAt: string;
  importedAt: string;
  importedBy: string;
  tenantId: string;
  clientId: string;
  caseId: string;
  taxYear: number;
  hash: string;
  quarantineStatus: 'QUARANTINED' | 'CLEARED' | 'REJECTED';
  provenance: Record<string, unknown>;
}

export interface AccountingDocumentSource {
  sourceType: IntakeSourceType;
  providerName: string;
  isConfigured: boolean;
  isAuthorized: boolean;
  authScopes?: string[];
  expiresAt?: string;
  discover(params: { clientId: string; caseId?: string; query?: string }): Promise<CandidateDocument[]>;
  importSelected(params: { candidateIds: string[]; clientId: string; caseId?: string; actor: string }): Promise<ImportedDocument[]>;
}

export interface AccountingIntakeBatchJob {
  batchId: string;
  clientId: string;
  taxYear: number;
  createdAt: string;
  updatedAt: string;
  status: 'PENDING' | 'SCANNING' | 'PROCESSING' | 'COMPLETED' | 'PAUSED' | 'FAILED';
  documentsFound: number;
  accountingRelevant: number;
  needsReview: number;
  duplicates: number;
  notAccountingRelated: number;
  processedCount: number;
  processingCount: number;
  items: AccountingIntakeQueueItem[];
}

export interface AccountingIntakeQueueItem {
  itemId: string;
  documentId: string;
  originalFilename: string;
  fileSizeBytes: number;
  mimeType: string;
  sourceType: IntakeSourceType;
  sha256: string;
  classification: AccountingDocumentClassification;
  isAccountingRelevant: boolean;
  quarantineStatus: 'QUARANTINED' | 'CLEARED' | 'REJECTED';
  duplicateStatus: DuplicateStatus;
  duplicateOfId?: string;
  envelope?: CanonicalAccountingExtractionEnvelope;
  transactions?: ExtractedAccountingTransaction[];
  confidence: number;
  needsReview: boolean;
  reviewReason?: string;
  humanReviewed: boolean;
  humanReviewDecision?: 'ACCEPTED' | 'MODIFIED' | 'EXCLUDED';
  reviewedBy?: string;
  reviewedAt?: string;
  processedAt: string;
}

export interface AccountingReviewQueueItem {
  reviewId: string;
  itemId: string;
  documentId: string;
  vendorOrPayee: string;
  documentType: AccountingDocumentClassification;
  amount?: number;
  aiSuggestedCategory: string;
  confidence: number;
  needsReviewReason: string;
  status: 'NEEDS_REVIEW' | 'ACCEPTED' | 'CATEGORY_CHANGED' | 'REJECTED';
  sourceDocumentName: string;
  sourcePage?: number;
  createdAt: string;
}
