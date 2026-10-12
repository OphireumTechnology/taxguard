import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
const invoke = (actor = 'lifecycle-maker', action = 'suspend', uid = 'lifecycle-staff', tenant = 'tenantA', reason = 'Synthetic access review') =>
  fixture.pg.query('SELECT taxguard_change_staff_membership_status($1,$2,$3,$4,$5) AS result', [tenant, actor, uid, action, reason]);
const targetState = async () => (await fixture.pg.query(
  "SELECT m.status,m.status_changed_by,m.mfa_reenrollment_required,i.user_data->>'status' AS identity_status FROM taxguard_members m JOIN taxguard_identities i ON i.uid=m.uid AND i.tenant_id=m.tenant_id WHERE m.uid='lifecycle-staff'"
)).rows[0];
beforeAll(async () => {
  fixture = await capabilityFixture();
  await fixture.pg.exec(readFileSync('docs/proposed-migrations/20261012040000_taxguard_staff_membership_lifecycle.sql', 'utf8'));
}, 30000);
afterAll(async () => { await fixture?.pg.close(); });
beforeEach(async () => {
  await fixture.pg.exec(
    "INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','lifecycle-maker','admin','active'),('tenantA','lifecycle-checker','admin','active'),('tenantA','lifecycle-staff','accountant','active'),('tenantB','lifecycle-outsider','admin','active') ON CONFLICT(tenant_id,uid) DO UPDATE SET role=EXCLUDED.role,status=EXCLUDED.status,status_changed_by=NULL,mfa_reenrollment_required=false;" +
    "INSERT INTO taxguard_identities(uid,tenant_id,user_data) VALUES('lifecycle-staff','tenantA','{\"id\":\"lifecycle-staff\",\"tenantId\":\"tenantA\",\"role\":\"accountant\",\"status\":\"active\",\"mfaEnabled\":true}') ON CONFLICT(uid) DO UPDATE SET tenant_id=EXCLUDED.tenant_id,user_data=EXCLUDED.user_data;" +
    "DELETE FROM taxguard_sessions WHERE uid='lifecycle-staff';" +
    "INSERT INTO taxguard_sessions(session_token_hash,uid,tenant_id,auth_time,expires_at,revoked) VALUES(repeat('1',64),'lifecycle-staff','tenantA',1,9999999999999,false),(repeat('2',64),'lifecycle-staff','tenantB',1,9999999999999,false),(repeat('3',64),'lifecycle-staff','tenantA',1,9999999999999,true);"
  );
});
describe('staff membership lifecycle proposal on actual migration schema', () => {
  it('atomically suspends member/identity, revokes only same-tenant sessions and records actor/reason', async () => {
    expect((await invoke()).rows[0]).toEqual({ result: { status: 'suspended', revokedSessions: 1 } });
    expect(await targetState()).toMatchObject({ status: 'suspended', identity_status: 'suspended', status_changed_by: 'lifecycle-maker' });
    expect((await fixture.pg.query("SELECT tenant_id,revoked FROM taxguard_sessions WHERE uid='lifecycle-staff' ORDER BY session_token_hash")).rows).toEqual([{tenant_id:'tenantA',revoked:true},{tenant_id:'tenantB',revoked:false},{tenant_id:'tenantA',revoked:true}]);
    expect((await fixture.pg.query("SELECT actor_uid,metadata FROM taxguard_audit_log WHERE action='STAFF_MEMBERSHIP_SUSPEND' ORDER BY timestamp DESC LIMIT 1")).rows[0]).toMatchObject({ actor_uid: 'lifecycle-maker', metadata: { uid:'lifecycle-staff', previousStatus:'active', status:'suspended', reason:'Synthetic access review', revokedSessions:1 } });
  });
  it('allows only an independent administrator to reactivate and never restores revoked sessions', async () => {
    await invoke();
    await expect(invoke('lifecycle-maker','reactivate')).rejects.toThrow('INDEPENDENT_APPROVER_REQUIRED');
    expect((await invoke('lifecycle-checker','reactivate')).rows[0]).toEqual({ result: { status:'active', revokedSessions:0 } });
    expect(await targetState()).toMatchObject({ status:'active',identity_status:'active',status_changed_by:'lifecycle-checker' });
    expect((await fixture.pg.query("SELECT revoked FROM taxguard_sessions WHERE tenant_id='tenantA' AND uid='lifecycle-staff'")).rows.every((r: any)=>r.revoked)).toBe(true);
  });
  it.each(['active','suspended'])('deactivates %s membership with no reactivation path', async status => {
    if(status==='suspended') await invoke();
    await invoke('lifecycle-checker','deactivate');
    expect(await targetState()).toMatchObject({ status:'disabled',identity_status:'disabled' });
    await expect(invoke('lifecycle-maker','reactivate')).rejects.toThrow('STAFF_STATUS_TRANSITION_DENIED');
  });
  it('refuses recovery reactivation without a separately verified reenrollment flow', async () => {
    await invoke();
    await fixture.pg.query("UPDATE taxguard_members SET mfa_reenrollment_required=true WHERE uid='lifecycle-staff'");
    await expect(invoke('lifecycle-checker','reactivate')).rejects.toThrow('STAFF_MFA_REENROLLMENT_REQUIRED');
    expect(await targetState()).toMatchObject({ status:'suspended',mfa_reenrollment_required:true });
  });
  it('refuses reactivation when identity MFA evidence is missing', async () => {
    await invoke();
    await fixture.pg.query("UPDATE taxguard_identities SET user_data=user_data-'mfaEnabled' WHERE uid='lifecycle-staff'");
    await expect(invoke('lifecycle-checker','reactivate')).rejects.toThrow('STAFF_MFA_REENROLLMENT_REQUIRED');
  });
  it.each([['lifecycle-outsider','tenantA'],['lifecycle-maker','tenantB']])('denies cross-tenant actor %s in %s', async (actor,tenant) => {
    await expect(invoke(actor,'suspend','lifecycle-staff',tenant)).rejects.toThrow('STAFF_ADMIN_REQUIRED');
    expect(await targetState()).toMatchObject({ status:'active' });
  });
  it('rechecks active administrator authority and disallows self action', async () => {
    await expect(invoke('lifecycle-maker','suspend','lifecycle-maker')).rejects.toThrow('INDEPENDENT_ACTOR_REQUIRED');
    await fixture.pg.query("UPDATE taxguard_members SET status='suspended' WHERE uid='lifecycle-maker'");
    await expect(invoke()).rejects.toThrow('STAFF_ADMIN_REQUIRED');
  });
  it.each(['super_admin','super_administrator','client','prospective_client','unknown'])('denies restricted target role %s', async role => {
    await fixture.pg.query("UPDATE taxguard_members SET role=$1 WHERE uid='lifecycle-staff'",[role]);
    await expect(invoke()).rejects.toThrow('STAFF_TARGET_DENIED');
  });
  it.each(['pending_approval','disabled','pending'])('denies undefined transition from %s', async status => {
    await fixture.pg.query("UPDATE taxguard_members SET status=$1 WHERE uid='lifecycle-staff'",[status]);
    await fixture.pg.query("UPDATE taxguard_identities SET user_data=jsonb_set(user_data,'{status}',to_jsonb($1::text)) WHERE uid='lifecycle-staff'",[status]);
    await expect(invoke()).rejects.toThrow('STAFF_STATUS_TRANSITION_DENIED');
  });
  it.each(['', 'x'.repeat(1001), 'line\nbreak'])('requires bounded nonempty safe audit reason', async reason => {
    await expect(invoke('lifecycle-maker','suspend','lifecycle-staff','tenantA',reason)).rejects.toThrow('STAFF_LIFECYCLE_INPUT_INVALID');
  });
  it('rejects missing or mismatched identity without changing membership/sessions', async () => {
    await fixture.pg.query("UPDATE taxguard_identities SET tenant_id='tenantB' WHERE uid='lifecycle-staff'");
    await expect(invoke()).rejects.toThrow('STAFF_IDENTITY_INCONSISTENT');
    expect((await fixture.pg.query("SELECT status FROM taxguard_members WHERE uid='lifecycle-staff'")).rows[0]).toEqual({status:'active'});
    expect((await fixture.pg.query("SELECT revoked FROM taxguard_sessions WHERE session_token_hash=repeat('1',64)")).rows[0]).toEqual({revoked:false});
  });
  it('rolls back status and revocation if transactional audit fails', async () => {
    await fixture.pg.exec("CREATE FUNCTION lifecycle_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_AUDIT_FAILURE'; END $$; CREATE TRIGGER lifecycle_reject_audit BEFORE INSERT ON taxguard_audit_log FOR EACH ROW EXECUTE FUNCTION lifecycle_reject_audit();");
    try {
      await expect(invoke()).rejects.toThrow('SYNTHETIC_AUDIT_FAILURE');
      expect(await targetState()).toMatchObject({status:'active',identity_status:'active'});
      expect((await fixture.pg.query("SELECT revoked FROM taxguard_sessions WHERE session_token_hash=repeat('1',64)")).rows[0]).toEqual({revoked:false});
    } finally { await fixture.pg.exec('DROP TRIGGER lifecycle_reject_audit ON taxguard_audit_log; DROP FUNCTION lifecycle_reject_audit();'); }
  });
  it('denies repeated suspension and invalid action without additional audit writes', async () => {
    await invoke();
    const before = (await fixture.pg.query("SELECT count(*)::int AS count FROM taxguard_audit_log WHERE action LIKE 'STAFF_MEMBERSHIP_%'")).rows[0];
    await expect(invoke()).rejects.toThrow('STAFF_STATUS_TRANSITION_DENIED');
    await expect(invoke('lifecycle-checker','activate')).rejects.toThrow('STAFF_LIFECYCLE_INPUT_INVALID');
    expect((await fixture.pg.query("SELECT count(*)::int AS count FROM taxguard_audit_log WHERE action LIKE 'STAFF_MEMBERSHIP_%'")).rows[0]).toEqual(before);
  });
  it('denies a same-tenant non-administrator actor and absent target', async () => {
    await expect(invoke('preparer')).rejects.toThrow('STAFF_ADMIN_REQUIRED');
    await expect(invoke('lifecycle-maker','suspend','missing-staff')).rejects.toThrow('STAFF_TARGET_DENIED');
  });
  it('prevents browser roles invoking service-role lifecycle RPC', async () => {
    for(const role of ['anon','authenticated']) {
      await fixture.pg.exec('SET ROLE '+role);
      try { await expect(invoke()).rejects.toThrow('permission denied'); }
      finally { await fixture.pg.exec('RESET ROLE'); }
    }
  });
});
