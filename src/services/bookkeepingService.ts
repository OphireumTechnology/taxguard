/**
 * Client-Side Bookkeeping Service
 * Front-end adapter for the TaxGuard Bookkeeping & Accounting REST API.
 */

import { api, getStoredToken } from './api';
import { apiEndpoint } from '../config/apiEndpoint';

export interface ChartOfAccountItem {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  accountSubtype: string;
  currency: string;
  isActive: boolean;
  taxMapping?: {
    formTarget: string;
    taxLineCode: string;
    taxLineDescription: string;
    isSubjectToLimitation?: boolean;
    limitationPercentage?: number;
  };
}

export interface JournalEntryItem {
  id: string;
  entryNumber: string;
  postingDate: string;
  transactionDate: string;
  description: string;
  reference?: string;
  source: string;
  isAdjusting: boolean;
  adjustingType?: string;
  totalDebit: number;
  totalCredit: number;
  status: string;
  creatorUid: string;
  reviewerUid?: string;
  reversalOfEntryId?: string;
  reversedByEntryId?: string;
  lines: Array<{
    id: string;
    accountId: string;
    accountNumber?: string;
    accountName?: string;
    debit: number;
    credit: number;
    memo?: string;
    taxCategory?: string;
  }>;
}

export interface BankTransactionItem {
  id: string;
  accountId: string;
  transactionDate: string;
  description: string;
  amount: number;
  duplicateStatus: 'NOT_DUPLICATE' | 'POSSIBLE_DUPLICATE' | 'CONFIRMED_DUPLICATE';
  classificationStatus: string;
  assignedAccountId?: string;
  reconciliationStatus: string;
  matchedDocumentIds: string[];
  aiProposal?: {
    suggestedAccountId: string;
    confidence: number;
    reasoning: string;
    isAiProposedOnly: true;
  };
}

export interface TrialBalanceReportItem {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  periodDebit: number;
  periodCredit: number;
  endingDebit: number;
  endingCredit: number;
}

export interface FinancialStatementsData {
  profitAndLoss: {
    grossRevenue: number;
    costOfGoodsSold: number;
    grossProfit: number;
    operatingExpenses: Array<{ accountName: string; amount: number }>;
    totalOperatingExpenses: number;
    operatingIncome: number;
    otherIncomeAndExpenses: number;
    netIncome: number;
  };
  balanceSheet: {
    assets: {
      totalCurrentAssets: number;
      totalFixedAssets: number;
      totalAssets: number;
    };
    liabilities: {
      totalCurrentLiabilities: number;
      totalLongTermLiabilities: number;
      totalLiabilities: number;
    };
    equity: {
      totalEquity: number;
      netIncomeCurrentPeriod: number;
    };
    isBalanced: boolean;
  };
}

export interface AccountingPeriodItem {
  id: string;
  periodName: string;
  taxYear: number;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'SOFT_CLOSED' | 'HARD_CLOSED';
  closedByUid?: string;
  closedAt?: string;
  reopenedByUid?: string;
  reopenedAt?: string;
  reopenReason?: string;
}

/** Server refusal with its machine-readable code (for example PERIOD_HAS_UNAPPROVED_ENTRIES). */
export class BookkeepingRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) { super(message); }
}

