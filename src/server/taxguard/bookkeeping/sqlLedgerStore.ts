/**
 * Durable ledger store over the proposal-024 service RPCs (Supabase service client in
 * deployment; PGlite in isolated tests). Converts between the API's dollar amounts and the
 * database's integer cents, and maps database refusals to coded errors.
 */
import { createHash } from 'node:crypto';
import type { AccountingPeriod, BankReconciliation, BankTransaction, ChartOfAccount, JournalEntry, TrialBalanceReport, FinancialStatements } from './types';
import { financialStatements, generalLedger, trialBalanceReport, type GeneralLedgerAccount, type TrialBalanceRow } from './ledgerReports';

export interface LedgerRpcClient { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: any; error: { code?: string; message?: string } | null }> }
export interface LedgerScope { tenantId: string; clientId: string }
export type LedgerReviewDecision = 'approve' | 'reject' | 'request_correction';

export class LedgerStoreError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}
const STATUS: Record<string, number> = {
  LEDGER_ACCESS_DENIED: 403, LEDGER_REVIEWER_REQUIRED: 403, MAKER_CHECKER_VIOLATION: 403,
  LEDGER_VERSION_CONFLICT: 409, LEDGER_CONCURRENT_UPDATE: 409, LEDGER_IDEMPOTENCY_CONFLICT: 409, LEDGER_BUSY: 409,
};
const statusOf = (code: string) => STATUS[code] ?? (code.endsWith('_NOT_FOUND') ? 404 : 400);

/** Whole, non-negative cents from a dollar amount; fractional cents are refused, never rounded. */
export function toCents(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e12) throw new LedgerStoreError('INVALID_AMOUNT', 400);
  const cents = Math.round(value * 100);
  if (Math.abs(cents - value * 100) > 1e-6) throw new LedgerStoreError('INVALID_AMOUNT', 400);
  return cents;
}
function signedCents(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new LedgerStoreError('INVALID_AMOUNT', 400);
  return (value < 0 ? -1 : 1) * toCents(Math.abs(value));
}
const canonical = (value: unknown): string => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
  : value && typeof value === 'object' ? '{' + Object.keys(value).sort().filter(k => (value as any)[k] !== undefined).map(k => JSON.stringify(k) + ':' + canonical((value as any)[k])).join(',') + '}'
  : JSON.stringify(value ?? null);
export const requestHash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
const date = (value: unknown) => typeof value === 'string' ? value.slice(0, 10) : value as string;
const iso = (value: unknown) => typeof value === 'string' ? new Date(value).toISOString() : undefined;

export interface PostEntryInput {
  idempotencyKey: string; taxYear: number; periodId?: string; postingDate: string; transactionDate?: string; description: string; reference?: string;
  source?: JournalEntry['source']; isAdjusting?: boolean; adjustingType?: JournalEntry['adjustingType'];
  lines: Array<{ accountId: string; debit: number; credit: number; memo?: string; taxCategory?: string }>; documentIds?: string[]; replacesEntryId?: string;
}
export type DurableJournalEntry = JournalEntry & { version: number; reviewNote?: string; replacesEntryId?: string; replayed?: boolean };

export class SqlLedgerStore {
  constructor(private readonly client: LedgerRpcClient) {}

