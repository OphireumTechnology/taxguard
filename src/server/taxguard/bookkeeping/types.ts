/**
 * TaxGuard Bookkeeping & General Ledger Architecture
 * Enterprise Types & Contracts for Double-Entry Accounting,
 * Bank Feeds, Reconciliation, Financial Reporting, and Tax Mapping.
 */

export type AccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'COGS'
  | 'EXPENSE'
  | 'OTHER_INCOME'
  | 'OTHER_EXPENSE';

export type AccountSubtype =
  | 'CASH_AND_EQUIVALENTS'
  | 'ACCOUNTS_RECEIVABLE'
  | 'INVENTORY'
  | 'PREPAID_EXPENSES'
  | 'FIXED_ASSETS'
  | 'ACCUMULATED_DEPRECIATION'
  | 'OTHER_CURRENT_ASSETS'
  | 'OTHER_NON_CURRENT_ASSETS'
  | 'ACCOUNTS_PAYABLE'
  | 'CREDIT_CARD'
  | 'CURRENT_LIABILITIES'
  | 'PAYROLL_LIABILITIES'
  | 'LONG_TERM_LIABILITIES'
  | 'OWNERS_CAPITAL'
  | 'OWNERS_DISTRIBUTION'
  | 'RETAINED_EARNINGS'
  | 'OPERATING_REVENUE'
  | 'SERVICE_REVENUE'
  | 'COST_OF_GOODS_SOLD'
  | 'PAYROLL_EXPENSES'
  | 'RENT_EXPENSES'
  | 'UTILITIES_EXPENSES'
  | 'ADVERTISING_EXPENSES'
  | 'TRAVEL_MEALS_EXPENSES'
  | 'PROFESSIONAL_LEGAL_EXPENSES'
  | 'DEPRECIATION_EXPENSE'
  | 'INSURANCE_EXPENSES'
  | 'OFFICE_SUPPLIES'
  | 'INTEREST_EXPENSE'
  | 'OTHER_OPERATING_EXPENSE'
  | 'INTEREST_INCOME'
  | 'TAX_EXPENSE';

export interface ChartOfAccount {
  id: string;
  tenantId: string;
  clientId: string;
  accountNumber: string;
  accountName: string;
  accountType: AccountType;
  accountSubtype: AccountSubtype;
  parentAccountId?: string;
  currency: 'USD';
  isActive: boolean;
  externalProviderMapping?: {
    quickbooksAccountId?: string;
    xeroAccountId?: string;
  };
  taxMapping?: {
    formTarget: '1040_SCHED_C' | '1065' | '1120S' | '1120';
    taxLineCode: string;
    taxLineDescription: string;
    isSubjectToLimitation?: boolean;
    limitationPercentage?: number; // e.g. 50% for business meals
  };
  createdAt: string;
  updatedAt: string;
  provenance: {
    source: 'SYSTEM_BOOTSTRAP' | 'MANUAL_ACCOUNTANT' | 'QUICKBOOKS_IMPORT' | 'XERO_IMPORT';
    creatorUid: string;
  };
}

export interface JournalEntryLine {
  id: string;
  accountId: string;
  accountNumber?: string;
  accountName?: string;
  debit: number;
  credit: number;
  memo?: string;
  taxCategory?: string;
  documentReferenceId?: string;
}

export type JournalEntryStatus = 'DRAFT' | 'PREPARED' | 'PENDING_REVIEW' | 'POSTED' | 'VOIDED' | 'REJECTED' | 'CORRECTION_REQUIRED';

export interface JournalEntry {
  id: string;
  tenantId: string;
  clientId: string;
  taxYear: number;
  periodId: string;
  entryNumber: string;
  postingDate: string;
  transactionDate: string;
  description: string;
  reference?: string;
  source: 'MANUAL' | 'BANK_FEED' | 'QUICKBOOKS' | 'XERO' | 'ADJUSTING' | 'CLOSING';
  isAdjusting: boolean;
  adjustingType?: 'ACCRUAL' | 'PREPAYMENT' | 'DEPRECIATION' | 'AMORTIZATION' | 'RECLASSIFICATION' | 'TAX_M1';
  lines: JournalEntryLine[];
  totalDebit: number;
  totalCredit: number;
  status: JournalEntryStatus;
  creatorUid: string;
  reviewerUid?: string;
  createdAt: string;
  postedAt?: string;
  documentProvenanceIds: string[];
}

export type DuplicateStatus = 'NOT_DUPLICATE' | 'POSSIBLE_DUPLICATE' | 'CONFIRMED_DUPLICATE';
export type ClassificationStatus =
  | 'UNCLASSIFIED'
  | 'AI_PROPOSED'
  | 'ACCOUNTANT_REVIEW_REQUIRED'
  | 'ACCOUNTANT_APPROVED'
  | 'POSTED'
  | 'REJECTED';

