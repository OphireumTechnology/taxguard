import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createBillingRouter } from '../server/routes/billing.routes';
import { BillingStore } from '../server/taxguard/billing/billingStore';
import { pgRpc, startDatabase, type TestDatabase } from './harness';

let db: TestDatabase, server: Server, origin: string;
const store = () => new BillingStore(pgRpc(db.pool));
const post = async (path: string, key: string, body: unknown) => {
  const r = await fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};
const invoice = async (key: string) => (await store().createInvoice('writes-a', 'client-a', 'maker-a', key, { dueDate: '2026-11-01' })).invoiceId;
async function issued(key: string) {
  const id = await invoice(key);
  const lined = await post(`/clients/client-a/invoices/${id}/lines`, key + '-line', { serviceCode: 'SYNTHETIC', quantity: '1' });
  const submitted = await store().transition('writes-a', 'client-a', 'maker-a', id, 'submit', lined.body.rowVersion);
  await store().transition('writes-a', 'client-a', 'checker-a', id, 'approve', submitted.rowVersion);
  return id;
}
beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES('writes-a','Synthetic'),('writes-b','Foreign synthetic');
    INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('writes-a','client-a','owner-a','Synthetic'),
      ('writes-a','client-b','owner-b','Other synthetic'),('writes-b','client-a','owner-c','Foreign synthetic');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('writes-a','maker-a','admin','active'),('writes-a','checker-a','admin','active'),
      ('writes-b','maker-b','admin','active');`);
  await store().upsertService('writes-a', 'maker-a', { serviceCode: 'SYNTHETIC', name: 'Synthetic service', category: 'ADVISORY', billingMethod: 'FLAT_FEE', baseFee: '100.00' });
  const app = express();
  app.use(createBillingRouter({ store, authenticate: (req: any, _res, next) => { req.user = { id: 'maker-a', tenantId: 'writes-a', role: 'admin', status: 'active' }; next(); } }));
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await db?.stop(); });

it('does not append a second invoice line when an HTTP request key is retried', async () => {
  const id = await invoice('writes-invoice-line');
  const path = `/clients/client-a/invoices/${id}/lines`, body = { serviceCode: 'SYNTHETIC', quantity: '1' };
  const first = await post(path, 'writes-line-key', body), retry = await post(path, 'writes-line-key', body);
  expect(first.status).toBe(200); expect(retry).toEqual(first);
  expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_invoice_lines WHERE invoice_id=$1`, [id])).rows[0].n).toBe(1);
});

it('removes once with one audit across six simultaneous identical removal requests', async () => {
  const id = await invoice('writes-remove-concurrent'), lines = `/clients/client-a/invoices/${id}/lines`;
  await post(lines, 'writes-remove-concurrent-line', { serviceCode: 'SYNTHETIC', quantity: '1' });
  const results = await Promise.all(Array.from({ length: 6 }, () => post(lines + '/1/remove', 'writes-remove-concurrent-key', {})));
  expect(results.every(r => r.status === 200 && JSON.stringify(r.body) === JSON.stringify(results[0].body))).toBe(true);
  const audit = (await db.pool.query(`SELECT actor_uid,metadata FROM taxguard_audit_log WHERE action='BILLING_INVOICE_LINE_REMOVED' AND metadata->>'invoiceId'=$1`, [id])).rows;
  expect(audit).toHaveLength(1);
  expect(audit[0]).toMatchObject({ actor_uid: 'maker-a', metadata: { clientId: 'client-a', lineNo: 1,
    before: { subtotal: '100.00', total: '100.00' }, after: { subtotal: '0.00', total: '0.00' } } });
});