  private async call<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    let response;
    try { response = await this.client.rpc(name, args); } catch { throw new LedgerStoreError('LEDGER_STORE_UNAVAILABLE', 503); }
    if (response?.error) {
      const { code, message } = response.error;
      if (code === '55P03' || code === '40001' || code === '40P01') throw new LedgerStoreError('LEDGER_BUSY', 409);
      if (code === 'P0001' && typeof message === 'string' && /^[A-Z_]{3,64}$/.test(message)) throw new LedgerStoreError(message, statusOf(message));
      throw new LedgerStoreError('LEDGER_STORE_UNAVAILABLE', 503);
    }
    return response?.data as T;
  }
  private base(scope: LedgerScope, actor: string) { return { p_tenant: scope.tenantId, p_client: scope.clientId, p_actor: actor }; }

  // ---------------- mapping ----------------
  private account(scope: LedgerScope, a: any): ChartOfAccount {
    return { id: a.accountId, tenantId: scope.tenantId, clientId: scope.clientId, accountNumber: a.accountNumber, accountName: a.accountName,
      accountType: a.accountType, accountSubtype: a.accountSubtype, currency: 'USD', isActive: a.isActive, ...(a.taxMapping ? { taxMapping: a.taxMapping } : {}),
      createdAt: iso(a.createdAt)!, updatedAt: iso(a.updatedAt)!, provenance: { source: a.source, creatorUid: a.createdBy } };
  }
  entry(scope: LedgerScope, e: any): DurableJournalEntry {
    const total = Number(e.totalCents) / 100;
    return { id: e.entryId, tenantId: scope.tenantId, clientId: scope.clientId, taxYear: e.taxYear, periodId: e.periodId ?? '', entryNumber: e.entryNumber,
      postingDate: date(e.postingDate), transactionDate: date(e.transactionDate), description: e.description, ...(e.reference ? { reference: e.reference } : {}),
      source: e.source, isAdjusting: e.isAdjusting, ...(e.adjustingType ? { adjustingType: e.adjustingType } : {}),
      lines: (e.lines || []).map((l: any) => ({ id: `${e.entryId}:${l.lineNo}`, accountId: l.accountId, accountNumber: l.accountNumber, accountName: l.accountName,
        debit: Number(l.debitCents) / 100, credit: Number(l.creditCents) / 100, ...(l.memo ? { memo: l.memo } : {}), ...(l.taxCategory ? { taxCategory: l.taxCategory } : {}) })),
      totalDebit: total, totalCredit: total, status: e.status, creatorUid: e.creatorUid, ...(e.reviewerUid ? { reviewerUid: e.reviewerUid } : {}),
      createdAt: iso(e.createdAt)!, ...(e.postedAt ? { postedAt: iso(e.postedAt) } : {}), documentProvenanceIds: e.documentIds || [],
      ...(e.reversalOfEntryId ? { reversalOfEntryId: e.reversalOfEntryId } : {}), ...(e.reversedByEntryId ? { reversedByEntryId: e.reversedByEntryId } : {}),
      ...(e.replacesEntryId ? { replacesEntryId: e.replacesEntryId } : {}), ...(e.reviewNote ? { reviewNote: e.reviewNote } : {}),
      version: e.version, ...(typeof e.replayed === 'boolean' ? { replayed: e.replayed } : {}) };
  }
  private period(scope: LedgerScope, p: any): AccountingPeriod {
    return { id: p.periodId, tenantId: scope.tenantId, clientId: scope.clientId, taxYear: p.taxYear, periodName: p.periodName, startDate: date(p.startDate),
      endDate: date(p.endDate), status: p.status, ...(p.closedBy ? { closedByUid: p.closedBy, closedAt: iso(p.closedAt) } : {}),
      ...(p.reopenedBy ? { reopenedByUid: p.reopenedBy, reopenedAt: iso(p.reopenedAt), reopenReason: p.reopenReason } : {}) };
  }
  private transaction(scope: LedgerScope, t: any): BankTransaction {
    return { id: t.transactionId, tenantId: scope.tenantId, clientId: scope.clientId, accountId: t.accountId, ...(t.externalId ? { externalTransactionId: t.externalId } : {}),
      provider: t.provider, transactionDate: date(t.transactionDate), postingDate: date(t.postingDate), description: t.description, amount: Number(t.amountCents) / 100,
      currency: 'USD', importBatchId: t.importBatchId, duplicateStatus: t.duplicateStatus, ...(t.duplicateOf ? { duplicateCandidateId: t.duplicateOf } : {}),
      classificationStatus: t.classificationStatus, ...(t.assignedAccountId ? { assignedAccountId: t.assignedAccountId } : {}), matchedDocumentIds: [],
      reconciliationStatus: t.reconciliationId ? 'CLEARED' : 'UNRECONCILED', ...(t.reconciliationId ? { reconciliationId: t.reconciliationId } : {}),
      ...(t.journalEntryId ? { journalEntryId: t.journalEntryId } : {}), ...(t.reviewedBy ? { reviewedByUid: t.reviewedBy, reviewedAt: iso(t.reviewedAt) } : {}),
      createdAt: iso(t.transactionDate)!, updatedAt: iso(t.reviewedAt ?? t.transactionDate)! };
  }
  private reconciliation(scope: LedgerScope, r: any): BankReconciliation & { clearedTransactionIds: string[] } {
    const variance = Number(r.varianceCents) / 100;
    return { id: r.reconciliationId, tenantId: scope.tenantId, clientId: scope.clientId, accountId: r.accountId, taxYear: r.taxYear,
      statementPeriodStart: date(r.statementStart), statementPeriodEnd: date(r.statementEnd), statementBeginningBalance: Number(r.beginningCents) / 100,
      statementEndingBalance: Number(r.endingCents) / 100, clearedBalance: Number(r.clearedCents) / 100, clearedTransactionsCount: Number(r.clearedCount),
      variance, tolerance: Number(r.toleranceCents) / 100,
      status: r.status === 'CLOSED' ? 'CLOSED' : Math.abs(Number(r.varianceCents)) <= Number(r.toleranceCents) ? 'BALANCED' : 'IN_PROGRESS', exceptions: [],
      ...(r.completedAt ? { completedAt: iso(r.completedAt), completedByUid: r.completedBy } : {}), createdAt: iso(r.completedAt) ?? new Date(0).toISOString(),
      updatedAt: iso(r.completedAt) ?? new Date(0).toISOString(), clearedTransactionIds: r.clearedTransactionIds || [] };
  }

  // ---------------- chart of accounts ----------------
  async createAccounts(scope: LedgerScope, actor: string, accounts: Array<Pick<ChartOfAccount, 'id' | 'accountNumber' | 'accountName' | 'accountType' | 'accountSubtype'> & { taxMapping?: unknown; source?: string }>) {
    return this.call<{ created: number }>('taxguard_ledger_create_accounts', { ...this.base(scope, actor), p_accounts: accounts.map(a => ({ accountId: a.id,
      accountNumber: a.accountNumber, accountName: a.accountName, accountType: a.accountType, accountSubtype: a.accountSubtype, taxMapping: a.taxMapping ?? null, source: a.source })) });
  }
  async setAccountActive(scope: LedgerScope, actor: string, accountId: string, active: boolean) {
    return this.call('taxguard_ledger_set_account_active', { ...this.base(scope, actor), p_account: accountId, p_active: active });
  }

  // ---------------- periods ----------------
  async openPeriod(scope: LedgerScope, actor: string, taxYear: number, periodName: string, startDate: string, endDate: string) {
    return this.call<{ periodId: string; created: boolean }>('taxguard_ledger_open_period', { ...this.base(scope, actor), p_name: periodName, p_tax_year: taxYear, p_start: startDate, p_end: endDate });
  }
  async closePeriod(scope: LedgerScope, actor: string, periodId: string, status: 'SOFT_CLOSED' | 'HARD_CLOSED') {
    return this.call('taxguard_ledger_close_period', { ...this.base(scope, actor), p_period: periodId, p_status: status });
  }
  async reopenPeriod(scope: LedgerScope, actor: string, periodId: string, reason: string) {
    return this.call('taxguard_ledger_reopen_period', { ...this.base(scope, actor), p_period: periodId, p_reason: reason });
  }

  // ---------------- journal ----------------
  async postEntry(scope: LedgerScope, actor: string, input: PostEntryInput): Promise<DurableJournalEntry> {
    if (!Array.isArray(input?.lines)) throw new LedgerStoreError('LEDGER_INPUT_INVALID', 400);
    const body = { taxYear: input.taxYear, periodId: input.periodId || null, postingDate: input.postingDate, transactionDate: input.transactionDate || input.postingDate,
      description: input.description, reference: input.reference || null, source: input.source || 'MANUAL', isAdjusting: Boolean(input.isAdjusting),
      adjustingType: input.adjustingType || null, documentIds: input.documentIds || [],
      lines: input.lines.map(l => ({ accountId: l.accountId, debitCents: toCents(l.debit ?? 0), creditCents: toCents(l.credit ?? 0), memo: l.memo || null, taxCategory: l.taxCategory || null })) };
    const data = await this.call('taxguard_ledger_post_entry', { ...this.base(scope, actor), p_key: input.idempotencyKey,
      p_hash: requestHash({ body, replaces: input.replacesEntryId || null }), p_entry: body, p_replaces: input.replacesEntryId || null });
    return this.entry(scope, data);
  }
  async reviewEntry(scope: LedgerScope, actor: string, entryId: string, decision: LedgerReviewDecision, expectedVersion: number, note?: string) {
    return this.entry(scope, await this.call('taxguard_ledger_review_entry', { ...this.base(scope, actor), p_entry: entryId, p_decision: decision, p_note: note ?? null, p_version: expectedVersion }));
  }
  async reverseEntry(scope: LedgerScope, actor: string, input: { idempotencyKey: string; entryId: string; postingDate: string; reason: string; periodId?: string }) {
    return this.entry(scope, await this.call('taxguard_ledger_reverse_entry', { ...this.base(scope, actor), p_key: input.idempotencyKey,
      p_hash: requestHash({ entryId: input.entryId, postingDate: input.postingDate, reason: input.reason, periodId: input.periodId || null }),
      p_entry: input.entryId, p_posting_date: input.postingDate, p_period: input.periodId || null, p_reason: input.reason }));
  }

  // ---------------- bank feed and reconciliation ----------------
  async ingestTransactions(scope: LedgerScope, actor: string, accountId: string, provider: string, batchId: string,
    rows: Array<{ transactionDate: string; postingDate?: string; description: string; amount: number; externalTransactionId?: string }>) {
    if (!Array.isArray(rows)) throw new LedgerStoreError('LEDGER_INPUT_INVALID', 400);
    return this.call<{ inserted: number; skippedExisting: number; possibleDuplicates: number }>('taxguard_ledger_ingest_transactions', { ...this.base(scope, actor),
      p_account: accountId, p_provider: provider, p_batch: batchId, p_rows: rows.map(r => ({ transactionDate: r.transactionDate, postingDate: r.postingDate || null,
        description: r.description, amountCents: signedCents(r.amount), externalId: r.externalTransactionId || null })) });
  }
  async categorizeTransaction(scope: LedgerScope, actor: string, transactionId: string, accountId: string, taxYear: number, periodId?: string) {
    const data = await this.call('taxguard_ledger_categorize_transaction', { ...this.base(scope, actor), p_txn: transactionId, p_account: accountId, p_period: periodId || null, p_tax_year: taxYear });
    return { transactionId: data.transactionId as string, journalEntry: this.entry(scope, data.entry) };
  }
  async startReconciliation(scope: LedgerScope, actor: string, input: { accountId: string; taxYear: number; statementStart: string; statementEnd: string; beginningBalance: number; endingBalance: number; tolerance?: number }) {
    const data = await this.call('taxguard_ledger_start_reconciliation', { ...this.base(scope, actor), p_account: input.accountId, p_tax_year: input.taxYear,
      p_start: input.statementStart, p_end: input.statementEnd, p_beginning: signedCents(input.beginningBalance), p_ending: signedCents(input.endingBalance), p_tolerance: toCents(input.tolerance ?? 0) });
    return data.reconciliationId as string;
  }
  async setCleared(scope: LedgerScope, actor: string, reconciliationId: string, transactionId: string, cleared: boolean) {
    return this.reconciliation(scope, await this.call('taxguard_ledger_set_cleared', { ...this.base(scope, actor), p_recon: reconciliationId, p_txn: transactionId, p_cleared: cleared }));
  }
  async finalizeReconciliation(scope: LedgerScope, actor: string, reconciliationId: string) {
    return this.reconciliation(scope, await this.call('taxguard_ledger_finalize_reconciliation', { ...this.base(scope, actor), p_recon: reconciliationId }));
  }

  // ---------------- reads and reports ----------------
  async read(scope: LedgerScope, actor: string, taxYear: number, filter: { fromDate?: string; toDate?: string; status?: string; accountId?: string; text?: string; limit?: number } = {}) {
    const data = await this.call('taxguard_ledger_read', { ...this.base(scope, actor), p_tax_year: taxYear, p_filter: filter });
    return { accounts: (data.accounts as any[]).map(a => this.account(scope, a)), periods: (data.periods as any[]).map(p => this.period(scope, p)),
      entries: (data.entries as any[]).map(e => this.entry(scope, e)), transactions: (data.transactions as any[]).map(t => this.transaction(scope, t)),
      reconciliations: (data.reconciliations as any[]).map(r => this.reconciliation(scope, r)), rawEntries: data.entries as any[] };
  }
  private async trialBalanceRows(scope: LedgerScope, actor: string, taxYear: number, asOf?: string): Promise<TrialBalanceRow[]> {
    const rows = await this.call<any[]>('taxguard_ledger_trial_balance', { ...this.base(scope, actor), p_tax_year: taxYear, p_as_of: asOf || null });
    return rows.map(r => ({ accountId: r.accountId, accountNumber: r.accountNumber, accountName: r.accountName, accountType: r.accountType,
      beginningDebitCents: Number(r.beginningDebitCents), beginningCreditCents: Number(r.beginningCreditCents), periodDebitCents: Number(r.periodDebitCents), periodCreditCents: Number(r.periodCreditCents) }));
  }
  async trialBalance(scope: LedgerScope, actor: string, taxYear: number, asOf?: string): Promise<TrialBalanceReport> {
    return trialBalanceReport(scope.tenantId, scope.clientId, taxYear, await this.trialBalanceRows(scope, actor, taxYear, asOf));
  }
  async financialStatements(scope: LedgerScope, actor: string, taxYear: number, asOf?: string): Promise<FinancialStatements> {
    return financialStatements(await this.trialBalanceRows(scope, actor, taxYear, asOf));
  }
  async generalLedger(scope: LedgerScope, actor: string, taxYear: number, accountId?: string): Promise<GeneralLedgerAccount[]> {
    const data = await this.read(scope, actor, taxYear, { status: 'POSTED', limit: 500, ...(accountId ? { accountId } : {}) });
    return generalLedger(data.accounts.map(a => ({ accountId: a.id, accountNumber: a.accountNumber, accountName: a.accountName, accountType: a.accountType })),
      data.rawEntries.map(e => ({ entryId: e.entryId, entryNumber: e.entryNumber, postingDate: date(e.postingDate), description: e.description, status: e.status,
        lines: e.lines.map((l: any) => ({ accountId: l.accountId, debitCents: Number(l.debitCents), creditCents: Number(l.creditCents) })) })), accountId);
  }
  async history(scope: LedgerScope, actor: string, limit = 50) {
    const rows = await this.call<any[]>('taxguard_ledger_history', { ...this.base(scope, actor), p_limit: limit });
    return rows.map(r => ({ action: r.action as string, actorUid: r.actorUid as string, actorRole: r.actorRole as string | null, metadata: r.metadata as Record<string, unknown>, at: iso(r.at)! }));
  }
}
