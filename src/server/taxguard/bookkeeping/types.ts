export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' | 'COGS' | 'OTHER_INCOME' | 'OTHER_EXPENSE';
export type PeriodStatus = 'OPEN' | 'SOFT_CLOSED' | 'HARD_CLOSED' | 'CLOSED' | 'LOCKED';
export type ClassificationStatus = 'UNCLASSIFIED' | 'SUGGESTED' | 'CLASSIFIED' | 'REVIEWED' | string;
export type DuplicateStatus = 'UNIQUE' | 'NOT_DUPLICATE' | 'POSSIBLE_DUPLICATE' | 'CONFIRMED_DUPLICATE' | 'IGNORED' | string;

export interface ChartOfAccount {
  id: string;
  tenantId: string;
  clientId: string;
  accountNumber: string;
  name?: string;
  accountName?: string;
  accountType: AccountType | string;
  accountSubtype?: string;
  subType?: string;
  normalBalance?: 'DEBIT' | 'CREDIT';
  currency?: string;
  isActive: boolean;
  taxLineMapping?: string;
  taxMapping?: any;
  provenance?: any;
  createdAt: string;
  updatedAt?: string;
}

export interface JournalEntryLine {
  id?: string;
  accountId: string;
  accountNumber?: string;
  accountName?: string;
  debit: number;
  credit: number;
  memo?: string;
  taxCategory?: string;
}

export interface JournalEntry {
  id: string;
  tenantId: string;
  clientId: string;
  taxYear: number;
  periodId?: string;
  entryNumber?: string;
  postingDate: string;
  transactionDate?: string;
  description: string;
  reference?: string;
  source?: 'MANUAL' | 'BANK_FEED' | 'ADJUSTING' | 'REVERSAL' | 'IMPORT' | 'SYSTEM' | string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'POSTED' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'REVERSED' | string;
  isAdjusting?: boolean;
  adjustingType?: string;
  lines: JournalEntryLine[];
  documentIds?: string[];
  createdBy?: string;
  reviewedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface BankTransaction {
  id: string;
  tenantId: string;
  clientId: string;
  accountId: string;
  transactionDate: string;
  postingDate?: string;
  description: string;
  amount: number;
  provider?: string;
  batchId?: string;
  externalTransactionId?: string;
  classificationStatus: ClassificationStatus;
  duplicateStatus: DuplicateStatus;
  journalEntryId?: string;
  cleared?: boolean;
  [key: string]: any;
}

export interface ReconciliationException {
  id: string;
  reconciliationId?: string;
  transactionId?: string;
  type?: string;
  status?: string;
  reason?: string;
  notes?: string;
  resolutionExplanation?: string;
  amount?: number;
  resolved?: boolean;
  [key: string]: any;
}

export interface BankReconciliation {
  id: string;
  tenantId: string;
  clientId: string;
  accountId: string;
  taxYear: number;
  statementStart?: string;
  statementEnd?: string;
  statementPeriodStart?: string;
  statementPeriodEnd?: string;
  beginningBalance?: number;
  endingBalance?: number;
  statementBeginningBalance?: number;
  statementEndingBalance?: number;
  clearedBalance?: number;
  difference?: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FINALIZED' | 'REOPENED' | string;
  clearedTransactionIds?: string[];
  exceptions?: ReconciliationException[];
  [key: string]: any;
}

export interface AccountingPeriod {
  id: string;
  tenantId: string;
  clientId: string;
  taxYear: number;
  name?: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  closedAt?: string;
  closedBy?: string;
  [key: string]: any;
}

export interface BookToTaxAdjustment {
  id: string;
  tenantId: string;
  clientId: string;
  taxYear: number;
  accountId?: string;
  accountName?: string;
  description: string;
  category?: 'PERMANENT' | 'TEMPORARY' | string;
  permanentOrTiming?: 'PERMANENT' | 'TIMING' | string;
  bookAmount?: number;
  taxAmount?: number;
  adjustmentAmount?: number;
  amount?: number;
  scheduleRef?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface TrialBalanceItem {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: AccountType | string;
  beginningDebit: number;
  beginningCredit: number;
  periodDebit: number;
  periodCredit: number;
  endingDebit: number;
  endingCredit: number;
  netBalance?: number;
}

export interface TrialBalanceReport {
  tenantId: string;
  clientId: string;
  taxYear: number;
  asOfDate?: string;
  items: TrialBalanceItem[];
  totalBeginningDebit?: number;
  totalBeginningCredit?: number;
  totalPeriodDebit?: number;
  totalPeriodCredit?: number;
  totalDebit?: number;
  totalCredit?: number;
  totalEndingDebit?: number;
  totalEndingCredit?: number;
  isBalanced: boolean;
  generatedAt: string;
  [key: string]: any;
}

export interface FinancialStatements {
  incomeStatement?: Record<string, any>;
  profitAndLoss?: Record<string, any>;
  balanceSheet: Record<string, any>;
  generatedAt?: string;
  [key: string]: any;
}
