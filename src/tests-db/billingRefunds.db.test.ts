import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { BillingStore, SandboxPaymentProvider } from '../server/taxguard/billing/billingStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';

// Refund records (proposal 20261018010000) on a real PostgreSQL server with independent connections.
// Synthetic data only.
const T = 'tenantRefund', C = 'rfClient', OTHER_T = 'tenantRefundB';
let db: TestDatabase; let store: BillingStore; let paymentId = ''; let invoiceId = '';
const refund = (s: BillingStore, amount: string, key: string, payment = paymentId, client = C, tenant = T, actor = 'rf-mgr') =>
  s.refund(tenant, client, actor, payment, amount, 'Synthetic refund returned by cheque', key);
const code = (p: Promise<unknown>) => p.then(() => 'OK', (e: any) => e?.code ?? String(e));

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic refund practice'), ('${OTHER_T}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'rf-client', 'Synthetic Refund Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ('${T}', 'rf-mgr', 'practice_manager', 'active', NULL), ('${T}', 'rf-mgr2', 'admin', 'active', NULL),
      ('${T}', 'rf-acct', 'accountant', 'active', NULL), ('${T}', 'rf-client', 'client', 'active', '${C}'), ('${OTHER_T}', 'rf-foreign', 'practice_manager', 'active', NULL);`);
  const practice = new PracticeStore(pgRpc(db.pool));
  const eng = (await practice.createEngagement(T, C, 'rf-mgr', 'rf-engagement', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'rf-mgr', eng, 'active', 1);
  await practice.assign(T, C, 'rf-mgr', 'rf-asg-1', { engagementId: eng, taxYear: 2025, role: 'preparer', userId: 'rf-acct', reason: 'Initial staffing' });
  store = new BillingStore(pgRpc(db.pool), new SandboxPaymentProvider());
  await store.upsertService(T, 'rf-mgr', { serviceCode: 'RF-1040', name: 'Synthetic return', category: 'INDIVIDUAL_TAX', billingMethod: 'FLAT_FEE', baseFee: '100.00' });
  invoiceId = (await store.createInvoice(T, C, 'rf-acct', 'rf-invoice-key', { dueDate: '2026-04-30' }) as any).invoiceId;
  const lined: any = await store.addLine(T, C, 'rf-acct', invoiceId, { serviceCode: 'RF-1040', quantity: 1 });
  const submitted: any = await store.transition(T, C, 'rf-acct', invoiceId, 'submit', lined.rowVersion);
  await store.transition(T, C, 'rf-mgr', invoiceId, 'approve', submitted.rowVersion);
  const paid: any = await store.recordManualPayment(T, C, 'rf-mgr', invoiceId, { amount: '100.00', method: 'CHECK', idempotencyKey: 'rf-payment-key' });
  paymentId = paid.paymentId ?? paid.invoice?.payments?.[0]?.paymentId;
  expect(paymentId).toBeTruthy();
}, 240_000);
afterAll(async () => { await db?.stop(); });

const state = async () => {
  const p = (await db.pool.query(`SELECT refunded_amount::text AS r FROM taxguard_invoice_payments WHERE id = $1`, [paymentId])).rows[0].r;
  const n = (await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_invoice_refunds WHERE payment_id = $1`, [paymentId])).rows[0].n;
  const i = (await db.pool.query(`SELECT amount_paid::text AS paid, balance_due::text AS due FROM taxguard_invoices WHERE id = $1`, [invoiceId])).rows[0];
  return { refunded: p, records: n, paid: i.paid, due: i.due };
};

