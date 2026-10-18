import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { bookkeepingRouter } from '../server/routes/bookkeeping.routes';
import { db } from '../server/db';
import { setLedgerStoreForTesting } from '../server/taxguard/bookkeeping/ledgerBackend';
import { SqlLedgerStore } from '../server/taxguard/bookkeeping/sqlLedgerStore';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Synthetic accounting cycle over HTTP -> /api/bookkeeping -> SqlLedgerStore -> proposal 024 (PGlite).
const T = 'tenantA', C = 'httpLedgerA', OTHER = 'httpLedgerB';
const people = { accountant: 'hl-accountant', reviewer: 'hl-reviewer', senior: 'hl-senior', client: 'hl-client' } as const;
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string;
let n = 0;

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012240000_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid) VALUES('${T}','${C}','owner'),('${T}','${OTHER}','owner2');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('${T}','${people.accountant}','accountant','active'),('${T}','${people.reviewer}','reviewer','active'),
      ('${T}','${people.senior}','senior_reviewer','active'),('${T}','${people.client}','client','active');
    INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,role,user_id,assigned_by,effective_from) VALUES
      ('hl-1','${T}','${C}','accountant','${people.accountant}','admin',now()-interval '1 day'),('hl-2','${T}','${C}','reviewer','${people.reviewer}','admin',now()-interval '1 day'),
      ('hl-3','${T}','${C}','senior_reviewer','${people.senior}','admin',now()-interval '1 day');`);
  setLedgerStoreForTesting(new SqlLedgerStore(pgliteRpc(() => fixture.pg)));
  const app = express(); app.use(express.json()); app.use('/api/bookkeeping', bookkeepingRouter);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 60000);
afterAll(async () => { setLedgerStoreForTesting(null); server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  for (const [role, id] of Object.entries(people)) {
    db.users.set(id, { id, name: 'Synthetic ' + role, email: id + '@example.test', role: role === 'senior' ? 'senior_reviewer' : role as any, tenantId: T,
      ...(role === 'client' ? { clientId: C } : {}), status: 'active', createdAt: '2025-01-01', isVerified: true } as any);
    db.sessions.set(id + '-token', { userId: id, expiresAt: Date.now() + 60_000 } as any);
    if (role !== 'client') for (const client of [C, OTHER]) db.clientAccountantAssignments.set(`hl-${id}-${client}`, { id: `hl-${id}-${client}`, clientId: client, clientName: client, accountantId: id,
      accountantName: id, assignmentType: 'primary', status: 'active', accessScope: [], assignedBy: 'admin', assignedByName: 'Admin', assignedAt: '2025-01-01T00:00:00Z', effectiveDate: '2025-01-01T00:00:00Z' } as any);
  }
});
afterEach(() => { for (const id of Object.values(people)) { db.users.delete(id); db.sessions.delete(id + '-token'); for (const c of [C, OTHER]) db.clientAccountantAssignments.delete(`hl-${id}-${c}`); } vi.unstubAllEnvs(); });

const call = async (who: keyof typeof people, method: 'GET' | 'POST', path: string, body: Record<string, unknown> = {}, client = C, idem = true) => {
  const query = method === 'GET' ? (path.includes('?') ? '&' : '?') + `clientId=${client}&taxYear=2025` : '';
  const response = await fetch(origin + '/api/bookkeeping' + path + query, { method, headers: { Authorization: `Bearer ${people[who]}-token`, 'Content-Type': 'application/json',
    ...(idem && method === 'POST' ? { 'Idempotency-Key': `http-ledger-${Date.now()}-${++n}` } : {}) }, ...(method === 'POST' ? { body: JSON.stringify({ clientId: client, taxYear: 2025, ...body }) } : {}) });
  return { status: response.status, body: await response.json().catch(() => null), store: response.headers.get('x-taxguard-ledger-store') };
};

describe('durable bookkeeping over HTTP', () => {
  let acct: Record<string, string> = {};
  it('completes a synthetic accounting cycle from chart setup to reconciliation and financial reports', async () => {
    const chart = await call('accountant', 'POST', '/chart-of-accounts/standard');
    expect(chart.status).toBe(200); expect(chart.store).toBe('durable');
    acct = Object.fromEntries(chart.body.accounts.map((a: any) => [a.accountNumber, a.id]));
    expect((await call('accountant', 'POST', '/chart-of-accounts/standard')).body.created).toBe(0);

    const period = await call('accountant', 'POST', '/periods', { periodName: '2025-Q1', startDate: '2025-01-01', endDate: '2025-03-31' });
    expect(period.status).toBe(201);
    const periodId = period.body.period.id;

    const capital = await call('accountant', 'POST', '/journal-entries', { periodId, postingDate: '2025-01-02', description: 'Synthetic owner contribution',
      lines: [{ accountId: acct['1010'], debit: 5000, credit: 0 }, { accountId: acct['3010'] ?? Object.values(acct)[8], debit: 0, credit: 5000 }] });
    expect(capital.status).toBe(201); expect(capital.body.entry.status).toBe('POSTED');

    const ingest = await call('accountant', 'POST', '/transactions/ingest', { accountId: acct['1010'], rawTransactions: [
      { transactionDate: '2025-02-03', description: 'Synthetic client payment', amount: 1200, externalTransactionId: 'h-1' },
      { transactionDate: '2025-02-04', description: 'Synthetic software', amount: -45.5, externalTransactionId: 'h-2' }] });
    expect(ingest.status).toBe(201); expect(ingest.body.inserted).toBe(2);
    const txns = (await call('accountant', 'GET', '/transactions')).body.transactions;
    for (const t of txns) {
      const posted = await call('accountant', 'POST', `/transactions/${t.id}/categorize`, { assignedAccountId: t.amount > 0 ? acct['4010'] : acct['6070'], periodId });
      expect(posted.status).toBe(200);
    }

    const adjusting = await call('accountant', 'POST', '/journal-entries', { periodId, postingDate: '2025-03-31', description: 'Synthetic accrued expense', isAdjusting: true, adjustingType: 'ACCRUAL',
      source: 'ADJUSTING', lines: [{ accountId: acct['6070'], debit: 80, credit: 0 }, { accountId: acct['2010'], debit: 0, credit: 80 }] });
    expect(adjusting.body.entry.status).toBe('PREPARED');
    expect((await call('accountant', 'POST', `/journal-entries/${adjusting.body.entry.id}/approve`, { version: 1 })).status).toBe(403);
    const corrected = await call('reviewer', 'POST', `/journal-entries/${adjusting.body.entry.id}/request-correction`, { version: 1, note: 'Accrue to accounts payable at 75.00' });
    expect(corrected.body.entry.status).toBe('CORRECTION_REQUIRED');
    const replacement = await call('accountant', 'POST', '/journal-entries', { periodId, postingDate: '2025-03-31', description: 'Synthetic accrued expense (corrected)', isAdjusting: true,
      source: 'ADJUSTING', replacesEntryId: adjusting.body.entry.id, lines: [{ accountId: acct['6070'], debit: 75, credit: 0 }, { accountId: acct['2010'], debit: 0, credit: 75 }] });
    expect(replacement.status).toBe(201);
    const stale = await call('reviewer', 'POST', `/journal-entries/${replacement.body.entry.id}/approve`, { version: 7 });
    expect(stale.status).toBe(409); expect(stale.body.code).toBe('LEDGER_VERSION_CONFLICT');
    expect((await call('reviewer', 'POST', `/journal-entries/${replacement.body.entry.id}/approve`, { version: 1 })).body.entry.status).toBe('POSTED');

    const reversal = await call('accountant', 'POST', `/journal-entries/${capital.body.entry.id}/reverse`, { postingDate: '2025-01-03', reason: 'Contribution was recorded twice' });
    expect(reversal.body.entry.status).toBe('PREPARED');
    expect((await call('reviewer', 'POST', `/journal-entries/${reversal.body.entry.id}/reject`, { version: 1, note: 'Contribution was genuine' })).body.entry.status).toBe('REJECTED');

    const recon = await call('accountant', 'POST', '/reconciliations/start', { accountId: acct['1010'], statementPeriodStart: '2025-02-01', statementPeriodEnd: '2025-02-28',
      statementBeginningBalance: 5000, statementEndingBalance: 6154.5 });
    expect(recon.status).toBe(201);
    for (const t of txns) await call('accountant', 'POST', `/reconciliations/${recon.body.reconciliation.id}/clear`, { transactionId: t.id, isCleared: true });
    const finalized = await call('accountant', 'POST', `/reconciliations/${recon.body.reconciliation.id}/finalize`);
    expect(finalized.body.reconciliation).toMatchObject({ status: 'CLOSED', variance: 0, clearedTransactionsCount: 2 });

    expect((await call('reviewer', 'POST', `/periods/${periodId}/close`, { status: 'HARD_CLOSED' })).status).toBe(200);
    const locked = await call('accountant', 'POST', '/journal-entries', { postingDate: '2025-02-15', description: 'After close', lines: [{ accountId: acct['1010'], debit: 1, credit: 0 }, { accountId: acct['4010'], debit: 0, credit: 1 }] });
    expect(locked.status).toBe(400); expect(locked.body.code).toBe('PERIOD_HARD_CLOSED');

    const tb = (await call('reviewer', 'GET', '/trial-balance')).body.trialBalance;
    expect(tb.isBalanced).toBe(true);
    const cash = tb.items.find((i: any) => i.accountNumber === '1010');
    expect(cash.endingDebit).toBe(6154.5);
    const statements = (await call('reviewer', 'GET', '/financial-statements')).body.statements;
    expect(statements.profitAndLoss).toMatchObject({ grossRevenue: 1200, totalOperatingExpenses: 120.5, netIncome: 1079.5 });
    expect(statements.balanceSheet.isBalanced).toBe(true);
    const gl = (await call('reviewer', 'GET', `/general-ledger?accountId=${acct['1010']}`)).body.accounts;
    expect(gl[0].lines.map((l: any) => l.runningBalance)).toEqual([5000, 6200, 6154.5]);
    const search = (await call('accountant', 'GET', '/journal-entries?q=accrued&status=POSTED')).body.entries;
    expect(search.map((e: any) => e.description)).toEqual(['Synthetic accrued expense (corrected)']);
    const history = (await call('reviewer', 'GET', '/history')).body.events.map((e: any) => e.action);
    expect(history).toEqual(expect.arrayContaining(['LEDGER_PERIOD_CLOSED', 'LEDGER_RECONCILIATION_FINALIZED', 'LEDGER_ENTRY_CORRECTION_REQUIRED', 'LEDGER_ENTRY_REJECTED', 'LEDGER_TRANSACTION_CATEGORIZED']));
  });

  it('replays a retried post with the same idempotency key and requires a key', async () => {
    const body = { postingDate: '2025-04-02', description: 'Synthetic retry', lines: [{ accountId: acct['1010'], debit: 3, credit: 0 }, { accountId: acct['4010'], debit: 0, credit: 3 }] };
    const headers = { Authorization: `Bearer ${people.accountant}-token`, 'Content-Type': 'application/json', 'Idempotency-Key': 'retry-key-0001' };
    const post = () => fetch(origin + '/api/bookkeeping/journal-entries', { method: 'POST', headers, body: JSON.stringify({ clientId: C, taxYear: 2025, ...body }) });
    const first = await post(), second = await post();
    expect(first.status).toBe(201); expect(second.status).toBe(200);
    expect((await second.json()).entry.id).toBe((await first.json()).entry.id);
    const missing = await call('accountant', 'POST', '/journal-entries', body, C, false);
    expect(missing.status).toBe(400); expect(missing.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('rejects client users, unassigned clients in the database and unsupported durable features', async () => {
    expect((await call('client', 'GET', '/journal-entries')).status).toBe(403);
    expect((await call('client', 'POST', '/periods', { periodName: 'x', startDate: '2025-05-01', endDate: '2025-05-31' })).status).toBe(403);
    const other = await call('accountant', 'GET', '/journal-entries', {}, OTHER);
    expect(other.status).toBe(403); expect(other.body.code).toBe('LEDGER_ACCESS_DENIED');
    const btt = await call('accountant', 'GET', '/book-to-tax');
    expect(btt.status).toBe(503); expect(btt.body.code).toBe('DURABLE_FEATURE_NOT_AVAILABLE');
  });

  it('fails closed in production when the durable ledger is not configured, never falling back to memory', async () => {
    setLedgerStoreForTesting(null);
    try {
      vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('TAXGUARD_TENANT_ID', T); vi.stubEnv('TAXGUARD_LEDGER_STORE', '');
      const { selectLedger } = await import('../server/taxguard/bookkeeping/ledgerBackend');
      expect(selectLedger()).toEqual({ mode: 'unavailable' });
      vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('TAXGUARD_LEDGER_STORE', 'durable'); vi.stubEnv('SUPABASE_URL', 'https://cvrlhixxczerytiocxid.supabase.co'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-not-a-key');
      expect(selectLedger().mode).toBe('unavailable');
    } finally { setLedgerStoreForTesting(new SqlLedgerStore(pgliteRpc(() => fixture.pg))); }
  });

  it.each(['/general-ledger', '/trial-balance', '/financial-statements'])('returns coded 422 for unrepresentable report money on %s', async path => {
    const actual = pgliteRpc(() => fixture.pg);
    setLedgerStoreForTesting(new SqlLedgerStore({ async rpc(name, args) {
      const result = await actual.rpc(name, args);
      if (!result.error && name.endsWith('_exact')) result.data = result.data.map((row: any, index: number) => index ? row : {
        ...row, endingCents: '9100000000000001', periodDebitCents: '9100000000000001',
      });
      return result;
    } }));
    try {
      const response = await call('reviewer', 'GET', path);
      expect(response.status).toBe(422);
      expect(response.body).toEqual({ code: 'LEDGER_REPORT_AMOUNT_OUT_OF_RANGE', error: 'LEDGER_REPORT_AMOUNT_OUT_OF_RANGE' });
    } finally { setLedgerStoreForTesting(new SqlLedgerStore(actual)); }
  });
});
