import { beforeAll,afterAll,expect,it } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals,pgliteRpc } from './helpers/pgliteRpc';
import { BillingStore } from '../server/taxguard/billing/billingStore';
let fixture:Awaited<ReturnType<typeof capabilityFixture>>;
beforeAll(async()=>{fixture=await capabilityFixture();await applyProposals(fixture.pg,/^20261012(250000|270000|280000)_|^20261015010000_/);
 await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('tenantA','pgBill','pg-owner','Synthetic pagination');
  INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES('tenantA','pg-owner','client','active','pgBill');
  INSERT INTO taxguard_invoices(id,tenant_id,client_id,invoice_number,status,subtotal,total,balance_due,approved_at,review_note,due_date,created_by)
  SELECT 'page-inv-'||n,'tenantA','pgBill','PAGE-'||n,'ISSUED',1,1,1,now(),'Confidential staff review','2026-12-01'::date,'synthetic-preparer' FROM generate_series(1,121)n;`);},30000);
afterAll(async()=>{await fixture?.pg.close();});
it('pages all own invoices without duplicates and preserves exact total balance independent of the page',async()=>{
 const store=new BillingStore(pgliteRpc(()=>fixture.pg));let after:any;const ids=new Set<string>();
 for(let p=0;p<3;p++){const page=await store.page('tenantA','pgBill','pg-owner',after,50);expect(page.summary).toEqual({balanceDue:'121.00',invoiceCount:121});
  expect(JSON.stringify(page)).not.toMatch(/reviewNote|Confidential|approvedBy|preparedBy/);for(const invoice of page.items){expect(ids.has(invoice.invoiceId)).toBe(false);ids.add(invoice.invoiceId);}after=page.next;}
 expect(after).toBeNull();expect(ids.size).toBe(121);
 await expect(store.list('tenantA','pgBill','pg-owner')).rejects.toThrow('BILLING_PAGINATION_REQUIRED');
 await expect(store.page('tenantB','pgBill','pg-owner')).rejects.toThrow();
 await expect(store.page('tenantA','pgBill','pg-owner',undefined,101)).rejects.toThrow('BILLING_PAGE_INVALID');
});
