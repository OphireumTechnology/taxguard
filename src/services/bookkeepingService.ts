/**
 * Client-Side Bookkeeping Service
 * Front-end adapter for the TaxGuard Bookkeeping & Accounting REST API.
 */

import { api } from './api';

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

class BookkeepingService {
  private getHeaders() {
    const token = localStorage.getItem('artax_session_token') || localStorage.getItem('supabase_auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-session-token'] = token;
    }
    return headers;
  }

  async getChartOfAccounts(clientId?: string, taxYear?: number): Promise<{ accounts: ChartOfAccountItem[] }> {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (taxYear) params.set('taxYear', String(taxYear));

    const res = await fetch(`/api/bookkeeping/chart-of-accounts?${params.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load chart of accounts');
    return res.json();
  }

  async getJournalEntries(clientId?: string, taxYear?: number): Promise<{ entries: JournalEntryItem[] }> {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (taxYear) params.set('taxYear', String(taxYear));

    const res = await fetch(`/api/bookkeeping/journal-entries?${params.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load journal entries');
    return res.json();
  }

  async getTransactions(clientId?: string, accountId?: string): Promise<{ transactions: BankTransactionItem[] }> {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (accountId) params.set('accountId', accountId);

    const res = await fetch(`/api/bookkeeping/transactions?${params.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load bank transactions');
    return res.json();
  }

  async getTrialBalance(clientId?: string, taxYear?: number): Promise<{ trialBalance: { items: TrialBalanceReportItem[]; isBalanced: boolean; totalEndingDebit: number; totalEndingCredit: number } }> {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (taxYear) params.set('taxYear', String(taxYear));

    const res = await fetch(`/api/bookkeeping/trial-balance?${params.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load trial balance');
    return res.json();
  }

  async getFinancialStatements(clientId?: string, taxYear?: number): Promise<{ statements: FinancialStatementsData }> {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (taxYear) params.set('taxYear', String(taxYear));

    const res = await fetch(`/api/bookkeeping/financial-statements?${params.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load financial statements');
    return res.json();
  }

  async matchDocument(transactionId: string, documentId: string): Promise<any> {
    const res = await fetch(`/api/bookkeeping/transactions/${transactionId}/match-document`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ documentId }),
    });
    if (!res.ok) throw new Error('Failed to match document');
    return res.json();
  }

  async executeReadOnlySync(provider: 'QUICKBOOKS' | 'XERO', clientId?: string): Promise<any> {
    const res = await fetch('/api/bookkeeping/sync/read-only', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ provider, clientId, idempotencyKey: `sync_${Date.now()}` }),
    });
    return res.json();
  }
}

export const bookkeepingService = new BookkeepingService();