it('rolls back line removal and receipt on audit failure and recovers the same key', async () => {
  const id = await invoice('writes-remove-rollback'), lines = `/clients/client-a/invoices/${id}/lines`;
  await post(lines, 'writes-remove-rollback-line', { serviceCode: 'SYNTHETIC', quantity: '1' });
  await db.pool.query(`CREATE FUNCTION remove_fixture_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.action='BILLING_INVOICE_LINE_REMOVED' THEN RAISE EXCEPTION 'Synthetic removal failure' USING ERRCODE='XX000'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER remove_fixture_failure BEFORE INSERT ON taxguard_audit_log FOR EACH ROW EXECUTE FUNCTION remove_fixture_failure();`);
  try {
    expect((await post(lines + '/1/remove', 'writes-remove-recovery-key', {})).status).toBe(503);
    expect((await db.pool.query(`SELECT total::text total FROM taxguard_invoices WHERE id=$1`, [id])).rows[0].total).toBe('100.00');
    expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_invoice_lines WHERE invoice_id=$1`, [id])).rows[0].n).toBe(1);
    expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_billing_write_receipts WHERE operation='REMOVE_LINE' AND idempotency_key='writes-remove-recovery-key'`)).rows[0].n).toBe(0);
  } finally { await db.pool.query('DROP TRIGGER remove_fixture_failure ON taxguard_audit_log; DROP FUNCTION remove_fixture_failure()'); }
  expect((await post(lines + '/1/remove', 'writes-remove-recovery-key', {})).status).toBe(200);
});

it('requires removal keys and allows service-role keyed execution without a keyless bypass', async () => {
  const id = await invoice('writes-remove-service'), lines = `/clients/client-a/invoices/${id}/lines`;
  await post(lines, 'writes-remove-service-line', { serviceCode: 'SYNTHETIC', quantity: '1' });
  expect((await post(lines + '/1/remove', '', {})).body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  const c = await db.connect();
  try {
    await c.query('BEGIN'); await c.query('SET LOCAL ROLE service_role');
    expect((await new BillingStore(pgRpc(c)).removeLine('writes-a', 'client-a', 'maker-a', id, 1, 'writes-remove-service-key')).total).toBe('0.00');
    await c.query('COMMIT');
  } finally { await c.query('ROLLBACK'); await c.end(); }
  expect((await db.pool.query(`SELECT has_function_privilege('service_role','taxguard_bill_remove_line(text,text,text,text,integer)','EXECUTE') allowed`)).rows[0].allowed).toBe(false);
});

it('does not create a second pending credit request when an HTTP request key is retried', async () => {
  const id = await invoice('writes-invoice-credit');
  const lined = await post(`/clients/client-a/invoices/${id}/lines`, 'writes-credit-line', { serviceCode: 'SYNTHETIC', quantity: '1' });
  const submitted = await store().transition('writes-a', 'client-a', 'maker-a', id, 'submit', lined.body.rowVersion);
  await store().transition('writes-a', 'client-a', 'checker-a', id, 'approve', submitted.rowVersion);
  const path = `/clients/client-a/invoices/${id}/credits`, body = { amount: '10.00', reason: 'Synthetic requested credit' };
  const first = await post(path, 'writes-credit-key', body), retry = await post(path, 'writes-credit-key', body);
  expect(first.status).toBe(201); expect(retry).toEqual(first);
  expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_invoice_credits WHERE invoice_id=$1`, [id])).rows[0].n).toBe(1);
});

it('creates one line and one attributed audit for six simultaneous identical requests', async () => {
  const id = await invoice('writes-line-concurrent'), path = `/clients/client-a/invoices/${id}/lines`;
  const results = await Promise.all(Array.from({ length: 6 }, () => post(path, 'writes-line-concurrent-key', { serviceCode: 'SYNTHETIC', quantity: '1' })));
  expect(results.every(r => r.status === 200 && JSON.stringify(r.body) === JSON.stringify(results[0].body))).toBe(true);
  expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_invoice_lines WHERE invoice_id=$1`, [id])).rows[0].n).toBe(1);
  const audits = (await db.pool.query(`SELECT tenant_id,actor_uid,metadata FROM taxguard_audit_log WHERE action='BILLING_INVOICE_LINE_ADDED' AND metadata->>'invoiceId'=$1`, [id])).rows;
  expect(audits).toHaveLength(1);
  expect(audits[0]).toMatchObject({ tenant_id: 'writes-a', actor_uid: 'maker-a', metadata: {
    clientId: 'client-a', before: { subtotal: '0.00', total: '0.00' }, after: { subtotal: '100.00', total: '100.00' },
  } });
});

