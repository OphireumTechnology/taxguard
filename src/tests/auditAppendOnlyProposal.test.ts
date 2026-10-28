import { afterAll, beforeAll, expect, it } from 'vitest';
import fs from 'node:fs';
import { capabilityFixture } from './aiCapabilities.fixture';
let f: Awaited<ReturnType<typeof capabilityFixture>>;
beforeAll(async () => {
  f = await capabilityFixture();
  await f.pg.exec(fs.readFileSync('docs/sql/taxguard-audit-append-only.proposal.sql', 'utf8'));
  await f.pg.exec("GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON taxguard_audit_log TO service_role");
  await f.pg.exec('GRANT TRUNCATE ON ALL TABLES IN SCHEMA public TO service_role');
}, 30000);
afterAll(async () => { await f?.pg.close(); });
it('permits append without replacing historical rows', async () => {
  await f.pg.exec("INSERT INTO taxguard_audit_log(tenant_id,action,actor_uid) VALUES('tenantA','SYNTHETIC_APPEND','test')");
  expect((await f.pg.query('SELECT action FROM taxguard_audit_log')).rows).toEqual([{ action: 'SYNTHETIC_APPEND' }]);
});
it.each(['UPDATE taxguard_audit_log SET action=\'REWRITTEN\'', 'DELETE FROM taxguard_audit_log', 'TRUNCATE taxguard_audit_log CASCADE'])('rejects owner history mutation: %s', async sql => {
  await expect(f.pg.exec(sql)).rejects.toThrow('TAXGUARD_AUDIT_IMMUTABLE');
  expect((await f.pg.query('SELECT action FROM taxguard_audit_log')).rows).toEqual([{ action: 'SYNTHETIC_APPEND' }]);
});
it.each(['UPDATE taxguard_audit_log SET action=\'REWRITTEN\'', 'DELETE FROM taxguard_audit_log', 'TRUNCATE taxguard_audit_log CASCADE'])('rejects server role history mutation: %s', async sql => {
  await f.pg.exec('SET ROLE service_role');
  try { await expect(f.pg.exec(sql)).rejects.toThrow('TAXGUARD_AUDIT_IMMUTABLE'); }
  finally { await f.pg.exec('RESET ROLE'); }
});
it('rolls back an append when the same transaction tries to erase history', async () => {
  await expect(f.pg.transaction(async tx => {
    await tx.exec("INSERT INTO taxguard_audit_log(tenant_id,action,actor_uid) VALUES('tenantA','ROLLBACK','test')");
    await tx.exec('DELETE FROM taxguard_audit_log');
  })).rejects.toThrow('TAXGUARD_AUDIT_IMMUTABLE');
  expect((await f.pg.query('SELECT action FROM taxguard_audit_log')).rows).toEqual([{ action: 'SYNTHETIC_APPEND' }]);
});