describe('refund records on PostgreSQL', () => {
  it('records two separate operations with identical details, and replays a retried operation without duplicating it', async () => {
    const first: any = await refund(store, '5.00', 'rf-op-0001');
    const second: any = await refund(store, '5.00', 'rf-op-0002');
    expect(first.replayed).toBe(false); expect(second.replayed).toBe(false); expect(second.refundId).not.toBe(first.refundId);
    const retry: any = await refund(store, '5.00', 'rf-op-0001');
    expect(retry).toMatchObject({ replayed: true, refundId: first.refundId });
    expect(await state()).toEqual({ refunded: '10.00', records: 2, paid: '90.00', due: '10.00' });
    expect(await code(refund(store, '6.00', 'rf-op-0001'))).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await code(Promise.resolve().then(() => store.refund(T, C, 'rf-mgr', paymentId, '5.00', 'Synthetic refund returned by cheque', 'short')))).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('serializes concurrent submissions of one operation: a single record, the same result for both callers', async () => {
    const connections = await Promise.all([db.connect(), db.connect(), db.connect(), db.connect()]);
    try {
      const results: any[] = await Promise.all(connections.map(c => refund(new BillingStore(pgRpc(c), new SandboxPaymentProvider()), '1.00', 'rf-op-race-same')));
      expect(new Set(results.map(r => r.refundId)).size).toBe(1);
      expect(results.filter(r => r.replayed === false)).toHaveLength(1);
      expect(await state()).toMatchObject({ refunded: '11.00', records: 3 });
    } finally { await Promise.all(connections.map(c => c.end())); }
  });

  it('never refunds more than the payment, even for concurrent distinct operations', async () => {
    const remaining = 100 - 11; // 89.00 refundable
    const connections = await Promise.all(Array.from({ length: 6 }, () => db.connect()));
    try {
      const outcomes = await Promise.all(connections.map((c, i) => code(refund(new BillingStore(pgRpc(c), new SandboxPaymentProvider()), '20.00', `rf-op-cap-${i}-xxxx`))));
      expect(outcomes.filter(o => o === 'OK')).toHaveLength(Math.floor(remaining / 20));
      expect(outcomes.filter(o => o !== 'OK').every(o => o === 'REFUND_EXCEEDS_PAYMENT')).toBe(true);
      const s = await state();
      expect(Number(s.refunded)).toBeLessThanOrEqual(100);
      expect(s).toMatchObject({ refunded: '91.00', records: 7, paid: '9.00', due: '91.00' });
    } finally { await Promise.all(connections.map(c => c.end())); }
  });

  it('refuses another tenant, another client and non-managers', async () => {
    expect(await code(refund(store, '1.00', 'rf-op-foreign', paymentId, C, OTHER_T, 'rf-foreign'))).not.toBe('OK');
    expect(await code(refund(store, '1.00', 'rf-op-otherclient', paymentId, 'rfNoSuchClient'))).not.toBe('OK');
    expect(await code(refund(store, '1.00', 'rf-op-acct', paymentId, C, T, 'rf-acct'))).toBe('BILLING_MANAGER_REQUIRED');
    expect(await code(refund(store, '1.00', 'rf-op-client', paymentId, C, T, 'rf-client'))).toBe('BILLING_MANAGER_REQUIRED');
    expect((await state()).records).toBe(7);
  });

  it('keeps refund records and their audit evidence immutable, and closes the unkeyed path to the service role', async () => {
    const audit = (await db.pool.query(`SELECT metadata FROM taxguard_audit_log WHERE action = 'BILLING_PAYMENT_REFUNDED' AND tenant_id = $1`, [T])).rows;
    expect(audit).toHaveLength(7);
    expect(audit.every(a => a.metadata.reason === 'Synthetic refund returned by cheque' && a.metadata.refundId)).toBe(true);
    await expect(db.pool.query(`UPDATE taxguard_invoice_refunds SET amount = 0.01 WHERE tenant_id = $1`, [T])).rejects.toThrow('BILLING_REFUND_IMMUTABLE');
    await expect(db.pool.query(`DELETE FROM taxguard_invoice_refunds WHERE tenant_id = $1`, [T])).rejects.toThrow('BILLING_REFUND_IMMUTABLE');
    // The application role cannot rewrite or delete audit history. (Owner-level append-only enforcement for all
    // audit rows is the separate docs/sql/taxguard-audit-append-only proposal, outside the canonical plan.)
    const tablePriv = async (priv: string) => (await db.pool.query("SELECT has_table_privilege('service_role', 'public.taxguard_audit_log', $1) AS ok", [priv])).rows[0].ok;
    for (const priv of ['UPDATE', 'DELETE', 'TRUNCATE']) expect(await tablePriv(priv), priv).toBe(false);
    const can = async (role: string, fn: string) => (await db.pool.query(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS ok`, [role, fn])).rows[0].ok;
    expect(await can('service_role', 'public.taxguard_bill_refund(text,text,text,text,numeric,text)')).toBe(false);
    expect(await can('service_role', 'public.taxguard_bill_refund_keyed(text,text,text,text,numeric,text,text)')).toBe(true);
    for (const role of ['anon', 'authenticated']) expect(await can(role, 'public.taxguard_bill_refund_keyed(text,text,text,text,numeric,text,text)')).toBe(false);
  });
});
