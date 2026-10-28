import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Proposal 20261017000000 (PGlite, synthetic): invitation and membership changes re-prove the actor's
// live, recent AAL2 durable session inside the same transaction, and the unproven functions are no
// longer callable by the service role.
const T = 'tenantA';
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
const rpc = pgliteRpc(() => fixture.pg);
const q = async <R = any>(sql: string, p: unknown[] = []) => (await fixture.pg.query<R>(sql, p)).rows;
const call = async (name: string, args: Record<string, unknown>) => { const r = await rpc.rpc(name, args); return r.error ? { code: r.error.message } : r.data; };
const hash = (t: string) => createHash('sha256').update(t).digest('hex');
const token = (c: string) => 'tg_live_' + c.repeat(64);
const nowS = () => Math.floor(Date.now() / 1000);
const suspend = (actor: string, session: string, uid = 'sp-staff') => call('taxguard_change_staff_membership_status_proven',
  { p_tenant: T, p_actor: actor, p_actor_session_hash: hash(session), p_uid: uid, p_action: 'suspend', p_reason: 'Synthetic access review' });
const memberStatus = async (uid: string) => (await q(`SELECT status FROM taxguard_members WHERE tenant_id=$1 AND uid=$2`, [T, uid]))[0].status;

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(0[0-9]|1[01])0000_|^2026101234|^2026101235|^20261017000000_/);
}, 90000);
afterAll(async () => { await fixture?.pg.close(); });
beforeEach(async () => {
  await fixture.pg.exec(`DELETE FROM taxguard_staff_invitations WHERE tenant_id='${T}'; DELETE FROM taxguard_sessions WHERE uid LIKE 'sp-%';
    DELETE FROM taxguard_identities WHERE uid LIKE 'sp-%'; DELETE FROM taxguard_members WHERE uid LIKE 'sp-%';
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES ('${T}','sp-admin-a','admin','active'),('${T}','sp-admin-b','admin','active'),('${T}','sp-staff','accountant','active');
    INSERT INTO taxguard_identities(tenant_id,uid,user_data) SELECT tenant_id,uid,jsonb_build_object('id',uid,'tenantId',tenant_id,'role',role,'status',status,'mfaEnabled',true)
      FROM taxguard_members WHERE uid LIKE 'sp-%';`);
  const live = Date.now() + 3_600_000;
  for (const [uid, c, age, aal] of [['sp-admin-a', 'a', 60, 'aal2'], ['sp-admin-a', 'b', 1800, 'aal2'], ['sp-admin-a', 'c', 60, 'aal1'], ['sp-admin-b', 'd', 60, 'aal2']] as const)
    await fixture.pg.query(`INSERT INTO taxguard_sessions(tenant_id,uid,session_token_hash,auth_time,expires_at,aal) VALUES($1,$2,$3,$4,$5,$6)`, [T, uid, hash(token(c)), nowS() - age, live, aal]);
});

