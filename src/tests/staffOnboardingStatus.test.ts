import { createServer, type Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createStaffAccessRouter } from '../server/routes/staff-access.routes';
import { StaffAccessRateLimit } from '../server/staffAccessRateLimit';
import { nextOnboardingSteps } from '../server/staffOnboardingStatus';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Contract C4: the verified identity's own staff onboarding status (proposal 20261016020000) on the
// real staff invitation / membership / MFA recovery proposals and assignments. Synthetic identities;
// the provider identity is injected exactly as the MFA recovery tests do. No real provider.
const T = 'tenantA';
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin = ''; let identity: any;
const rpc = pgliteRpc(() => fixture.pg);
const status = (as: Record<string, unknown> | null, body: unknown = { providerAccessToken: 'synthetic-provider-token' }) => {
  identity = as;
  return fetch(origin + '/staff/onboarding/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    .then(async r => ({ status: r.status, body: await r.json() as any }));
};
const who = (uid: string, aal: 'aal1' | 'aal2' = 'aal2', verifiedFactorCount = 1) => ({ uid, email: uid + '@example.test', authTime: Math.floor(Date.now() / 1000), aal, verifiedFactorCount });
const PRIVATE = /invited_by|invitedBy|approvedBy|token|example\.test|synthetic-provider-token|so-client-x|Synthetic Client/i;

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(0[0-9]|1[01])0000_|^20261012(250000|340000|350000|370000)_|^20261016020000_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','so-client-x','owner-x','Synthetic Client');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES ('${T}','so-new','accountant','pending_approval',NULL),('${T}','so-ready','accountant','active',NULL),
      ('${T}','so-unassigned','reviewer','active',NULL),('${T}','so-suspended','accountant','suspended',NULL),('${T}','so-disabled','bookkeeper','disabled',NULL),
      ('${T}','so-client','client','active','so-client-x'),('${T}','so-mgr','practice_manager','active',NULL),('tenantB','so-foreign','accountant','active',NULL);
    INSERT INTO taxguard_staff_invitations(id,tenant_id,email,role,legal_first_name,legal_last_name,token_hash,status,expires_at,invited_by,accepted_uid,accepted_at)
      VALUES('inv-so-new','${T}','new@example.test','accountant','Synthetic','New','${'a'.repeat(64)}','accepted',now()+interval '1 day','so-mgr','so-new',now());`);
  await fixture.pg.query(`INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,user_id,role,status,assigned_by) VALUES('asg-so-1',$1,'so-client-x','so-ready','preparer','ACTIVE','so-mgr')`, [T]);
  const app = express(); app.use(express.json({ limit: '32kb' }));
  app.use('/staff', createStaffAccessRouter({ client: () => rpc as any, tenantId: () => T, limiter: new StaffAccessRateLimit(10_000, 60_000, 100_000, () => 0),
    verifyIdentity: async () => { if (!identity) throw new Error('invalid'); return identity; },
    authenticate: (_req: any, res: any) => res.status(401).json({ code: 'AUTH_REQUIRED' }) }));
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = 'http://127.0.0.1:' + (server.address() as any).port;
}, 90000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

describe('staff onboarding status (C4)', () => {
  it('shows a pending member what is outstanding before activation', async () => {
    const r = await status(who('so-new'));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ membershipStatus: 'pending_approval', role: 'accountant', invitationAcceptedAt: expect.any(String), activeAssignments: 0,
      mfa: { sessionAssurance: 'aal2', verifiedFactors: 1, recovery: 'none' }, nextSteps: ['AWAIT_INDEPENDENT_APPROVAL'] });
    expect(JSON.stringify(r.body)).not.toMatch(PRIVATE);
  });
  it('reports an active, assigned member as ready, with counts but no client identities', async () => {
    const r = await status(who('so-ready'));
    expect(r.body).toMatchObject({ membershipStatus: 'active', activeAssignments: 1, assignedClients: 1, nextSteps: ['READY'] });
    expect(JSON.stringify(r.body)).not.toMatch(PRIVATE);
  });
  it.each([
    ['an active member without assignments', 'so-unassigned', 'aal2', 1, ['AWAIT_ASSIGNMENT']],
    ['a member without an enrolled factor', 'so-unassigned', 'aal1', 0, ['ENROLL_AUTHENTICATOR', 'AWAIT_ASSIGNMENT']],
    ['a member signed in without the authenticator', 'so-ready', 'aal1', 1, ['SIGN_IN_WITH_AUTHENTICATOR']],
    ['a suspended member', 'so-suspended', 'aal2', 1, ['ACCOUNT_SUSPENDED']],
    ['a disabled member', 'so-disabled', 'aal2', 1, ['ACCESS_ENDED']],
    ['a client account', 'so-client', 'aal2', 1, ['NOT_STAFF']],
    ['an identity without membership in this tenant', 'so-foreign', 'aal2', 1, ['NO_MEMBERSHIP']],
  ])('handles %s', async (_l, uid, aal, factors, steps) => {
    const r = await status(who(uid, aal as any, factors));
    expect(r.status).toBe(200);
    expect(r.body.nextSteps).toEqual(steps);
    if (['so-client', 'so-foreign'].includes(uid)) expect(Object.keys(r.body).sort()).toEqual(['activeAssignments', 'assignedClients', 'invitationAcceptedAt', 'memberSince', 'membershipStatus', 'mfa', 'nextSteps', 'role']);
    if (['so-client', 'so-foreign'].includes(uid)) expect(r.body).toMatchObject({ role: null, activeAssignments: 0, assignedClients: 0 });
  });
  it('refuses requests without a verified provider identity and cannot be pointed at another person', async () => {
    expect((await status(null)).status).toBe(401);
    expect((await status(who('so-new'), {})).status).toBe(401);
    // A uid in the body is ignored: only the verified identity is reported.
    const r = await status(who('so-new'), { providerAccessToken: 'synthetic-provider-token', uid: 'so-ready' });
    expect(r.body.membershipStatus).toBe('pending_approval');
  });
  it('rejects a malformed identity and keeps the function service-role only', async () => {
    expect((await status(who("so' OR 1=1"))).status).toBe(400);
    for (const role of ['anon', 'authenticated'])
      expect((await fixture.pg.query<{ ok: boolean }>(`SELECT has_function_privilege('${role}', 'public.taxguard_staff_onboarding_status(text,text)', 'EXECUTE') AS ok`)).rows[0].ok).toBe(false);
  });
  it('MFA recovery takes precedence over other steps', () => {
    expect(nextOnboardingSteps({ membershipStatus: 'active', role: 'accountant', memberSince: null, invitationAcceptedAt: null, activeAssignments: 2, assignedClients: 1,
      mfa: { sessionAssurance: 'aal1', verifiedFactors: 0, recovery: 'ready_for_enrollment' } })).toEqual(['COMPLETE_MFA_RECOVERY']);
  });
});
