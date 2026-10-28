import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { AppointmentStore } from '../server/taxguard/appointments/appointmentStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';

// Real PostgreSQL: proposal 040 booking conflicts under true concurrency (separate connections),
// with every migration and proposal applied in name order. Synthetic records only.
let db: TestDatabase;
const T = 'tenantDbApt', C1 = 'dbAptClient1', C2 = 'dbAptClient2';
const start = new Date(Date.now() + 72 * 3_600_000).toISOString(), end = new Date(Date.now() + 73 * 3_600_000).toISOString();
beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES('${T}','Synthetic appointment tenant'),('tenantDbAptOther','Other synthetic tenant') ON CONFLICT DO NOTHING;
    INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C1}','db-apt-c1','Synthetic One'),('${T}','${C2}','db-apt-c2','Synthetic Two');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES('${T}','db-apt-mgr','practice_manager','active',NULL),('${T}','db-apt-acct','accountant','active',NULL),
      ('${T}','db-apt-c1','client','active','${C1}'),('tenantDbAptOther','db-apt-foreign','practice_manager','active',NULL);`);
  const practice = new PracticeStore(pgRpc(db.pool));
  for (const [c, k] of [[C1, '1'], [C2, '2']]) {
    const e = (await practice.createEngagement(T, c, 'db-apt-mgr', 'db-apt-eng-' + k, { title: 'Synthetic 2025', type: 'tax_preparation', taxYears: [2025] })).engagementId;
    await practice.setEngagementStatus(T, c, 'db-apt-mgr', e, 'active', 1);
    await practice.assign(T, c, 'db-apt-mgr', 'db-apt-asg-' + k, { engagementId: e, taxYear: 2025, role: 'preparer', userId: 'db-apt-acct', reason: 'Synthetic staffing' });
  }
}, 240000);
afterAll(async () => { await db?.stop(); });

describe('appointments on a real PostgreSQL server', () => {
  it('books exactly one of ten simultaneous overlapping requests for the same staff member, across clients', async () => {
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => new AppointmentStore(pgRpc(db.pool)).create(T, i % 2 ? C2 : C1, 'db-apt-mgr', `db-apt-race-${i}`,
      { title: `Synthetic race ${i}`, mode: 'REMOTE', startsAt: start, endsAt: end, timezone: 'UTC', staffUid: 'db-apt-acct', confirm: true })));
    const ok = results.filter(r => r.status === 'fulfilled');
    expect(ok).toHaveLength(1);
    for (const r of results) if (r.status === 'rejected') expect((r.reason as any).code).toMatch(/^APPOINTMENT_(STAFF|CLIENT)_CONFLICT$/);
    const active = (await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_appointments WHERE tenant_id = $1 AND staff_uid = 'db-apt-acct' AND status IN ('REQUESTED','CONFIRMED')`, [T])).rows[0].n;
    expect(active).toBe(1);
  });
  it('records one appointment when the same request is retried concurrently', async () => {
    const s = new Date(Date.now() + 96 * 3_600_000).toISOString(), e = new Date(Date.now() + 97 * 3_600_000).toISOString();
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => new AppointmentStore(pgRpc(db.pool)).create(T, C1, 'db-apt-c1', 'db-apt-same-key',
      { title: 'Synthetic retried request', mode: 'PHONE', startsAt: s, endsAt: e, timezone: 'UTC' })));
    const ids = new Set(results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled').map(r => r.value.appointmentId));
    expect(ids.size).toBe(1);
    for (const r of results) if (r.status === 'rejected') expect((r.reason as any).code).toMatch(/^(APPOINTMENT_CLIENT_CONFLICT|APPOINTMENT_STORE_UNAVAILABLE|IDEMPOTENCY_KEY_REUSED)$/);
    const rows = (await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_appointments WHERE tenant_id = $1 AND title = 'Synthetic retried request'`, [T])).rows[0].n;
    expect(rows).toBe(1);
  });
  it('refuses another tenant and survives a new connection', async () => {
    await expect(new AppointmentStore(pgRpc(db.pool)).listForClient(T, C1, 'db-apt-foreign')).rejects.toMatchObject({ status: 403 });
    expect((await new AppointmentStore(pgRpc(db.pool)).listForClient(T, C1, 'db-apt-mgr')).length).toBeGreaterThanOrEqual(1);
  });
});
