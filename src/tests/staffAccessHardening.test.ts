import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Proposal 035 (PGlite, synthetic): safe search_path, actor gating, super-administrator protection,
// activation identity checks and invitations bound to the issuer's current authority.
const T = 'tenantA';
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
const rpc = pgliteRpc(() => fixture.pg);
const q = async <R = any>(sql: string, p: unknown[] = []) => (await fixture.pg.query<R>(sql, p)).rows;
const call = async (name: string, args: Record<string, unknown>) => { const r = await rpc.rpc(name, args); return r.error ? { code: r.error.message } : r.data; };
const status = (actor: string, uid: string, action: string) => call('taxguard_change_staff_membership_status', { p_tenant: T, p_actor: actor, p_uid: uid, p_action: action, p_reason: 'Synthetic change' });
const hash = (t: string) => createHash('sha256').update(t).digest('hex');

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(0[0-9]|1[01])0000_|^2026101234|^2026101235/);
}, 90000);
afterAll(async () => { await fixture?.pg.close(); });
beforeEach(async () => {
  await fixture.pg.exec(`DELETE FROM taxguard_staff_invitations WHERE tenant_id='${T}'; DELETE FROM taxguard_identities WHERE uid LIKE 'hd-%'; DELETE FROM taxguard_sessions WHERE uid LIKE 'hd-%';
    DELETE FROM taxguard_members WHERE uid LIKE 'hd-%';
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES ('${T}','hd-admin-a','admin','active'),('${T}','hd-admin-b','admin','active'),
      ('${T}','hd-super-1','super_admin','active'),('${T}','hd-super-2','super_admin','active'),('${T}','hd-staff','accountant','active');
    INSERT INTO taxguard_identities(tenant_id,uid,user_data) SELECT tenant_id,uid,jsonb_build_object('id',uid,'tenantId',tenant_id,'role',role,'status',status,'mfaEnabled',true)
      FROM taxguard_members WHERE uid LIKE 'hd-%';`);
});

