import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../server/db';

/** Accounting staging routes: tenant/assignment scoping, amount validation, rollback integrity. Synthetic data. */
const state = vi.hoisted(() => ({ users: new Map<string, any>() }));
vi.mock('../server/auth', async original => ({
  ...await original<typeof import('../server/auth')>(),
  authenticateToken: (req: any, res: any, next: any) => {
    const user = state.users.get(req.get('x-test-user'));
    if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    req.user = user; next();
  },
}));
import { stagingRouter } from '../server/routes/staging.routes';

let server: Server, origin: string;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api/staging', stagingRouter);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });

const past = new Date(Date.now() - 86_400_000).toISOString();
const u = (id: string, role: string, tenantId: string, extra: Record<string, unknown> = {}) => ({ id, name: id, role, status: 'active', tenantId, ...extra });
const people = {
  clientA: u('st-client-a', 'client', 'tenant-st-a', { clientId: 'st-client-a' }),
  prospectB: u('st-prospect-b', 'prospective_client', 'tenant-st-b', { clientId: 'st-prospect-b' }),
  accountant: u('st-accountant', 'accountant', 'tenant-st-a'),
  unassigned: u('st-unassigned', 'accountant', 'tenant-st-a'),
  adminB: u('st-admin-b', 'administrator', 'tenant-st-b'),
  adminA: u('st-admin-a', 'administrator', 'tenant-st-a'),
};
type Who = keyof typeof people;
const call = async (method: string, path: string, who: Who, body?: unknown) => {
  const r = await fetch(`${origin}/api/staging${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-user': people[who].id }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const record = (id: string, clientId: string, status: string) => db.accountingStagingRecords.set(id, {
  id, clientId, clientName: clientId, status, recordType: 'expense', date: past, description: 'Synthetic', amount: 100, debitAmount: 100, creditAmount: 0,
  suggestedAccountCode: '6000', suggestedAccountName: 'Office', confidenceScore: 0.9, aiModelVersion: 'synthetic', sourceDocumentName: 'synthetic.pdf', auditTrail: [] } as any);

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  for (const p of Object.values(people)) state.users.set(p.id, p);
  for (const c of [people.clientA, people.prospectB]) db.users.set(c.id, { ...c } as any);
  db.clientAccountantAssignments.set('st-asg', { id: 'st-asg', clientId: 'st-client-a', clientName: 'a', accountantId: 'st-accountant', accountantName: 'a', assignmentType: 'primary', status: 'active', accessScope: [], assignedBy: 'x', assignedByName: 'x', assignedAt: past, effectiveDate: past } as any);
  record('st-rec-a', 'st-client-a', 'needs_review');
  record('st-rec-a-posted', 'st-client-a', 'posted');
  record('st-rec-b', 'st-prospect-b', 'needs_review');
});
afterEach(() => {
  vi.unstubAllEnvs(); state.users.clear();
  for (const id of ['st-client-a', 'st-prospect-b']) db.users.delete(id);
  db.clientAccountantAssignments.delete('st-asg');
  for (const id of ['st-rec-a', 'st-rec-a-posted', 'st-rec-b']) db.accountingStagingRecords.delete(id);
  for (const [id, tx] of Array.from(db.bookkeepingTransactions.entries())) if (String(tx.clientId).startsWith('st-')) db.bookkeepingTransactions.delete(id);
});

const ids = (body: any) => (body.records as any[]).map(r => r.id).filter((id: string) => id.startsWith('st-rec-')).sort();

describe('listing and metrics are scoped', () => {
  it.each([['clientA', ['st-rec-a', 'st-rec-a-posted']], ['prospectB', ['st-rec-b']], ['accountant', ['st-rec-a', 'st-rec-a-posted']], ['unassigned', []], ['adminB', ['st-rec-b']], ['adminA', ['st-rec-a', 'st-rec-a-posted']]] as const)(
    '%s lists only authorized records', async (who, expected) => {
      expect(ids((await call('GET', '/records', who)).body)).toEqual([...expected]);
    });
  it('a clientId query cannot widen access', async () => {
    expect(ids((await call('GET', '/records?clientId=st-prospect-b', 'accountant')).body)).toEqual([]);
  });
  it('metrics count only authorized records (previously all tenants for staff and prospective clients)', async () => {
    const m = (await call('GET', '/metrics', 'unassigned')).body;
    expect(m.total).toBe(0);
    const p = (await call('GET', '/metrics', 'prospectB')).body;
    expect(p.total).toBe(1);
  });
});

describe('record actions are object-authorized', () => {
  it.each(['unassigned', 'adminB'] as const)('%s cannot review, approve, post or roll back another client\'s record', async who => {
    expect((await call('PUT', '/records/st-rec-a/review', who, { notes: 'x' })).status).toBe(404);
    expect((await call('POST', '/records/st-rec-a/approve', who)).status).toBe(404);
    expect((await call('POST', '/records/st-rec-a/post', who)).status).toBe(404);
    expect((await call('POST', '/records/st-rec-a/rollback', who)).status).toBe(404);
    expect(db.accountingStagingRecords.get('st-rec-a')?.status).toBe('needs_review');
  });
  it('an assigned accountant can approve then post, creating exactly one ledger transaction', async () => {
    expect((await call('POST', '/records/st-rec-a/approve', 'accountant')).status).toBe(200);
    expect((await call('POST', '/records/st-rec-a/post', 'accountant')).status).toBe(200);
    expect(Array.from(db.bookkeepingTransactions.values()).filter(t => t.clientId === 'st-client-a')).toHaveLength(1);
  });
  it.each([[{ debitAmount: -5 }], [{ creditAmount: 1e309 }], [{ debitAmount: 'NaN' }]])('review rejects invalid amount %j', async body => {
    const r = await call('PUT', '/records/st-rec-a/review', 'accountant', body);
    expect(r.status).toBe(400);
    expect(db.accountingStagingRecords.get('st-rec-a')?.debitAmount).toBe(100);
  });
  it('a posted record cannot be rolled back (would duplicate the ledger on re-post)', async () => {
    const r = await call('POST', '/records/st-rec-a-posted/rollback', 'accountant');
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('ROLLBACK_REQUIRES_REVERSAL');
    expect(db.accountingStagingRecords.get('st-rec-a-posted')?.status).toBe('posted');
  });
  it('an unposted approved record can still be rolled back to review', async () => {
    await call('POST', '/records/st-rec-a/approve', 'accountant');
    expect((await call('POST', '/records/st-rec-a/rollback', 'accountant')).status).toBe(200);
    expect(db.accountingStagingRecords.get('st-rec-a')?.status).toBe('needs_review');
  });
});
