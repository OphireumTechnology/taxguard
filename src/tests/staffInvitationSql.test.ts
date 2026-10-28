import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
let pg: PGlite;
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE taxguard_tenants(id varchar(128) PRIMARY KEY);
    CREATE TABLE taxguard_members(id text, tenant_id varchar(128), uid varchar(128), role varchar(64), status varchar(32), updated_at timestamptz, UNIQUE(tenant_id,uid));
    CREATE TABLE taxguard_identities(uid varchar(128) PRIMARY KEY, tenant_id varchar(128), user_data jsonb);
    CREATE TABLE taxguard_audit_log(tenant_id text, action text, actor_uid text, actor_role text, metadata jsonb);
    INSERT INTO taxguard_tenants VALUES('tenantA'),('tenantB');`);
  for (const path of ['20261012010000_taxguard_staff_invitations.sql', '20261012020000_taxguard_staff_acceptance.sql']) {
    await pg.exec(readFileSync('docs/proposed-migrations/' + path, 'utf8'));
  }
  await pg.exec(`INSERT INTO taxguard_staff_invitations(id,tenant_id,email,role,legal_first_name,legal_last_name,token_hash,expires_at,invited_by)
    VALUES('invite','tenantA','staff@example.test','accountant','Synthetic','Staff',repeat('a',64),NOW()+interval '1 day','maker');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','maker','admin','active'),('tenantA','checker','admin','active'),('tenantB','outsider','admin','active');`);
}, 30000);
afterAll(async () => { await pg?.close(); });
it('denies a different tenant and email without consuming the invitation', async () => {
  await expect(pg.query("SELECT taxguard_accept_staff_invitation('tenantB',repeat('a',64),'staff','staff@example.test')")).rejects.toThrow('INVITATION_INVALID');
  await expect(pg.query("SELECT taxguard_accept_staff_invitation('tenantA',repeat('a',64),'staff','wrong@example.test')")).rejects.toThrow('INVITATION_INVALID');
});
it('atomically accepts once with a pending membership and audit', async () => {
  await pg.query("SELECT taxguard_accept_staff_invitation('tenantA',repeat('a',64),'staff','staff@example.test')");
  expect((await pg.query("SELECT role,status FROM taxguard_members WHERE uid='staff'")).rows).toEqual([{role:'accountant',status:'pending_approval'}]);
  expect((await pg.query("SELECT action FROM taxguard_audit_log")).rows).toEqual([{action:'STAFF_INVITATION_ACCEPTED'}]);
  await expect(pg.query("SELECT taxguard_accept_staff_invitation('tenantA',repeat('a',64),'staff','staff@example.test')")).rejects.toThrow('INVITATION_INVALID');
});
it('requires an independent administrator in the same tenant', async () => {
  await expect(pg.query("SELECT taxguard_approve_staff_activation('tenantA','maker','staff')")).rejects.toThrow('INDEPENDENT_APPROVER_REQUIRED');
  await expect(pg.query("SELECT taxguard_approve_staff_activation('tenantA','outsider','staff')")).rejects.toThrow('STAFF_ADMIN_REQUIRED');
  await pg.query("SELECT taxguard_approve_staff_activation('tenantA','checker','staff')");
  expect((await pg.query("SELECT status,approved_by FROM taxguard_members WHERE uid='staff'")).rows).toEqual([{status:'active',approved_by:'checker'}]);
});
it('browser roles cannot execute the privileged acceptance RPC', async () => {
  await pg.exec('SET ROLE authenticated');
  try { await expect(pg.query("SELECT taxguard_accept_staff_invitation('tenantA',repeat('a',64),'staff','staff@example.test')")).rejects.toThrow('permission denied'); }
  finally { await pg.exec('RESET ROLE'); }
});
