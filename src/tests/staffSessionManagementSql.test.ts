import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';

// Proposal 023 composed with the actual core schema and proposals 000–011 (synthetic data only).
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
const h = (c: string) => c.repeat(64);
const call = async <T = any>(sql: string, params: unknown[]) => (await fixture.pg.query<{ result: T }>(sql, params)).rows[0].result;
const listOwn = (uid = 'sess-staff', hash = h('a'), tenant = 'tenantA') =>
  call<any[]>('SELECT taxguard_list_own_sessions($1,$2,$3) AS result', [tenant, uid, hash]);
const revokeOwn = (sessionId: string, uid = 'sess-staff', hash = h('a')) =>
  call<{ revoked: boolean }>('SELECT taxguard_revoke_own_session($1,$2,$3,$4) AS result', ['tenantA', uid, hash, sessionId]);
const revokeOthers = (uid = 'sess-staff', hash = h('a')) =>
  call<{ revokedSessions: number }>('SELECT taxguard_revoke_other_own_sessions($1,$2,$3) AS result', ['tenantA', uid, hash]);
const adminRevoke = (target = 'sess-staff', p: Partial<{ actor: string; hash: string; category: string; tenant: string }> = {}) =>
  call<{ revokedSessions: number }>('SELECT taxguard_admin_revoke_member_sessions($1,$2,$3,$4,$5) AS result',
    [p.tenant ?? 'tenantA', p.actor ?? 'sess-admin', p.hash ?? h('d'), target, p.category ?? 'lost_or_stolen_device']);
const sessionId = async (hash: string) => (await fixture.pg.query<{ id: string }>('SELECT id FROM taxguard_sessions WHERE session_token_hash=$1', [hash])).rows[0].id;
const revokedFlags = async (uid: string) => (await fixture.pg.query<{ session_token_hash: string; revoked: boolean }>(
  "SELECT session_token_hash, revoked FROM taxguard_sessions WHERE uid=$1 ORDER BY session_token_hash", [uid])).rows.map(r => [r.session_token_hash[0], r.revoked]);
const audits = async (action: string) => (await fixture.pg.query<{ actor_uid: string; metadata: any }>(
  'SELECT actor_uid, metadata FROM taxguard_audit_log WHERE action=$1', [action])).rows;

beforeAll(async () => {
  fixture = await capabilityFixture();
  for (const name of readdirSync('docs/proposed-migrations').filter(n => /^20261012(?:(?:0[0-9]|1[01])0000|230000)_/.test(n)).sort())
    await fixture.pg.exec(readFileSync('docs/proposed-migrations/' + name, 'utf8'));
}, 30000);
afterAll(async () => { await fixture?.pg.close(); });
beforeEach(async () => {
  const live = "(floor(extract(epoch FROM now())*1000)::bigint+3600000)", fresh = 'floor(extract(epoch FROM now()))::bigint';
  await fixture.pg.exec(
    "DELETE FROM taxguard_sessions WHERE uid LIKE 'sess-%'; DELETE FROM taxguard_identities WHERE uid LIKE 'sess-%'; DELETE FROM taxguard_members WHERE uid LIKE 'sess-%';" +
    "DELETE FROM taxguard_audit_log WHERE action LIKE '%SESSION%'; UPDATE taxguard_tenants SET status='active';" +
    "INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','sess-staff','accountant','active'),('tenantA','sess-admin','admin','active')," +
    "('tenantA','sess-super','super_administrator','active'),('tenantA','sess-client','client','active'),('tenantB','sess-foreign','accountant','active');" +
    "INSERT INTO taxguard_identities(tenant_id,uid,user_data) SELECT tenant_id,uid,jsonb_build_object('id',uid,'tenantId',tenant_id,'role',role,'status',status) FROM taxguard_members WHERE uid LIKE 'sess-%';" +
    `INSERT INTO taxguard_sessions(tenant_id,uid,session_token_hash,auth_time,expires_at,aal) VALUES
      ('tenantA','sess-staff',repeat('a',64),${fresh},${live},'aal2'),('tenantA','sess-staff',repeat('b',64),${fresh},${live},'aal2'),
      ('tenantA','sess-staff',repeat('c',64),${fresh},1,'aal2'),('tenantA','sess-admin',repeat('d',64),${fresh},${live},'aal2'),
      ('tenantA','sess-super',repeat('e',64),${fresh},${live},'aal2'),('tenantA','sess-client',repeat('f',64),${fresh},${live},'aal1'),
      ('tenantB','sess-foreign',repeat('9',64),${fresh},${live},'aal2'),('tenantA','sess-staff',repeat('8',64),${fresh},${live},'aal1');`);
});

