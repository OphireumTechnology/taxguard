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
  replacesEntryId?: string;
  reviewNote?: string;
  version?: number;
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

export interface GeneralLedgerAccountItem {
  accountId: string; accountNumber: string; accountName: string; accountType: string; endingBalance: number;
  lines: Array<{ entryId: string; entryNumber: string; postingDate: string; description: string; debit: number; credit: number; runningBalance: number }>;
}
export interface LedgerHistoryEvent { action: string; actorUid: string; actorRole: string | null; metadata: Record<string, unknown>; at: string }

export interface LedgerWorkQueue {
  actorRole: string;
  uncategorized: Array<{ transactionId: string; accountId: string; transactionDate: string; description: string; amountCents: number; duplicateStatus: string }>;
  possibleDuplicates: number;
  awaitingReview: Array<{ entryId: string; entryNumber: string; postingDate: string; description: string; totalCents: number; creatorUid: string; version: number }>;
  returnedToMe: Array<{ entryId: string; entryNumber: string; description: string; reviewNote: string | null }>;
  openReconciliations: Array<{ reconciliationId: string; accountId: string; statementStart: string; statementEnd: string; varianceCents: number; clearedCount: number; clearedTransactionIds: string[] }>;
  periods: Array<{ periodId: string; periodName: string; startDate: string; endDate: string; status: string; preparedEntries: number; uncategorizedTransactions: number }>;
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
  /**
   * Every bookkeeping request: the same session store and API host as the rest of the application. Nothing is sent
   * without a session, and a response that arrives after a sign-out or account switch is discarded (it belongs to
   * another session), as in the other durable clients.
   */
  private async send(path: string, init: { method?: 'GET' | 'POST'; body?: unknown; idempotencyKey?: string } = {}) {
    const token = getStoredToken();
    if (!token) throw new BookkeepingRequestError('Sign in to use bookkeeping.', 401, 'AUTH_REQUIRED');
    const res = await fetch(apiEndpoint('/api/bookkeeping' + path), {
      method: init.method ?? 'GET', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}) },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
    const data = await res.json().catch(() => null);
    if (getStoredToken() !== token) throw new BookkeepingRequestError('Your session changed. Sign in again.', 409, 'SESSION_CHANGED');
    return { res, data };
  }

  /** A legacy read or action: its own failure message, the server's code kept. */
  private async legacy<T>(path: string, failure: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
    const { res, data } = await this.send(path, init);
    if (!res.ok) throw new BookkeepingRequestError(failure, res.status, typeof data?.code === 'string' ? data.code : undefined);
    return data as T;
  }

  private async mutate<T>(path: string, body: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
    const { res, data } = await this.send(path, { method: 'POST', body, idempotencyKey });
    if (!res.ok) {
      const code = typeof data?.code === 'string' ? data.code : undefined;
      throw new BookkeepingRequestError(typeof data?.error === 'string' ? data.error : 'The bookkeeping service did not accept this request.', res.status, code);
    }
    return data as T;
  }

  categorizeTransaction(clientId: string, taxYear: number, transactionId: string, assignedAccountId: string, notes: string) {
    return this.mutate<{ transaction: BankTransactionItem; journalEntry: JournalEntryItem }>(`/transactions/${encodeURIComponent(transactionId)}/categorize`, { clientId, taxYear, assignedAccountId, notes });
  }
  /** version is the entry's optimistic-concurrency version (required by the durable store). */
  approveJournalEntry(clientId: string, taxYear: number, entryId: string, version?: number) {
    return this.mutate<{ entry: JournalEntryItem }>(`/journal-entries/${encodeURIComponent(entryId)}/approve`, { clientId, taxYear, version });
  }
  rejectJournalEntry(clientId: string, taxYear: number, entryId: string, note: string, version?: number) {
    return this.mutate<{ entry: JournalEntryItem }>(`/journal-entries/${encodeURIComponent(entryId)}/reject`, { clientId, taxYear, note, version });
  }
  requestJournalCorrection(clientId: string, taxYear: number, entryId: string, note: string, version?: number) {
    return this.mutate<{ entry: JournalEntryItem }>(`/journal-entries/${encodeURIComponent(entryId)}/request-correction`, { clientId, taxYear, note, version });
  }
  /** A fresh idempotency key per user action; retries of the same action should reuse it. */
  newIdempotencyKey() { return 'ui-' + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2)); }
  postJournalEntry(clientId: string, taxYear: number, entry: Record<string, unknown>, idempotencyKey = this.newIdempotencyKey()) {
    return this.mutate<{ entry: JournalEntryItem }>('/journal-entries', { clientId, taxYear, ...entry }, idempotencyKey);
  }
  reverseJournalEntry(clientId: string, taxYear: number, entryId: string, postingDate: string, reason: string, idempotencyKey = this.newIdempotencyKey()) {
    return this.mutate<{ entry: JournalEntryItem }>(`/journal-entries/${encodeURIComponent(entryId)}/reverse`, { clientId, taxYear, postingDate, reason }, idempotencyKey);
  }
  bootstrapStandardChart(clientId: string, taxYear: number, formTarget = '1040_SCHED_C') {
    return this.mutate<{ created: number; accounts: ChartOfAccountItem[] }>('/chart-of-accounts/standard', { clientId, taxYear, formTarget });
  }
  setAccountActive(clientId: string, taxYear: number, accountId: string, active: boolean) {
    return this.mutate<{ accountId: string; isActive: boolean }>(`/chart-of-accounts/${encodeURIComponent(accountId)}/status`, { clientId, taxYear, active });
  }
  private async read<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
    const query = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== ''));
    return this.legacy<T>(`${path}?${query.toString()}`, 'The bookkeeping service could not load this view.');
  }
  searchJournal(clientId: string, taxYear: number, filter: { q?: string; status?: string; fromDate?: string; toDate?: string; accountId?: string }) {
    return this.read<{ entries: JournalEntryItem[] }>('/journal-entries', { clientId, taxYear: String(taxYear), ...filter });
  }
  getGeneralLedger(clientId: string, taxYear: number, accountId?: string) {
    return this.read<{ accounts: GeneralLedgerAccountItem[] }>('/general-ledger', { clientId, taxYear: String(taxYear), accountId });
  }
  getWorkQueue(clientId: string, taxYear: number) {
    return this.read<LedgerWorkQueue>('/work-queue', { clientId, taxYear: String(taxYear) });
  }
  categorize(clientId: string, taxYear: number, transactionId: string, assignedAccountId: string) {
    return this.mutate<{ journalEntry: JournalEntryItem }>(`/transactions/${encodeURIComponent(transactionId)}/categorize`, { clientId, taxYear, assignedAccountId });
  }
  startReconciliation(clientId: string, taxYear: number, r: { accountId: string; statementPeriodStart: string; statementPeriodEnd: string; statementBeginningBalance: string; statementEndingBalance: string }) {
    return this.mutate('/reconciliations/start', { clientId, taxYear, ...r, statementBeginningBalance: Number(r.statementBeginningBalance), statementEndingBalance: Number(r.statementEndingBalance) });
  }
  clearReconciliationItem(clientId: string, taxYear: number, reconciliationId: string, transactionId: string, isCleared: boolean) {
    return this.mutate(`/reconciliations/${encodeURIComponent(reconciliationId)}/clear`, { clientId, taxYear, transactionId, isCleared });
  }
  finalizeReconciliation(clientId: string, taxYear: number, reconciliationId: string) {
    return this.mutate(`/reconciliations/${encodeURIComponent(reconciliationId)}/finalize`, { clientId, taxYear });
  }
  getLedgerHistory(clientId: string, taxYear: number) {
    return this.read<{ events: LedgerHistoryEvent[] }>('/history', { clientId, taxYear: String(taxYear) });
  }
  getPeriods(clientId: string, taxYear: number): Promise<{ periods: AccountingPeriodItem[] }> {
    const params = new URLSearchParams({ clientId, taxYear: String(taxYear) });
    return this.legacy(`/periods?${params.toString()}`, 'Failed to load accounting periods');
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

  private scopeQuery(clientId?: string, taxYear?: number, accountId?: string) {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (taxYear) params.set('taxYear', String(taxYear));
    if (accountId) params.set('accountId', accountId);
    return params.toString();
  }

  getChartOfAccounts(clientId?: string, taxYear?: number): Promise<{ accounts: ChartOfAccountItem[] }> {
    return this.legacy(`/chart-of-accounts?${this.scopeQuery(clientId, taxYear)}`, 'Failed to load chart of accounts');
  }

  getJournalEntries(clientId?: string, taxYear?: number): Promise<{ entries: JournalEntryItem[] }> {
    return this.legacy(`/journal-entries?${this.scopeQuery(clientId, taxYear)}`, 'Failed to load journal entries');
  }

  getTransactions(clientId?: string, accountId?: string): Promise<{ transactions: BankTransactionItem[] }> {
    return this.legacy(`/transactions?${this.scopeQuery(clientId, undefined, accountId)}`, 'Failed to load bank transactions');
  }

  getTrialBalance(clientId?: string, taxYear?: number): Promise<{ trialBalance: { items: TrialBalanceReportItem[]; isBalanced: boolean; totalEndingDebit: number; totalEndingCredit: number } }> {
    return this.legacy(`/trial-balance?${this.scopeQuery(clientId, taxYear)}`, 'Failed to load trial balance');
  }

  getFinancialStatements(clientId?: string, taxYear?: number): Promise<{ statements: FinancialStatementsData }> {
    return this.legacy(`/financial-statements?${this.scopeQuery(clientId, taxYear)}`, 'Failed to load financial statements');
  }

  matchDocument(transactionId: string, documentId: string): Promise<any> {
    return this.legacy(`/transactions/${encodeURIComponent(transactionId)}/match-document`, 'Failed to match document', { method: 'POST', body: { documentId } });
  }

  /**
   * Read-only accounting sync. The server answers success: false when the provider is not commissioned; that is a
   * refusal, not a completed sync, so it is reported as one.
   */
  async executeReadOnlySync(provider: 'QUICKBOOKS' | 'XERO', clientId?: string): Promise<{ success: true; provider: string; syncedAccounts: number; syncedTransactions: number; readOnly: true }> {
    const data = await this.legacy<any>('/sync/read-only', 'The accounting sync did not complete.', { method: 'POST', body: { provider, clientId, idempotencyKey: `sync_${Date.now()}` } });
    if (data?.success !== true) throw new BookkeepingRequestError(`${provider} is not connected; nothing was synchronized.`, 503, 'SYNC_PROVIDER_NOT_COMMISSIONED');
    return data;
  }
}

export const bookkeepingService = new BookkeepingService();
