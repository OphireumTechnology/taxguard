import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDatabase, type TestDatabase } from './harness';

// The offline synthetic staging seed (scripts/staging/build-synthetic-seed.mjs) applies cleanly
// after every migration and proposal, and contains only synthetic, example.test identities.
let db: TestDatabase;
beforeAll(async () => { db = await startDatabase(); }, 240000);
afterAll(async () => { await db?.stop(); });

describe('synthetic staging seed', () => {
  it('applies on a real PostgreSQL server and creates only synthetic records', async () => {
    const sql = execFileSync(process.execPath, ['scripts/staging/build-synthetic-seed.mjs', '--tenant', 'tenantStagingTest'], { encoding: 'utf8' });
    expect(sql).not.toMatch(/@(?!example\.test)[a-z0-9.-]+\.[a-z]{2,}/i);
    await db.pool.query(sql);
    const r = (await db.pool.query(`SELECT (SELECT count(*) FROM taxguard_members WHERE tenant_id = 'tenantStagingTest')::int AS members,
      (SELECT count(*) FROM taxguard_clients WHERE tenant_id = 'tenantStagingTest')::int AS clients`)).rows[0];
    expect(r).toEqual({ members: 9, clients: 3 });
  });
});
