import type { BookkeeperSnapshot } from '../types/bookkeeperDashboard';
import type { SqlLedgerStore } from './taxguard/bookkeeping/sqlLedgerStore';

const READ_LIMIT = 500;

/**
 * The bookkeeper's existing panels (Transactions, Reconciliation, Chart of Accounts, Reports) fed
 * from the durable ledger instead of the in-memory engine. The database re-checks the bookkeeper's
 * assignment on every read. Statuses are reported as recorded: a categorized bank transaction whose
 * journal entry still awaits review is PENDING_REVIEW, and a transaction is RECONCILED only when its
 * reconciliation is closed. Document matching and AI proposals are not part of the durable ledger
 * and are reported as absent rather than invented.
 */
export async function projectDurableBookkeeper(store: SqlLedgerStore, actor: string, tenantId: string, clientId: string, taxYear: number, periodId?: string)
  : Promise<BookkeeperSnapshot & { provider: 'DURABLE_LEDGER'; truncated: boolean }> {
  const scope = { tenantId, clientId };
  const data = await store.read(scope, actor, taxYear, { limit: READ_LIMIT });
  const period = periodId ? data.periods.find(p => p.id === periodId) : undefined;
  if (periodId && !period) throw new Error('PERIOD_ACCESS_DENIED');
  const inScope = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number(date.slice(0, 4)) === taxYear && (!period || (date >= period.startDate && date <= period.endDate));
  const accountName = (id?: string) => data.accounts.find(a => a.id === id)?.accountName;
  const journals = data.entries.filter(j => inScope(j.postingDate));
  const entryStatus = new Map(data.entries.map(e => [e.id, e.status]));
  const closedRecon = new Set(data.reconciliations.filter(r => r.status === 'CLOSED').map(r => r.id));
  return {
    provider: 'DURABLE_LEDGER',
    truncated: data.entries.length >= READ_LIMIT || data.transactions.length >= READ_LIMIT,
    scope: { tenantId, clientId, taxYear, periodId },
    accounts: data.accounts.map(a => ({ id: a.id, number: a.accountNumber, name: a.accountName, type: a.accountType, active: a.isActive })),
    periods: data.periods.filter(p => p.taxYear === taxYear).map(p => ({ id: p.id, name: p.periodName, start: p.startDate, end: p.endDate, status: p.status })),
    transactions: data.transactions.filter(t => inScope(t.transactionDate)).map(t => {
      const posted = t.journalEntryId ? entryStatus.get(t.journalEntryId) : undefined;
      return { id: t.id, date: t.transactionDate, description: t.description, amount: t.amount, category: accountName(t.assignedAccountId), source: t.provider,
        classification: !t.journalEntryId ? 'UNCLASSIFIED' : posted === 'POSTED' ? 'POSTED' : 'PENDING_REVIEW',
        reconciliation: !t.reconciliationId ? 'UNRECONCILED' : closedRecon.has(t.reconciliationId) ? 'RECONCILED' : 'CLEARED',
        duplicate: t.duplicateStatus, documentCount: 0, journalEntryId: journals.some(j => j.id === t.journalEntryId) ? t.journalEntryId : undefined };
    }),
    journals: journals.map(j => ({ id: j.id, number: j.entryNumber, date: j.postingDate, description: j.description, debit: j.totalDebit, credit: j.totalCredit, status: j.status,
      adjusting: j.isAdjusting, creator: j.creatorUid, reviewer: j.reviewerUid, source: j.source, documentCount: j.documentProvenanceIds?.length ?? 0 })),
    reconciliations: data.reconciliations.filter(r => r.taxYear === taxYear && (!period || (r.statementPeriodStart >= period.startDate && r.statementPeriodEnd <= period.endDate)))
      .map(r => ({ id: r.id, start: r.statementPeriodStart, end: r.statementPeriodEnd, status: r.status, variance: r.variance, matched: r.clearedTransactionsCount, exceptions: [] })),
    capabilities: { mutations: false, periodClose: false, privateDocumentPreview: false },
  };
}
