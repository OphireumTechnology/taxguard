import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { CONSULTATION_CONSENT_VERSION, ConsultationStore } from '../server/taxguard/consultations/consultationStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';

// Real PostgreSQL: proposal 043 abuse limits and conversion under true concurrency, with every
// migration and proposal applied in name order. Synthetic visitors and records only.
let db: TestDatabase;
const T = 'tenantDbConsult', C = 'dbConsultClient';
const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const request = (email: string) => ({ fullName: 'Synthetic Visitor', email, preferredContact: 'EMAIL', topic: 'TAX_PLANNING', modePreference: 'REMOTE',
  preferredWindows: [{ date: day(4), partOfDay: 'AFTERNOON' }], timezone: 'UTC', consent: true, consentVersion: CONSULTATION_CONSENT_VERSION });
beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES('${T}','Synthetic consultation tenant') ON CONFLICT DO NOTHING;
    INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','db-consult-client','Synthetic Consultation Client');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES('${T}','db-consult-mgr','practice_manager','active',NULL),('${T}','db-consult-acct','accountant','active',NULL);`);
  const practice = new PracticeStore(pgRpc(db.pool));
  const e = (await practice.createEngagement(T, C, 'db-consult-mgr', 'db-consult-eng', { title: 'Synthetic 2025', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'db-consult-mgr', e, 'active', 1);
  await practice.assign(T, C, 'db-consult-mgr', 'db-consult-asg', { engagementId: e, taxYear: 2025, role: 'preparer', userId: 'db-consult-acct', reason: 'Synthetic staffing' });
}, 240000);
afterAll(async () => { await db?.stop(); });

describe('consultation requests on a real PostgreSQL server', () => {
  it('holds the per-e-mail limit exactly under a concurrent burst', async () => {
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) =>
      new ConsultationStore(pgRpc(db.pool)).submit(T, `db-consult-burst-${i}`, `192.0.2.${10 + i}`, request('burst@example.test'))));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(3);
    for (const r of results) if (r.status === 'rejected') expect((r.reason as any).code).toBe('CONSULTATION_RATE_LIMITED');
    const stored = (await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_consultation_requests WHERE tenant_id = $1 AND email = 'burst@example.test'`, [T])).rows[0].n;
    expect(stored).toBe(3);
  });
  it('converts a request into exactly one appointment when conversions race', async () => {
    const store = new ConsultationStore(pgRpc(db.pool));
    await store.submit(T, 'db-consult-convert', '192.0.2.99', request('convert@example.test'));
    const [q] = (await store.list(T, 'db-consult-mgr', 'NEW')).filter((x: any) => x.email === 'convert@example.test');
    const reviewing: any = await store.decide(T, 'db-consult-mgr', q.requestId, q.version, 'db-consult-review', 'review');
    const start = new Date(Date.now() + 6 * 86_400_000); start.setUTCHours(15, 0, 0, 0);
    const appointment = { title: 'Synthetic consultation', category: 'CONSULTATION', mode: 'REMOTE', startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3_600_000).toISOString(),
      timezone: 'UTC', staffUid: 'db-consult-acct', confirm: true };
    const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) =>
      new ConsultationStore(pgRpc(db.pool)).convert(T, 'db-consult-mgr', q.requestId, reviewing.version, `db-consult-conv-${i}`, C, appointment)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    for (const r of results) if (r.status === 'rejected') expect((r.reason as any).code).toMatch(/^(CONSULTATION_VERSION_CONFLICT|CONSULTATION_TRANSITION_INVALID|APPOINTMENT_(STAFF|CLIENT)_CONFLICT)$/);
    const apts = (await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_appointments WHERE tenant_id = $1 AND client_id = $2`, [T, C])).rows[0].n;
    expect(apts).toBe(1);
  });
});
