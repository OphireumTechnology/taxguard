/**
 * Ledger persistence dispatch for /api/bookkeeping. Registered after the authorized-client
 * middleware and before the in-memory handlers: in memory mode most handlers defer to the
 * existing implementation (next()), in durable mode they answer from SqlLedgerStore, and when
 * durable storage is required but missing every ledger request fails closed with 503.
 * Workflows added with the durable store (reject, request correction, replacement, account
 * status, standard chart, filtered journal, general ledger, reconciliation list) are served
 * in both modes.
 */
import { randomUUID } from 'node:crypto';
import type { Response, Router } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { globalBookkeepingEngine } from '../taxguard/bookkeeping/bookkeeping.engine';
import { selectLedger } from '../taxguard/bookkeeping/ledgerBackend';
import { generateStandardChartOfAccounts } from '../taxguard/bookkeeping/defaultAccounts';
import { generalLedger } from '../taxguard/bookkeeping/ledgerReports';
import { ReportAmountError } from '../taxguard/bookkeeping/reportMoney';
import { LedgerStoreError, toCents, type LedgerScope, type SqlLedgerStore } from '../taxguard/bookkeeping/sqlLedgerStore';
import type { JournalEntry } from '../taxguard/bookkeeping/types';

const CLIENT_ROLES = ['client', 'prospective_client'];
const REVIEWER_ROLES = ['reviewer', 'senior_reviewer', 'admin', 'administrator', 'super_admin', 'super_administrator'];
const FORM_TARGETS = ['1040_SCHED_C', '1065', '1120S', '1120'] as const;
type Handler = (req: AuthenticatedRequest, res: Response, scope: LedgerScope & { taxYear: number }, store: SqlLedgerStore) => Promise<unknown>;

function scopeOf(req: AuthenticatedRequest) {
  const context = req.authorizedClientContext!;
  return { tenantId: context.tenantId, clientId: context.clientId, taxYear: Number(req.query.taxYear || req.body?.taxYear) || 2025 };
}
function fail(res: Response, error: unknown) {
  if (error instanceof LedgerStoreError || error instanceof ReportAmountError) return res.status(error.status).json({ code: error.code, error: error.code });
  const message = error instanceof Error ? error.message : '';
  const code = /^[A-Z_]{3,64}/.exec(message)?.[0];
  if (code) return res.status(code.endsWith('_NOT_FOUND') ? 404 : code === 'MAKER_CHECKER_VIOLATION' ? 403 : 400).json({ code, error: message });
  return res.status(503).json({ code: 'LEDGER_STORE_UNAVAILABLE', error: 'LEDGER_STORE_UNAVAILABLE' });
}
const idempotencyKey = (req: AuthenticatedRequest) => {
  const value = req.get('idempotency-key') || req.body?.idempotencyKey;
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.:-]{8,128}$/.test(value)) throw new LedgerStoreError('IDEMPOTENCY_KEY_REQUIRED', 400);
  return value;
};
const requireStaff = (req: AuthenticatedRequest) => { if (CLIENT_ROLES.includes(req.user!.role)) throw new LedgerStoreError('LEDGER_STAFF_REQUIRED', 403); };
const requireReviewer = (req: AuthenticatedRequest) => { if (!REVIEWER_ROLES.includes(req.user!.role)) throw new LedgerStoreError('LEDGER_REVIEWER_REQUIRED', 403); };
const text = (value: unknown, max = 128) => typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : undefined;
function journalFilter(query: Record<string, unknown>) {
  const filter: Record<string, string | number> = {};
  for (const key of ['status', 'fromDate', 'toDate', 'accountId'] as const) { const v = text(query[key], 160); if (v) filter[key] = v; }
  const q = text(query.q, 100); if (q) filter.text = q;
  if (query.limit !== undefined) { const n = Number(query.limit); if (!Number.isInteger(n) || n < 1 || n > 500) throw new LedgerStoreError('LEDGER_INPUT_INVALID', 400); filter.limit = n; }
  if (filter.status && !['PREPARED', 'POSTED', 'REJECTED', 'CORRECTION_REQUIRED'].includes(filter.status as string)) throw new LedgerStoreError('LEDGER_INPUT_INVALID', 400);
  for (const key of ['fromDate', 'toDate'] as const) if (filter[key] && !/^\d{4}-\d{2}-\d{2}$/.test(filter[key] as string)) throw new LedgerStoreError('LEDGER_INPUT_INVALID', 400);
  return filter;
}
function memoryJournal(scope: LedgerScope & { taxYear: number }, filter: Record<string, string | number>): JournalEntry[] {
  const q = typeof filter.text === 'string' ? filter.text.toLowerCase() : '';
  return globalBookkeepingEngine.getJournalEntries(scope.tenantId, scope.clientId, scope.taxYear).filter(e =>
    (!filter.status || e.status === filter.status) && (!filter.fromDate || e.postingDate >= filter.fromDate) && (!filter.toDate || e.postingDate <= filter.toDate) &&
    (!filter.accountId || e.lines.some(l => l.accountId === filter.accountId)) &&
    (!q || `${e.description} ${e.reference ?? ''} ${e.entryNumber}`.toLowerCase().includes(q))).slice(0, Number(filter.limit) || 500);
}

