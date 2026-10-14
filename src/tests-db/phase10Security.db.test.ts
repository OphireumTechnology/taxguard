import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDatabase, pgRpc, type TestDatabase } from './harness';
import { BillingStore, SandboxPaymentProvider, SANDBOX_SUCCESS_CARD } from '../server/taxguard/billing/billingStore';
import { SecurityEventRecorder } from '../server/securityEventRecorder';

let db: TestDatabase;
beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES('tenantA','Synthetic phase10'),('tenantB','Synthetic foreign');
    INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('tenantA','p10Client','p10-client','Synthetic client');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES('tenantA','p10-client','client','active','p10Client'),
    ('tenantA','p10-preparer','practice_manager','active',NULL),('tenantA','p10-reviewer','admin','active',NULL),('tenantB','p10-foreign','admin','active',NULL);`);
});
afterAll(async () => { await db?.stop(); });

describe('Phase 10 security on disposable real PostgreSQL', () => {
  it('enforces nested client billing confidentiality at the service-role RPC boundary', async () => {
    const client = await db.connect();
    try {
      await client.query('SET ROLE service_role');
      const store = new BillingStore(pgRpc(client), new SandboxPaymentProvider());
      await store.upsertService('tenantA', 'p10-preparer', { serviceCode: 'P10', name: 'Synthetic service', category: 'INDIVIDUAL_TAX', billingMethod: 'FLAT_FEE', baseFee: '100.00' });
      const invoice = await store.createInvoice('tenantA', 'p10Client', 'p10-preparer', 'p10-invoice-key', { dueDate: '2026-12-01' });
      let state = await store.addLine('tenantA', 'p10Client', 'p10-preparer', invoice.invoiceId, { serviceCode: 'P10', quantity: '1', unitRate: '90.00', overrideReason: 'Confidential discount rationale' });
      state = await store.transition('tenantA', 'p10Client', 'p10-preparer', invoice.invoiceId, 'submit', state.rowVersion);
      await store.transition('tenantA', 'p10Client', 'p10-reviewer', invoice.invoiceId, 'approve', state.rowVersion);
      const credit = await store.requestCredit('tenantA', 'p10Client', 'p10-preparer', invoice.invoiceId, '1.00', 'Confidential credit rationale');
      await store.decideCredit('tenantA', 'p10Client', 'p10-reviewer', credit.creditId, true);
      const paid = await store.paySandbox('tenantA', 'p10Client', 'p10-client', invoice.invoiceId, { amount: '2.00', idempotencyKey: 'p10-payment-key', testCard: SANDBOX_SUCCESS_CARD });
      expect(paid.invoice.balanceDue).toBe('87.00');
      for (const result of [paid, await store.list('tenantA', 'p10Client', 'p10-client')]) {
        expect(JSON.stringify(result)).not.toMatch(/preparedBy|approvedBy|reviewNote|rateOverrideReason|requestedBy|decidedBy|provider|Confidential|p10-reviewer|p10-preparer/);
      }
      await expect(store.list('tenantB', 'p10Client', 'p10-client')).rejects.toThrow();
      await expect(store.list('tenantA', 'p10Client', 'p10-foreign')).rejects.toThrow();
      await expect(client.query('SELECT taxguard_bill_invoice_json(i) FROM taxguard_invoices i')).rejects.toThrow(/permission denied/);
    } finally { await client.end(); }
  });
  it('persists security events through service-only ingestion and enforces immutability and bounds', async () => {
    const client = await db.connect();
    try {
      await client.query('SET ROLE service_role');
      const recorder = new SecurityEventRecorder(pgRpc(client), 'tenantA');
      recorder.record({ eventType: 'INVALID_CREDENTIALS', severity: 'warning' }); await recorder.drain();
      expect(recorder.status().persisted).toBe(1);
      const row = (await db.pool.query("SELECT * FROM taxguard_audit_log WHERE action='SECURITY_AUTH_FAILURE'")).rows[0];
      expect(row.metadata).toEqual({ category: 'SECURITY', severity: 'warning' });
      expect(row.ip_address).toBeNull();
      await expect(db.pool.query('DELETE FROM taxguard_audit_log WHERE id=$1', [row.id])).rejects.toThrow('SECURITY_EVENT_IMMUTABLE');
      await client.query('SET ROLE authenticated');
      await expect(client.query("SELECT taxguard_security_record('tenantA',NULL,$1,'AUTH_FAILURE','warning')", [randomUUID()])).rejects.toThrow(/permission denied/);
      await client.query('RESET ROLE');
      await client.query('BEGIN');
      try {
        await client.query("INSERT INTO taxguard_audit_log(tenant_id,action,actor_uid,metadata) SELECT 'tenantA','SECURITY_AUTH_FAILURE','security_ingest','{}'::jsonb FROM generate_series(1,1200)");
        await expect(client.query("SELECT taxguard_security_record('tenantA',NULL,$1,'AUTH_FAILURE','warning')", [randomUUID()])).rejects.toThrow('SECURITY_INGEST_LIMIT');
      } finally { await client.query('ROLLBACK'); }
    } finally { await client.end(); }
  });
});
