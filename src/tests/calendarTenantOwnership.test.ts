import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../server/db';

/** Calendar routes: tenant ownership, appointment access, honest provider status. Synthetic data. */
const state = vi.hoisted(() => ({ users: new Map<string, any>() }));
vi.mock('../server/auth', async original => ({
  ...await original<typeof import('../server/auth')>(),
  authenticateToken: (req: any, res: any, next: any) => {
    const user = state.users.get(req.get('x-test-user'));
    if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    req.user = user; next();
  },
}));
import { calendarRouter } from '../server/routes/calendar.routes';

let server: Server, origin: string;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api/calendar', calendarRouter);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });

const past = new Date(Date.now() - 86_400_000).toISOString();
const u = (id: string, role: string, tenantId: string, extra: Record<string, unknown> = {}) => ({ id, name: id, email: `${id}@example.invalid`, role, status: 'active', tenantId, ...extra });
const people = {
  adminA: u('cal-admin-a', 'administrator', 'tenant-cal-a'),
  adminB: u('cal-admin-b', 'administrator', 'tenant-cal-b'),
  staffA: u('cal-staff-a', 'accountant', 'tenant-cal-a'),
  staffOther: u('cal-staff-other', 'accountant', 'tenant-cal-a'),
  staffB: u('cal-staff-b', 'accountant', 'tenant-cal-b'),
  client: u('cal-client', 'client', 'tenant-cal-a', { clientId: 'cal-client' }),
  prospect: u('cal-prospect', 'prospective_client', 'tenant-cal-a', { clientId: 'cal-prospect' }),
};
type Who = keyof typeof people;
const call = async (method: string, path: string, who: Who, body?: unknown) => {
  const r = await fetch(`${origin}/api/calendar${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-user': people[who].id }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  for (const p of Object.values(people)) { state.users.set(p.id, p); db.users.set(p.id, { ...p } as any); }
  db.appointments.set('cal-apt', { id: 'cal-apt', clientId: 'cal-client', clientEmail: 'cal-client@example.invalid', accountantId: 'cal-staff-a', status: 'confirmed', date: '2026-11-02', timeSlot: '10:00' } as any);
  db.appointments.set('cal-apt-b', { id: 'cal-apt-b', clientId: 'cal-client-b', accountantId: 'cal-staff-b', status: 'confirmed', date: '2026-11-03', timeSlot: '11:00' } as any);
  db.calendarConnections.set('cal-conn-a', { id: 'cal-conn-a', staffId: 'cal-staff-a', staffName: 'a', provider: 'google_calendar', status: 'connected', twoWaySyncEnabled: false } as any);
  db.calendarConnections.set('cal-conn-b', { id: 'cal-conn-b', staffId: 'cal-staff-b', staffName: 'b', provider: 'google_calendar', status: 'connected', twoWaySyncEnabled: false } as any);
});
afterEach(() => {
  vi.unstubAllEnvs(); state.users.clear();
  for (const p of Object.values(people)) db.users.delete(p.id);
  for (const id of Array.from(db.appointments.keys())) if (id.startsWith('cal-apt') || db.appointments.get(id)?.accountantId?.startsWith?.('cal-')) db.appointments.delete(id);
  for (const id of Array.from(db.calendarConnections.keys())) if (id.startsWith('cal-conn') || id.includes('cal-')) db.calendarConnections.delete(id);
});

describe('reschedule and cancel', () => {
  it.each(['staffOther', 'staffB', 'adminB', 'prospect'] as const)('%s cannot reschedule or cancel (previously only the client role was checked)', async who => {
    expect((await call('POST', '/reschedule', who, { appointmentId: 'cal-apt', newDate: '2026-11-09', newTimeSlot: '14:00' })).status).toBe(404);
    expect((await call('POST', '/cancel', who, { appointmentId: 'cal-apt' })).status).toBe(404);
    expect(db.appointments.get('cal-apt')).toMatchObject({ status: 'confirmed', date: '2026-11-02' });
  });
  it.each(['client', 'staffA', 'adminA'] as const)('%s may reschedule', async who => {
    expect((await call('POST', '/reschedule', who, { appointmentId: 'cal-apt', newDate: '2026-11-09', newTimeSlot: '14:00' })).status).toBe(200);
    expect(db.appointments.get('cal-apt')?.date).toBe('2026-11-09');
  });
  it('client cancellation is recorded as canceled_by_client; staff as canceled_by_staff', async () => {
    expect((await call('POST', '/cancel', 'client', { appointmentId: 'cal-apt' })).status).toBe(200);
    expect(db.appointments.get('cal-apt')?.status).toBe('canceled_by_client');
    db.appointments.get('cal-apt')!.status = 'confirmed';
    expect((await call('POST', '/cancel', 'staffA', { appointmentId: 'cal-apt' })).status).toBe(200);
    expect(db.appointments.get('cal-apt')?.status).toBe('canceled_by_staff');
  });
  it.each([[{ newDate: 'next week', newTimeSlot: '14:00' }], [{ newDate: '2026-11-09', newTimeSlot: 'x'.repeat(40) }], [{ newDate: '2026-11-09', newTimeSlot: '2:00 PM' }]])('rejects malformed reschedule %j (a non HH:MM slot previously crashed with 500)', async body => {
    expect((await call('POST', '/reschedule', 'client', { appointmentId: 'cal-apt', ...body })).status).toBe(400);
  });
});

describe('provider connections', () => {
  it('administrators list only their tenant\'s connections', async () => {
    const ids = ((await call('GET', '/connections', 'adminA')).body.connections as any[]).map(c => c.id).filter((id: string) => id.startsWith('cal-conn'));
    expect(ids).toEqual(['cal-conn-a']);
  });
  it.each(['staffOther', 'adminB', 'client'] as const)('%s cannot disconnect another staff member\'s calendar', async who => {
    expect((await call('POST', '/disconnect-provider', who, { connectionId: 'cal-conn-a' })).status).toBe(404);
    expect(db.calendarConnections.get('cal-conn-a')?.status).toBe('connected');
  });
  it.each(['staffA', 'adminA'] as const)('%s (owner / same-tenant admin) can disconnect', async who => {
    expect((await call('POST', '/disconnect-provider', who, { connectionId: 'cal-conn-a' })).status).toBe(200);
    expect(db.calendarConnections.get('cal-conn-a')?.status).toBe('disconnected');
  });
  it('connect records a pending authorization instead of a fabricated live 2-way sync', async () => {
    const r = await call('POST', '/connect-provider', 'staffOther', { provider: 'google_calendar' });
    expect(r.status).toBe(200);
    expect(r.body.connection).toMatchObject({ status: 'authorization_pending', twoWaySyncEnabled: false });
    expect(r.body.connection).not.toHaveProperty('lastSuccessfulSync');
    expect(r.body.message).not.toMatch(/connected successfully|2-way sync enabled/i);
  });
  it('connect rejects unsupported providers', async () => {
    expect((await call('POST', '/connect-provider', 'staffOther', { provider: 'evil' })).status).toBe(400);
  });
});

describe('administrator override booking and firm overview', () => {
  const body = { staffId: 'cal-staff-a', date: '2026-11-10', timeSlot: '09:00', overrideReason: 'Synthetic override' };
  it('another tenant\'s administrator cannot book onto this tenant\'s staff calendar', async () => {
    const before = db.appointments.size;
    expect((await call('POST', '/admin-override-booking', 'adminB', body)).status).toBe(404);
    expect(db.appointments.size).toBe(before);
  });
  it.each([['missing staff', { staffId: 'nobody' }], ['a client as staff', { staffId: 'cal-client' }]])('refuses %s', async (_label, patch) => {
    expect((await call('POST', '/admin-override-booking', 'adminA', { ...body, ...patch })).status).toBe(404);
  });
  it.each([[{ date: '11/10/2026' }], [{ overrideReason: '' }], [{ clientEmail: 'not-an-email' }]])('rejects malformed %j', async patch => {
    expect((await call('POST', '/admin-override-booking', 'adminA', { ...body, ...patch })).status).toBe(400);
  });
  it('same-tenant administrator books without invented contact details or meeting link', async () => {
    const r = await call('POST', '/admin-override-booking', 'adminA', body);
    expect(r.status).toBe(200);
    expect(r.body.appointment).toMatchObject({ accountantId: 'cal-staff-a', status: 'confirmed' });
    expect(r.body.appointment).not.toHaveProperty('meetingLink');
    expect(r.body.appointment).not.toHaveProperty('clientPhone');
    expect(r.body.appointment.clientEmail).toBeUndefined();
    db.appointments.delete(r.body.appointment.id);
  });
  it('firm overview shows only the caller tenant\'s appointments', async () => {
    const r = await call('GET', '/firm-overview', 'adminA');
    expect(r.status).toBe(200);
    const ids = (r.body.appointments as any[]).map(a => a.id).filter((id: string) => id.startsWith('cal-apt'));
    expect(ids).toEqual(['cal-apt']);
  });
});
