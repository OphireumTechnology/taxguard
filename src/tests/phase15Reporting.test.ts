import { beforeAll, afterAll } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';
import { phase15IsolationSeed, registerPhase15Reporting } from './helpers/phase15Reporting';
import { SqlLedgerStore } from '../server/taxguard/bookkeeping/sqlLedgerStore';

let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012240000_/);
  await fixture.pg.exec(`INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,role,user_id,assigned_by)
    VALUES('phase15-review','tenantA','clientA','reviewer','reviewer','test');`);
  await fixture.pg.exec(phase15IsolationSeed);
}, 60000);
afterAll(async () => { await fixture?.pg.close(); });
registerPhase15Reporting(() => new SqlLedgerStore(pgliteRpc(() => fixture.pg)));
