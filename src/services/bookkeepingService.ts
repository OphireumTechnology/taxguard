import { api } from './api';

export interface AccountingPeriodItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  [key: string]: any;
}

export interface ChartOfAccountItem {
  id: string;
  accountNumber: string;
  accountName: string;
  code?: string;
  name?: string;
  type?: string;
  active?: boolean;
  balanceCents?: number;
  [key: string]: any;
}

export interface GeneralLedgerAccountItem extends ChartOfAccountItem {
  entries?: any[];
}

export interface JournalEntryItem {
  id: string;
  entryNumber?: string;
  date: string;
  description: string;
  status: string;
  lines: any[];
  [key: string]: any;
}

export interface BankTransactionItem {
  id: string;
  date: string;
  description: string;
  amountCents?: number;
  amount?: number;
  status: string;
  [key: string]: any;
}

export interface TrialBalanceReportItem {
  accountId: string;
  accountCode?: string;
  accountName: string;
  debitCents: number;
  creditCents: number;
  [key: string]: any;
}

export interface FinancialStatementsData {
  incomeStatement?: any;
  balanceSheet?: any;
  trialBalance?: TrialBalanceReportItem[];
  [key: string]: any;
}

export interface LedgerHistoryEvent {
  id: string;
  action: string;
  actor?: string;
  timestamp: string;
  details?: string;
  [key: string]: any;
}

export interface LedgerWorkQueue {
  pendingJournals: JournalEntryItem[];
  openPeriods: AccountingPeriodItem[];
  [key: string]: any;
}

export class BookkeepingRequestError extends Error {
  constructor(public readonly code: string, message?: string, public readonly status?: number) {
    super(message || code);
    this.name = 'BookkeepingRequestError';
  }
}

export const bookkeepingService: any = {
  getAccounts: (clientId: string, signal?: AbortSignal) =>
    api.request(`/api/bookkeeping/${encodeURIComponent(clientId)}/accounts`, { signal }),
  getPeriods: (clientId: string, taxYear: number, signal?: AbortSignal) =>
    api.request(`/api/bookkeeping/${encodeURIComponent(clientId)}/periods`, { query: { taxYear }, signal }),
  getJournals: (clientId: string, taxYear: number, signal?: AbortSignal) =>
    api.request(`/api/bookkeeping/${encodeURIComponent(clientId)}/journals`, { query: { taxYear }, signal }),
  getTransactions: (clientId: string, taxYear: number, signal?: AbortSignal) =>
    api.request(`/api/bookkeeping/${encodeURIComponent(clientId)}/transactions`, { query: { taxYear }, signal }),
  getReports: (clientId: string, taxYear: number, signal?: AbortSignal) =>
    api.request(`/api/bookkeeping/${encodeURIComponent(clientId)}/reports`, { query: { taxYear }, signal }),
  getHistory: (clientId: string, taxYear: number, signal?: AbortSignal) =>
    api.request(`/api/bookkeeping/${encodeURIComponent(clientId)}/history`, { query: { taxYear }, signal }),
  getWorkQueue: (signal?: AbortSignal) => api.request('/api/bookkeeping/work-queue', { signal }),
  createJournal: (clientId: string, payload: Record<string, any>) =>
    api.request(`/api/bookkeeping/${encodeURIComponent(clientId)}/journals`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  closePeriod: (clientId: string, periodId: string) =>
    api.request(`/api/bookkeeping/${encodeURIComponent(clientId)}/periods/${encodeURIComponent(periodId)}/close`, {
      method: 'POST',
    }),
};
