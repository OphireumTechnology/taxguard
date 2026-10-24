/**
 * Implementation-neutral refund regression contract (owner decision 2026-10-19: the Phase 15 refund design is
 * the canonical target). The same cases run against the Phase 14 keyed function today and are meant to run
 * against the unified Phase 15 contract once it is reconciled, by supplying a different adapter. Only the
 * function names, error codes and result shape differ between implementations; the guarantees do not.
 * Synthetic data only.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { BillingStore, SandboxPaymentProvider } from '../server/taxguard/billing/billingStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';

type Rpc = ReturnType<typeof pgRpc>;
export interface RefundAdapter {
  name: string;
  /** Prepares the database after composition (for example replacing the refund objects under test). */
  prepare?: (db: TestDatabase) => Promise<void>;
  /** Records one refund operation; resolves with the result or rejects with an error carrying `code`. */
  refund: (rpc: Rpc, a: { tenant: string; client: string; actor: string; payment: string; amount: string; reason: string; key: string }) => Promise<unknown>;
  keyedSignature: string; unkeyedSignature: string;
  /** Code returned when a key is reused for a different refund. */
  keyReusedCode: string;
  /** Whether the stored refund records are protected from UPDATE/DELETE even by the table owner. */
  ownerImmutable: boolean;
  /** Whether the refund reason is part of the audit metadata. */
  auditCarriesReason: boolean;
  /** Whether the unkeyed signature is revoked from service_role (Phase 14) rather than kept and failing closed. */
  unkeyedRevoked: boolean;
}

export const phase14Adapter: RefundAdapter = {
  name: 'Phase 14 (taxguard_bill_refund_keyed)',
  refund: async (rpc, a) => {
    const r = await rpc.rpc('taxguard_bill_refund_keyed', { p_tenant: a.tenant, p_client: a.client, p_actor: a.actor, p_payment: a.payment, p_amount: a.amount, p_reason: a.reason, p_key: a.key });
    if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.message });
    return r.data;
  },
  keyedSignature: 'public.taxguard_bill_refund_keyed(text,text,text,text,numeric,text,text)',
  unkeyedSignature: 'public.taxguard_bill_refund(text,text,text,text,numeric,text)',
  keyReusedCode: 'IDEMPOTENCY_KEY_REUSED', ownerImmutable: true, auditCarriesReason: true, unkeyedRevoked: true,
};

