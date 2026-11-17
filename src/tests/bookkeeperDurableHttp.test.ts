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

// Bookkeeper on the durable ledger: real local authentication -> /api/bookkeeping -> proposals 024 + 030 (PGlite). Synthetic data only.
const T = 'tenantA', C = 'bkDurable', OTHER = 'bkOther';
const people = { bookkeeper: 'bk-durable', reviewer: 'bk-reviewer' } as const;
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let n = 0;
let store: SqlLedgerStore;

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(240000|300000)_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','owner','Synthetic Books'),('${T}','${OTHER}','owner2','Other');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('${T}','${people.bookkeeper}','bookkeeper','active'),('${T}','${people.reviewer}','senior_reviewer','active');
    INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,role,user_id,assigned_by,effective_from) VALUES
      ('bkd-1','${T}','${C}','bookkeeper','${people.bookkeeper}','seed',now()-interval '1 day'),('bkd-2','${T}','${C}','reviewer','${people.reviewer}','seed',now()-interval '1 day'),
      ('bkd-3','${T}','${OTHER}','reviewer','${people.reviewer}','seed',now()-interval '1 day');`);
  store = new SqlLedgerStore(pgliteRpc(() => fixture.pg));
  setLedgerStoreForTesting(store);
  const app = express(); app.use(express.json()); app.use('/api/bookkeeping', bookkeepingRouter);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 60000);
afterAll(async () => { setLedgerStoreForTesting(null); server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  db.users.set(people.bookkeeper, { id: people.bookkeeper, name: 'Synthetic Bookkeeper', email: 'bk@example.test', role: 'bookkeeper', tenantId: T, authorizedClientIds: [C, OTHER],
    status: 'active', createdAt: '2025-01-01', isVerified: true } as any);
  db.users.set(people.reviewer, { id: people.reviewer, name: 'Synthetic Reviewer', email: 'rv@example.test', role: 'senior_reviewer', tenantId: T, status: 'active', createdAt: '2025-01-01', isVerified: true } as any);
  for (const id of Object.values(people)) db.sessions.set(id + '-token', { userId: id, expiresAt: Date.now() + 60_000 } as any);
  for (const client of [C, OTHER]) db.clientAccountantAssignments.set(`bkd-${client}`, { id: `bkd-${client}`, clientId: client, clientName: client, accountantId: people.reviewer, accountantName: 'r',
    assignmentType: 'primary', status: 'active', accessScope: [], assignedBy: 'admin', assignedByName: 'Admin', assignedAt: '2025-01-01T00:00:00Z', effectiveDate: '2025-01-01T00:00:00Z' } as any);
});
afterEach(() => { for (const id of Object.values(people)) { db.users.delete(id); db.sessions.delete(id + '-token'); } for (const c of [C, OTHER]) db.clientAccountantAssignments.delete(`bkd-${c}`); vi.unstubAllEnvs(); });
const call = async (who: keyof typeof people, method: 'GET' | 'POST', path: string, body: Record<string, unknown> = {}, client = C) => {
  const q = method === 'GET' ? (path.includes('?') ? '&' : '?') + `clientId=${client}&taxYear=2025` : '';
  const r = await fetch(origin + '/api/bookkeeping' + path + q, { method, headers: { Authorization: `Bearer ${people[who]}-token`, 'Content-Type': 'application/json', 'Idempotency-Key': `bkd-key-${++n}-${Date.now()}` },
    ...(method === 'POST' ? { body: JSON.stringify({ clientId: client, taxYear: 2025, ...body }) } : {}) });
  return { status: r.status, body: await r.json().catch(() => null) };
};

describe('bookkeeper on the durable ledger', () => {
  let acct: Record<string, string> = {};
  it('works an authorized client: entries and categorizations always await independent review', async () => {
    acct = Object.fromEntries((await call('bookkeeper', 'POST', '/chart-of-accounts/standard')).body.accounts.map((a: any) => [a.accountNumber, a.id]));
    await call('bookkeeper', 'POST', '/periods', { periodName: '2025-Q1', startDate: '2025-01-01', endDate: '2025-03-31' });
    const entry = await call('bookkeeper', 'POST', '/journal-entries', { postingDate: '2025-01-15', description: 'Synthetic owner deposit',
      lines: [{ accountId: acct['1010'], debit: 1000, credit: 0 }, { accountId: acct['3010'], debit: 0, credit: 1000 }] });
    expect(entry.status).toBe(201); expect(entry.body.entry.status).toBe('PREPARED');
    await call('bookkeeper', 'POST', '/transactions/ingest', { accountId: acct['1010'], rawTransactions: [{ transactionDate: '2025-02-02', description: 'Synthetic SaaS', amount: -30, externalTransactionId: 'bkd-1' }] });
    let queue = (await call('bookkeeper', 'GET', '/work-queue')).body;
    expect(queue.actorRole).toBe('bookkeeper');
    expect(queue.uncategorized.map((t: any) => t.description)).toEqual(['Synthetic SaaS']);
    const categorized = await call('bookkeeper', 'POST', `/transactions/${queue.uncategorized[0].transactionId}/categorize`, { assignedAccountId: acct['6070'] });
    expect(categorized.body.journalEntry.status).toBe('PREPARED');
    queue = (await call('bookkeeper', 'GET', '/work-queue')).body;
    expect(queue.uncategorized).toEqual([]);
    expect(queue.awaitingReview.map((e: any) => e.description)).toEqual(['Synthetic owner deposit', 'Bank Feed: Synthetic SaaS']);
    expect(queue.periods[0]).toMatchObject({ periodName: '2025-Q1', status: 'OPEN', preparedEntries: 2 });
    const tbBefore = (await call('bookkeeper', 'GET', '/trial-balance')).body.trialBalance;
    expect(tbBefore.totalPeriodDebit).toBe(0);
  });

  it('cannot approve, close or reopen; a reviewer approves and the reports reflect it', async () => {
    const queue = (await call('bookkeeper', 'GET', '/work-queue')).body;
    const first = queue.awaitingReview[0];
    expect((await call('bookkeeper', 'POST', `/journal-entries/${first.entryId}/approve`, { version: first.version })).status).toBe(403);
    expect((await call('bookkeeper', 'POST', `/periods/period_${C}_2025-Q1/close`, { status: 'SOFT_CLOSED' })).status).toBe(403);
    for (const e of queue.awaitingReview) expect((await call('reviewer', 'POST', `/journal-entries/${e.entryId}/approve`, { version: e.version })).body.entry.status).toBe('POSTED');
    const statements = (await call('bookkeeper', 'GET', '/financial-statements')).body.statements;
    expect(statements.profitAndLoss.totalOperatingExpenses).toBe(30);
    expect(statements.balanceSheet.isBalanced).toBe(true);
    expect((await call('bookkeeper', 'GET', '/work-queue')).body.awaitingReview).toEqual([]);
  });

  it('reconciles, sees returned entries in the queue, and searches the journal', async () => {
    const txn = (await call('bookkeeper', 'GET', '/transactions')).body.transactions[0];
    const recon = await call('bookkeeper', 'POST', '/reconciliations/start', { accountId: acct['1010'], statementPeriodStart: '2025-02-01', statementPeriodEnd: '2025-02-28', statementBeginningBalance: 0, statementEndingBalance: -30 });
    expect((await call('bookkeeper', 'GET', '/work-queue')).body.openReconciliations).toHaveLength(1);
    await call('bookkeeper', 'POST', `/reconciliations/${recon.body.reconciliation.id}/clear`, { transactionId: txn.id, isCleared: true });
    expect((await call('bookkeeper', 'POST', `/reconciliations/${recon.body.reconciliation.id}/finalize`)).body.reconciliation.status).toBe('CLOSED');
    const wrong = await call('bookkeeper', 'POST', '/journal-entries', { postingDate: '2025-03-01', description: 'Synthetic misposting',
      lines: [{ accountId: acct['6070'], debit: 5, credit: 0 }, { accountId: acct['1010'], debit: 0, credit: 5 }] });
    await call('reviewer', 'POST', `/journal-entries/${wrong.body.entry.id}/request-correction`, { version: wrong.body.entry.version, note: 'Use the supplies account 6070 only for supplies' });
    expect((await call('bookkeeper', 'GET', '/work-queue')).body.returnedToMe.map((e: any) => e.reviewNote)).toEqual(['Use the supplies account 6070 only for supplies']);
    expect((await call('bookkeeper', 'GET', '/journal-entries?q=misposting')).body.entries.map((e: any) => e.status)).toEqual(['CORRECTION_REQUIRED']);
  });

  it('refuses clients outside the grant or without a database assignment, and the in-memory mode', async () => {
    expect((await call('bookkeeper', 'GET', '/work-queue', {}, 'bkNotGranted')).body.code).toBe('BOOKKEEPER_SCOPE_DENIED');
    const unassigned = await call('bookkeeper', 'GET', '/work-queue', {}, OTHER);
    expect(unassigned.status).toBe(403); expect(unassigned.body.code).toBe('LEDGER_ACCESS_DENIED');
    setLedgerStoreForTesting(null);
    try { expect((await call('bookkeeper', 'GET', '/work-queue')).body.code).toBe('BOOKKEEPER_CAPABILITY_DENIED'); }
    finally { setLedgerStoreForTesting(store); }
  });
});
