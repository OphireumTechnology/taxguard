import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { bookkeepingRouter } from '../server/routes/bookkeeping.routes';
import { db } from '../server/db';
import { setLedgerStoreForTesting } from '../server/taxguard/bookkeeping/ledgerBackend';
import { SqlLedgerStore } from '../server/taxguard/bookkeeping/sqlLedgerStore';
import { bookkeeperKpis } from '../components/workspace/bookkeeperDashboardModel';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// The bookkeeper's existing panels fed from the durable ledger (Phase 4): real local
// authentication -> /api/bookkeeping/bookkeeper-dashboard -> proposals 024 + 030 (PGlite).
const T = 'tenantA', C = 'bdClient', OTHER = 'bdOther';
const people = { bookkeeper: 'bd-bookkeeper', reviewer: 'bd-reviewer' } as const;
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let n = 0; let store: SqlLedgerStore;
beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(240000|300000)_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','o1','Synthetic Books'),('${T}','${OTHER}','o2','Other');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('${T}','${people.bookkeeper}','bookkeeper','active'),('${T}','${people.reviewer}','senior_reviewer','active');
    INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,role,user_id,assigned_by,effective_from) VALUES
      ('bd-1','${T}','${C}','bookkeeper','${people.bookkeeper}','seed',now()-interval '1 day'),('bd-2','${T}','${C}','reviewer','${people.reviewer}','seed',now()-interval '1 day');`);
  store = new SqlLedgerStore(pgliteRpc(() => fixture.pg));
  setLedgerStoreForTesting(store);
  const app = express(); app.use(express.json()); app.use('/api/bookkeeping', bookkeepingRouter);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 60000);
afterAll(async () => { setLedgerStoreForTesting(null); server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  db.users.set(people.bookkeeper, { id: people.bookkeeper, name: 'Synthetic Bookkeeper', email: 'bd@example.test', role: 'bookkeeper', tenantId: T, authorizedClientIds: [C, OTHER],
    status: 'active', createdAt: '2025-01-01', isVerified: true } as any);
  db.users.set(people.reviewer, { id: people.reviewer, name: 'Synthetic Reviewer', email: 'bdr@example.test', role: 'senior_reviewer', tenantId: T, status: 'active', createdAt: '2025-01-01', isVerified: true } as any);
  for (const id of Object.values(people)) db.sessions.set(id + '-token', { userId: id, expiresAt: Date.now() + 60_000 } as any);
  db.clientAccountantAssignments.set('bd-binding', { id: 'bd-binding', clientId: C, clientName: C, accountantId: people.reviewer, accountantName: 'r', assignmentType: 'primary', status: 'active',
    accessScope: [], assignedBy: 'admin', assignedByName: 'Admin', assignedAt: '2025-01-01T00:00:00Z', effectiveDate: '2025-01-01T00:00:00Z' } as any);
});
afterEach(() => { for (const id of Object.values(people)) { db.users.delete(id); db.sessions.delete(id + '-token'); } db.clientAccountantAssignments.delete('bd-binding'); vi.unstubAllEnvs(); });
const call = async (who: keyof typeof people, method: 'GET' | 'POST', path: string, body: Record<string, unknown> = {}, client = C) => {
  const q = method === 'GET' ? (path.includes('?') ? '&' : '?') + `clientId=${client}&taxYear=2025` : '';
  const r = await fetch(origin + '/api/bookkeeping' + path + q, { method, headers: { Authorization: `Bearer ${people[who]}-token`, 'Content-Type': 'application/json', 'Idempotency-Key': `bd-key-${++n}-${Date.now()}` },
    ...(method === 'POST' ? { body: JSON.stringify({ clientId: client, taxYear: 2025, ...body }) } : {}) });
  return { status: r.status, body: await r.json().catch(() => null) as any };
};

describe('bookkeeper dashboard on the durable ledger', () => {
  it('reports each bank transaction as recorded: unclassified, pending review, posted, cleared, reconciled', async () => {
    const acct = Object.fromEntries((await call('bookkeeper', 'POST', '/chart-of-accounts/standard')).body.accounts.map((a: any) => [a.accountNumber, a.id]));
    await call('bookkeeper', 'POST', '/transactions/ingest', { accountId: acct['1010'], rawTransactions: [{ transactionDate: '2025-04-03', description: 'Synthetic postage', amount: -12.34, externalTransactionId: 'bd-1' }] });
    let dash = (await call('bookkeeper', 'GET', '/bookkeeper-dashboard')).body;
    expect(dash).toMatchObject({ provider: 'DURABLE_LEDGER', truncated: false, scope: { tenantId: T, clientId: C, taxYear: 2025 } });
    expect(dash.transactions.map((t: any) => [t.description, t.amount, t.classification, t.reconciliation])).toEqual([['Synthetic postage', -12.34, 'UNCLASSIFIED', 'UNRECONCILED']]);
    expect(bookkeeperKpis(dash)).toMatchObject({ records: 1, uncategorized: 1, reconciled: 0 });
    const txn = dash.transactions[0];
    await call('bookkeeper', 'POST', `/transactions/${txn.id}/categorize`, { assignedAccountId: acct['6070'] });
    dash = (await call('bookkeeper', 'GET', '/bookkeeper-dashboard')).body;
    expect(dash.transactions[0]).toMatchObject({ classification: 'PENDING_REVIEW', category: expect.stringMatching(/./) });
    expect(dash.journals.map((j: any) => j.status)).toEqual(['PREPARED']);
    const entry = (await call('reviewer', 'GET', '/journal-entries?status=PREPARED')).body.entries[0];
    await call('reviewer', 'POST', `/journal-entries/${entry.id}/approve`, { version: entry.version });
    const recon = (await call('bookkeeper', 'POST', '/reconciliations/start', { accountId: acct['1010'], statementPeriodStart: '2025-04-01', statementPeriodEnd: '2025-04-30',
      statementBeginningBalance: 0, statementEndingBalance: -12.34 })).body.reconciliation;
    await call('bookkeeper', 'POST', `/reconciliations/${recon.id}/clear`, { transactionId: txn.id, isCleared: true });
    dash = (await call('bookkeeper', 'GET', '/bookkeeper-dashboard')).body;
    expect(dash.transactions[0]).toMatchObject({ classification: 'POSTED', reconciliation: 'CLEARED' });
    await call('bookkeeper', 'POST', `/reconciliations/${recon.id}/finalize`);
    dash = (await call('bookkeeper', 'GET', '/bookkeeper-dashboard')).body;
    expect(dash.transactions[0].reconciliation).toBe('RECONCILED');
    expect(bookkeeperKpis(dash)).toMatchObject({ records: 1, uncategorized: 0, reconciled: 1 });
    expect(dash.reconciliations.map((r: any) => [r.status, r.variance, r.matched])).toEqual([['CLOSED', 0, 1]]);
    expect(dash.capabilities).toEqual({ mutations: false, periodClose: false, privateDocumentPreview: false });
  });
  it('re-checks the database assignment, the grant and periods, and falls back to memory only when not durable', async () => {
    const unassigned = await call('bookkeeper', 'GET', '/bookkeeper-dashboard', {}, OTHER);
    expect(unassigned.status).toBe(403); expect(unassigned.body.code).toBe('LEDGER_ACCESS_DENIED');
    expect((await call('bookkeeper', 'GET', '/bookkeeper-dashboard', {}, 'bdNotGranted')).body.code).toBe('BOOKKEEPER_SCOPE_DENIED');
    expect((await call('bookkeeper', 'GET', '/bookkeeper-dashboard?periodId=missing')).body.code).toBe('PERIOD_ACCESS_DENIED');
    expect((await call('reviewer', 'GET', '/bookkeeper-dashboard')).body.code).toBe('BOOKKEEPER_REQUIRED');
    setLedgerStoreForTesting(null);
    try { expect((await call('bookkeeper', 'GET', '/bookkeeper-dashboard')).body.provider).toBeUndefined(); }
    finally { setLedgerStoreForTesting(store); }
  });
});
