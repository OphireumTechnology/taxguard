export class BookkeepingRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = 'BookkeepingRequestError';
    this.status = status;
    this.code = code;
  }
}

export interface ChartOfAccountItem {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  balanceCents: number;
  isActive?: boolean;
}

export interface JournalEntryLineItem {
  accountId: string;
  debit: number;
  credit: number;
}

export interface JournalEntryItem {
  id: string;
  entryId?: string;
  source?: string;
  entryNumber: string;
  postingDate: string;
  description: string;
  totalDebit: number;
  totalCredit: number;
  status: 'PREPARED' | 'POSTED' | 'REJECTED' | 'CORRECTION_REQUIRED';
  creatorUid: string;
  version: number;
  reversedByEntryId?: string;
  reversalOfEntryId?: string;
  replacesEntryId?: string;
  reviewNote?: string;
  lines: JournalEntryLineItem[];
  [key: string]: any;
}

export interface BankTransactionItem {
  id?: string;
  transactionId: string;
  accountId: string;
  transactionDate: string;
  description: string;
  amount?: number;
  amountCents: number;
  aiProposal?: any;
  classificationStatus?: string;
  duplicateStatus?: 'POSSIBLE_DUPLICATE' | 'NONE';
  category?: string;
  [key: string]: any;
}

export interface AccountingPeriodItem {
  id: string;
  periodName: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'SOFT_CLOSED' | 'HARD_CLOSED';
  preparedEntries?: number;
  uncategorizedTransactions?: number;
}

export interface GeneralLedgerLine {
  entryId: string;
  entryNumber: string;
  postingDate: string;
  description: string;
  debit?: number;
  credit?: number;
  runningBalance: number;
}

export interface GeneralLedgerAccountItem {
  accountId: string;
  accountNumber: string;
  accountName: string;
  endingBalance: number;
  lines: GeneralLedgerLine[];
}

export interface LedgerHistoryEvent {
  action: string;
  actorUid: string;
  actorRole?: string;
  at: string;
}

export interface TrialBalanceReportItem {
  trialBalance: {
    isBalanced: boolean;
    totalDebit?: number;
    totalCredit?: number;
    totalEndingDebit?: number;
    totalEndingCredit?: number;
    lines?: Array<{
      accountNumber: string;
      accountName: string;
      debit: number;
      credit: number;
    }>;
    items?: any[];
    [key: string]: any;
  };
}

export interface FinancialStatementsData {
  statements?: {
    profitAndLoss: {
      netIncome: number;
      revenue: number;
      expenses: number;
    };
    balanceSheet: {
      assets: {
        totalAssets: number;
      };
      liabilities: {
        totalLiabilities: number;
      };
      equity: {
        totalEquity: number;
      };
    };
  };
  profitAndLoss?: any;
  balanceSheet?: any;
  [key: string]: any;
}

export interface LedgerWorkQueue {
  uncategorized: BankTransactionItem[];
  awaitingReview: JournalEntryItem[];
  returnedToMe: JournalEntryItem[];
  openReconciliations: Array<{
    reconciliationId: string;
    accountId: string;
    statementStart: string;
    statementEnd: string;
    clearedCount: number;
    varianceCents: number;
  }>;
  periods: Array<{
    periodId: string;
    periodName: string;
    startDate: string;
    endDate: string;
    status: string;
    preparedEntries: number;
    uncategorizedTransactions: number;
  }>;
  possibleDuplicates?: number;
}

export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  balance: number;
}

export interface LedgerTransaction {
  id: string;
  date: string;
  description: string;
  accountCode: string;
  debit: number;
  credit: number;
  status: string;
}

let keyCounter = 1000;

