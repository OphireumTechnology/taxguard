import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { startDatabase, type TestDatabase } from './harness';

// Proposal 034 job claiming on a real PostgreSQL server: workers on separate connections race for
// runnable reset jobs; FOR UPDATE SKIP LOCKED plus fencing must give each job to exactly one worker.
let db: TestDatabase; let conns: pg.Client[] = [];
const N = 10, JOBS = 3;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
beforeAll(async () => {
  db = await startDatabase();
  conns = await Promise.all(Array.from({ length: N }, () => db.connect()));
  await db.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES('tenantA','Synthetic A');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','db-admin-a','admin','active'),('tenantA','db-admin-b','admin','active');`);
  for (let i = 1; i <= JOBS; i++) {
    await db.pool.query(`INSERT INTO taxguard_members(tenant_id,uid,role,status,mfa_reenrollment_required) VALUES('tenantA','db-staff-${i}','accountant','suspended',true)`);
    await db.pool.query(`INSERT INTO taxguard_mfa_recovery_requests(request_id,tenant_id,target_uid,maker_uid,reason_category,reason,status,checker_uid,approved_at)
      VALUES($1,'tenantA',$2,'db-admin-a','lost_authenticator','Synthetic loss','approved','db-admin-b',now())`, [uuid(i), `db-staff-${i}`]);
    await db.pool.query(`INSERT INTO taxguard_mfa_reset_jobs(job_id,tenant_id,request_id,target_uid) VALUES($1,'tenantA',$1,$2)`, [uuid(i), `db-staff-${i}`]);
  }
});
afterAll(async () => { await Promise.all(conns.map(c => c.end().catch(() => undefined))); await db?.stop(); });

describe('reset job claiming under concurrency', () => {
  it('hands each runnable job to exactly one of many simultaneous workers', async () => {
    const claims = await Promise.all(conns.map((c, i) => c.query(`SELECT taxguard_mfa_job_claim('tenantA', $1, 60) AS r`, [`worker-${i}`]).then(r => r.rows[0].r)));
    const got = claims.filter(Boolean);
    expect(got).toHaveLength(JOBS);
    expect(new Set(got.map((g: any) => g.jobId)).size).toBe(JOBS);
    expect(got.every((g: any) => g.fence === 1 && g.attempt === 1)).toBe(true);
    const rows = (await db.pool.query(`SELECT status, fence, lease_owner FROM taxguard_mfa_reset_jobs ORDER BY job_id`)).rows;
    expect(rows.every(r => r.status === 'leased' && Number(r.fence) === 1 && r.lease_owner)).toBe(true);
  });
  it('lets only the current fence holder report when a lease is re-claimed concurrently', async () => {
    await db.pool.query(`UPDATE taxguard_mfa_reset_jobs SET lease_expires_at = now() - interval '1 second' WHERE job_id = $1`, [uuid(1)]);
    const old = (await db.pool.query(`SELECT lease_owner, fence FROM taxguard_mfa_reset_jobs WHERE job_id=$1`, [uuid(1)])).rows[0];
    const [reclaim, staleReport] = await Promise.allSettled([
      conns[0].query(`SELECT taxguard_mfa_job_claim('tenantA', 'worker-new', 60) AS r`),
      conns[1].query(`SELECT taxguard_mfa_job_report('tenantA', $1, $2, $3, '{"kind":"reset_verified","remainingFactors":0,"removedFactorHashes":[]}'::jsonb) AS r`, [uuid(1), old.lease_owner, old.fence])]);
    expect(staleReport.status).toBe('rejected'); // the old lease had expired before either statement ran
    expect(reclaim.status).toBe('fulfilled');
    const row = (await db.pool.query(`SELECT status, fence, lease_owner FROM taxguard_mfa_reset_jobs WHERE job_id=$1`, [uuid(1)])).rows[0];
    expect([row.status, Number(row.fence), row.lease_owner]).toEqual(['leased', 2, 'worker-new']);
  });
});
