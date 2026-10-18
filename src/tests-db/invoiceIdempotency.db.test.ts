import { afterAll, beforeAll, expect, it } from 'vitest';
import { BillingStore } from '../server/taxguard/billing/billingStore';
import { pgRpc, startDatabase, type TestDatabase } from './harness';

let db: TestDatabase;
const bill = () => new BillingStore(pgRpc(db.pool));
beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES('idem-a','Synthetic A'),('idem-b','Synthetic B');
    INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES
      ('idem-a','client-a','owner-a','Synthetic A'),('idem-a','client-b','owner-b','Synthetic B'),('idem-b','client-a','owner-c','Synthetic C');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES
      ('idem-a','manager-a','practice_manager','active'),('idem-a','manager-other','practice_manager','active'),('idem-b','manager-b','practice_manager','active');`);
});
afterAll(async () => { await db?.stop(); });

it('rejects a changed due date for an existing invoice key', async () => {
  await bill().createInvoice('idem-a', 'client-a', 'manager-a', 'invoice-date-key', { dueDate: '2026-11-01' });
  await expect(bill().createInvoice('idem-a', 'client-a', 'manager-a', 'invoice-date-key', { dueDate: '2026-12-01' }))
    .rejects.toMatchObject({ code: 'BILLING_IDEMPOTENCY_CONFLICT', status: 409 });
});

it('returns one stable invoice for simultaneous identical requests', async () => {
  const connections = await Promise.all(Array.from({ length: 8 }, () => db.connect()));
  try {
    const results = await Promise.all(connections.map(c => new BillingStore(pgRpc(c)).createInvoice(
      'idem-a', 'client-a', 'manager-a', 'invoice-concurrent-key', { dueDate: '2026-11-01' })));
    expect(new Set(results.map(r => r.invoiceId)).size).toBe(1);
    expect(results.filter(r => r.created)).toHaveLength(1);
    const counts = (await db.pool.query(`SELECT
      (SELECT count(*)::int FROM taxguard_invoices WHERE tenant_id='idem-a' AND idempotency_key='invoice-concurrent-key') invoices,
      (SELECT count(*)::int FROM taxguard_audit_log WHERE action='BILLING_INVOICE_DRAFTED' AND metadata->>'invoiceId'=$1) audits`, [results[0].invoiceId])).rows[0];
    expect(counts).toEqual({ invoices: 1, audits: 1 });
  } finally { await Promise.all(connections.map(c => c.end())); }
});

it('allows one winner and reports an explicit conflict for simultaneous different requests', async () => {
  const connections = await Promise.all([db.connect(), db.connect()]);
  try {
    const results = await Promise.allSettled(connections.map((c, n) => new BillingStore(pgRpc(c)).createInvoice(
      'idem-a', 'client-a', 'manager-a', 'invoice-conflicting-key', { dueDate: n ? '2026-12-01' : '2026-11-01' })));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
    expect(failure.reason).toMatchObject({ code: 'BILLING_IDEMPOTENCY_CONFLICT', status: 409 });
  } finally { await Promise.all(connections.map(c => c.end())); }
});

it('binds retries to engagement, client and actor while allowing the same key in another tenant', async () => {
  const first = await bill().createInvoice('idem-a', 'client-a', 'manager-a', 'invoice-scoped-key', { dueDate: '2026-11-01' });
  for (const [client, actor, engagementId] of [
    ['client-b', 'manager-a', undefined], ['client-a', 'manager-other', undefined], ['client-a', 'manager-a', 'changed-engagement'],
  ]) await expect(bill().createInvoice('idem-a', client!, actor!, 'invoice-scoped-key', { dueDate: '2026-11-01', engagementId }))
    .rejects.toMatchObject({ code: 'BILLING_IDEMPOTENCY_CONFLICT' });
  const other = await bill().createInvoice('idem-b', 'client-a', 'manager-b', 'invoice-scoped-key', { dueDate: '2026-11-01' });
  expect(other.invoiceId).not.toBe(first.invoiceId);
  await expect(bill().createInvoice('idem-a', 'client-a', 'manager-b', 'invoice-scoped-key', { dueDate: '2026-11-01' })).rejects.toHaveProperty('code');
});

it('rolls back invoice, audit and key together and permits recovery with the same key', async () => {
  const c = await db.connect();
  let rolledBackId: string;
  try {
    await c.query('BEGIN');
    rolledBackId = (await new BillingStore(pgRpc(c)).createInvoice('idem-a', 'client-a', 'manager-a', 'invoice-rollback-key', { dueDate: '2026-11-01' })).invoiceId;
    await c.query('ROLLBACK');
    expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_invoices WHERE id=$1`, [rolledBackId])).rows[0].n).toBe(0);
    expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_audit_log WHERE metadata->>'invoiceId'=$1`, [rolledBackId])).rows[0].n).toBe(0);
  } finally { await c.end(); }
  const recovered = await bill().createInvoice('idem-a', 'client-a', 'manager-a', 'invoice-rollback-key', { dueDate: '2026-11-01' });
  expect(recovered.created).toBe(true);
  expect(await bill().createInvoice('idem-a', 'client-a', 'manager-a', 'invoice-rollback-key', { dueDate: '2026-11-01' }))
    .toEqual({ invoiceId: recovered.invoiceId, created: false });
});

it('rechecks authorization on replay and keeps the SQL entry point service-only', async () => {
  await bill().createInvoice('idem-a', 'client-a', 'manager-other', 'invoice-revoked-key', { dueDate: '2026-11-01' });
  await db.pool.query(`UPDATE taxguard_members SET status='suspended' WHERE tenant_id='idem-a' AND uid='manager-other'`);
  await expect(bill().createInvoice('idem-a', 'client-a', 'manager-other', 'invoice-revoked-key', { dueDate: '2026-11-01' })).rejects.toHaveProperty('code');
  const sig = 'taxguard_bill_create_invoice(text,text,text,text,text,date)';
  const grants = (await db.pool.query(`SELECT has_function_privilege('anon',$1,'EXECUTE') anon,
    has_function_privilege('authenticated',$1,'EXECUTE') authenticated, has_function_privilege('service_role',$1,'EXECUTE') service`, [sig])).rows[0];
  expect(grants).toEqual({ anon: false, authenticated: false, service: true });
});

it('returns an explicit retryable conflict on lock timeout and recovers without partial writes', async () => {
  const holder = await db.connect(), contender = await db.connect();
  try {
    await holder.query('BEGIN');
    await holder.query(`SELECT pg_advisory_xact_lock(hashtextextended(jsonb_build_array('billing-invoice','idem-a','invoice-timeout-key')::text,0))`);
    await contender.query(`SET lock_timeout='100ms'`);
    await expect(new BillingStore(pgRpc(contender)).createInvoice('idem-a', 'client-a', 'manager-a', 'invoice-timeout-key', { dueDate: '2026-11-01' }))
      .rejects.toMatchObject({ code: 'BILLING_BUSY', status: 409 });
    expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_invoices WHERE idempotency_key='invoice-timeout-key'`)).rows[0].n).toBe(0);
    await holder.query('ROLLBACK');
    const recovered = await bill().createInvoice('idem-a', 'client-a', 'manager-a', 'invoice-timeout-key', { dueDate: '2026-11-01' });
    const audit = (await db.pool.query(`SELECT tenant_id,actor_uid,actor_role,metadata FROM taxguard_audit_log
      WHERE action='BILLING_INVOICE_DRAFTED' AND metadata->>'invoiceId'=$1`, [recovered.invoiceId])).rows;
    expect(audit).toEqual([{ tenant_id: 'idem-a', actor_uid: 'manager-a', actor_role: 'manager', metadata: { clientId: 'client-a', invoiceId: recovered.invoiceId } }]);
  } finally { await holder.query('ROLLBACK'); await Promise.all([holder.end(), contender.end()]); }
});