describe('search_path', () => {
  it('pins pg_catalog, public, pg_temp on every superseded function and leaves no SECURITY DEFINER taxguard function on public alone', async () => {
    const rows = await q<{ proname: string; cfg: string[] }>(`SELECT proname, proconfig cfg FROM pg_proc WHERE proname = ANY($1)`,
      [['taxguard_change_staff_membership_status', 'taxguard_approve_staff_activation', 'taxguard_accept_staff_invitation', 'taxguard_create_staff_invitation', 'taxguard_revoke_staff_invitation']]);
    expect(rows).toHaveLength(5);
    for (const r of rows) expect(r.cfg, r.proname).toEqual(['search_path=pg_catalog, public, pg_temp']);
    const unsafe = await q(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prosecdef
      AND EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%' AND c NOT IN ('search_path=pg_catalog, public, pg_temp', 'search_path=public, pg_temp', 'search_path=pg_catalog'))`);
    expect(unsafe).toEqual([]);
  });
});

describe('membership changes', () => {
  it('keeps super administrators outside membership changes for everyone, including other super administrators', async () => {
    expect(await status('hd-admin-a', 'hd-super-1', 'suspend')).toEqual({ code: 'STAFF_TARGET_DENIED' });
    expect(await status('hd-super-2', 'hd-super-1', 'suspend')).toEqual({ code: 'STAFF_TARGET_DENIED' });
    expect(await status('hd-admin-a', 'hd-staff', 'suspend')).toMatchObject({ status: 'suspended' });
  });
  it('refuses an actor whose identity record is inconsistent or who is under MFA re-enrolment', async () => {
    await fixture.pg.query(`UPDATE taxguard_identities SET user_data = jsonb_set(user_data, '{role}', '"accountant"') WHERE uid = 'hd-admin-a'`);
    expect(await status('hd-admin-a', 'hd-staff', 'suspend')).toEqual({ code: 'STAFF_ADMIN_REQUIRED' });
    await fixture.pg.exec(`UPDATE taxguard_identities SET user_data = jsonb_set(user_data, '{role}', '"admin"') WHERE uid = 'hd-admin-a';
      UPDATE taxguard_members SET mfa_reenrollment_required = true WHERE uid = 'hd-admin-a'`);
    expect(await status('hd-admin-a', 'hd-staff', 'suspend')).toEqual({ code: 'STAFF_ADMIN_REQUIRED' });
    expect((await q(`SELECT status FROM taxguard_members WHERE uid='hd-staff'`))[0].status).toBe('active');
  });
  it('never lets the tenant lose its last active administrator', async () => {
    await fixture.pg.exec(`UPDATE taxguard_members SET status='disabled' WHERE uid IN ('hd-super-1','hd-super-2');
      UPDATE taxguard_identities SET user_data = jsonb_set(user_data,'{status}','"disabled"') WHERE uid IN ('hd-super-1','hd-super-2')`);
    expect(await status('hd-admin-a', 'hd-admin-b', 'deactivate')).toMatchObject({ status: 'disabled' });
    // hd-admin-a is now the only active administrator and cannot act on itself; nobody else can act at all.
    expect(await status('hd-admin-b', 'hd-admin-a', 'suspend')).toEqual({ code: 'STAFF_ADMIN_REQUIRED' });
    expect(await status('hd-admin-a', 'hd-admin-a', 'suspend')).toEqual({ code: 'INDEPENDENT_ACTOR_REQUIRED' });
    expect((await q(`SELECT count(*)::int n FROM taxguard_members WHERE tenant_id=$1 AND status='active' AND role IN ('admin','super_admin') AND uid LIKE 'hd-%'`, [T]))[0].n).toBe(1);
  });
});

describe('activation and invitations', () => {
  const invite = (actor: string, email: string, token: string) => call('taxguard_create_staff_invitation', { p_tenant: T, p_actor: actor, p_id: '00000000-0000-4000-8000-' + hash(email).slice(0, 12),
    p_email: email, p_role: 'accountant', p_first: 'Synthetic', p_last: 'Invitee', p_token_hash: hash(token) });
  const accept = (uid: string, email: string, token: string) => call('taxguard_accept_staff_invitation', { p_tenant: T, p_token_hash: hash(token), p_uid: uid, p_email: email });
  it('kills invitations whose issuer lost administrator authority', async () => {
    expect(await invite('hd-admin-a', 'one@example.test', 'token-one')).toMatchObject({ expiresAt: expect.any(String) });
    expect(await invite('hd-admin-b', 'two@example.test', 'token-two')).toMatchObject({ expiresAt: expect.any(String) });
    expect(await status('hd-admin-b', 'hd-admin-a', 'suspend')).toMatchObject({ status: 'suspended' });
    expect(await accept('hd-new-1', 'one@example.test', 'token-one')).toEqual({ code: 'INVITATION_INVALID' });
    expect(await accept('hd-new-2', 'two@example.test', 'token-two')).toEqual({ status: 'pending_approval' });
  });
  it('activates only a consistent pending identity, approved by someone other than the inviter', async () => {
    await invite('hd-admin-a', 'three@example.test', 'token-three');
    await accept('hd-new-3', 'three@example.test', 'token-three');
    expect(await call('taxguard_approve_staff_activation', { p_tenant: T, p_actor: 'hd-admin-a', p_uid: 'hd-new-3' })).toEqual({ code: 'INDEPENDENT_APPROVER_REQUIRED' });
    await fixture.pg.query(`UPDATE taxguard_identities SET user_data = jsonb_set(user_data, '{role}', '"admin"') WHERE uid = 'hd-new-3'`);
    expect(await call('taxguard_approve_staff_activation', { p_tenant: T, p_actor: 'hd-admin-b', p_uid: 'hd-new-3' })).toEqual({ code: 'STAFF_IDENTITY_INCONSISTENT' });
    await fixture.pg.query(`UPDATE taxguard_identities SET user_data = jsonb_set(user_data, '{role}', '"accountant"') WHERE uid = 'hd-new-3'`);
    expect(await call('taxguard_approve_staff_activation', { p_tenant: T, p_actor: 'hd-admin-b', p_uid: 'hd-new-3' })).toEqual({ status: 'active' });
  });
});
