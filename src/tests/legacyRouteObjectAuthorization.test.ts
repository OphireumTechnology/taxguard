import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../server/db';

/** Object-level authorization for legacy message, appointment and practice-console routes. Synthetic data. */
const state = vi.hoisted(() => ({ users: new Map<string, any>() }));
vi.mock('../server/auth', async original => ({
  ...await original<typeof import('../server/auth')>(),
  authenticateToken: (req: any, res: any, next: any) => {
    const user = state.users.get(req.get('x-test-user'));
    if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    req.user = user; next();
  },
}));
import { messagesRouter } from '../server/routes/messages.routes';
import { appointmentsRouter } from '../server/routes/appointments.routes';
import { practiceConsoleRouter } from '../server/routes/practice-console.routes';

let server: Server, origin: string;
beforeAll(async () => {
  const app = express(); app.use(express.json());
  app.use('/api/messages', messagesRouter); app.use('/api/appointments', appointmentsRouter); app.use('/api/practice-console', practiceConsoleRouter);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });

const past = new Date(Date.now() - 86_400_000).toISOString();
const u = (id: string, role: string, tenantId: string, extra: Record<string, unknown> = {}) => ({ id, name: id, role, status: 'active', tenantId, ...extra });
const people = {
  clientA: u('lr-client-a', 'client', 'tenant-lr-a', { clientId: 'lr-client-a' }),
  clientA2: u('lr-client-a2', 'client', 'tenant-lr-a', { clientId: 'lr-client-a2' }),
  accountant: u('lr-accountant', 'accountant', 'tenant-lr-a'),
  unassigned: u('lr-unassigned', 'accountant', 'tenant-lr-a'),
  adminB: u('lr-admin-b', 'admin', 'tenant-lr-b'),
};
type Who = keyof typeof people;
const call = async (method: string, path: string, who: Who, body?: unknown) => {
  const r = await fetch(`${origin}/api${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-user': people[who].id }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  for (const p of Object.values(people)) state.users.set(p.id, p);
  for (const c of [people.clientA, people.clientA2]) db.users.set(c.id, { ...c } as any);
  db.clientAccountantAssignments.set('lr-asg', { id: 'lr-asg', clientId: 'lr-client-a', clientName: 'a', accountantId: 'lr-accountant', accountantName: 'a', assignmentType: 'primary', status: 'active', accessScope: [], assignedBy: 'x', assignedByName: 'x', assignedAt: past, effectiveDate: past } as any);
  db.messages.set('lr-msg', { id: 'lr-msg', clientId: 'lr-client-a', senderId: 'lr-accountant', senderName: 'a', senderRole: 'accountant', content: 'Synthetic', isRead: false } as any);
  db.messages.set('lr-msg-internal', { id: 'lr-msg-internal', clientId: 'lr-client-a', senderId: 'lr-accountant', senderName: 'a', senderRole: 'accountant', content: 'Internal', isRead: false, isInternalOnly: true } as any);
  db.appointments.set('lr-apt', { id: 'lr-apt', clientId: 'lr-client-a', accountantId: 'lr-accountant', status: 'confirmed', date: '2026-11-02', timeSlot: '10:00' } as any);
  db.documents.set('lr-doc', { id: 'lr-doc', clientId: 'lr-client-a', fileName: 'w2.pdf', category: 'other', taxYear: 2025, status: 'uploaded' } as any);
});
afterEach(() => {
  vi.unstubAllEnvs(); state.users.clear();
  for (const id of ['lr-client-a', 'lr-client-a2']) db.users.delete(id);
  db.clientAccountantAssignments.delete('lr-asg');
  for (const id of ['lr-msg', 'lr-msg-internal']) db.messages.delete(id);
  db.appointments.delete('lr-apt'); db.documents.delete('lr-doc');
});

describe('PATCH /messages/:id/read', () => {
  it.each(['clientA2', 'unassigned', 'adminB'] as const)('%s cannot mark another client\'s message read', async who => {
    expect((await call('PATCH', '/messages/lr-msg/read', who)).status).toBe(404);
    expect(db.messages.get('lr-msg')?.isRead).toBe(false);
  });
  it('the owning client and the sender can', async () => {
    expect((await call('PATCH', '/messages/lr-msg/read', 'clientA')).status).toBe(200);
    db.messages.get('lr-msg')!.isRead = false;
    expect((await call('PATCH', '/messages/lr-msg/read', 'accountant')).status).toBe(200);
  });
  it('a client cannot touch an internal-only staff note', async () => {
    expect((await call('PATCH', '/messages/lr-msg-internal/read', 'clientA')).status).toBe(404);
  });
});

describe('PATCH /appointments/:id', () => {
  it.each(['clientA2', 'unassigned', 'adminB'] as const)('%s cannot change another client\'s appointment', async who => {
    expect((await call('PATCH', '/appointments/lr-apt', who, { status: 'cancelled', date: '2026-12-01' })).status).toBe(404);
    expect(db.appointments.get('lr-apt')).toMatchObject({ status: 'confirmed', date: '2026-11-02' });
  });
  it('the client may cancel or reschedule, but cannot record a staff outcome', async () => {
    expect((await call('PATCH', '/appointments/lr-apt', 'clientA', { status: 'completed' })).status).toBe(403);
    expect((await call('PATCH', '/appointments/lr-apt', 'clientA', { status: 'canceled_by_client' })).status).toBe(200);
  });
  it.each([[{ status: 'deleted' }], [{ status: 7 }], [{ date: 'tomorrow' }], [{ notes: 'x'.repeat(2001) }]])('rejects invalid input %j instead of storing or crashing', async body => {
    expect((await call('PATCH', '/appointments/lr-apt', 'accountant', body)).status).toBe(400);
    expect(db.appointments.get('lr-apt')?.status).toBe('confirmed');
  });
  it('the assigned accountant can mark it completed', async () => {
    expect((await call('PATCH', '/appointments/lr-apt', 'accountant', { status: 'completed' })).status).toBe(200);
  });
});

describe('practice-console document resolution', () => {
  it.each(['unassigned', 'adminB'] as const)('%s cannot re-year or reclassify another tenant\'s / unassigned client\'s document', async who => {
    expect((await call('POST', '/practice-console/resolve-tax-year', who, { documentId: 'lr-doc', resolvedTaxYear: 2024 })).status).toBe(404);
    expect((await call('POST', '/practice-console/resolve-classification', who, { documentId: 'lr-doc', newCategory: 'tax_form_w2' })).status).toBe(404);
    expect(db.documents.get('lr-doc')).toMatchObject({ taxYear: 2025, category: 'other', status: 'uploaded' });
  });
  it('validates the resolved year and category', async () => {
    expect((await call('POST', '/practice-console/resolve-tax-year', 'accountant', { documentId: 'lr-doc', resolvedTaxYear: 'abc' })).status).toBe(400);
    expect((await call('POST', '/practice-console/resolve-tax-year', 'accountant', { documentId: 'lr-doc', resolvedTaxYear: 1990 })).status).toBe(400);
    expect((await call('POST', '/practice-console/resolve-classification', 'accountant', { documentId: 'lr-doc', newCategory: '<script>' })).status).toBe(400);
  });
  it('an assigned accountant can resolve both', async () => {
    expect((await call('POST', '/practice-console/resolve-tax-year', 'accountant', { documentId: 'lr-doc', resolvedTaxYear: 2024 })).status).toBe(200);
    expect((await call('POST', '/practice-console/resolve-classification', 'accountant', { documentId: 'lr-doc', newCategory: 'tax_form_w2' })).status).toBe(200);
    expect(db.documents.get('lr-doc')).toMatchObject({ taxYear: 2024, category: 'tax_form_w2' });
  });
});
