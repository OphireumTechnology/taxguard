import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createBillingRouter } from '../server/routes/billing.routes';
import { BillingStore } from '../server/taxguard/billing/billingStore';
import { pgRpc, startDatabase, type TestDatabase } from './harness';

// Phase 15 refund HTTP regressions (Codex, af34972), run against the one canonical refund implementation:
// taxguard_bill_refund_keyed hardened by 20261019020000 (owner instruction 2026-10-27). Contract differences from
// Codex's original: a reused key is IDEMPOTENCY_KEY_REUSED, a replay carries replayed: true, and the audit keeps the
// reason (as Phase 14 and Codex's later reconciliation both require). Synthetic data only.
let db: TestDatabase, server: Server, origin: string;
const settled = (body: any) => { const { replayed, ...rest } = body; return rest; };
const bill = () => new BillingStore(pgRpc(db.pool));
async function paidInvoice(suffix: string, tenant = 'refund-a', client = 'client-a', maker = 'manager-a', checker = 'manager-other') {
  const inv = await bill().createInvoice(tenant, client, maker, 'refund-invoice-' + suffix, { dueDate: '2026-11-01' });
  const lined = await bill().addLine(tenant, client, maker, inv.invoiceId, { serviceCode: 'SYNTHETIC', quantity: '1' });
  const submitted = await bill().transition(tenant, client, maker, inv.invoiceId, 'submit', lined.rowVersion);
  await bill().transition(tenant, client, checker, inv.invoiceId, 'approve', submitted.rowVersion);
  const payment = await bill().recordManualPayment(tenant, client, maker, inv.invoiceId,
    { amount: '100.00', method: 'CHECK', idempotencyKey: 'refund-payment-' + suffix });
  return { invoiceId: inv.invoiceId, paymentId: payment.paymentId as string };
}
const refund = async (payment: string, key: string, amount = '20.00', reason = 'Synthetic partial refund',
  scope: { tenant?: string; client?: string; actor?: string } = {}) => {
  const response = await fetch(origin + `/clients/${scope.client ?? 'client-a'}/payments/${payment}/refund`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'Idempotency-Key': key, 'x-fixture-tenant': scope.tenant ?? 'refund-a',
      'x-fixture-actor': scope.actor ?? 'manager-a' }, body: JSON.stringify({ amount, reason }) });
  return { status: response.status, body: await response.json() };
};
beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES('refund-a','Synthetic A'),('refund-b','Synthetic B');
    INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('refund-a','client-a','owner-a','Synthetic A'),
      ('refund-a','client-b','owner-b','Synthetic B'),('refund-b','client-a','owner-c','Synthetic C');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES
      ('refund-a','manager-a','admin','active'),('refund-a','manager-other','admin','active'),
      ('refund-b','manager-b','admin','active'),('refund-b','checker-b','admin','active');`);
  await bill().upsertService('refund-a', 'manager-a', { serviceCode: 'SYNTHETIC', name: 'Synthetic service', category: 'ADVISORY', billingMethod: 'FLAT_FEE', baseFee: '100.00' });
  await bill().upsertService('refund-b', 'manager-b', { serviceCode: 'SYNTHETIC', name: 'Synthetic service', category: 'ADVISORY', billingMethod: 'FLAT_FEE', baseFee: '100.00' });
  const app = express();
  app.use(createBillingRouter({ store: bill, authenticate: (req: any, _res, next) => {
    req.user = { id: req.get('x-fixture-actor') ?? 'manager-a', tenantId: req.get('x-fixture-tenant') ?? 'refund-a', role: 'admin', status: 'active' }; next();
  } }));
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(async () => {
  server?.closeAllConnections();
  await new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve());
  await db?.stop();
});

it('replays a repeated HTTP refund key without applying the partial refund twice', async () => {
  const paid = await paidInvoice('retry');
  const first = await refund(paid.paymentId, 'refund-retry-key');
  const second = await refund(paid.paymentId, 'refund-retry-key');
  expect(first.status).toBe(200); expect(second.status).toBe(200);
  expect(first.body.replayed).toBe(false); expect(second.body.replayed).toBe(true);
  expect(settled(second.body)).toEqual(settled(first.body));
  const row = (await db.pool.query(`SELECT refunded_amount::text amount FROM taxguard_invoice_payments WHERE id=$1`, [paid.paymentId])).rows[0];
  expect(row.amount).toBe('20.00');
});

it('applies one refund across simultaneous identical HTTP requests', async () => {
  const paid = await paidInvoice('concurrent');
  const results = await Promise.all(Array.from({ length: 4 }, () => refund(paid.paymentId, 'refund-concurrent-key')));
  expect(results.map(r => r.status)).toEqual([200, 200, 200, 200]);
  expect(results.every(r => JSON.stringify(settled(r.body)) === JSON.stringify(settled(results[0].body)))).toBe(true);
  expect(results.filter(r => r.body.replayed === false)).toHaveLength(1);
  expect((await db.pool.query(`SELECT refunded_amount::text amount FROM taxguard_invoice_payments WHERE id=$1`, [paid.paymentId])).rows[0].amount).toBe('20.00');
});

it('binds amount, reason, payment, client and actor and preserves a stable historical result', async () => {
  const paid = await paidInvoice('binding'), other = await paidInvoice('other');
  const first = await refund(paid.paymentId, 'refund-binding-key');
  expect(first.status).toBe(200);
  for (const result of [await refund(paid.paymentId, 'refund-binding-key', '21.00'),
    await refund(paid.paymentId, 'refund-binding-key', '20.00', 'Different synthetic reason'),
    await refund(other.paymentId, 'refund-binding-key'),
    await refund(paid.paymentId, 'refund-binding-key', '20.00', 'Synthetic partial refund', { client: 'client-b' }),
    await refund(paid.paymentId, 'refund-binding-key', '20.00', 'Synthetic partial refund', { actor: 'manager-other' })])
    expect(result).toMatchObject({ status: 409, body: { code: 'IDEMPOTENCY_KEY_REUSED' } });
  expect((await refund(paid.paymentId, 'refund-later-key', '10.00')).status).toBe(200);
  // The stored result is returned, not the invoice as it is after the later refund.
  expect(settled((await refund(paid.paymentId, 'refund-binding-key')).body)).toEqual(settled(first.body));
  expect((await db.pool.query(`SELECT refunded_amount::text amount FROM taxguard_invoice_payments WHERE id=$1`, [paid.paymentId])).rows[0].amount).toBe('30.00');
});

it('allows one winner for simultaneous conflicting requests and retains refund caps for distinct keys', async () => {
  const paid = await paidInvoice('conflict');
  const results = await Promise.all([refund(paid.paymentId, 'refund-conflict-key', '20.00'), refund(paid.paymentId, 'refund-conflict-key', '30.00')]);
  expect(results.map(r => r.status).sort()).toEqual([200, 409]);
  const distinct = await Promise.all(Array.from({ length: 4 }, (_, n) => refund(paid.paymentId, 'refund-distinct-' + n, '60.00')));
  expect(distinct.filter(r => r.status === 200)).toHaveLength(1);
  for (const result of distinct.filter(r => r.status !== 200)) expect(result.body.code).toBe('REFUND_EXCEEDS_PAYMENT');
  const row = (await db.pool.query(`SELECT refunded_amount::text amount FROM taxguard_invoice_payments WHERE id=$1`, [paid.paymentId])).rows[0];
  expect(['80.00', '90.00']).toContain(row.amount);
});

it('isolates tenant key collisions and refuses foreign actors and foreign payment scope', async () => {
  const local = await paidInvoice('scope'), foreign = await paidInvoice('scope', 'refund-b', 'client-a', 'manager-b', 'checker-b');
  expect((await refund(local.paymentId, 'refund-tenant-key')).status).toBe(200);
  expect((await refund(foreign.paymentId, 'refund-tenant-key', '20.00', 'Synthetic partial refund', { tenant: 'refund-b', actor: 'manager-b' })).status).toBe(200);
  expect((await refund(local.paymentId, 'refund-foreign-key', '20.00', 'Synthetic partial refund', { tenant: 'refund-b', actor: 'manager-b' })).status).toBe(404);
  expect((await refund(local.paymentId, 'refund-tenant-key', '20.00', 'Synthetic partial refund', { actor: 'manager-b' })).status).toBe(403);
});

it('fails atomically when audit persistence fails and recovers the same key', async () => {
  const paid = await paidInvoice('failure');
  await db.pool.query(`CREATE FUNCTION refund_fixture_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.action='BILLING_PAYMENT_REFUNDED' THEN RAISE EXCEPTION 'Synthetic audit failure' USING ERRCODE='XX000'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER refund_fixture_failure BEFORE INSERT ON taxguard_audit_log FOR EACH ROW EXECUTE FUNCTION refund_fixture_failure();`);
  try {
    expect(await refund(paid.paymentId, 'refund-recovery-key')).toMatchObject({ status: 503, body: { code: 'BILLING_STORE_UNAVAILABLE' } });
    expect((await db.pool.query(`SELECT refunded_amount::text amount FROM taxguard_invoice_payments WHERE id=$1`, [paid.paymentId])).rows[0].amount).toBe('0.00');
    expect((await db.pool.query(`SELECT amount_paid::text paid FROM taxguard_invoices WHERE id=$1`, [paid.invoiceId])).rows[0].paid).toBe('100.00');
    expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_invoice_refunds WHERE idempotency_key='refund-recovery-key'`)).rows[0].n).toBe(0);
  } finally { await db.pool.query('DROP TRIGGER refund_fixture_failure ON taxguard_audit_log; DROP FUNCTION refund_fixture_failure()'); }
  expect((await refund(paid.paymentId, 'refund-recovery-key')).status).toBe(200);
  expect((await refund(paid.paymentId, 'refund-recovery-key')).status).toBe(200);
  expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_invoice_refunds WHERE idempotency_key='refund-recovery-key'`)).rows[0].n).toBe(1);
});

it('records one attributed audit with the reason and exact before/after amounts, and protects raw receipts', async () => {
  const paid = await paidInvoice('audit');
  const reason = 'Private synthetic refund justification';
  expect((await refund(paid.paymentId, 'refund-audit-key', '20.00', reason)).status).toBe(200);
  const rows = (await db.pool.query(`SELECT id,tenant_id,actor_uid,actor_role,metadata FROM taxguard_audit_log
    WHERE action='BILLING_PAYMENT_REFUNDED' AND metadata->>'paymentId'=$1`, [paid.paymentId])).rows;
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ tenant_id: 'refund-a', actor_uid: 'manager-a', actor_role: 'manager', metadata: {
    clientId: 'client-a', paymentId: paid.paymentId, invoiceId: paid.invoiceId, amount: '20.00', reason,
    before: { amountPaid: '100.00', balanceDue: '0.00', refundedAmount: '0.00' },
    after: { amountPaid: '80.00', balanceDue: '20.00', refundedAmount: '20.00' },
  } });
  expect((await db.pool.query(`SELECT id::text FROM taxguard_invoice_refunds WHERE idempotency_key='refund-audit-key'`)).rows[0].id).toBe(rows[0].metadata.refundId);
  const redacted = (await db.pool.query(`SELECT taxguard_audit_center_event('refund-a','manager-a',$1) result`, [rows[0].id])).rows[0].result;
  expect(redacted.fields.before).toBeUndefined(); expect(redacted.fields.after).toBeUndefined(); expect(redacted.fields.amount).toBeUndefined();
  const c = await db.connect();
  try {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await c.query('BEGIN'); await c.query(`SET LOCAL ROLE ${role}`);
      await expect(c.query('UPDATE taxguard_invoice_refunds SET amount=1')).rejects.toMatchObject({ code: '42501' });
      await c.query('ROLLBACK'); await c.query('BEGIN'); await c.query(`SET LOCAL ROLE ${role}`);
      await expect(c.query('TRUNCATE taxguard_invoice_refunds CASCADE')).rejects.toMatchObject({ code: '42501' });
      await c.query('ROLLBACK');
    }
  } finally { await c.query('ROLLBACK'); await c.end(); }
  // Even the table owner cannot change, delete or truncate a recorded refund.
  for (const sql of ['UPDATE taxguard_invoice_refunds SET amount=1', 'DELETE FROM taxguard_invoice_refunds', 'TRUNCATE taxguard_invoice_refunds CASCADE'])
    await expect(db.pool.query(sql)).rejects.toThrow('BILLING_REFUND_IMMUTABLE');
  // A refund row cannot point at another client's or invoice's payment.
  const other = await paidInvoice('audit-other');
  await expect(db.pool.query(`INSERT INTO taxguard_invoice_refunds(id,tenant_id,client_id,invoice_id,payment_id,amount,reason,recorded_by,idempotency_key)
    VALUES (gen_random_uuid(),'refund-a','client-b',$1,$2,1,'Synthetic mismatch','manager-a','refund-scope-probe')`, [other.invoiceId, other.paymentId])).rejects.toMatchObject({ code: '23503' });
});

it('fails closed for missing keys, legacy keyless RPCs and revoked access on replay', async () => {
  const paid = await paidInvoice('revoked');
  expect(await refund(paid.paymentId, '')).toMatchObject({ status: 400, body: { code: 'IDEMPOTENCY_KEY_REQUIRED' } });
  const legacy = await pgRpc(db.pool).rpc('taxguard_bill_refund', { p_tenant: 'refund-a', p_client: 'client-a', p_actor: 'manager-a',
    p_payment: paid.paymentId, p_amount: '20.00', p_reason: 'Synthetic partial refund' });
  expect(legacy.error?.message).toBe('IDEMPOTENCY_KEY_REQUIRED');
  expect((await refund(paid.paymentId, 'refund-revoked-key', '20.00', 'Synthetic partial refund', { actor: 'manager-other' })).status).toBe(200);
  await db.pool.query(`UPDATE taxguard_members SET status='suspended' WHERE tenant_id='refund-a' AND uid='manager-other'`);
  expect((await refund(paid.paymentId, 'refund-revoked-key', '20.00', 'Synthetic partial refund', { actor: 'manager-other' })).status).toBe(403);
});

it('tests the separate owner append-only proposal only inside a rolled-back disposable transaction', async () => {
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    await c.query(readFileSync('docs/sql/taxguard-audit-append-only.proposal.sql', 'utf8'));
    for (const sql of ["UPDATE taxguard_audit_log SET metadata='{}' WHERE action='BILLING_PAYMENT_REFUNDED'",
      "DELETE FROM taxguard_audit_log WHERE action='BILLING_PAYMENT_REFUNDED'", 'TRUNCATE taxguard_audit_log CASCADE']) {
      await c.query('SAVEPOINT mutation');
      await expect(c.query(sql)).rejects.toMatchObject({ code: '55000', message: 'TAXGUARD_AUDIT_IMMUTABLE' });
      await c.query('ROLLBACK TO SAVEPOINT mutation');
    }
  } finally { await c.query('ROLLBACK'); await c.end(); }
  expect((await db.pool.query(`SELECT count(*)::int n FROM pg_trigger WHERE tgname='taxguard_audit_append_only'`)).rows[0].n).toBe(0);
});
