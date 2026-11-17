import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { startDatabase, type TestDatabase } from './harness';

// Proposal 035 on real PostgreSQL: two administrators try to suspend each other at the same moment
// on separate connections. Exactly one change may win, the other is refused cleanly (no deadlock
// abort), and the tenant always keeps an active administrator.
let db: TestDatabase; let a: pg.Client; let b: pg.Client;
const ROUNDS = 15;
beforeAll(async () => {
  db = await startDatabase(); a = await db.connect(); b = await db.connect();
  await db.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES('tenantA','Synthetic A');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','race-a','admin','active'),('tenantA','race-b','admin','active');
    INSERT INTO taxguard_identities(tenant_id,uid,user_data) SELECT tenant_id,uid,jsonb_build_object('id',uid,'tenantId',tenant_id,'role',role,'status',status) FROM taxguard_members;`);
});
afterAll(async () => { await a?.end().catch(() => undefined); await b?.end().catch(() => undefined); await db?.stop(); });

describe('mutual administrator suspension', () => {
  it('never suspends both administrators and never surfaces a deadlock', async () => {
    const outcomes: string[] = [];
    for (let round = 0; round < ROUNDS; round++) {
      await db.pool.query(`UPDATE taxguard_members SET status='active', status_changed_by=NULL WHERE uid IN ('race-a','race-b');
        UPDATE taxguard_identities SET user_data = jsonb_set(user_data,'{status}','"active"') WHERE uid IN ('race-a','race-b')`);
      const run = (c: pg.Client, actor: string, target: string) => c.query(`SELECT taxguard_change_staff_membership_status('tenantA',$1,$2,'suspend','Synthetic race') AS r`, [actor, target])
        .then(() => 'ok', (e: any) => e.code === 'P0001' ? e.message : 'SQLSTATE_' + e.code);
      const [x, y] = await Promise.all([run(a, 'race-a', 'race-b'), run(b, 'race-b', 'race-a')]);
      outcomes.push(x, y);
      expect([x, y].filter(o => o === 'ok')).toHaveLength(1);
      expect([x, y].filter(o => o !== 'ok')).toEqual(['STAFF_ADMIN_REQUIRED']);
      const active = (await db.pool.query(`SELECT count(*)::int n FROM taxguard_members WHERE status='active' AND uid LIKE 'race-%'`)).rows[0].n;
      expect(active).toBe(1);
    }
    expect(outcomes.some(o => o.startsWith('SQLSTATE_'))).toBe(false);
  });
});
