import { beforeAll, afterAll } from 'vitest';
import { startDatabase, pgRpc, type TestDatabase } from './harness';
import { phase15IsolationSeed, registerPhase15Reporting } from '../tests/helpers/phase15Reporting';
import { SqlLedgerStore } from '../server/taxguard/bookkeeping/sqlLedgerStore';

let db: TestDatabase;
beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES('tenantA','Synthetic A'),('tenantB','Synthetic B');
    INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid) VALUES('tenantA','clientA','owner'),('tenantA','clientB','other');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','preparer','accountant','active'),('tenantA','reviewer','reviewer','active');
    INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,role,user_id,assigned_by) VALUES
      ('phase15-preparer','tenantA','clientA','accountant','preparer','test'),('phase15-reviewer','tenantA','clientA','reviewer','reviewer','test');`);
  await db.pool.query(phase15IsolationSeed);
});
afterAll(async () => { await db?.stop(); });
registerPhase15Reporting(() => new SqlLedgerStore(pgRpc(db.pool)));