class BookkeepingService {
  // Same session store and API host as the rest of the application.
  private getHeaders() {
    const token = getStoredToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async mutate<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(apiEndpoint('/api/bookkeeping' + path), { method: 'POST', headers: this.getHeaders(), cache: 'no-store', body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const code = typeof data?.code === 'string' ? data.code : undefined;
      throw new BookkeepingRequestError(typeof data?.error === 'string' ? data.error : 'The bookkeeping service did not accept this request.', res.status, code);
    }
    return data as T;
  }

  categorizeTransaction(clientId: string, taxYear: number, transactionId: string, assignedAccountId: string, notes: string) {
    return this.mutate<{ transaction: BankTransactionItem; journalEntry: JournalEntryItem }>(`/transactions/${encodeURIComponent(transactionId)}/categorize`, { clientId, taxYear, assignedAccountId, notes });
  }
  approveJournalEntry(clientId: string, taxYear: number, entryId: string) {
    return this.mutate<{ entry: JournalEntryItem }>(`/journal-entries/${encodeURIComponent(entryId)}/approve`, { clientId, taxYear });
  }
  reverseJournalEntry(clientId: string, taxYear: number, entryId: string, postingDate: string, reason: string) {
    return this.mutate<{ entry: JournalEntryItem }>(`/journal-entries/${encodeURIComponent(entryId)}/reverse`, { clientId, taxYear, postingDate, reason });
  }
  async getPeriods(clientId: string, taxYear: number): Promise<{ periods: AccountingPeriodItem[] }> {
    const params = new URLSearchParams({ clientId, taxYear: String(taxYear) });
    const res = await fetch(apiEndpoint(`/api/bookkeeping/periods?${params.toString()}`), { headers: this.getHeaders(), cache: 'no-store' });
    if (!res.ok) throw new BookkeepingRequestError('Failed to load accounting periods', res.status);
    return res.json();
  }
  openPeriod(clientId: string, taxYear: number, periodName: string, startDate: string, endDate: string) {
    return this.mutate<{ period: AccountingPeriodItem }>('/periods', { clientId, taxYear, periodName, startDate, endDate });
  }
  closePeriod(clientId: string, taxYear: number, periodId: string, status: 'SOFT_CLOSED' | 'HARD_CLOSED') {
    return this.mutate<{ period: AccountingPeriodItem }>(`/periods/${encodeURIComponent(periodId)}/close`, { clientId, taxYear, status });
  }
  reopenPeriod(clientId: string, taxYear: number, periodId: string, reason: string) {
    return this.mutate<{ period: AccountingPeriodItem }>(`/periods/${encodeURIComponent(periodId)}/reopen`, { clientId, taxYear, reason });
  }

  async getChartOfAccounts(clientId?: string, taxYear?: number): Promise<{ accounts: ChartOfAccountItem[] }> {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (taxYear) params.set('taxYear', String(taxYear));

    const res = await fetch(apiEndpoint(`/api/bookkeeping/chart-of-accounts?${params.toString()}`), {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load chart of accounts');
    return res.json();
  }

  async getJournalEntries(clientId?: string, taxYear?: number): Promise<{ entries: JournalEntryItem[] }> {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (taxYear) params.set('taxYear', String(taxYear));

    const res = await fetch(apiEndpoint(`/api/bookkeeping/journal-entries?${params.toString()}`), {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load journal entries');
    return res.json();
  }

  async getTransactions(clientId?: string, accountId?: string): Promise<{ transactions: BankTransactionItem[] }> {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (accountId) params.set('accountId', accountId);

    const res = await fetch(apiEndpoint(`/api/bookkeeping/transactions?${params.toString()}`), {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load bank transactions');
    return res.json();
  }

  async getTrialBalance(clientId?: string, taxYear?: number): Promise<{ trialBalance: { items: TrialBalanceReportItem[]; isBalanced: boolean; totalEndingDebit: number; totalEndingCredit: number } }> {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (taxYear) params.set('taxYear', String(taxYear));

    const res = await fetch(apiEndpoint(`/api/bookkeeping/trial-balance?${params.toString()}`), {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load trial balance');
    return res.json();
  }

  async getFinancialStatements(clientId?: string, taxYear?: number): Promise<{ statements: FinancialStatementsData }> {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (taxYear) params.set('taxYear', String(taxYear));

    const res = await fetch(apiEndpoint(`/api/bookkeeping/financial-statements?${params.toString()}`), {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load financial statements');
    return res.json();
  }

  async matchDocument(transactionId: string, documentId: string): Promise<any> {
    const res = await fetch(apiEndpoint(`/api/bookkeeping/transactions/${transactionId}/match-document`), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ documentId }),
    });
    if (!res.ok) throw new Error('Failed to match document');
    return res.json();
  }

  async executeReadOnlySync(provider: 'QUICKBOOKS' | 'XERO', clientId?: string): Promise<any> {
    const res = await fetch(apiEndpoint('/api/bookkeeping/sync/read-only'), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ provider, clientId, idempotencyKey: `sync_${Date.now()}` }),
    });
    return res.json();
  }
}

export const bookkeepingService = new BookkeepingService();
