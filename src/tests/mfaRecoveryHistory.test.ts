import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Proposal 037 (PGlite, synthetic): recovery audit history for administrators and the coarse
// recovery step for the staff member, with tenant isolation and no secret or reason text.
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
const rpc = pgliteRpc(() => fixture.pg);
const hashOf = (c: string) => createHash('sha256').update('tg_live_' + c.repeat(64)).digest('hex');
const req = '00000000-0000-4000-8000-000000000371';
const call = async (name: string, args: Record<string, unknown>) => { const r = await rpc.rpc(name, args); return r.error ? { code: r.error.message } : r.data; };
const step = (uid: string) => call('taxguard_mfa_recovery_step', { p_tenant: 'tenantA', p_uid: uid });
const history = (actor: string, c: string, tenant = 'tenantA') => call('taxguard_mfa_recovery_history', { p_tenant: tenant, p_actor: actor, p_session_hash: hashOf(c), p_request_id: req });

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(0[0-9]|1[01])0000_|^2026101234|^2026101237/);
  await fixture.pg.exec(`INSERT INTO taxguard_tenants(id,name) VALUES('tenantH','Synthetic H') ON CONFLICT DO NOTHING;
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES ('tenantA','hs-admin-a','admin','active'),('tenantA','hs-admin-b','admin','active'),
      ('tenantA','hs-staff','accountant','active'),('tenantA','hs-acct','accountant','active'),('tenantH','hs-foreign','admin','active');
    INSERT INTO taxguard_identities(tenant_id,uid,user_data) SELECT tenant_id,uid,jsonb_build_object('id',uid,'tenantId',tenant_id,'role',role,'status',status,'mfaEnabled',true) FROM taxguard_members WHERE uid LIKE 'hs-%';`);
  const live = Date.now() + 3_600_000, fresh = Math.floor(Date.now() / 1000) - 30;
  for (const [t, uid, c] of [['tenantA', 'hs-admin-a', 'a'], ['tenantA', 'hs-admin-b', 'b'], ['tenantA', 'hs-acct', 'c'], ['tenantH', 'hs-foreign', 'd']])
    await fixture.pg.query(`INSERT INTO taxguard_sessions(tenant_id,uid,session_token_hash,auth_time,expires_at,aal) VALUES($1,$2,$3,$4,$5,'aal2')`, [t, uid, hashOf(c), fresh, live]);
}, 90000);
afterAll(async () => { await fixture?.pg.close(); });

describe('recovery step and history', () => {
  it('reports each step to the staff member and nothing about anyone else', async () => {
    expect(await step('hs-staff')).toEqual({ step: 'none' });
    await call('taxguard_request_mfa_recovery', { p_tenant: 'tenantA', p_actor: 'hs-admin-a', p_uid: 'hs-staff', p_request_id: req, p_reason_category: 'lost_authenticator',
      p_reason: 'Synthetic secret-looking reason text', p_actor_session_hash: hashOf('a') });
    expect(await step('hs-staff')).toEqual({ step: 'awaiting_approval' });
    await call('taxguard_approve_mfa_recovery', { p_tenant: 'tenantA', p_actor: 'hs-admin-b', p_request_id: req, p_actor_session_hash: hashOf('b') });
    expect(await step('hs-staff')).toEqual({ step: 'awaiting_reset' });
    const claim = await call('taxguard_mfa_job_claim', { p_tenant: 'tenantA', p_worker: 'worker-h', p_lease_seconds: 60 });
    await call('taxguard_mfa_job_report', { p_tenant: 'tenantA', p_job: req, p_worker: 'worker-h', p_fence: claim.fence, p_outcome: { kind: 'failed', errorCode: 'PROVIDER_UNAVAILABLE', retryable: false } });
    expect(await step('hs-staff')).toEqual({ step: 'reset_failed' });
    expect(await step('hs-acct')).toEqual({ step: 'none' });
    expect(await call('taxguard_mfa_recovery_step', { p_tenant: 'tenantH', p_uid: 'hs-staff' })).toEqual({ step: 'none' });
  });
  it('gives administrators of the tenant the ordered audit trail without reason text or factor data', async () => {
    const h = await history('hs-admin-a', 'a');
    expect(h.items.map((x: any) => x.action)).toEqual(['STAFF_MFA_RECOVERY_REQUESTED', 'STAFF_MFA_RECOVERY_APPROVED', 'STAFF_MFA_RESET_JOB_CLAIMED', 'STAFF_MFA_RESET_JOB_FAILED']);
    expect(h.items[1]).toMatchObject({ actorUid: 'hs-admin-b', details: { status: 'suspended', revokedSessions: 0, reasonCategory: 'lost_authenticator' } });
    expect(h.items[3].details).toMatchObject({ errorCode: 'PROVIDER_UNAVAILABLE', attempt: 1 });
    expect(JSON.stringify(h)).not.toMatch(/secret-looking|fence|factor-/);
  });
  it('refuses non-administrators, other tenants and unknown sessions', async () => {
    expect(await history('hs-acct', 'c')).toEqual({ code: 'STAFF_ADMIN_REQUIRED' });
    expect(await history('hs-foreign', 'd', 'tenantH')).toEqual({ code: 'MFA_RECOVERY_NOT_FOUND' });
    expect(await history('hs-foreign', 'd')).toEqual({ code: 'STAFF_ADMIN_REQUIRED' });
    expect(await history('hs-admin-a', 'z')).toEqual({ code: 'STAFF_ADMIN_REQUIRED' });
  });
  it('grants the service role only', async () => {
    const rows = (await fixture.pg.query<{ proname: string; svc: boolean; pub: boolean }>(`SELECT proname, has_function_privilege('service_role', oid, 'EXECUTE') svc,
      has_function_privilege('anon', oid, 'EXECUTE') OR has_function_privilege('authenticated', oid, 'EXECUTE') pub FROM pg_proc
      WHERE proname IN ('taxguard_staff_admin_session','taxguard_mfa_recovery_history','taxguard_mfa_recovery_step') ORDER BY proname`)).rows;
    expect(rows).toEqual([{ proname: 'taxguard_mfa_recovery_history', svc: true, pub: false }, { proname: 'taxguard_mfa_recovery_step', svc: true, pub: false },
      { proname: 'taxguard_staff_admin_session', svc: false, pub: false }]);
  });
});