export interface BankTransaction {
  id: string;
  tenantId: string;
  clientId: string;
  accountId: string; // Cash / Bank or Credit Card account ID
  externalTransactionId?: string;
  provider: 'CSV_UPLOAD' | 'MANUAL_ENTRY' | 'QUICKBOOKS' | 'XERO';
  transactionDate: string;
  postingDate: string;
  description: string;
  amount: number; // positive = inflow/deposit, negative = outflow/expense
  currency: 'USD';
  rawReference?: string;
  importBatchId: string;
  documentReferenceId?: string;
  duplicateStatus: DuplicateStatus;
  duplicateCandidateId?: string;
  classificationStatus: ClassificationStatus;
  assignedAccountId?: string;
  assignedTaxCategory?: string;
  aiProposal?: {
    suggestedAccountId: string;
    taxCategory?: string;
    confidence: number;
    reasoning: string;
    isAiProposedOnly: true;
    suggestedAt: string;
  };
  matchedDocumentIds: string[];
  reconciliationStatus: 'UNRECONCILED' | 'CLEARED' | 'RECONCILED';
  reconciliationId?: string;
  journalEntryId?: string;
  reviewedByUid?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReconciliationStatus = 'IN_PROGRESS' | 'BALANCED' | 'RESOLVED' | 'CLOSED';
export type ExceptionType =
  | 'MISSING_TRANSACTION'
  | 'DUPLICATE'
  | 'AMOUNT_MISMATCH'
  | 'DATE_MISMATCH'
  | 'UNMATCHED_STATEMENT_LINE'
  | 'UNEXPLAINED_VARIANCE'
  | 'MISSING_EVIDENCE';

export interface ReconciliationException {
  id: string;
  reconciliationId: string;
  transactionId?: string;
  type: ExceptionType;
  amount: number;
  status: 'OPEN' | 'ASSIGNED' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED' | 'ESCALATED';
  notes?: string;
  assignedToUid?: string;
  resolutionExplanation?: string;
  resolvedByUid?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface BankReconciliation {
  id: string;
  tenantId: string;
  clientId: string;
  accountId: string;
  taxYear: number;
  statementPeriodStart: string;
  statementPeriodEnd: string;
  statementBeginningBalance: number;
  statementEndingBalance: number;
  clearedBalance: number;
  clearedTransactionsCount: number;
  variance: number;
  tolerance: number; // typically 0.00
  status: ReconciliationStatus;
  exceptions: ReconciliationException[];
  completedAt?: string;
  completedByUid?: string;
  createdAt: string;
  updatedAt: string;
}

export type PeriodStatus = 'OPEN' | 'SOFT_CLOSED' | 'HARD_CLOSED';

export interface AccountingPeriod {
  id: string;
  tenantId: string;
  clientId: string;
  taxYear: number;
  periodName: string; // e.g. '2025-Q1' or '2025-01'
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  closedByUid?: string;
  closedAt?: string;
  reopenedByUid?: string;
  reopenedAt?: string;
  reopenReason?: string;
}

export interface TrialBalanceItem {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: AccountType;
  beginningDebit: number;
  beginningCredit: number;
  periodDebit: number;
  periodCredit: number;
  endingDebit: number;
  endingCredit: number;
}

export interface TrialBalanceReport {
  tenantId: string;
  clientId: string;
  taxYear: number;
  periodId?: string;
  generatedAt: string;
  items: TrialBalanceItem[];
  totalBeginningDebit: number;
  totalBeginningCredit: number;
  totalPeriodDebit: number;
  totalPeriodCredit: number;
  totalEndingDebit: number;
  totalEndingCredit: number;
  isBalanced: boolean;
}

export interface FinancialStatements {
  profitAndLoss: {
    grossRevenue: number;
    costOfGoodsSold: number;
    grossProfit: number;
    operatingExpenses: { accountName: string; amount: number }[];
    totalOperatingExpenses: number;
    operatingIncome: number;
    otherIncomeAndExpenses: number;
    netIncome: number;
  };
  balanceSheet: {
    assets: {
      currentAssets: { accountName: string; amount: number }[];
      totalCurrentAssets: number;
      fixedAssets: { accountName: string; amount: number }[];
      totalFixedAssets: number;
      totalAssets: number;
    };
    liabilities: {
      currentLiabilities: { accountName: string; amount: number }[];
      totalCurrentLiabilities: number;
      longTermLiabilities: { accountName: string; amount: number }[];
      totalLongTermLiabilities: number;
      totalLiabilities: number;
    };
    equity: {
      items: { accountName: string; amount: number }[];
      netIncomeCurrentPeriod: number;
      totalEquity: number;
    };
    isBalanced: boolean; // Assets === Liabilities + Equity
  };
}

export interface BookToTaxAdjustment {
  id: string;
  tenantId: string;
  clientId: string;
  taxYear: number;
  accountId: string;
  accountName: string;
  description: string;
  bookAmount: number;
  taxAmount: number;
  adjustmentAmount: number; // taxAmount - bookAmount
  permanentOrTiming: 'PERMANENT' | 'TIMING';
  scheduleM1Category:
    | 'MEALS_50_LIMIT'
    | 'NON_DEDUCTIBLE_PENALTIES'
    | 'TAX_EXEMPT_INTEREST'
    | 'DEPRECIATION_DIFFERENCE'
    | 'MUNICIPAL_BOND_INCOME'
    | 'POLITICAL_CONTRIBUTIONS'
    | 'OTHER_M1_ADDITION'
    | 'OTHER_M1_SUBTRACTION';
  taxAuthorityCitation: string;
  preparerUid: string;
  reviewerUid?: string;
  reviewStatus: 'DRAFT' | 'PREPARED' | 'REVIEWED' | 'APPROVED';
  createdAt: string;
  updatedAt: string;
}

export type SyncConflictState =
  | 'NO_CONFLICT'
  | 'TAXGUARD_CHANGED'
  | 'PROVIDER_CHANGED'
  | 'BOTH_CHANGED'
  | 'MANUAL_RESOLUTION_REQUIRED';

export interface AccountingSyncState {
  provider: 'QUICKBOOKS' | 'XERO';
  tenantId: string;
  clientId: string;
  isConnected: boolean;
  isReadOnly: boolean;
  lastSyncAt?: string;
  conflictState: SyncConflictState;
  writeAuthorization: {
    clientAuthorized: boolean;
    accountantPrepared: boolean;
    reviewerApproved: boolean;
    explicitlyConfirmed: boolean;
    confirmationPhrase?: string;
  };
  syncedAccountsCount: number;
  syncedTransactionsCount: number;
  unresolvedConflictsCount: number;
}
