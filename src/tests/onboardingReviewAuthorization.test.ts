import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../server/db';

/** Onboarding client review and staff activation: tenant ownership, assignment, role escalation, state. Synthetic data. */
const state = vi.hoisted(() => ({ users: new Map<string, any>() }));
vi.mock('../server/auth', async original => ({
  ...await original<typeof import('../server/auth')>(),
  authenticateToken: (req: any, res: any, next: any) => {
    const user = state.users.get(req.get('x-test-user'));
    if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    req.user = user; next();
  },
}));
import { onboardingRouter } from '../server/routes/onboarding.routes';

let server: Server, origin: string;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api/onboarding', onboardingRouter);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });

const past = new Date(Date.now() - 86_400_000).toISOString();
const u = (id: string, role: string, tenantId: string, extra: Record<string, unknown> = {}) => ({ id, name: id, role, status: 'active', tenantId, ...extra });
const people = {
  adminA: u('ob-admin-a', 'administrator', 'tenant-ob-a'),
  adminB: u('ob-admin-b', 'administrator', 'tenant-ob-b'),
  assigned: u('ob-assigned', 'accountant', 'tenant-ob-a'),
  unassigned: u('ob-unassigned', 'accountant', 'tenant-ob-a'),
};
type Who = keyof typeof people;
const post = async (path: string, who: Who, body: unknown) => {
  const r = await fetch(`${origin}/api/onboarding${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-user': people[who].id }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  for (const p of Object.values(people)) { state.users.set(p.id, p); db.users.set(p.id, { ...p } as any); }
  db.users.set('ob-client', { id: 'ob-client', clientId: 'ob-client', name: 'Synthetic Client', role: 'client', status: 'active', tenantId: 'tenant-ob-a', onboardingStatus: 'submitted' } as any);
  db.clientOnboarding.set('ob-client', { id: 'ob-dossier', clientId: 'ob-client', status: 'onboarding_submitted', reviewSubmission: {}, updatedAt: past } as any);
  db.clientAccountantAssignments.set('ob-asg', { id: 'ob-asg', clientId: 'ob-client', clientName: 'c', accountantId: 'ob-assigned', accountantName: 'a', assignmentType: 'primary', status: 'active', accessScope: [], assignedBy: 'x', assignedByName: 'x', assignedAt: past, effectiveDate: past } as any);
  db.users.set('ob-staff', { id: 'ob-staff', name: 'Synthetic Staff', role: 'consultant', status: 'pending', tenantId: 'tenant-ob-a' } as any);
  db.staffOnboarding.set('ob-staff', { status: 'submitted', adminReview: { assignedRole: 'accountant' }, personalContact: { professionalDisplayName: 'Synthetic Staff' }, calendarSetup: { timeZone: 'America/New_York' }, updatedAt: past } as any);
});
afterEach(() => {
  vi.unstubAllEnvs(); state.users.clear();
  for (const id of [...Object.values(people).map(p => p.id), 'ob-client', 'ob-staff']) db.users.delete(id);
  db.clientOnboarding.delete('ob-client'); db.clientAccountantAssignments.delete('ob-asg');
  db.staffOnboarding.delete('ob-staff'); db.staffAvailability.delete('ob-staff');
});

describe('POST /client/review', () => {
  it.each(['adminB', 'unassigned'] as const)('%s cannot approve the dossier (404, no change)', async who => {
    expect((await post('/client/review', who, { clientId: 'ob-client', decision: 'approved' })).status).toBe(404);
    expect(db.clientOnboarding.get('ob-client')?.status).toBe('onboarding_submitted');
    expect(db.users.get('ob-client')?.onboardingStatus).toBe('submitted');
  });
  it.each(['adminA', 'assigned'] as const)('%s (same tenant / assigned) can approve', async who => {
    const r = await post('/client/review', who, { clientId: 'ob-client', decision: 'approved', notes: 'Synthetic' });
    expect(r.status).toBe(200);
    expect(db.clientOnboarding.get('ob-client')?.status).toBe('approved');
  });
  it('can request corrections', async () => {
    expect((await post('/client/review', 'adminA', { clientId: 'ob-client', decision: 'correction_requested', correctionInstructions: 'Upload ID' })).status).toBe(200);
    expect(db.clientOnboarding.get('ob-client')?.status).toBe('correction_requested');
  });
  it.each([[{ clientId: 'ob-client' }], [{ clientId: 'ob-client', decision: 'APPROVED' }], [{ clientId: 'ob-client', decision: 'rejected' }], [{ clientId: 'ob-client', decision: 'approved', notes: 7 }]])(
    'rejects %j with 400 instead of crashing or storing it', async body => {
      expect((await post('/client/review', 'adminA', body)).status).toBe(400);
      expect(db.clientOnboarding.get('ob-client')?.status).toBe('onboarding_submitted');
    });
});

describe('POST /staff/review-activate', () => {
  it('another tenant\'s administrator cannot activate the staff account (404, no change)', async () => {
    expect((await post('/staff/review-activate', 'adminB', { staffUserId: 'ob-staff', assignedRole: 'accountant' })).status).toBe(404);
    expect(db.users.get('ob-staff')).toMatchObject({ status: 'pending', role: 'consultant' });
    expect(db.staffOnboarding.get('ob-staff')?.status).toBe('submitted');
  });
  it.each(['super_administrator', 'super_admin', 'admin', 'client', 'owner'])('refuses privilege escalation to %s', async role => {
    const r = await post('/staff/review-activate', 'adminA', { staffUserId: 'ob-staff', assignedRole: role });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('STAFF_ROLE_INVALID');
    expect(db.users.get('ob-staff')).toMatchObject({ status: 'pending', role: 'consultant' });
  });
  it('refuses to activate a dossier that has not been submitted', async () => {
    db.staffOnboarding.get('ob-staff')!.status = 'profile_in_progress';
    const r = await post('/staff/review-activate', 'adminA', { staffUserId: 'ob-staff', assignedRole: 'accountant' });
    expect(r.status).toBe(409);
    expect(db.users.get('ob-staff')?.status).toBe('pending');
  });
  it('refuses when the staff user record is unknown (fail closed)', async () => {
    db.users.delete('ob-staff');
    expect((await post('/staff/review-activate', 'adminA', { staffUserId: 'ob-staff', assignedRole: 'accountant' })).status).toBe(404);
  });
  it.each([[{ permissions: 'all' }], [{ permissions: ['ok', 'DROP TABLE'] }], [{ adminNotes: 5 }]])('rejects malformed %j', async extra => {
    expect((await post('/staff/review-activate', 'adminA', { staffUserId: 'ob-staff', assignedRole: 'accountant', ...extra })).status).toBe(400);
  });
  it('same-tenant administrator activates with an allowed role', async () => {
    const r = await post('/staff/review-activate', 'adminA', { staffUserId: 'ob-staff', assignedRole: 'reviewer', permissions: ['view_assigned_clients'] });
    expect(r.status).toBe(200);
    expect(db.users.get('ob-staff')).toMatchObject({ status: 'active', role: 'reviewer' });
    expect(db.staffOnboarding.get('ob-staff')?.status).toBe('approved');
  });
  it('defaults to the dossier\'s proposed role when none is supplied', async () => {
    expect((await post('/staff/review-activate', 'adminA', { staffUserId: 'ob-staff' })).status).toBe(200);
    expect(db.users.get('ob-staff')?.role).toBe('accountant');
  });
});