it('returns one winner and a conflict for different concurrent line payloads', async () => {
  const id = await invoice('writes-line-conflict'), path = `/clients/client-a/invoices/${id}/lines`;
  const results = await Promise.all(['1', '2'].map(quantity => post(path, 'writes-line-conflict-key', { serviceCode: 'SYNTHETIC', quantity })));
  expect(results.map(r => r.status).sort()).toEqual([200, 409]);
  expect(results.find(r => r.status === 409)?.body.code).toBe('BILLING_IDEMPOTENCY_CONFLICT');
});

it('creates one credit for simultaneous requests and preserves independent approval on retry', async () => {
  const id = await issued('writes-credit-concurrent'), path = `/clients/client-a/invoices/${id}/credits`;
  const body = { amount: '10.00', reason: 'Synthetic requested credit' };
  const results = await Promise.all(Array.from({ length: 6 }, () => post(path, 'writes-credit-concurrent-key', body)));
  expect(results.every(r => r.status === 201 && JSON.stringify(r.body) === JSON.stringify(results[0].body))).toBe(true);
  const creditId = results[0].body.creditId;
  await expect(store().decideCredit('writes-a', 'client-a', 'maker-a', creditId, true)).rejects.toMatchObject({ code: 'MAKER_CHECKER_VIOLATION' });
  await store().decideCredit('writes-a', 'client-a', 'checker-a', creditId, true);
  expect(await post(path, 'writes-credit-concurrent-key', body)).toEqual(results[0]);
  expect((await db.pool.query(`SELECT status FROM taxguard_invoice_credits WHERE id=$1`, [creditId])).rows[0].status).toBe('APPLIED');
  expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_audit_log WHERE action='BILLING_CREDIT_REQUESTED' AND metadata->>'creditId'=$1`, [creditId])).rows[0].n).toBe(1);
  expect((await post(path, 'writes-credit-concurrent-key', { ...body, amount: '20.00' })).status).toBe(409);
});

it('binds scope and actor, permits independent tenant keys and refuses revoked access', async () => {
  const id = await invoice('writes-scope-invoice');
  const line = { serviceCode: 'SYNTHETIC', quantity: '1' };
  await store().addLine('writes-a', 'client-a', 'maker-a', id, line, 'writes-scoped-key');
  await expect(store().addLine('writes-a', 'client-b', 'maker-a', id, line, 'writes-scoped-key')).rejects.toMatchObject({ code: 'BILLING_IDEMPOTENCY_CONFLICT' });
  await expect(store().addLine('writes-a', 'client-a', 'checker-a', id, line, 'writes-scoped-key')).rejects.toMatchObject({ code: 'BILLING_IDEMPOTENCY_CONFLICT' });
  await expect(store().addLine('writes-a', 'client-a', 'maker-b', id, line, 'writes-scoped-key')).rejects.toMatchObject({ code: 'BILLING_ACCESS_DENIED' });
  await store().upsertService('writes-b', 'maker-b', { serviceCode: 'SYNTHETIC', name: 'Foreign synthetic service', category: 'ADVISORY', billingMethod: 'FLAT_FEE', baseFee: '100.00' });
  const foreign = (await store().createInvoice('writes-b', 'client-a', 'maker-b', 'writes-scope-invoice', { dueDate: '2026-11-01' })).invoiceId;
  expect((await store().addLine('writes-b', 'client-a', 'maker-b', foreign, line, 'writes-scoped-key')).total).toBe('100.00');
  await db.pool.query(`UPDATE taxguard_members SET status='suspended' WHERE tenant_id='writes-b' AND uid='maker-b'`);
  await expect(store().addLine('writes-b', 'client-a', 'maker-b', foreign, line, 'writes-scoped-key')).rejects.toHaveProperty('code');
});

it('rolls back the line, totals and receipt when audit creation fails and then recovers', async () => {
  const id = await invoice('writes-rollback-invoice'), path = `/clients/client-a/invoices/${id}/lines`;
  const body = { serviceCode: 'SYNTHETIC', quantity: '1' };
  await db.pool.query(`CREATE FUNCTION writes_fixture_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.action='BILLING_INVOICE_LINE_ADDED' THEN RAISE EXCEPTION 'Synthetic failure' USING ERRCODE='XX000'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER writes_fixture_failure BEFORE INSERT ON taxguard_audit_log FOR EACH ROW EXECUTE FUNCTION writes_fixture_failure();`);
  try {
    expect((await post(path, 'writes-recovery-key', body)).status).toBe(503);
    expect((await db.pool.query(`SELECT total::text total FROM taxguard_invoices WHERE id=$1`, [id])).rows[0].total).toBe('0.00');
    expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_invoice_lines WHERE invoice_id=$1`, [id])).rows[0].n).toBe(0);
    expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_billing_write_receipts WHERE idempotency_key='writes-recovery-key'`)).rows[0].n).toBe(0);
  } finally { await db.pool.query('DROP TRIGGER writes_fixture_failure ON taxguard_audit_log; DROP FUNCTION writes_fixture_failure()'); }
  expect((await post(path, 'writes-recovery-key', body)).status).toBe(200);
});

it('allows service-role keyed writes while denying keyless, helper and raw-table bypasses', async () => {
  const id = await invoice('writes-service-invoice'), c = await db.connect();
  try {
    await c.query('BEGIN'); await c.query('SET LOCAL ROLE service_role');
    expect((await new BillingStore(pgRpc(c)).addLine('writes-a', 'client-a', 'maker-a', id,
      { serviceCode: 'SYNTHETIC', quantity: '1' }, 'writes-service-key')).total).toBe('100.00');
    await c.query('COMMIT');
    const privileges = (await db.pool.query(`SELECT
      has_function_privilege('service_role','taxguard_bill_add_line(text,text,text,text,text,numeric,numeric,text,text)','EXECUTE') line,
      has_function_privilege('service_role','taxguard_bill_request_credit(text,text,text,text,numeric,text)','EXECUTE') credit,
      has_function_privilege('service_role','taxguard_bill_retry_result(text,text,text,text,text,jsonb)','EXECUTE') helper,
      has_table_privilege('service_role','taxguard_billing_write_receipts','UPDATE') raw`)).rows[0];
    expect(privileges).toEqual({ line: false, credit: false, helper: false, raw: false });
  } finally { await c.query('ROLLBACK'); await c.end(); }
  expect((await post(`/clients/client-a/invoices/${id}/lines`, '', { serviceCode: 'SYNTHETIC', quantity: '1' })).body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
});

it('does not remove a replacement line when a delayed removal request is retried', async () => {
  const id = await invoice('writes-remove-reuse'), lines = `/clients/client-a/invoices/${id}/lines`;
  expect((await post(lines, 'writes-remove-first-line', { serviceCode: 'SYNTHETIC', quantity: '1' })).status).toBe(200);
  const removed = await post(lines + '/1/remove', 'writes-remove-retry-key', {});
  expect(removed.status).toBe(200); expect(removed.body.total).toBe('0.00');
  const replacement = await post(lines, 'writes-remove-replacement', { serviceCode: 'SYNTHETIC', quantity: '2' });
  expect(replacement.body.lines[0].lineNo).toBe(1); expect(replacement.body.total).toBe('200.00');
  expect(await post(lines + '/1/remove', 'writes-remove-retry-key', {})).toEqual(removed);
  expect((await db.pool.query(`SELECT total::text total FROM taxguard_invoices WHERE id=$1`, [id])).rows[0].total).toBe('200.00');
  expect((await db.pool.query(`SELECT count(*)::int n FROM taxguard_invoice_lines WHERE invoice_id=$1`, [id])).rows[0].n).toBe(1);
  expect((await post(lines + '/2/remove', 'writes-remove-retry-key', {})).status).toBe(409);
  const submitted = await store().transition('writes-a', 'client-a', 'maker-a', id, 'submit', replacement.body.rowVersion);
  await store().transition('writes-a', 'client-a', 'checker-a', id, 'approve', submitted.rowVersion);
  expect(await post(lines + '/1/remove', 'writes-remove-retry-key', {})).toEqual(removed);
  expect((await db.pool.query(`SELECT total::text total,status FROM taxguard_invoices WHERE id=$1`, [id])).rows[0]).toEqual({ total: '200.00', status: 'ISSUED' });
});
