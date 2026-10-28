import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
type Row = Record<string, any>;
const list = async (kind = 'members', actor = 'directory-admin', status: string | null = null, size: number | null = 51, after: string | null = null, id: string | null = null, tenant = 'tenantA'): Promise<Row[]> =>
  (await fixture.pg.query<{ result: Row[] }>('SELECT taxguard_list_staff_' + kind + '($1,$2,$3,$4,$5,$6) AS result', [tenant, actor, status, size, after, id])).rows[0].result;
beforeAll(async () => {
  fixture = await capabilityFixture();
  // The fixture loads every actual migration; compose every staff proposal in deployment order.
  for (const name of readdirSync('docs/proposed-migrations').filter(n => /^202610120[0-5]0000_/.test(n)).sort())
    await fixture.pg.exec(readFileSync('docs/proposed-migrations/' + name, 'utf8'));
}, 30000);
afterAll(async () => { await fixture?.pg.close(); });
beforeEach(async () => {
  await fixture.pg.exec(`
    UPDATE taxguard_members SET created_at='2025-01-01' WHERE uid IN ('preparer','reviewer');
    DELETE FROM taxguard_staff_invitations;
    DELETE FROM taxguard_identities WHERE uid LIKE 'directory-%';
    DELETE FROM taxguard_members WHERE uid LIKE 'directory-%';
    INSERT INTO taxguard_members(tenant_id,uid,role,status,created_at) VALUES
      ('tenantA','directory-admin','admin','active','2026-01-01'),
      ('tenantB','directory-foreign','admin','active','2026-01-01'),
      ('tenantA','directory-c','accountant','active','2026-10-01 12:00:00.123456+00'),
      ('tenantA','directory-b','reviewer','suspended','2026-10-01 12:00:00.123456+00'),
      ('tenantA','directory-a','operations','active','2026-10-01 12:00:00.123455+00');
    INSERT INTO taxguard_identities(uid,tenant_id,user_data) VALUES
      ('directory-c','tenantA','{"id":"directory-c","tenantId":"tenantA","role":"accountant","status":"active","name":"Synthetic Staff","email":"synthetic@example.test","mfaEnabled":true,"password":"PRIVATE_PASSWORD","factorId":"PRIVATE_FACTOR","metadata":{"secret":"PRIVATE_METADATA"}}'),
      ('directory-b','tenantA','{"id":"WRONG","tenantId":"tenantA","role":"reviewer","status":"suspended","mfaEnabled":"true"}'),
      ('directory-a','tenantB','{"id":"directory-a","tenantId":"tenantB","role":"operations","status":"active","name":"FOREIGN_NAME"}');
    INSERT INTO taxguard_staff_invitations(id,tenant_id,email,role,legal_first_name,legal_last_name,token_hash,status,expires_at,invited_by,created_at) VALUES
      ('directory-c','tenantA','c@example.test','accountant','Synthetic','C',repeat('c',64),'pending','2026-11-01','directory-admin','2026-10-01 12:00:00.123456+00'),
      ('directory-b','tenantA','b@example.test','reviewer','Synthetic','B',repeat('b',64),'accepted','2026-11-01','directory-admin','2026-10-01 12:00:00.123456+00'),
      ('directory-a','tenantA','a@example.test','admin','Synthetic','A',repeat('a',64),'revoked','2026-11-01','directory-admin','2026-10-01 12:00:00.123455+00'),
      ('directory-foreign','tenantB','foreign@example.test','admin','Synthetic','Foreign',repeat('f',64),'pending','2026-11-01','directory-foreign','2026-10-02');
  `);
});
describe('proposed service-only staff directory against all actual migrations', () => {
  it.each(['members','invitations'])('paginates %s ties and microsecond boundaries without gaps or repeats', async kind => {
    const first = await list(kind, 'directory-admin', null, 1);
    const key = kind === 'members' ? 'uid' : 'id';
    expect(first.map(r => r[key])).toEqual(['directory-c']);
    expect(first[0].createdAt).toContain('.123456');
    const second = await list(kind, 'directory-admin', null, 1, first[0].createdAt, first[0][key]);
    expect(second.map(r => r[key])).toEqual(['directory-b']);
    const third = await list(kind, 'directory-admin', null, 1, second[0].createdAt, second[0][key]);
    expect(third.map(r => r[key])).toEqual(['directory-a']);
    expect(third[0].createdAt).toContain('.123455');
    expect((await list(kind)).some(r => r[key] === 'directory-foreign')).toBe(false);
  });
  it.each(['members','invitations'])('uses ASCII C ordering for %s mixed-case and punctuation ties', async kind => {
    const ids = ['directory-mix-A', 'directory-mix-Z', 'directory-mix-a', 'directory-mix-z', 'directory-mix_', 'directory-mix-'];
    for (const [index, id] of ids.entries()) {
      if (kind === 'members') await fixture.pg.query("INSERT INTO taxguard_members(tenant_id,uid,role,status,created_at) VALUES('tenantA',$1,'accountant','pending_approval','2026-10-03 12:00:00.123456+00')", [id]);
      else await fixture.pg.query("INSERT INTO taxguard_staff_invitations(id,tenant_id,email,role,legal_first_name,legal_last_name,token_hash,status,expires_at,invited_by,created_at) VALUES($1,'tenantA',$2,'accountant','Synthetic','Tie',$3,'pending','2026-11-01','directory-admin','2026-10-03 12:00:00.123456+00')", [id, id.toLowerCase() + index + '@example.test', String(index + 1).repeat(64)]);
    }
    const key = kind === 'members' ? 'uid' : 'id';
    const status = kind === 'members' ? 'pending_approval' : 'pending';
    let after: string | null = null;
    let afterId: string | null = null;
    const observed: string[] = [];
    for (let n = 0; n < ids.length; n++) {
      const page = await list(kind, 'directory-admin', status, 1, after, afterId);
      expect(page).toHaveLength(1);
      observed.push(page[0][key]);
      after = page[0].createdAt;
      afterId = page[0][key];
    }
    expect(observed).toEqual([...ids].sort().reverse());
    expect(new Set(observed).size).toBe(ids.length);
  });
  it('filters statuses and returns empty arrays for absent results', async () => {
    expect((await list('members','directory-admin','suspended')).map(r=>r.uid)).toEqual(['directory-b']);
    expect(await list('members','directory-admin','pending_approval')).toEqual([]);
    expect((await list('invitations','directory-admin','pending')).map(r=>r.id)).toEqual(['directory-c']);
    expect((await list('invitations','directory-admin','accepted')).map(r=>r.id)).toEqual(['directory-b']);
    expect((await list('invitations','directory-admin','revoked')).map(r=>r.id)).toEqual(['directory-a']);
  });
  it('returns explicit safe fields and fail-closed internal identity/MFA evidence', async () => {
    const rows = await list();
    expect(rows[0]).toMatchObject({uid:'directory-c',name:'Synthetic Staff',email:'synthetic@example.test',identityConsistent:true,mfaEnabled:true,mfaReenrollmentRequired:false});
    expect(rows.find(r=>r.uid==='directory-b')).toMatchObject({identityConsistent:false,mfaEnabled:false});
    expect(rows.find(r=>r.uid==='directory-a')).toMatchObject({name:null,email:null,identityConsistent:false,mfaEnabled:false});
    expect(Object.keys(rows[0]).sort()).toEqual(['uid','name','email','role','status','createdAt','invitedBy','approvedBy','approvedAt','statusChangedBy','statusChangedAt','mfaReenrollmentRequired','identityConsistent','mfaEnabled'].sort());
    expect(Object.keys((await list('invitations'))[0]).sort()).toEqual(['id','email','role','legalFirstName','legalLastName','status','createdAt','expiresAt','invitedBy','acceptedUid','acceptedAt','revokedBy','revokedAt'].sort());
    const serialized = JSON.stringify([rows,await list('invitations')]);
    for(const secret of ['PRIVATE_PASSWORD','PRIVATE_FACTOR','PRIVATE_METADATA','FOREIGN_NAME','token_hash','c'.repeat(64),'status_reason']) expect(serialized).not.toContain(secret);
  });
  it.each(['client','prospective_client','super_admin','super_administrator'])('excludes member role %s', async role => {
    await fixture.pg.query("UPDATE taxguard_members SET role=$1 WHERE uid='directory-c'",[role]);
    expect((await list()).some(r=>r.uid==='directory-c')).toBe(false);
  });
  it.each(['admin','administrator','super_admin','super_administrator'])('accepts canonical administrator alias %s only while active', async role => {
    await fixture.pg.query("UPDATE taxguard_members SET role=$1 WHERE uid='directory-admin'",[role]);
    for(const kind of ['members','invitations']) expect(await list(kind)).toBeInstanceOf(Array);
    await fixture.pg.exec("UPDATE taxguard_members SET status='suspended' WHERE uid='directory-admin'");
    for(const kind of ['members','invitations']) await expect(list(kind)).rejects.toThrow('STAFF_ADMIN_REQUIRED');
  });
  it.each(['members','invitations'])('denies %s cross-tenant, missing and non-admin actors', async kind => {
    for(const actor of ['directory-foreign','missing','directory-c']) await expect(list(kind,actor)).rejects.toThrow('STAFF_ADMIN_REQUIRED');
    await expect(list(kind,'directory-admin',null,51,null,null,'tenantB')).rejects.toThrow('STAFF_ADMIN_REQUIRED');
  });
  it.each(['members','invitations'])('validates %s page bounds, filters and complete finite cursors', async kind => {
    for(const size of [null,0,-1,52]) await expect(list(kind,'directory-admin',null,size)).rejects.toThrow('STAFF_DIRECTORY_INPUT_INVALID');
    for(const status of ['', 'unknown', kind==='members'?'pending':'active']) await expect(list(kind,'directory-admin',status)).rejects.toThrow('STAFF_DIRECTORY_INPUT_INVALID');
    for(const [created,id] of [[null,'x'],['2026-10-01',null],['infinity','x'],['-infinity','x'],['2026-10-01',''],['2026-10-01','x'.repeat(129)],['2026-10-01','line\nbreak']] as const)
      await expect(list(kind,'directory-admin',null,1,created,id)).rejects.toThrow('STAFF_DIRECTORY_INPUT_INVALID');
    await expect(list(kind,'')).rejects.toThrow('STAFF_DIRECTORY_INPUT_INVALID');
    await expect(list(kind,'directory-admin',null,1,null,null,'')).rejects.toThrow('STAFF_DIRECTORY_INPUT_INVALID');
  });
  it('supports exactly the server overfetch ceiling of 51', async () => {
    await fixture.pg.exec("INSERT INTO taxguard_members(tenant_id,uid,role,status) SELECT 'tenantA','directory-extra-'||n,'accountant','active' FROM generate_series(1,60) n");
    expect(await list()).toHaveLength(51);
    expect(await list('members','directory-admin',null,50)).toHaveLength(50);
  });
  it('limits execution to service role and pins the safe search path', async () => {
    for(const role of ['anon','authenticated']) {
      await fixture.pg.exec('SET ROLE '+role);
      try { for(const kind of ['members','invitations']) await expect(list(kind)).rejects.toThrow('permission denied'); }
      finally { await fixture.pg.exec('RESET ROLE'); }
    }
    await fixture.pg.exec('SET ROLE service_role');
    try { expect(await list()).toBeInstanceOf(Array); expect(await list('invitations')).toHaveLength(3); }
    finally { await fixture.pg.exec('RESET ROLE'); }
    const config = await fixture.pg.query<{proconfig:string[]}>("SELECT proconfig FROM pg_proc WHERE proname IN ('taxguard_list_staff_members','taxguard_list_staff_invitations')");
    expect(config.rows).toHaveLength(2);
    for(const row of config.rows) expect(row.proconfig).toContain('search_path=pg_catalog, public, pg_temp');
  });
});