describe('session management proposal 023', () => {
  it('lists only the actor\'s live sessions, marks the current one, and never projects token hashes', async () => {
    const rows = await listOwn();
    expect(rows.map(r => r.assuranceLevel).sort()).toEqual(['aal1', 'aal2', 'aal2']);
    expect(rows.filter(r => r.current)).toHaveLength(1);
    expect(rows.find(r => r.current).sessionId).toBe(await sessionId(h('a')));
    expect(JSON.stringify(rows)).not.toMatch(/a{64}|b{64}|token|hash/i);
    expect(Object.keys(rows[0]).sort()).toEqual(['assuranceLevel', 'authenticatedAt', 'createdAt', 'current', 'expiresAt', 'sessionId']);
  });

  it('accepts an AAL1 client session but never an AAL1 staff session as proof', async () => {
    expect(await listOwn('sess-client', h('f'))).toHaveLength(1);
    await expect(listOwn('sess-staff', h('8'))).rejects.toThrow('SESSION_AUTHORITY_DENIED');
  });

  it.each(['revoked', 'expired', 'foreign-tenant', 'suspended', 'identity', 'gated', 'epoch', 'tenant-inactive'])('rechecks the acting session and membership: %s', async kind => {
    const sql: Record<string, string> = {
      revoked: "UPDATE taxguard_sessions SET revoked=true WHERE session_token_hash=repeat('a',64)",
      expired: "UPDATE taxguard_sessions SET expires_at=1 WHERE session_token_hash=repeat('a',64)",
      'foreign-tenant': "UPDATE taxguard_sessions SET tenant_id='tenantB' WHERE session_token_hash=repeat('a',64)",
      suspended: "UPDATE taxguard_members SET status='suspended' WHERE uid='sess-staff'",
      identity: "UPDATE taxguard_identities SET user_data=jsonb_set(user_data,'{role}','\"admin\"') WHERE uid='sess-staff'",
      gated: "UPDATE taxguard_members SET mfa_reenrollment_required=true WHERE uid='sess-staff'",
      epoch: "UPDATE taxguard_members SET status_changed_at=clock_timestamp()+interval '1 second' WHERE uid='sess-staff'",
      'tenant-inactive': "UPDATE taxguard_tenants SET status='suspended' WHERE id='tenantA'",
    };
    await fixture.pg.exec(sql[kind]);
    const expected = kind === 'gated' ? 'STAFF_MFA_REENROLLMENT_REQUIRED' : kind === 'epoch' ? 'STAFF_FRESH_SIGN_IN_REQUIRED' : 'SESSION_AUTHORITY_DENIED';
    await expect(listOwn()).rejects.toThrow(expected);
    await expect(revokeOthers()).rejects.toThrow(expected);
  });

  it('revokes one other own session with audit; current, foreign and repeated targets do not change state', async () => {
    const other = await sessionId(h('b'));
    expect(await revokeOwn(other)).toEqual({ revoked: true });
    expect(await revokeOwn(other)).toEqual({ revoked: false });
    expect(await revokeOwn(await sessionId(h('d')))).toEqual({ revoked: false });
    expect(await revokeOwn(await sessionId(h('9')))).toEqual({ revoked: false });
    await expect(revokeOwn(await sessionId(h('a')))).rejects.toThrow('SESSION_CURRENT_USE_LOGOUT');
    expect(await revokedFlags('sess-admin')).toEqual([['d', false]]);
    expect(await revokedFlags('sess-staff')).toEqual([['8', false], ['a', false], ['b', true], ['c', false]]);
    expect(await audits('SESSION_REVOKED_BY_OWNER')).toEqual([{ actor_uid: 'sess-staff', metadata: { sessionId: other } }]);
  });

  it('revokes all other own sessions and keeps the current one', async () => {
    expect(await revokeOthers()).toEqual({ revokedSessions: 3 });
    expect(await revokedFlags('sess-staff')).toEqual([['8', true], ['a', false], ['b', true], ['c', true]]);
    expect(await revokeOthers()).toEqual({ revokedSessions: 0 });
    expect((await audits('SESSIONS_OTHER_REVOKED_BY_OWNER')).map(a => a.metadata.revokedSessions)).toEqual([3, 0]);
  });

  it('lets an administrator with a fresh sign-in revoke every session of a staff member, audited by category', async () => {
    expect(await adminRevoke()).toEqual({ revokedSessions: 4 });
    expect((await revokedFlags('sess-staff')).every(([, revoked]) => revoked)).toBe(true);
    expect(await audits('STAFF_SESSIONS_REVOKED_BY_ADMIN')).toEqual([{ actor_uid: 'sess-admin',
      metadata: { targetUid: 'sess-staff', targetRole: 'accountant', reasonCategory: 'lost_or_stolen_device', revokedSessions: 4 } }]);
    await expect(listOwn()).rejects.toThrow('SESSION_AUTHORITY_DENIED');
  });

  it('requires re-authentication when the administrator primary sign-in is older than 15 minutes', async () => {
    await fixture.pg.exec("UPDATE taxguard_sessions SET auth_time=floor(extract(epoch FROM now()))::bigint-901 WHERE uid='sess-admin'");
    await expect(adminRevoke()).rejects.toThrow('STAFF_REAUTHENTICATION_REQUIRED');
    expect((await revokedFlags('sess-staff')).some(([, revoked]) => revoked)).toBe(false);
  });

  it.each([
    ['non-administrator actor', () => adminRevoke('sess-admin', { actor: 'sess-staff', hash: h('a') }), 'STAFF_ADMIN_REQUIRED'],
    ['self target', () => adminRevoke('sess-admin'), 'SESSION_TARGET_SELF'],
    ['client target', () => adminRevoke('sess-client'), 'SESSION_TARGET_NOT_FOUND'],
    ['cross-tenant target', () => adminRevoke('sess-foreign'), 'SESSION_TARGET_NOT_FOUND'],
    ['unknown target', () => adminRevoke('sess-missing'), 'SESSION_TARGET_NOT_FOUND'],
    ['super administrator target', () => adminRevoke('sess-super'), 'SESSION_TARGET_PROTECTED'],
    ['foreign tenant administrator proof', () => adminRevoke('sess-staff', { tenant: 'tenantB' }), 'SESSION_AUTHORITY_DENIED'],
    ['free-text reason category', () => adminRevoke('sess-staff', { category: 'because' }), 'SESSION_INPUT_INVALID'],
    ['malformed proof', () => adminRevoke('sess-staff', { hash: 'bad' }), 'SESSION_INPUT_INVALID'],
  ])('denies %s without changing sessions', async (_label, run, code) => {
    await expect(run()).rejects.toThrow(code);
    expect(await audits('STAFF_SESSIONS_REVOKED_BY_ADMIN')).toEqual([]);
    expect((await fixture.pg.query("SELECT count(*)::int AS n FROM taxguard_sessions WHERE uid LIKE 'sess-%' AND revoked")).rows[0]).toEqual({ n: 0 });
  });

  it('lets a super administrator revoke a protected administrator-tier target', async () => {
    await fixture.pg.exec("INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','sess-super2','super_admin','active');" +
      "INSERT INTO taxguard_identities(tenant_id,uid,user_data) VALUES('tenantA','sess-super2','{\"id\":\"sess-super2\",\"tenantId\":\"tenantA\",\"role\":\"super_admin\",\"status\":\"active\"}')");
    expect(await adminRevoke('sess-super2', { actor: 'sess-super', hash: h('e') })).toEqual({ revokedSessions: 0 });
  });

  it('is executable by the service role only; the internal proof helper is not executable by any API role', async () => {
    for (const role of ['anon', 'authenticated']) {
      await fixture.pg.exec('SET ROLE ' + role);
      try { await expect(listOwn()).rejects.toThrow('permission denied'); } finally { await fixture.pg.exec('RESET ROLE'); }
    }
    await fixture.pg.exec('SET ROLE service_role');
    try {
      expect(await listOwn()).toHaveLength(3);
      await expect(fixture.pg.query("SELECT * FROM taxguard_session_actor('tenantA','sess-staff',repeat('a',64))")).rejects.toThrow('permission denied');
    } finally { await fixture.pg.exec('RESET ROLE'); }
  });
});