describe('membership changes re-prove the actor session in the same transaction', () => {
  it('applies a change for a live, recent AAL2 session of the actor', async () => {
    expect(await suspend('sp-admin-a', token('a'))).toMatchObject({ status: 'suspended' });
    expect(await memberStatus('sp-staff')).toBe('suspended');
  });
  it.each([
    ['an old sign-in', token('b'), 'STAFF_RECENT_SIGN_IN_REQUIRED'],
    ['an AAL1 session', token('c'), 'STAFF_ADMIN_REQUIRED'],
    ['an unknown session', token('e'), 'STAFF_ADMIN_REQUIRED'],
    ["another administrator's session", token('d'), 'STAFF_ADMIN_REQUIRED'],
  ])('refuses %s and changes nothing', async (_label, session, code) => {
    expect(await suspend('sp-admin-a', session)).toEqual({ code });
    expect(await memberStatus('sp-staff')).toBe('active');
  });
  it('refuses a session revoked after the service-level check (no time-of-check gap)', async () => {
    await q(`UPDATE taxguard_sessions SET revoked=true WHERE session_token_hash=$1`, [hash(token('a'))]);
    expect(await suspend('sp-admin-a', token('a'))).toEqual({ code: 'STAFF_ADMIN_REQUIRED' });
    expect(await memberStatus('sp-staff')).toBe('active');
  });
  it('refuses an actor gated for MFA re-enrolment even with a fresh session', async () => {
    await q(`UPDATE taxguard_members SET mfa_reenrollment_required=true WHERE uid='sp-admin-a'`);
    expect(await suspend('sp-admin-a', token('a'))).toEqual({ code: 'STAFF_ADMIN_REQUIRED' });
    expect(await memberStatus('sp-staff')).toBe('active');
  });
  it('proves the session for invitation create / revoke and activation approval too', async () => {
    const id = '00000000-0000-4000-8000-0000000005a1';
    const invite = (session: string) => call('taxguard_create_staff_invitation_proven', { p_tenant: T, p_actor: 'sp-admin-a', p_actor_session_hash: hash(session), p_id: id,
      p_email: 'sp-new@example.test', p_role: 'accountant', p_first: 'Synthetic', p_last: 'Staff', p_token_hash: hash('sp-invitation') });
    expect(await invite(token('b'))).toEqual({ code: 'STAFF_RECENT_SIGN_IN_REQUIRED' });
    expect(await q(`SELECT 1 FROM taxguard_staff_invitations WHERE id=$1`, [id])).toHaveLength(0);
    expect(await invite(token('a'))).toMatchObject({ id });
    expect(await call('taxguard_revoke_staff_invitation_proven', { p_tenant: T, p_actor: 'sp-admin-a', p_actor_session_hash: hash(token('c')), p_id: id })).toEqual({ code: 'STAFF_ADMIN_REQUIRED' });
    expect(await call('taxguard_revoke_staff_invitation_proven', { p_tenant: T, p_actor: 'sp-admin-a', p_actor_session_hash: hash(token('a')), p_id: id })).toMatchObject({ status: 'revoked' });
    expect(await call('taxguard_approve_staff_activation_proven', { p_tenant: T, p_actor: 'sp-admin-a', p_actor_session_hash: hash(token('b')), p_uid: 'sp-staff' })).toEqual({ code: 'STAFF_RECENT_SIGN_IN_REQUIRED' });
  });
});

describe('privileges', () => {
  it('leaves only the proven wrappers executable by the service role, and none by browser roles', async () => {
    const can = async (role: string, fn: string) => (await q<{ ok: boolean }>(`SELECT has_function_privilege($1, $2, 'EXECUTE') ok`, [role, fn]))[0].ok;
    const old = ['taxguard_create_staff_invitation(text,text,text,text,text,text,text,text)', 'taxguard_revoke_staff_invitation(text,text,text)',
      'taxguard_approve_staff_activation(text,text,text)', 'taxguard_change_staff_membership_status(text,text,text,text,text)'];
    const proven = ['taxguard_create_staff_invitation_proven(text,text,text,text,text,text,text,text,text)', 'taxguard_revoke_staff_invitation_proven(text,text,text,text)',
      'taxguard_approve_staff_activation_proven(text,text,text,text)', 'taxguard_change_staff_membership_status_proven(text,text,text,text,text,text)'];
    for (const fn of old) for (const role of ['service_role', 'anon', 'authenticated']) expect(await can(role, fn), `${role} ${fn}`).toBe(false);
    for (const fn of proven) {
      expect(await can('service_role', fn), fn).toBe(true);
      for (const role of ['anon', 'authenticated']) expect(await can(role, fn), `${role} ${fn}`).toBe(false);
    }
    const cfg = await q<{ proname: string; cfg: string[]; secdef: boolean }>(`SELECT proname, proconfig cfg, prosecdef secdef FROM pg_proc WHERE proname LIKE 'taxguard_%_proven'`);
    expect(cfg.map(r => r.proname).sort()).toHaveLength(4);
    for (const r of cfg) { expect(r.secdef).toBe(true); expect(r.cfg, r.proname).toEqual(['search_path=pg_catalog, public, pg_temp']); }
  });
});
