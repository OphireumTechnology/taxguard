import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../server/db';

/** Assignment suspension / restoration / reassignment review: tenant ownership and input validation. Synthetic data. */
const state = vi.hoisted(() => ({ users: new Map<string, any>() }));
vi.mock('../server/auth', async original => ({
  ...await original<typeof import('../server/auth')>(),
  authenticateToken: (req: any, res: any, next: any) => {
    const user = state.users.get(req.get('x-test-user'));
    if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    req.user = user; next();
  },
}));
import { assignmentsRouter } from '../server/routes/assignments.routes';

let server: Server, origin: string;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api/assignments', assignmentsRouter);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });

const past = new Date(Date.now() - 86_400_000).toISOString();
const u = (id: string, role: string, tenantId: string, extra: Record<string, unknown> = {}) => ({ id, name: id, role, status: 'active', tenantId, ...extra });
const people = {
  adminA: u('as-admin-a', 'admin', 'tenant-as-a'),
  adminB: u('as-admin-b', 'admin', 'tenant-as-b'),
  accountant: u('as-accountant', 'accountant', 'tenant-as-a'),
  client: u('as-client-a', 'client', 'tenant-as-a', { clientId: 'as-client-a' }),
};
type Who = keyof typeof people;
const post = async (path: string, who: Who, body: unknown = {}) => {
  const r = await fetch(`${origin}/api/assignments${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': people[who].id }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const binding = (status: string) => db.clientAccountantAssignments.set('as-binding', {
  id: 'as-binding', clientId: 'as-client-a', clientName: 'Client A', accountantId: 'as-accountant', accountantName: 'Accountant', assignmentType: 'primary',
  status, accessScope: [], assignedBy: 'as-admin-a', assignedByName: 'Admin A', assignedAt: past, effectiveDate: past, internalNotes: '' } as any);

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  for (const p of Object.values(people)) { state.users.set(p.id, p); db.users.set(p.id, { ...p } as any); }
  binding('active');
  db.reassignmentRequests.set('as-request', { id: 'as-request', clientId: 'as-client-a', clientName: 'Client A', currentAccountantId: 'as-accountant', reason: 'Synthetic request', status: 'pending', createdAt: past } as any);
});
afterEach(() => {
  vi.unstubAllEnvs(); state.users.clear();
  for (const p of Object.values(people)) db.users.delete(p.id);
  db.clientAccountantAssignments.delete('as-binding');
  db.reassignmentRequests.delete('as-request');
});

describe('suspend and restore', () => {
  it('another tenant\'s administrator cannot suspend or restore (404, no change)', async () => {
    expect((await post('/suspend', 'adminB', { bindingId: 'as-binding', reason: 'cross-tenant' })).status).toBe(404);
    expect(db.clientAccountantAssignments.get('as-binding')?.status).toBe('active');
    binding('suspended');
    expect((await post('/restore', 'adminB', { bindingId: 'as-binding' })).status).toBe(404);
    expect(db.clientAccountantAssignments.get('as-binding')?.status).toBe('suspended');
  });
  it.each(['accountant', 'client'] as const)('%s cannot suspend or restore (role gate)', async who => {
    expect((await post('/suspend', who, { bindingId: 'as-binding' })).status).toBe(403);
    expect((await post('/restore', who, { bindingId: 'as-binding' })).status).toBe(403);
  });
  it('same-tenant administrator can suspend, and the suspension removes effective access', async () => {
    expect((await post('/suspend', 'adminA', { bindingId: 'as-binding', reason: 'Synthetic hold' })).status).toBe(200);
    expect(db.clientAccountantAssignments.get('as-binding')?.status).toBe('suspended');
  });
  it('restore lifts a suspension', async () => {
    binding('suspended');
    expect((await post('/restore', 'adminA', { bindingId: 'as-binding' })).status).toBe(200);
    expect(db.clientAccountantAssignments.get('as-binding')?.status).toBe('active');
  });
  it.each(['unbound', 'active'])('restore refuses a binding that is %s (cannot resurrect an ended assignment)', async status => {
    binding(status);
    const r = await post('/restore', 'adminA', { bindingId: 'as-binding' });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('ASSIGNMENT_NOT_SUSPENDED');
    expect(db.clientAccountantAssignments.get('as-binding')?.status).toBe(status);
  });
  it('unknown binding returns 404', async () => {
    expect((await post('/suspend', 'adminA', { bindingId: 'missing' })).status).toBe(404);
  });
});

describe('reassignment request review', () => {
  it('another tenant\'s administrator cannot review (404, no change)', async () => {
    expect((await post('/reassignment-requests/as-request/review', 'adminB', { action: 'approved' })).status).toBe(404);
    expect(db.reassignmentRequests.get('as-request')?.status).toBe('pending');
  });
  it.each([[{}], [{ action: 'APPROVE' }], [{ action: 'approve' }], [{ action: 1 }], [{ action: null }], [{ action: 'approved', notes: 'x'.repeat(2001) }]])(
    'rejects %j with a controlled 400 instead of crashing or silently rejecting', async body => {
      const r = await post('/reassignment-requests/as-request/review', 'adminA', body);
      expect(r.status).toBe(400);
      expect(['REVIEW_ACTION_INVALID', 'REVIEW_NOTES_INVALID']).toContain(r.body.code);
      expect(db.reassignmentRequests.get('as-request')?.status).toBe('pending');
    });
  it.each(['approved', 'rejected'])('same-tenant administrator can record %s', async action => {
    const r = await post('/reassignment-requests/as-request/review', 'adminA', { action, notes: 'Synthetic review' });
    expect(r.status).toBe(200);
    expect(db.reassignmentRequests.get('as-request')).toMatchObject({ status: action, reviewedBy: 'as-admin-a' });
  });
  it('non-administrators cannot review', async () => {
    expect((await post('/reassignment-requests/as-request/review', 'accountant', { action: 'approved' })).status).toBe(403);
  });
});