export function registerLedgerDispatch(router: Router) {
  // Both modes may be served; durable-only handlers pass memory requests to the existing routes.
  const route = (method: 'get' | 'post', path: string, durable: Handler, memory?: (req: AuthenticatedRequest, res: Response, scope: LedgerScope & { taxYear: number }, next: () => void) => unknown) => {
    router[method](path, async (req: AuthenticatedRequest, res: Response, next) => {
      const selection = selectLedger();
      if (selection.mode === 'unavailable') return res.status(503).json({ code: 'DURABLE_ACCOUNTING_PROVIDER_REQUIRED' });
      res.setHeader('X-TaxGuard-Ledger-Store', selection.mode);
      const scope = scopeOf(req);
      try {
        if (selection.mode === 'memory') return memory ? await memory(req, res, scope, next) : next();
        res.setHeader('Cache-Control', 'no-store');
        return await durable(req, res, scope, selection.store);
      } catch (error) { return fail(res, error); }
    });
  };
  const uid = (req: AuthenticatedRequest) => req.user!.id;

  // Chart of accounts
  route('get', '/chart-of-accounts', async (req, res, s, store) => res.json({ accounts: (await store.read(s, uid(req), s.taxYear)).accounts }));
  route('post', '/chart-of-accounts', async (req, res, s, store) => {
    requireStaff(req);
    const b = req.body || {};
    const number = text(b.accountNumber, 16), name = text(b.accountName, 160);
    if (!number || !name) throw new LedgerStoreError('LEDGER_INPUT_INVALID', 400);
    const id = `coa_${s.clientId}_${number}_${randomUUID().slice(0, 8)}`;
    await store.createAccounts(s, uid(req), [{ id, accountNumber: number, accountName: name, accountType: b.accountType, accountSubtype: b.accountSubtype, taxMapping: b.taxMapping }]);
    const account = (await store.read(s, uid(req), s.taxYear)).accounts.find(a => a.accountNumber === number);
    if (!account || account.id !== id) throw new LedgerStoreError('ACCOUNT_CONFLICT', 409);
    return res.status(201).json({ account });
  });
  route('post', '/chart-of-accounts/standard', async (req, res, s, store) => {
    requireStaff(req);
    const target = FORM_TARGETS.includes(req.body?.formTarget) ? req.body.formTarget : '1040_SCHED_C';
    const result = await store.createAccounts(s, uid(req), generateStandardChartOfAccounts(s.tenantId, s.clientId, target, uid(req)).map(a => ({ ...a, source: 'SYSTEM_BOOTSTRAP' })));
    return res.json({ created: result.created, accounts: (await store.read(s, uid(req), s.taxYear)).accounts });
  }, (req, res, s) => {
    requireStaff(req);
    const target = FORM_TARGETS.includes(req.body?.formTarget) ? req.body.formTarget : '1040_SCHED_C';
    const before = globalBookkeepingEngine.getChartOfAccounts(s.tenantId, s.clientId).length;
    const accounts = globalBookkeepingEngine.ensureDefaultChartOfAccounts(s.tenantId, s.clientId, target, uid(req));
    return res.json({ created: accounts.length - before, accounts });
  });
  route('post', '/chart-of-accounts/:id/status', async (req, res, s, store) => {
    requireStaff(req);
    if (typeof req.body?.active !== 'boolean') throw new LedgerStoreError('LEDGER_INPUT_INVALID', 400);
    return res.json(await store.setAccountActive(s, uid(req), req.params.id, req.body.active));
  }, (req, res, s) => {
    requireStaff(req);
    if (typeof req.body?.active !== 'boolean') throw new LedgerStoreError('LEDGER_INPUT_INVALID', 400);
    const account = globalBookkeepingEngine.setAccountActive(req.params.id, req.body.active, s);
    return res.json({ accountId: account.id, isActive: account.isActive });
  });

  // Journal
  route('get', '/journal-entries', async (req, res, s, store) => res.json({ entries: (await store.read(s, uid(req), s.taxYear, journalFilter(req.query))).entries }),
    (req, res, s) => res.json({ entries: memoryJournal(s, journalFilter(req.query)) }));
  route('post', '/journal-entries', async (req, res, s, store) => {
    requireStaff(req);
    const b = req.body || {};
    const entry = await store.postEntry(s, uid(req), { idempotencyKey: idempotencyKey(req), taxYear: s.taxYear, periodId: text(b.periodId, 160),
      postingDate: b.postingDate, transactionDate: b.transactionDate, description: b.description, reference: text(b.reference), source: b.source,
      isAdjusting: b.isAdjusting === true, adjustingType: b.adjustingType, lines: b.lines, documentIds: Array.isArray(b.documentProvenanceIds) ? b.documentProvenanceIds : [],
      replacesEntryId: text(b.replacesEntryId, 64) });
    return res.status(entry.replayed ? 200 : 201).json({ entry });
  }, (req, res, s, next) => {
    if (!req.body?.replacesEntryId) return next();
    requireStaff(req);
    const b = req.body;
    const entry = globalBookkeepingEngine.prepareReplacementEntry(b.replacesEntryId, { tenantId: s.tenantId, clientId: s.clientId, taxYear: s.taxYear,
      periodId: b.periodId || 'unassigned', postingDate: b.postingDate, transactionDate: b.transactionDate || b.postingDate, description: b.description,
      reference: b.reference, source: b.source || 'ADJUSTING', isAdjusting: b.isAdjusting === true, adjustingType: b.adjustingType, lines: b.lines, creatorUid: uid(req) }, s);
    return res.status(201).json({ entry });
  });
  const review = (decision: 'approve' | 'reject' | 'request_correction'): Handler => async (req, res, s, store) => {
    requireReviewer(req);
    const version = Number(req.body?.version);
    if (!Number.isInteger(version) || version < 1) throw new LedgerStoreError('LEDGER_VERSION_REQUIRED', 400);
    return res.json({ entry: await store.reviewEntry(s, uid(req), req.params.id, decision, version, req.body?.note) });
  };
  route('post', '/journal-entries/:id/approve', review('approve'));
  for (const [path, decision, outcome] of [['reject', 'reject', 'REJECTED'], ['request-correction', 'request_correction', 'CORRECTION_REQUIRED']] as const) {
    route('post', `/journal-entries/:id/${path}`, review(decision), (req, res, s) => {
      requireReviewer(req);
      return res.json({ entry: globalBookkeepingEngine.reviewJournalEntryOutcome(req.params.id, uid(req), outcome, req.body?.note, s) });
    });
  }
  route('post', '/journal-entries/:id/reverse', async (req, res, s, store) => {
    requireStaff(req);
    const entry = await store.reverseEntry(s, uid(req), { idempotencyKey: idempotencyKey(req), entryId: req.params.id, postingDate: req.body?.postingDate,
      reason: req.body?.reason, periodId: text(req.body?.periodId, 160) });
    return res.status(entry.replayed ? 200 : 201).json({ entry });
  });

  // Periods
  route('get', '/periods', async (req, res, s, store) => res.json({ periods: (await store.read(s, uid(req), s.taxYear)).periods }));
  route('post', '/periods', async (req, res, s, store) => {
    requireStaff(req);
    const result = await store.openPeriod(s, uid(req), s.taxYear, req.body?.periodName, req.body?.startDate, req.body?.endDate);
    const period = (await store.read(s, uid(req), s.taxYear)).periods.find(p => p.id === result.periodId);
    return res.status(result.created ? 201 : 200).json({ period });
  });
  route('post', '/periods/:id/close', async (req, res, s, store) => {
    requireReviewer(req);
    await store.closePeriod(s, uid(req), req.params.id, req.body?.status);
    return res.json({ period: (await store.read(s, uid(req), s.taxYear)).periods.find(p => p.id === req.params.id) });
  });
  route('post', '/periods/:id/reopen', async (req, res, s, store) => {
    requireReviewer(req);
    await store.reopenPeriod(s, uid(req), req.params.id, req.body?.reason);
    return res.json({ period: (await store.read(s, uid(req), s.taxYear)).periods.find(p => p.id === req.params.id) });
  });

  // Bank feed and reconciliation
  route('get', '/transactions', async (req, res, s, store) => {
    const accountId = text(req.query.accountId, 160);
    const { transactions } = await store.read(s, uid(req), s.taxYear, { ...(text(req.query.q, 100) ? { text: text(req.query.q, 100) } : {}), limit: 500 });
    return res.json({ transactions: accountId ? transactions.filter(t => t.accountId === accountId) : transactions });
  });
  route('post', '/transactions/ingest', async (req, res, s, store) => {
    requireStaff(req);
    const b = req.body || {};
    const batchId = text(b.importBatchId, 128) || `batch_${randomUUID()}`;
    const result = await store.ingestTransactions(s, uid(req), b.accountId, b.provider || 'CSV_UPLOAD', batchId, b.rawTransactions);
    return res.status(201).json({ importBatchId: batchId, ...result });
  });
  route('post', '/transactions/:id/categorize', async (req, res, s, store) => {
    requireStaff(req);
    return res.json(await store.categorizeTransaction(s, uid(req), req.params.id, req.body?.assignedAccountId, s.taxYear, text(req.body?.periodId, 160)));
  });
  route('get', '/reconciliations', async (req, res, s, store) => res.json({ reconciliations: (await store.read(s, uid(req), s.taxYear)).reconciliations }),
    (req, res, s) => res.json({ reconciliations: globalBookkeepingEngine.getReconciliations(s.tenantId, s.clientId, s.taxYear) }));
  route('post', '/reconciliations/start', async (req, res, s, store) => {
    requireStaff(req);
    const b = req.body || {};
    const id = await store.startReconciliation(s, uid(req), { accountId: b.accountId, taxYear: s.taxYear, statementStart: b.statementPeriodStart, statementEnd: b.statementPeriodEnd,
      beginningBalance: Number(b.statementBeginningBalance), endingBalance: Number(b.statementEndingBalance), tolerance: b.tolerance === undefined ? 0 : Number(b.tolerance) });
    return res.status(201).json({ reconciliation: (await store.read(s, uid(req), s.taxYear)).reconciliations.find(r => r.id === id) });
  });
  route('post', '/reconciliations/:id/clear', async (req, res, s, store) => {
    requireStaff(req);
    return res.json({ reconciliation: await store.setCleared(s, uid(req), req.params.id, req.body?.transactionId, Boolean(req.body?.isCleared)) });
  });
  route('post', '/reconciliations/:id/finalize', async (req, res, s, store) => {
    requireStaff(req);
    return res.json({ message: 'Reconciliation completed and locked.', reconciliation: await store.finalizeReconciliation(s, uid(req), req.params.id) });
  });

  // Reports and history
  route('get', '/trial-balance', async (req, res, s, store) => res.json({ trialBalance: await store.trialBalance(s, uid(req), s.taxYear, text(req.query.asOf, 10)) }));
  route('get', '/financial-statements', async (req, res, s, store) => res.json({ statements: await store.financialStatements(s, uid(req), s.taxYear, text(req.query.asOf, 10)) }));
  route('get', '/general-ledger', async (req, res, s, store) => res.json({ accounts: await store.generalLedger(s, uid(req), s.taxYear, text(req.query.accountId, 160)) }),
    (req, res, s) => {
      const accounts = globalBookkeepingEngine.getChartOfAccounts(s.tenantId, s.clientId).map(a => ({ accountId: a.id, accountNumber: a.accountNumber, accountName: a.accountName, accountType: a.accountType }));
      const entries = globalBookkeepingEngine.getJournalEntries(s.tenantId, s.clientId, s.taxYear).map(e => ({ entryId: e.id, entryNumber: e.entryNumber, postingDate: e.postingDate,
        description: e.description, status: e.status, lines: e.lines.map(l => ({ accountId: l.accountId, debitCents: toCents(l.debit || 0), creditCents: toCents(l.credit || 0) })) }));
      return res.json({ accounts: generalLedger(accounts, entries, text(req.query.accountId, 160)) });
    });
  route('get', '/history', async (req, res, s, store) => {
    requireStaff(req);
    const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
    return res.json({ events: await store.history(s, uid(req), limit) });
  }, (_req, res) => res.status(503).json({ code: 'LEDGER_HISTORY_REQUIRES_DURABLE_STORE' }));

  route('get', '/work-queue', async (req, res, s, store) => res.json(await store.workQueue(s, uid(req), s.taxYear)),
    (_req, res) => res.status(503).json({ code: 'LEDGER_WORK_QUEUE_REQUIRES_DURABLE_STORE' }));

  // Remaining ledger features have no durable implementation yet: refuse rather than mix stores.
  router.use((req: AuthenticatedRequest, res: Response, next) => {
    const selection = selectLedger();
    if (selection.mode === 'memory') return next();
    return res.status(503).json({ code: selection.mode === 'unavailable' ? 'DURABLE_ACCOUNTING_PROVIDER_REQUIRED' : 'DURABLE_FEATURE_NOT_AVAILABLE' });
  });
}
