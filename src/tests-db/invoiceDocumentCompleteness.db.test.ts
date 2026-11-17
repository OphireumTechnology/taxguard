import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { BillingStore } from '../server/taxguard/billing/billingStore';
import { clientInvoiceView } from '../server/taxguard/billing/clientBillingView';
import { invoiceDocumentText, renderInvoicePdf, type InvoiceDocumentView } from '../server/taxguard/billing/invoiceDocument';

let db: TestDatabase;
let store: BillingStore;
const tenant = 'invoicePdfFixture', client = 'pdfClient';
beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES ($1,'Synthetic PDF practice');`, [tenant]);
  await db.pool.query(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES ($1,$2,'pdf-client','Synthetic PDF client');`, [tenant, client]);
  await db.pool.query(`INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES
    ($1,'pdf-manager','practice_manager','active',NULL),($1,'pdf-preparer','accountant','active',NULL),($1,'pdf-client','client','active',$2);`, [tenant, client]);
  store = new BillingStore(pgRpc(db.pool));
}, 240_000);
afterAll(async () => { await db?.stop(); });

describe('complete invoice documents from PostgreSQL client projections', () => {
  it.each([499, 500, 501, 1001])('reconciles every line of an issued %i-line invoice', async count => {
    const draft: any = await store.createInvoice(tenant, client, 'pdf-manager', `pdf-invoice-${count}`, { dueDate: '2026-12-31' });
    // Fixture-owner bulk seeding only: no production database or accounting API is bypassed.
    // Recompute and independent submit/approve use the unchanged accounting implementation.
    await db.pool.query(`INSERT INTO taxguard_invoice_lines(invoice_id,tenant_id,line_no,service_code,description,quantity,unit_rate,amount,rate_override_reason)
      SELECT $1,$2,n,'PDF-SYNTHETIC','PDF fixture line '||n,1.00,1.01,1.01,'PRIVATE fixture override' FROM generate_series(1,$3::integer) n;
      `, [draft.invoiceId, tenant, count]);
    await db.pool.query('SELECT taxguard_bill_recompute($1)', [draft.invoiceId]);
    // A practice manager is an authorized preparer for this unassigned synthetic client.
    const current: any = (await store.list(tenant, client, 'pdf-manager')).find((item: any) => item.invoiceId === draft.invoiceId);
    const submitted: any = await store.transition(tenant, client, 'pdf-manager', draft.invoiceId, 'submit', current.rowVersion);
    // Independent manager preserves maker-checker; this fixture never commissions a payment provider.
    await db.pool.query(`INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES ($1,'pdf-checker','practice_manager','active') ON CONFLICT DO NOTHING`, [tenant]);
    await store.transition(tenant, client, 'pdf-checker', draft.invoiceId, 'approve', submitted.rowVersion);
    const issued: any = (await store.list(tenant, client, 'pdf-client')).find((item: any) => item.invoiceId === draft.invoiceId);
    const view = clientInvoiceView(issued) as InvoiceDocumentView;
    expect(view.lines).toHaveLength(count);
    expect(view.lines?.map(line => line.lineNo)).toEqual(Array.from({ length: count }, (_, i) => i + 1));
    const cents = BigInt(count) * 101n;
    const expected = `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
    expect(view).toMatchObject({ status: 'ISSUED', subtotal: expected, total: expected, balanceDue: expected });
    const text = invoiceDocumentText(view, new Date('2026-10-19T00:00:00Z'));
    expect(text.filter(line => line.includes('PDF fixture line'))).toHaveLength(count);
    expect(text.find(line => line.includes(`PDF fixture line ${count}`))).toMatch(new RegExp(`^${count}\\s+`));
    const pdf = renderInvoicePdf(view, new Date('2026-10-19T00:00:00Z')).toString('latin1');
    expect(pdf.match(/PDF fixture line /g)).toHaveLength(count);
    expect(pdf).toContain(`${expected} USD`);
    expect(pdf).not.toMatch(/PRIVATE fixture override|pdf-manager|pdf-checker|pdf-preparer/);
  });
});
