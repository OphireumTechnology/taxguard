import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../server/db';

/** Accounting-integration routes: ownership, tenant isolation, maker-checker and honest provider status. Synthetic data. */
const state = vi.hoisted(() => ({ users: new Map<string, any>() }));
vi.mock('../server/auth', async original => ({
  ...await original<typeof import('../server/auth')>(),
  authenticateToken: (req: any, res: any, next: any) => {
    const user = state.users.get(req.get('x-test-user'));
    if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    req.user = user; next();
  },
}));
import { integrationsRouter } from '../server/routes/integrations.routes';

let server: Server, origin: string;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api/integrations', integrationsRouter);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });

const past = new Date(Date.now() - 86_400_000).toISOString();
const u = (id: string, role: string, tenantId: string, extra: Record<string, unknown> = {}) => ({ id, name: id, role, status: 'active', tenantId, ...extra });
const people = {
  clientA: u('ig-client-a', 'client', 'tenant-ig-a', { clientId: 'ig-client-a' }),
  clientA2: u('ig-client-a2', 'client', 'tenant-ig-a', { clientId: 'ig-client-a2' }),
  clientB: u('ig-client-b', 'client', 'tenant-ig-b', { clientId: 'ig-client-b' }),
  preparer: u('ig-preparer', 'accountant', 'tenant-ig-a'),
  senior: u('ig-senior', 'senior_reviewer', 'tenant-ig-a'),
  adminA: u('ig-admin-a', 'admin', 'tenant-ig-a'),
  adminB: u('ig-admin-b', 'admin', 'tenant-ig-b'),
  unassigned: u('ig-unassigned', 'accountant', 'tenant-ig-a'),
};
type Who = keyof typeof people;
const call = async (method: string, path: string, who: Who, body?: unknown) => {
  const r = await fetch(`${origin}/api/integrations${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-user': people[who].id }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const assign = (accountantId: string, clientId: string) => db.clientAccountantAssignments.set(`ig-asg-${accountantId}`, {
  id: `ig-asg-${accountantId}`, clientId, clientName: clientId, accountantId, accountantName: accountantId, assignmentType: 'primary',
  status: 'active', accessScope: [], assignedBy: 'admin', assignedByName: 'Admin', assignedAt: past, effectiveDate: past } as any);
const conn = (id: string, clientId: string, extra: Record<string, unknown> = {}) => db.accountingConnections.set(id, {
  id, clientId, provider: 'xero', companyName: 'Synthetic Co', status: 'pending_auth', readOnlyDefault: true, errorCount: 0, syncErrors: [],
  writeAuthorization: { clientAuthorized: false, accountantPrepared: false, reviewerApproved: false, explicitlyConfirmed: false }, ...extra } as any);

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  for (const p of Object.values(people)) state.users.set(p.id, p);
  for (const c of [people.clientA, people.clientA2, people.clientB]) db.users.set(c.id, { ...c } as any);
  assign('ig-preparer', 'ig-client-a'); assign('ig-senior', 'ig-client-a');
  conn('ig-conn-a', 'ig-client-a'); conn('ig-conn-b', 'ig-client-b');
});
afterEach(() => {
  vi.unstubAllEnvs(); state.users.clear();
  for (const id of ['ig-client-a', 'ig-client-a2', 'ig-client-b']) db.users.delete(id);
  for (const id of Array.from(db.clientAccountantAssignments.keys())) if (id.startsWith('ig-asg-')) db.clientAccountantAssignments.delete(id);
  for (const [id, c] of Array.from(db.accountingConnections.entries())) if (id.startsWith('ig-conn-') || String(c.clientId).startsWith('ig-')) db.accountingConnections.delete(id);
});

describe('listing', () => {
  it.each([['clientA', ['ig-conn-a']], ['clientB', ['ig-conn-b']], ['preparer', ['ig-conn-a']], ['adminA', ['ig-conn-a']], ['adminB', ['ig-conn-b']], ['unassigned', []], ['clientA2', []]] as const)(
    '%s sees only authorized connections', async (who, expected) => {
      const ids = ((await call('GET', '/', who)).body.connections as any[]).map(c => c.id).filter(id => id.startsWith('ig-conn-')).sort();
      expect(ids).toEqual([...expected]);
    });
});

describe('connect', () => {
  it('records a pending, read-only request without invented sync data', async () => {
    const r = await call('POST', '/connect', 'clientA', { provider: 'xero', companyName: 'Synthetic LLC' });
    expect(r.status).toBe(201);
    expect(r.body.connection).toMatchObject({ clientId: 'ig-client-a', status: 'pending_auth', readOnlyDefault: true });
    expect(r.body.connection).not.toHaveProperty('accountCount');
    expect(r.body.connection).not.toHaveProperty('lastSyncAt');
  });
  it('a client cannot attach a connection to another client by passing clientId', async () => {
    const r = await call('POST', '/connect', 'clientA', { provider: 'xero', clientId: 'ig-client-b' });
    expect(r.status).toBe(201);
    expect(r.body.connection.clientId).toBe('ig-client-a');
  });
  it.each([['unassigned', 'ig-client-a'], ['adminB', 'ig-client-a'], ['preparer', 'ig-client-b'], ['preparer', undefined]] as const)('%s cannot connect for client %s', async (who, clientId) => {
    expect((await call('POST', '/connect', who, { provider: 'xero', clientId })).status).toBe(403);
  });
  it('rejects unknown providers', async () => {
    expect((await call('POST', '/connect', 'clientA', { provider: 'evil' })).status).toBe(400);
  });
});

describe('object access on existing connections', () => {
  it.each([['clientB'], ['clientA2'], ['adminB'], ['unassigned']] as const)('%s gets 404 for another client\'s connection on every endpoint, with no state change', async who => {
    for (const path of ['/ig-conn-a/sync', '/ig-conn-a/disconnect', '/ig-conn-a/authorize-write/client', '/ig-conn-a/authorize-write/accountant-prepare', '/ig-conn-a/authorize-write/reviewer-approve', '/ig-conn-a/authorize-write/execute-commit'])
      expect((await call('POST', path, who, { confirmationPhrase: 'CONFIRM_WRITE_TO_LEDGER' })).status).toBe(404);
    expect(db.accountingConnections.get('ig-conn-a')).toMatchObject({ status: 'pending_auth', writeAuthorization: { clientAuthorized: false } });
  });
  it('sync never reports a fabricated success', async () => {
    const r = await call('POST', '/ig-conn-a/sync', 'clientA');
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('ACCOUNTING_PROVIDER_NOT_COMMISSIONED');
    expect(db.accountingConnections.get('ig-conn-a')?.status).toBe('pending_auth');
  });
});

describe('write authorization pipeline', () => {
  it('stage 1 is the client\'s own consent: staff and admins cannot record it', async () => {
    for (const who of ['adminA', 'preparer', 'senior'] as const) expect((await call('POST', '/ig-conn-a/authorize-write/client', who)).status).toBe(403);
    expect((await call('POST', '/ig-conn-a/authorize-write/client', 'clientA')).status).toBe(200);
    expect(db.accountingConnections.get('ig-conn-a')?.writeAuthorization).toMatchObject({ clientAuthorized: true, clientAuthorizedBy: 'ig-client-a' });
  });
  it('stage 2 is staff-only; a client cannot prepare its own batch', async () => {
    await call('POST', '/ig-conn-a/authorize-write/client', 'clientA');
    expect((await call('POST', '/ig-conn-a/authorize-write/accountant-prepare', 'clientA')).status).toBe(403);
    expect((await call('POST', '/ig-conn-a/authorize-write/accountant-prepare', 'preparer')).status).toBe(200);
  });
  it('stage 3 must be an independent reviewer (maker-checker), and execution never fabricates a commit', async () => {
    await call('POST', '/ig-conn-a/authorize-write/client', 'clientA');
    await call('POST', '/ig-conn-a/authorize-write/accountant-prepare', 'senior');
    const self = await call('POST', '/ig-conn-a/authorize-write/reviewer-approve', 'senior');
    expect(self.status).toBe(403);
    expect(self.body.code).toBe('MAKER_CHECKER_VIOLATION');
    expect((await call('POST', '/ig-conn-a/authorize-write/reviewer-approve', 'adminA')).status).toBe(200);
    expect((await call('POST', '/ig-conn-a/authorize-write/execute-commit', 'clientA', { confirmationPhrase: 'CONFIRM_WRITE_TO_LEDGER' })).status).toBe(403);
    const exec = await call('POST', '/ig-conn-a/authorize-write/execute-commit', 'preparer', { confirmationPhrase: 'CONFIRM_WRITE_TO_LEDGER' });
    expect(exec.status).toBe(503);
    expect(exec.body).toMatchObject({ code: 'ACCOUNTING_PROVIDER_NOT_COMMISSIONED', transmitted: false });
    expect(exec.body).not.toHaveProperty('success');
    expect(db.accountingConnections.get('ig-conn-a')?.writeAuthorization?.explicitlyConfirmed).toBe(false);
  });
  it('execution without all prior stages is refused', async () => {
    expect((await call('POST', '/ig-conn-a/authorize-write/execute-commit', 'preparer', { confirmationPhrase: 'CONFIRM_WRITE_TO_LEDGER' })).body.code).toBe('STAGE_CHECK_FAILED');
  });
  it('disconnect revokes every write authorization', async () => {
    await call('POST', '/ig-conn-a/authorize-write/client', 'clientA');
    expect((await call('POST', '/ig-conn-a/disconnect', 'clientA')).status).toBe(200);
    expect(db.accountingConnections.get('ig-conn-a')).toMatchObject({ status: 'disconnected', writeAuthorization: { clientAuthorized: false } });
  });
});
