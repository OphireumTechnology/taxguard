import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { capabilityFixture } from './aiCapabilities.fixture';
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
beforeAll(async () => {
  fixture = await capabilityFixture();
  for (const name of ['20261012010000_taxguard_staff_invitations.sql','20261012020000_taxguard_staff_acceptance.sql','20261012030000_taxguard_staff_invitation_management.sql','20261012040000_taxguard_staff_membership_lifecycle.sql']) await fixture.pg.exec(readFileSync('docs/proposed-migrations/' + name, 'utf8'));
  await fixture.pg.exec("INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','invite-maker','admin','active'),('tenantA','invite-checker','admin','active'),('tenantB','invite-foreign','admin','active')");
}, 30000);
afterAll(async () => { await fixture?.pg.close(); });
const create = (id: string, email: string, hash: string, actor = 'invite-maker') => fixture.pg.query(
  'SELECT taxguard_create_staff_invitation($1,$2,$3,$4,$5,$6,$7,$8) AS result', ['tenantA', actor, id, email, 'accountant', 'Synthetic', 'Staff', hash]);
it('creates hash-only invitation and audit using actual core schema', async () => {
  const row = (await create('issued', 'issued@example.test', 'b'.repeat(64))).rows[0] as any;
  expect(row.result.id).toBe('issued');
  expect(Date.parse(row.result.expiresAt)).toBeGreaterThan(Date.now());
  const audit = (await fixture.pg.query("SELECT metadata FROM taxguard_audit_log WHERE action='STAFF_INVITATION_CREATED'")).rows as any[];
  expect(audit).toHaveLength(1); expect(JSON.stringify(audit)).not.toContain('b'.repeat(64));
});
it('rejects duplicate pending invitation and cross-tenant issuer', async () => {
  await expect(create('duplicate', 'issued@example.test', 'c'.repeat(64))).rejects.toThrow('duplicate key');
  await expect(create('foreign', 'foreign@example.test', 'd'.repeat(64), 'invite-foreign')).rejects.toThrow('STAFF_ADMIN_REQUIRED');
});
it('revokes once with an idempotent retry and refuses acceptance', async () => {
  await fixture.pg.query("SELECT taxguard_revoke_staff_invitation('tenantA','invite-maker','issued')");
  await fixture.pg.query("SELECT taxguard_revoke_staff_invitation('tenantA','invite-maker','issued')");
  expect((await fixture.pg.query("SELECT action FROM taxguard_audit_log WHERE action='STAFF_INVITATION_REVOKED'")).rows).toHaveLength(1);
  await expect(fixture.pg.query("SELECT taxguard_accept_staff_invitation('tenantA',repeat('b',64),'staff-revoked','issued@example.test')")).rejects.toThrow('INVITATION_INVALID');
});
it('expires previous token on replacement and refuses the old token', async () => {
  await create('expired', 'expired@example.test', 'e'.repeat(64));
  await fixture.pg.exec("UPDATE taxguard_staff_invitations SET expires_at=NOW()-interval '1 second' WHERE id='expired'");
  await create('replacement', 'expired@example.test', 'f'.repeat(64));
  expect((await fixture.pg.query("SELECT status FROM taxguard_staff_invitations WHERE id='expired'")).rows).toEqual([{status:'revoked'}]);
  await expect(fixture.pg.query("SELECT taxguard_accept_staff_invitation('tenantA',repeat('e',64),'staff-expired','expired@example.test')")).rejects.toThrow('INVITATION_INVALID');
});
it('accepts replacement then requires independent administrator activation against real tables', async () => {
  await fixture.pg.query("SELECT taxguard_accept_staff_invitation('tenantA',repeat('f',64),'staff-real-core','expired@example.test')");
  await expect(fixture.pg.query("SELECT taxguard_approve_staff_activation('tenantA','invite-maker','staff-real-core')")).rejects.toThrow('INDEPENDENT_APPROVER_REQUIRED');
  await fixture.pg.query("SELECT taxguard_approve_staff_activation('tenantA','invite-checker','staff-real-core')");
  expect((await fixture.pg.query("SELECT role,status,approved_by FROM taxguard_members WHERE uid='staff-real-core'")).rows).toEqual([{role:'accountant',status:'active',approved_by:'invite-checker'}]);
});
it('limits issuance across transactions and rolls back the refused invitation', async () => {
  // Three committed invitations above; fill the per-administrator hourly allowance to ten.
  for (let i=0;i<7;i++) await create('bounded-'+i, 'bounded-'+i+'@example.test', (i+1).toString(16).repeat(64));
  await expect(create('limited', 'limited@example.test', '9'.repeat(64))).rejects.toThrow('INVITATION_RATE_LIMITED');
  expect((await fixture.pg.query("SELECT id FROM taxguard_staff_invitations WHERE id='limited'")).rows).toEqual([]);
});
it('denies browser invocation of issuance and revocation functions', async () => {
  await fixture.pg.exec('SET ROLE authenticated');
  try {
    await expect(create('browser', 'browser@example.test', '8'.repeat(64))).rejects.toThrow('permission denied');
    await expect(fixture.pg.query("SELECT taxguard_revoke_staff_invitation('tenantA','invite-maker','issued')")).rejects.toThrow('permission denied');
  } finally { await fixture.pg.exec('RESET ROLE'); }
});
