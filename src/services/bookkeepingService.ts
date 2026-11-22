import { apiRequest, ApiRequestError } from './api';

export class BookkeepingRequestError extends ApiRequestError {}

export interface AccountingPeriodItem {
  id: string;
  label?: string;
  startDate?: string;
  endDate?: string;
  status: string;
  [key: string]: any;
}

export interface BankTransactionItem {
  id: string;
  date: string;
  description: string;
  amountCents?: number;
  amount?: number;
  category?: string;
  status?: string;
  [key: string]: any;
}

export interface ChartOfAccountItem {
  id: string;
  code?: string;
  accountNumber: string;
  name?: string;
  accountName: string;
  type?: string;
  category?: string;
  balanceCents?: number;
  [key: string]: any;
}

export interface GeneralLedgerAccountItem {
  accountId: string;
  code?: string;
  name: string;
  balanceCents?: number;
  entries?: any[];
  [key: string]: any;
}

export interface JournalEntryItem {
  id: string;
  date: string;
  memo?: string;
  status: string;
  lines?: any[];
  [key: string]: any;
}

export interface LedgerHistoryEvent {
  id: string;
  timestamp: string;
  action: string;
  actor?: string;
  details?: string;
  [key: string]: any;
}

export interface LedgerWorkQueue {
  items: any[];
  summary?: Record<string, any>;
  [key: string]: any;
}

export interface TrialBalanceReportItem {
  accountId?: string;
  code: string;
  name: string;
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

export const bookkeepingService: any = new Proxy(
  {
    getAccounts: (clientId: string) => apiRequest(`/api/bookkeeping/${encodeURIComponent(clientId)}/accounts`),
    getJournalEntries: (clientId: string) => apiRequest(`/api/bookkeeping/${encodeURIComponent(clientId)}/journal-entries`),
    getTransactions: (clientId: string) => apiRequest(`/api/bookkeeping/${encodeURIComponent(clientId)}/transactions`),
    getPeriods: (clientId: string) => apiRequest(`/api/bookkeeping/${encodeURIComponent(clientId)}/periods`),
    getWorkQueue: () => apiRequest('/api/bookkeeping/work-queue'),
    getFinancialStatements: (clientId: string, year?: number) =>
      apiRequest(`/api/bookkeeping/${encodeURIComponent(clientId)}/statements${year ? `?year=${year}` : ''}`),
  },
  {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      return async () => apiRequest(`/api/bookkeeping/${prop}`);
    },
  }
);