export const bookkeepingService = {
  newIdempotencyKey(): string {
    return `idem_${Date.now()}_${++keyCounter}_${Math.random().toString(36).substring(2, 9)}`;
  },

  async getWorkQueue(clientId: string, taxYear: number): Promise<LedgerWorkQueue> {
    return {
      uncategorized: [
        {
          transactionId: 'tx_01',
          accountId: 'acc_1010',
          transactionDate: `${taxYear}-03-15`,
          description: 'Client Wire Deposit - Tech Consulting',
          amountCents: 1540000,
          duplicateStatus: 'NONE'
        },
        {
          transactionId: 'tx_02',
          accountId: 'acc_1010',
          transactionDate: `${taxYear}-03-18`,
          description: 'Cloud Infrastructure Hosting AWS',
          amountCents: -128500,
          duplicateStatus: 'POSSIBLE_DUPLICATE'
        }
      ],
      awaitingReview: [
        {
          id: 'je_101',
          entryNumber: 'JE-0042',
          postingDate: `${taxYear}-03-31`,
          description: 'Quarterly Prepaid Insurance Amortization',
          totalDebit: 3250.00,
          totalCredit: 3250.00,
          status: 'PREPARED',
          creatorUid: 'staff_bookkeeper',
          version: 1,
          lines: [
            { accountId: 'acc_6020', debit: 3250, credit: 0 },
            { accountId: 'acc_1300', debit: 0, credit: 3250 }
          ]
        }
      ],
      returnedToMe: [],
      openReconciliations: [
        {
          reconciliationId: 'recon_01',
          accountId: 'acc_1010',
          statementStart: `${taxYear}-01-01`,
          statementEnd: `${taxYear}-03-31`,
          clearedCount: 48,
          varianceCents: 0
        }
      ],
      periods: [
        {
          periodId: 'per_q1',
          periodName: `${taxYear}-Q1`,
          startDate: `${taxYear}-01-01`,
          endDate: `${taxYear}-03-31`,
          status: 'OPEN',
          preparedEntries: 1,
          uncategorizedTransactions: 2
        }
      ],
      possibleDuplicates: 1
    };
  },

  async getChartOfAccounts(clientId: string, taxYear: number): Promise<{ accounts: ChartOfAccountItem[] }> {
    return {
      accounts: [
        { id: 'acc_1010', accountNumber: '1010', accountName: 'Operating Cash Account', accountType: 'ASSET', balanceCents: 48250000, isActive: true },
        { id: 'acc_1020', accountNumber: '1020', accountName: 'Payroll Reserve Account', accountType: 'ASSET', balanceCents: 12500000, isActive: true },
        { id: 'acc_1200', accountNumber: '1200', accountName: 'Accounts Receivable', accountType: 'ASSET', balanceCents: 8520000, isActive: true },
        { id: 'acc_1300', accountNumber: '1300', accountName: 'Prepaid Expenses', accountType: 'ASSET', balanceCents: 975000, isActive: true },
        { id: 'acc_2010', accountNumber: '2010', accountName: 'Accounts Payable', accountType: 'LIABILITY', balanceCents: 3410000, isActive: true },
        { id: 'acc_2200', accountNumber: '2200', accountName: 'Accrued Payroll Taxes', accountType: 'LIABILITY', balanceCents: 1180000, isActive: true },
        { id: 'acc_3010', accountNumber: '3010', accountName: 'Member Equity / Capital', accountType: 'EQUITY', balanceCents: 30000000, isActive: true },
        { id: 'acc_4010', accountNumber: '4010', accountName: 'Tax Advisory & Consulting Revenue', accountType: 'REVENUE', balanceCents: 75000000, isActive: true },
        { id: 'acc_6010', accountNumber: '6010', accountName: 'Software & Technology Services', accountType: 'EXPENSE', balanceCents: 3850000, isActive: true },
        { id: 'acc_6020', accountNumber: '6020', accountName: 'Corporate Insurance', accountType: 'EXPENSE', balanceCents: 650000, isActive: true }
      ]
    };
  },

  async getTrialBalance(clientId: string, taxYear: number): Promise<TrialBalanceReportItem> {
    return {
      trialBalance: {
        isBalanced: true,
        totalDebit: 750000,
        totalCredit: 750000,
        lines: [
          { accountNumber: '1010', accountName: 'Operating Cash Account', debit: 482500, credit: 0 },
          { accountNumber: '1200', accountName: 'Accounts Receivable', debit: 85200, credit: 0 },
          { accountNumber: '2010', accountName: 'Accounts Payable', debit: 0, credit: 34100 },
          { accountNumber: '3010', accountName: 'Member Equity', debit: 0, credit: 300000 },
          { accountNumber: '4010', accountName: 'Service Revenue', debit: 0, credit: 280000 },
          { accountNumber: '6010', accountName: 'Software & Tech', debit: 46400, credit: 0 }
        ]
      }
    };
  },

  async getFinancialStatements(clientId: string, taxYear: number): Promise<FinancialStatementsData> {
    return {
      statements: {
        profitAndLoss: {
          netIncome: 233600,
          revenue: 280000,
          expenses: 46400
        },
        balanceSheet: {
          assets: {
            totalAssets: 567700
          },
          liabilities: {
            totalLiabilities: 34100
          },
          equity: {
            totalEquity: 533600
          }
        }
      }
    };
  },

  async getPeriods(clientId: string, taxYear: number): Promise<{ periods: AccountingPeriodItem[] }> {
    return {
      periods: [
        {
          id: 'per_q1',
          periodName: `${taxYear}-Q1`,
          startDate: `${taxYear}-01-01`,
          endDate: `${taxYear}-03-31`,
          status: 'OPEN',
          preparedEntries: 1,
          uncategorizedTransactions: 2
        },
        {
          id: 'per_q2',
          periodName: `${taxYear}-Q2`,
          startDate: `${taxYear}-04-01`,
          endDate: `${taxYear}-06-30`,
          status: 'OPEN',
          preparedEntries: 0,
          uncategorizedTransactions: 0
        }
      ]
    };
  },

  async openPeriod(clientId: string, taxYear: number, periodName: string, startDate: string, endDate: string): Promise<AccountingPeriodItem> {
    return {
      id: `per_${Date.now()}`,
      periodName,
      startDate,
      endDate,
      status: 'OPEN',
      preparedEntries: 0,
      uncategorizedTransactions: 0
    };
  },

  async closePeriod(clientId: string, taxYear: number, periodId: string, status: 'SOFT_CLOSED' | 'HARD_CLOSED'): Promise<{ success: boolean }> {
    return { success: true };
  },

  async reopenPeriod(clientId: string, taxYear: number, periodId: string, reason: string): Promise<{ success: boolean }> {
    return { success: true };
  },

  async postJournalEntry(clientId: string, taxYear: number, entry: any, idempotencyKey?: string): Promise<{ success: boolean; entryId: string }> {
    return { success: true, entryId: `je_${Date.now()}` };
  },

  async approveJournalEntry(clientId: string, taxYear: number, entryId: string, version: number): Promise<{ success: boolean }> {
    return { success: true };
  },

  async rejectJournalEntry(clientId: string, taxYear: number, entryId: string, note: string, version: number): Promise<{ success: boolean }> {
    return { success: true };
  },

  async requestJournalCorrection(clientId: string, taxYear: number, entryId: string, note: string, version: number): Promise<{ success: boolean }> {
    return { success: true };
  },

  async reverseJournalEntry(clientId: string, taxYear: number, entryId: string, postingDate: string, reason: string, idempotencyKey?: string): Promise<{ success: boolean }> {
    return { success: true };
  },

  async categorize(clientId: string, taxYear: number, transactionId: string, accountId: string): Promise<{ success: boolean }> {
    return { success: true };
  },

  async startReconciliation(clientId: string, taxYear: number, reconData: any): Promise<{ success: boolean; reconciliationId: string }> {
    return { success: true, reconciliationId: `recon_${Date.now()}` };
  },

  async finalizeReconciliation(clientId: string, taxYear: number, reconciliationId: string): Promise<{ success: boolean }> {
    return { success: true };
  },

  async searchJournal(clientId: string, taxYear: number, filter: any): Promise<{ entries: JournalEntryItem[] }> {
    return {
      entries: [
        {
          id: 'je_101',
          entryNumber: 'JE-0042',
          postingDate: `${taxYear}-03-31`,
          description: 'Quarterly Prepaid Insurance Amortization',
          totalDebit: 3250.00,
          totalCredit: 3250.00,
          status: 'POSTED',
          creatorUid: 'staff_bookkeeper',
          version: 2,
          lines: [
            { accountId: 'acc_6020', debit: 3250, credit: 0 },
            { accountId: 'acc_1300', debit: 0, credit: 3250 }
          ]
        }
      ]
    };
  },

  async getGeneralLedger(clientId: string, taxYear: number, accountId?: string): Promise<{ accounts: GeneralLedgerAccountItem[] }> {
    return {
      accounts: [
        {
          accountId: accountId || 'acc_1010',
          accountNumber: '1010',
          accountName: 'Operating Cash Account',
          endingBalance: 482500,
          lines: [
            {
              entryId: 'je_100',
              entryNumber: 'JE-0038',
              postingDate: `${taxYear}-01-15`,
              description: 'Initial Opening Balance Migration',
              debit: 350000,
              runningBalance: 350000
            },
            {
              entryId: 'je_105',
              entryNumber: 'JE-0040',
              postingDate: `${taxYear}-02-28`,
              description: 'Client Retainer Fees Received',
              debit: 132500,
              runningBalance: 482500
            }
          ]
        }
      ]
    };
  },

  async getLedgerHistory(clientId: string, taxYear: number): Promise<{ events: LedgerHistoryEvent[] }> {
    return {
      events: [
        { action: 'LEDGER_ENTRY_POSTED', actorUid: 'reviewer_cpa', actorRole: 'Reviewer', at: new Date().toISOString() },
        { action: 'LEDGER_PERIOD_SOFT_CLOSED', actorUid: 'practice_manager', actorRole: 'Manager', at: new Date(Date.now() - 86400000).toISOString() }
      ]
    };
  },

  // Legacy compatibility helpers
  getLedgerAccounts: async (clientId?: string): Promise<LedgerAccount[]> => [],
  getTransactions: async (_clientId?: string): Promise<any> => Object.assign([], { transactions: [] }),
  reconcileAccount: async (accountId: string): Promise<{ success: boolean }> => ({ success: true }),
  executeReadOnlySync: async (..._args: any[]) => ({ success: true }),
  getJournalEntries: async (_clientId: string, _taxYear: number): Promise<{ entries: JournalEntryItem[] }> => ({ entries: [] }),
  categorizeTransaction: async (..._args: any[]) => ({ success: true })
};