export function defineRefundContract(adapter: RefundAdapter) {
  const T = 'tenantRefund', C = 'rfClient', OTHER_T = 'tenantRefundB', REASON = 'Synthetic refund returned by cheque';
  let db: TestDatabase; let paymentId = ''; let invoiceId = '';
  const refund = (amount: string, key: string, over: Partial<{ payment: string; client: string; tenant: string; actor: string; rpc: Rpc; reason: string }> = {}) =>
    adapter.refund(over.rpc ?? pgRpc(db.pool), { tenant: over.tenant ?? T, client: over.client ?? C, actor: over.actor ?? 'rf-mgr', payment: over.payment ?? paymentId, amount, reason: over.reason ?? REASON, key });
  const code = (p: Promise<unknown>) => p.then(() => 'OK', (e: any) => e?.code ?? String(e));
  const recordId = async (key: string) => (await db.pool.query('SELECT id::text AS id FROM taxguard_invoice_refunds WHERE tenant_id = $1 AND idempotency_key = $2', [T, key])).rows.map(r => r.id);
  const state = async () => {
    const p = (await db.pool.query('SELECT refunded_amount::text AS r FROM taxguard_invoice_payments WHERE id = $1', [paymentId])).rows[0].r;
    const n = (await db.pool.query('SELECT count(*)::int AS n FROM taxguard_invoice_refunds WHERE payment_id = $1', [paymentId])).rows[0].n;
    const i = (await db.pool.query('SELECT amount_paid::text AS paid, balance_due::text AS due FROM taxguard_invoices WHERE id = $1', [invoiceId])).rows[0];
    return { refunded: p, records: n, paid: i.paid, due: i.due };
  };

  describe(`refund contract: ${adapter.name}`, () => {
    beforeAll(async () => {
      db = await startDatabase();
      await adapter.prepare?.(db);
      await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic refund practice'), ('${OTHER_T}', 'Other synthetic practice');
        INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'rf-client', 'Synthetic Refund Client');
        INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ('${T}', 'rf-mgr', 'practice_manager', 'active', NULL), ('${T}', 'rf-mgr2', 'admin', 'active', NULL),
          ('${T}', 'rf-acct', 'accountant', 'active', NULL), ('${T}', 'rf-client', 'client', 'active', '${C}'), ('${OTHER_T}', 'rf-foreign', 'practice_manager', 'active', NULL);`);
      const practice = new PracticeStore(pgRpc(db.pool));
      const eng = (await practice.createEngagement(T, C, 'rf-mgr', 'rf-engagement', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
      await practice.setEngagementStatus(T, C, 'rf-mgr', eng, 'active', 1);
      await practice.assign(T, C, 'rf-mgr', 'rf-asg-1', { engagementId: eng, taxYear: 2025, role: 'preparer', userId: 'rf-acct', reason: 'Initial staffing' });
      const store = new BillingStore(pgRpc(db.pool), new SandboxPaymentProvider());
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

    it('records two separate operations with identical details, and replays a retried operation without duplicating it', async () => {
      await refund('5.00', 'rf-op-0001'); await refund('5.00', 'rf-op-0002');
      const [first] = await recordId('rf-op-0001'); const [second] = await recordId('rf-op-0002');
      expect(first).toBeTruthy(); expect(second).toBeTruthy(); expect(second).not.toBe(first);
      await refund('5.00', 'rf-op-0001');
      expect(await recordId('rf-op-0001')).toEqual([first]);
      expect(await state()).toEqual({ refunded: '10.00', records: 2, paid: '90.00', due: '10.00' });
      expect(await code(refund('6.00', 'rf-op-0001'))).toBe(adapter.keyReusedCode);
      expect(await code(refund('5.00', 'short'))).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });

    it('serializes concurrent submissions of one operation: a single record', async () => {
      const connections = await Promise.all([db.connect(), db.connect(), db.connect(), db.connect()]);
      try {
        const results = await Promise.all(connections.map(c => code(refund('1.00', 'rf-op-race-same', { rpc: pgRpc(c) }))));
        expect(results.every(r => r === 'OK')).toBe(true);
        expect(await recordId('rf-op-race-same')).toHaveLength(1);
        expect(await state()).toMatchObject({ refunded: '11.00', records: 3 });
      } finally { await Promise.all(connections.map(c => c.end())); }
    });

    it('never refunds more than the payment, even for concurrent distinct operations', async () => {
      const remaining = 100 - 11;
      const connections = await Promise.all(Array.from({ length: 6 }, () => db.connect()));
      try {
        const outcomes = await Promise.all(connections.map((c, i) => code(refund('20.00', `rf-op-cap-${i}-xxxx`, { rpc: pgRpc(c) }))));
        expect(outcomes.filter(o => o === 'OK')).toHaveLength(Math.floor(remaining / 20));
        expect(outcomes.filter(o => o !== 'OK').every(o => o === 'REFUND_EXCEEDS_PAYMENT')).toBe(true);
        expect(await state()).toMatchObject({ refunded: '91.00', records: 7, paid: '9.00', due: '91.00' });
      } finally { await Promise.all(connections.map(c => c.end())); }
    });

    it('refuses another tenant, another client and non-managers', async () => {
      expect(await code(refund('1.00', 'rf-op-foreign', { tenant: OTHER_T, actor: 'rf-foreign' }))).not.toBe('OK');
      expect(await code(refund('1.00', 'rf-op-otherclient', { client: 'rfNoSuchClient' }))).not.toBe('OK');
      expect(await code(refund('1.00', 'rf-op-acct', { actor: 'rf-acct' }))).toBe('BILLING_MANAGER_REQUIRED');
      expect(await code(refund('1.00', 'rf-op-client', { actor: 'rf-client' }))).toBe('BILLING_MANAGER_REQUIRED');
      expect((await state()).records).toBe(7);
    });

    it('keeps refund records and audit evidence protected; the unkeyed path cannot record a refund', async () => {
      const audit = (await db.pool.query(`SELECT metadata FROM taxguard_audit_log WHERE action = 'BILLING_PAYMENT_REFUNDED' AND tenant_id = $1`, [T])).rows;
      expect(audit).toHaveLength(7);
      expect(audit.every(a => a.metadata.refundId)).toBe(true);
      if (adapter.auditCarriesReason) expect(audit.every(a => a.metadata.reason === REASON)).toBe(true);
      // Stored reasons survive in the refund records whichever implementation is used.
      expect((await db.pool.query('SELECT count(*)::int AS n FROM taxguard_invoice_refunds WHERE tenant_id = $1 AND reason = $2', [T, REASON])).rows[0].n).toBe(7);
      if (adapter.ownerImmutable) {
        await expect(db.pool.query('UPDATE taxguard_invoice_refunds SET amount = 0.01 WHERE tenant_id = $1', [T])).rejects.toThrow('BILLING_REFUND_IMMUTABLE');
        await expect(db.pool.query('DELETE FROM taxguard_invoice_refunds WHERE tenant_id = $1', [T])).rejects.toThrow('BILLING_REFUND_IMMUTABLE');
      }
      const priv = async (role: string, table: string, p: string) => (await db.pool.query('SELECT has_table_privilege($1, $2, $3) AS ok', [role, table, p])).rows[0].ok;
      for (const p of ['UPDATE', 'DELETE', 'TRUNCATE']) {
        expect(await priv('service_role', 'public.taxguard_audit_log', p), `audit ${p}`).toBe(false);
        expect(await priv('service_role', 'public.taxguard_invoice_refunds', p), `refunds ${p}`).toBe(false);
      }
      const can = async (role: string, fn: string) => (await db.pool.query(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS ok`, [role, fn])).rows[0].ok;
      expect(await can('service_role', adapter.keyedSignature)).toBe(true);
      for (const role of ['anon', 'authenticated']) expect(await can(role, adapter.keyedSignature)).toBe(false);
      // The unkeyed signature never records a refund: it is revoked (Phase 14) or kept and refusing (Phase 15).
      if (adapter.unkeyedRevoked) expect(await can('service_role', adapter.unkeyedSignature)).toBe(false);
      if (await can('service_role', adapter.unkeyedSignature)) {
        const r = await pgRpc(db.pool).rpc('taxguard_bill_refund', { p_tenant: T, p_client: C, p_actor: 'rf-mgr', p_payment: paymentId, p_amount: '1.00', p_reason: REASON });
        expect(r.error?.message).toBe('IDEMPOTENCY_KEY_REQUIRED');
      }
      expect((await state()).records).toBe(7);
    });
  });
}
