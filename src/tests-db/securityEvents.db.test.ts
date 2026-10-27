import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { BillingStore, SandboxPaymentProvider } from '../server/taxguard/billing/billingStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';

// Real PostgreSQL, every migration and proposal applied in name order: proposal 048 ingestion bounds
// under true concurrency (separate connections), and proposal 047 client projection on a real
// server. Synthetic records only.
let db: TestDatabase;
const T = 'tenantDbSec', C = 'dbSecClient';
beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES('${T}','Synthetic security tenant') ON CONFLICT DO NOTHING;
    INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','db-sec-client','Synthetic client');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES('${T}','db-sec-mgr','practice_manager','active',NULL),('${T}','db-sec-mgr2','admin','active',NULL),
      ('${T}','db-sec-client','client','active','${C}');`);
}, 240000);
afterAll(async () => { await db?.stop(); });

const record = (fp: string) => db.connect().then(async c => {
  try { return (await c.query(`SELECT public.taxguard_security_event_record($1,'AUTH','AUTH_FAILURE_TELEMETRY','warning',NULL,$2,'{}'::jsonb) AS r`, [T, fp])).rows[0].r.result; }
  finally { await c.end(); }
});

describe('security events on a real PostgreSQL server', () => {
  it('records exactly 20 of 40 simultaneous events from one source and writes one repeated-requests marker', async () => {
    const fp = 'a1'.repeat(16);
    const results = await Promise.all(Array.from({ length: 40 }, () => record(fp)));
    expect(results.filter(r => r === 'RECORDED')).toHaveLength(20);
    expect(results.filter(r => r === 'SUPPRESSED')).toHaveLength(20);
    const rows = (await db.pool.query(`SELECT action, count(*)::int AS n FROM taxguard_audit_log WHERE tenant_id = $1 AND action LIKE 'SECURITY_%' GROUP BY action ORDER BY action`, [T])).rows;
    expect(rows).toEqual([{ action: 'SECURITY_AUTH_FAILURE_TELEMETRY', n: 20 }, { action: 'SECURITY_REPEATED_REQUESTS', n: 1 }]);
  }, 60000);
});

describe('client billing projection on a real PostgreSQL server', () => {
  it('returns no staff-only invoice fields to the client', async () => {
    const practice = new PracticeStore(pgRpc(db.pool)), store = new BillingStore(pgRpc(db.pool), new SandboxPaymentProvider());
    const eng = (await practice.createEngagement(T, C, 'db-sec-mgr', 'db-sec-engagement', { title: 'Synthetic 2025', type: 'tax_preparation', taxYears: [2025] })).engagementId;
    await practice.setEngagementStatus(T, C, 'db-sec-mgr', eng, 'active', 1);
    await store.upsertService(T, 'db-sec-mgr', { serviceCode: 'SYN-1', name: 'Synthetic service', category: 'INDIVIDUAL_TAX', billingMethod: 'FLAT_FEE', baseFee: '100.00' });
    const inv = (await store.createInvoice(T, C, 'db-sec-mgr', 'db-sec-invoice', { dueDate: '2026-12-31' })).invoiceId;
    let r: any = await store.addLine(T, C, 'db-sec-mgr', inv, { serviceCode: 'SYN-1', quantity: 1, unitRate: '90.00', overrideReason: 'Synthetic override reason' }, 'security-line-key');
    r = await store.transition(T, C, 'db-sec-mgr', inv, 'submit', r.rowVersion);
    await store.transition(T, C, 'db-sec-mgr2', inv, 'approve', r.rowVersion);
    const [client] = await store.list(T, C, 'db-sec-client');
    expect(JSON.stringify(client)).not.toMatch(/preparedBy|approvedBy|reviewNote|voidReason|rateOverrideReason|Synthetic override|db-sec-mgr/);
    const [staff] = await store.list(T, C, 'db-sec-mgr');
    expect(staff).toMatchObject({ preparedBy: 'db-sec-mgr', approvedBy: 'db-sec-mgr2' });
  }, 60000);
});
