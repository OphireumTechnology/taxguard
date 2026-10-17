import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBillingRouter } from '../server/routes/billing.routes';
import { BillingStore, SandboxPaymentProvider, SANDBOX_DECLINE_CARD, SANDBOX_SUCCESS_CARD, money } from '../server/taxguard/billing/billingStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// HTTP -> /api/billing -> BillingStore -> proposal 028 (PGlite) with the sandbox provider. Synthetic data only.
const T = 'tenantA', C = 'blClient', OTHER = 'blOther';
const people: Record<string, any> = { mgr: { id: 'bl-mgr', role: 'practice_manager' }, mgr2: { id: 'bl-mgr2', role: 'admin' }, acct: { id: 'bl-acct', role: 'accountant' },
  outsider: { id: 'bl-outsider', role: 'accountant' }, client: { id: 'bl-client', role: 'client', clientId: C }, other: { id: 'bl-other', role: 'client', clientId: OTHER } };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let user: any; let n = 0;
const as = (who: string, tenantId = T) => { user = { ...people[who], tenantId, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown, key: string | null = `bl-key-${++n}-${Date.now()}`) => fetch(origin + '/billing' + path, { method,
  headers: { 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  .then(async r => ({ status: r.status, body: await r.json() }));

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(250000|270000|280000)_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','bl-client','Synthetic Billing Client'),('${T}','${OTHER}','bl-other','Other Synthetic');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES('${T}','bl-mgr','practice_manager','active',NULL),('${T}','bl-mgr2','admin','active',NULL),
      ('${T}','bl-acct','accountant','active',NULL),('${T}','bl-outsider','accountant','active',NULL),('${T}','bl-client','client','active','${C}'),('${T}','bl-other','client','active','${OTHER}');`);
  const practice = new PracticeStore(pgliteRpc(() => fixture.pg));
  const eng = (await practice.createEngagement(T, C, 'bl-mgr', 'bl-engagement', { title: '2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'bl-mgr', eng, 'active', 1);
  await practice.assign(T, C, 'bl-mgr', 'bl-asg-1', { engagementId: eng, taxYear: 2025, role: 'preparer', userId: 'bl-acct', reason: 'Initial staffing' });
  const store = new BillingStore(pgliteRpc(() => fixture.pg), new SandboxPaymentProvider());
  const app = express();
  app.use('/billing', createBillingRouter({ store: () => store, authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 60000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

describe('billing', () => {
  let inv = ''; let version = 0;
  it('prices services with history; only managers change prices and a change needs a reason', async () => {
    as('acct');
    expect((await call('POST', '/catalog', { serviceCode: 'IND-1040', name: 'Individual return', category: 'INDIVIDUAL_TAX', billingMethod: 'FLAT_FEE', baseFee: '450.00' })).body.code).toBe('BILLING_MANAGER_REQUIRED');
    as('mgr');
    expect((await call('POST', '/catalog', { serviceCode: 'IND-1040', name: 'Individual return', category: 'INDIVIDUAL_TAX', billingMethod: 'FLAT_FEE', baseFee: '450.00' })).status).toBe(200);
    await call('POST', '/catalog', { serviceCode: 'BK-HOUR', name: 'Bookkeeping hour', category: 'BOOKKEEPING', billingMethod: 'HOURLY', baseFee: 85.5 });
    expect((await call('POST', '/catalog', { serviceCode: 'IND-1040', name: 'Individual return', category: 'INDIVIDUAL_TAX', billingMethod: 'FLAT_FEE', baseFee: '475.00' })).body.code).toBe('PRICE_CHANGE_REASON_REQUIRED');
    await call('POST', '/catalog', { serviceCode: 'IND-1040', name: 'Individual return', category: 'INDIVIDUAL_TAX', billingMethod: 'FLAT_FEE', baseFee: '475.00', reason: 'Annual synthetic price review' });
    expect((await call('POST', '/catalog', { serviceCode: 'X', name: 'Bad', category: 'INDIVIDUAL_TAX', billingMethod: 'FLAT_FEE', baseFee: '1.005' })).body.code).toBe('BILLING_AMOUNT_INVALID');
    const history = (await fixture.pg.query<{ previous_fee: string | null; new_fee: string }>("SELECT previous_fee, new_fee FROM taxguard_service_price_history WHERE service_code='IND-1040' ORDER BY created_at")).rows;
    expect(history.map(h => [h.previous_fee, h.new_fee])).toEqual([[null, '450.00'], ['450.00', '475.00']]);
    await expect(fixture.pg.query('DELETE FROM taxguard_service_price_history')).rejects.toThrow('BILLING_HISTORY_IMMUTABLE');
  });

  it('drafts an invoice idempotently, prices lines from the catalog and requires a reason for a rate override', async () => {
    as('acct');
    const created = await call('POST', `/clients/${C}/invoices`, { dueDate: '2026-04-30' }, 'bl-invoice-key-1');
    expect(created.status).toBe(201); inv = created.body.invoiceId;
    expect((await call('POST', `/clients/${C}/invoices`, { dueDate: '2026-04-30' }, 'bl-invoice-key-1')).body).toEqual({ invoiceId: inv, created: false });
    let r = await call('POST', `/clients/${C}/invoices/${inv}/lines`, { serviceCode: 'IND-1040', quantity: 1 });
    expect(r.body).toMatchObject({ subtotal: '475.00', total: '475.00', balanceDue: '475.00', invoiceNumber: null });
    expect((await call('POST', `/clients/${C}/invoices/${inv}/lines`, { serviceCode: 'BK-HOUR', quantity: '2.5', unitRate: '60.00' })).body.code).toBe('RATE_OVERRIDE_REASON_REQUIRED');
    r = await call('POST', `/clients/${C}/invoices/${inv}/lines`, { serviceCode: 'BK-HOUR', quantity: '2.5', unitRate: '60.00', overrideReason: 'Agreed synthetic discount' });
    expect(r.body).toMatchObject({ subtotal: '625.00', total: '625.00' });
    expect(r.body.lines.map((l: any) => [l.serviceCode, l.quantity, l.unitRate, l.amount])).toEqual([['IND-1040', '1.00', '475.00', '475.00'], ['BK-HOUR', '2.50', '60.00', '150.00']]);
    version = r.body.rowVersion;
    as('client');
    expect((await call('GET', `/clients/${C}/invoices`)).body.items).toEqual([]);
  });

  it('requires a different manager to approve; numbers are assigned only at issue', async () => {
    as('acct');
    let r = await call('POST', `/clients/${C}/invoices/${inv}/submit`, { rowVersion: version }); version = r.body.rowVersion;
    expect(r.body.status).toBe('PENDING_APPROVAL');
    expect((await call('POST', `/clients/${C}/invoices/${inv}/approve`, { rowVersion: version })).body.code).toBe('BILLING_MANAGER_REQUIRED');
    as('mgr');
    r = await call('POST', `/clients/${C}/invoices/${inv}/return`, { rowVersion: version, note: 'Add the engagement reference' }); version = r.body.rowVersion;
    expect(r.body).toMatchObject({ status: 'DRAFT', reviewNote: 'Add the engagement reference' });
    as('acct');
    r = await call('POST', `/clients/${C}/invoices/${inv}/submit`, { rowVersion: version }); version = r.body.rowVersion;
    as('mgr');
    expect((await call('POST', `/clients/${C}/invoices/${inv}/approve`, { rowVersion: version - 1 })).body.code).toBe('INVOICE_VERSION_CONFLICT');
    r = await call('POST', `/clients/${C}/invoices/${inv}/approve`, { rowVersion: version }); version = r.body.rowVersion;
    expect(r.body).toMatchObject({ status: 'ISSUED', approvedBy: 'bl-mgr', preparedBy: 'bl-acct' });
    expect(r.body.invoiceNumber).toMatch(/^INV-\d{4}-000001$/);
    expect((await call('POST', `/clients/${C}/invoices/${inv}/lines`, { serviceCode: 'IND-1040', quantity: 1 })).body.code).toBe('INVOICE_NOT_EDITABLE');
    // A manager who prepared an invoice cannot approve it.
    const own = (await call('POST', `/clients/${C}/invoices`, { dueDate: '2026-05-30' })).body.invoiceId;
    let o = await call('POST', `/clients/${C}/invoices/${own}/lines`, { serviceCode: 'IND-1040', quantity: 1 });
    o = await call('POST', `/clients/${C}/invoices/${own}/submit`, { rowVersion: o.body.rowVersion });
    expect((await call('POST', `/clients/${C}/invoices/${own}/approve`, { rowVersion: o.body.rowVersion })).body.code).toBe('MAKER_CHECKER_VIOLATION');
    expect((await call('POST', `/clients/${C}/invoices/${own}/void`, { rowVersion: o.body.rowVersion, note: 'Duplicate synthetic invoice' })).body.status).toBe('VOID');
  });

  it('records payments idempotently, refuses duplicates and overpayment, and settles in exact decimals', async () => {
    as('client');
    const mine = (await call('GET', `/clients/${C}/invoices`)).body.items;
    // An unissued draft that was voided is also confidential.
    expect(mine.map((i: any) => i.status)).toEqual(['ISSUED']);
    // Phase 9: staff-only financial details never reach clients (allow-listed client projection).
    const text = JSON.stringify(mine);
    for (const internal of ['preparedBy', 'approvedBy', 'reviewNote', 'voidReason', 'rateOverrideReason', 'Agreed synthetic discount', 'Add the engagement reference', 'bl-mgr', 'bl-acct', 'provider'])
      expect(text, internal).not.toContain(internal);
    expect(mine[0].lines.map((l: any) => l.serviceCode)).toEqual(['IND-1040', 'BK-HOUR']);
    expect((await call('POST', `/clients/${C}/invoices/${inv}/payments`, { amount: '10.00', method: 'CHECK' })).body.code).toBe('PAYMENT_NOT_AUTHORIZED');
    expect((await call('POST', `/clients/${C}/invoices/${inv}/pay-sandbox`, { amount: '100.00', testCard: '5555555555554444' })).body.code).toBe('SANDBOX_TEST_CARD_REQUIRED');
    expect((await call('POST', `/clients/${C}/invoices/${inv}/pay-sandbox`, { amount: '100.00', testCard: SANDBOX_DECLINE_CARD })).status).toBe(402);
    const paid = await call('POST', `/clients/${C}/invoices/${inv}/pay-sandbox`, { amount: '100.10', testCard: SANDBOX_SUCCESS_CARD }, 'bl-pay-key-1');
    expect(paid.status).toBe(201); expect(paid.body.invoice).toMatchObject({ amountPaid: '100.10', balanceDue: '524.90', status: 'PARTIALLY_PAID' });
    expect(JSON.stringify(paid.body)).not.toMatch(/preparedBy|approvedBy|reviewNote|bl-mgr|provider/);
    const replay = await call('POST', `/clients/${C}/invoices/${inv}/pay-sandbox`, { amount: '100.10', testCard: SANDBOX_SUCCESS_CARD }, 'bl-pay-key-1');
    expect(replay.body).toMatchObject({ paymentId: paid.body.paymentId, replayed: true });
    expect((await call('POST', `/clients/${C}/invoices/${inv}/pay-sandbox`, { amount: '999.99', testCard: SANDBOX_SUCCESS_CARD })).body.code).toBe('PAYMENT_EXCEEDS_BALANCE');
    as('acct');
    expect((await call('POST', `/clients/${C}/invoices/${inv}/payments`, { amount: '10.00', method: 'CHECK' })).body.code).toBe('PAYMENT_NOT_AUTHORIZED');
    as('mgr');
    const check = await call('POST', `/clients/${C}/invoices/${inv}/payments`, { amount: '24.90', method: 'CHECK' });
    expect(check.body.invoice).toMatchObject({ amountPaid: '125.00', balanceDue: '500.00' });
    expect((await fixture.pg.query<{ n: number }>(`SELECT count(*)::int n FROM taxguard_invoice_payments WHERE invoice_id='${inv}'`)).rows[0].n).toBe(2);
  });

  it('applies credits only after a different manager approves, and refunds within limits', async () => {
    as('acct');
    const credit = await call('POST', `/clients/${C}/invoices/${inv}/credits`, { amount: '50.00', reason: 'Synthetic goodwill credit' });
    expect((await call('POST', `/clients/${C}/invoices/${inv}/credits`, { amount: '600.00', reason: 'Too large' })).body.code).toBe('CREDIT_EXCEEDS_BALANCE');
    expect((await call('POST', `/clients/${C}/credits/${credit.body.creditId}/apply`)).body.code).toBe('BILLING_MANAGER_REQUIRED');
    as('mgr');
    const applied = await call('POST', `/clients/${C}/credits/${credit.body.creditId}/apply`);
    expect(applied.body).toMatchObject({ creditsApplied: '50.00', total: '575.00', balanceDue: '450.00' });
    expect((await call('POST', `/clients/${C}/credits/${credit.body.creditId}/reject`)).body.code).toBe('CREDIT_ALREADY_DECIDED');
    const own = await call('POST', `/clients/${C}/invoices/${inv}/credits`, { amount: '5.00', reason: 'Manager requested credit' });
    expect((await call('POST', `/clients/${C}/credits/${own.body.creditId}/apply`)).body.code).toBe('MAKER_CHECKER_VIOLATION');
    const payments = applied.body.payments;
    expect((await call('POST', `/clients/${C}/payments/${payments[0].paymentId}/refund`, { amount: '200.00', reason: 'Too much' })).body.code).toBe('REFUND_EXCEEDS_PAYMENT');
    const refunded = await call('POST', `/clients/${C}/payments/${payments[0].paymentId}/refund`, { amount: '0.10', reason: 'Synthetic rounding refund' });
    expect(refunded.body).toMatchObject({ amountPaid: '124.90', balanceDue: '450.10', status: 'PARTIALLY_PAID' });
    as('mgr2');
    expect((await call('POST', `/clients/${C}/invoices/${inv}/void`, { rowVersion: refunded.body.rowVersion, note: 'Cannot void with payments' })).body.code).toBe('INVOICE_STATUS_TRANSITION_INVALID');
  });

  it('reports accounts receivable by age for visible clients only', async () => {
    as('mgr');
    const report = (await call('GET', '/ar-aging?asOf=2026-06-15')).body;
    expect(report.clients).toEqual([expect.objectContaining({ clientId: C, totalDue: '450.10', days31to60: '450.10', current: '0.00', openInvoices: 1 })]);
    as('acct');
    expect((await call('GET', '/ar-aging?asOf=2026-04-01')).body.clients[0]).toMatchObject({ current: '450.10' });
    as('outsider');
    expect((await call('GET', '/ar-aging')).body.clients).toEqual([]);
    as('client');
    expect((await call('GET', '/ar-aging')).body.code).toBe('BILLING_STAFF_REQUIRED');
  });

  it('enforces confidentiality in direct database RPCs without the HTTP projection', async () => {
    const rpc = pgliteRpc(() => fixture.pg);
    const store = new BillingStore(rpc, new SandboxPaymentProvider());
    const mine = await store.list(T, C, 'bl-client');
    const internal = /preparedBy|approvedBy|reviewNote|voidReason|rateOverrideReason|requestedBy|decidedBy|provider|Synthetic goodwill|bl-mgr|bl-acct/;
    expect(JSON.stringify(mine)).not.toMatch(internal);
    const paid = await store.paySandbox(T, C, 'bl-client', inv, { amount: '1.00', idempotencyKey: 'bl-direct-payment', testCard: SANDBOX_SUCCESS_CARD });
    expect(paid.invoice.amountPaid).toBe('125.90');
    expect(JSON.stringify(paid)).not.toMatch(internal);
    expect(JSON.stringify(await store.list(T, C, 'bl-mgr'))).toMatch(/preparedBy/);
    await expect(store.list('tenantB', C, 'bl-client')).rejects.toThrow();
    await expect(store.list(T, OTHER, 'bl-client')).rejects.toThrow();
    await expect(store.list(T, C, 'bl-outsider')).rejects.toThrow();
    await expect(store.paySandbox(T, OTHER, 'bl-other', inv, { amount: '1.00', idempotencyKey: 'bl-direct-payment', testCard: SANDBOX_SUCCESS_CARD })).rejects.toThrow('INVOICE_NOT_FOUND');
    for (const table of ['taxguard_invoices', 'taxguard_invoice_lines', 'taxguard_invoice_payments', 'taxguard_service_price_history', 'taxguard_invoice_credits']) {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const r = await fixture.pg.query<{ ok: boolean }>('SELECT has_table_privilege($1, $2, \'SELECT\') AS ok', [role, table]);
        expect(r.rows[0].ok).toBe(false);
      }
    }
    for (const fn of ['taxguard_bill_invoice_json(taxguard_invoices)', 'taxguard_bill_client_invoice_json(taxguard_invoices)']) {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const r = await fixture.pg.query<{ ok: boolean }>('SELECT has_function_privilege($1, $2, \'EXECUTE\') AS ok', [role, fn]);
        expect(r.rows[0].ok).toBe(false);
      }
    }
  });

  it('isolates clients and tenants', async () => {
    as('other');
    expect((await call('GET', `/clients/${C}/invoices`)).body.code).toBe('INVOICE_NOT_FOUND');
    as('outsider');
    expect((await call('GET', `/clients/${C}/invoices`)).body.code).toBe('CLIENT_NOT_FOUND');
    expect((await call('POST', `/clients/${C}/invoices`, { dueDate: '2026-04-30' })).body.code).toBe('CLIENT_NOT_FOUND');
    as('mgr', 'tenantB');
    expect((await call('GET', `/clients/${C}/invoices`)).body.code).toBe('CLIENT_NOT_FOUND'); // other tenant: indistinguishable from absent
  });

  it('detects a confidentiality mutation of the database projection and restores it', async () => {
    await fixture.pg.exec('BEGIN');
    try {
      await fixture.pg.exec(`CREATE OR REPLACE FUNCTION public.taxguard_bill_client_invoice_json(i public.taxguard_invoices) RETURNS jsonb
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$ SELECT public.taxguard_bill_invoice_json(i) $$`);
      const exposed = await new BillingStore(pgliteRpc(() => fixture.pg)).list(T, C, 'bl-client');
      // The same confidentiality predicate used by the direct-RPC regression catches this mutant.
      expect(() => expect(JSON.stringify(exposed)).not.toMatch(/preparedBy|approvedBy|rateOverrideReason/)).toThrow();
    } finally { await fixture.pg.exec('ROLLBACK'); }
    expect(JSON.stringify(await new BillingStore(pgliteRpc(() => fixture.pg)).list(T, C, 'bl-client'))).not.toMatch(/preparedBy|approvedBy|rateOverrideReason/);
  });

  it('validates money without rounding and keeps the sandbox provider out of production', () => {
    expect(money('12.50')).toBe('12.50'); expect(money(3)).toBe('3');
    expect(() => money('1.005')).toThrow(); expect(() => money(-1)).toThrow(); expect(() => money('1e3')).toThrow();
    const env = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
    try { expect(() => new SandboxPaymentProvider()).toThrow('PAYMENT_PROVIDER_NOT_COMMISSIONED'); } finally { process.env.NODE_ENV = env; }
  });
  it('produces an issued-invoice PDF from client-visible fields only, for authorized callers only', async () => {
    const pdf = (path: string) => fetch(origin + '/billing' + path).then(async r => ({ status: r.status, type: r.headers.get('content-type'), disposition: r.headers.get('content-disposition'),
      bytes: Buffer.from(await r.arrayBuffer()) }));
    as('client');
    const r = await pdf(`/clients/${C}/invoices/${inv}/document`);
    expect(r.status).toBe(200); expect(r.type).toBe('application/pdf');
    expect(r.disposition).toMatch(/^attachment; filename="invoice-INV-\d{4}-000001\.pdf"$/);
    const text = r.bytes.toString('latin1');
    expect(text.startsWith('%PDF-1.4\n')).toBe(true); expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    // Every cross-reference offset points at the start of its object.
    const xref = Number(/startxref\n(\d+)\n/.exec(text)![1]);
    expect(text.slice(xref, xref + 4)).toBe('xref');
    const entries = [...text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map(m => Number(m[1]));
    entries.forEach((offset, i) => expect(text.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
    const issued = (await call('GET', `/clients/${C}/invoices`, undefined, null)).body.items.find((i: any) => i.invoiceId === inv);
    expect(text).toContain(issued.invoiceNumber);
    for (const amount of [issued.total, issued.balanceDue, issued.amountPaid]) expect(text).toContain(amount);
    expect(text).toContain('This document is not a receipt. It has not been e-mailed or otherwise delivered by TaxGuard.');
    // Staff receive the same client-facing document: no preparer, approver or internal review note.
    as('mgr');
    const staff = (await pdf(`/clients/${C}/invoices/${inv}/document`)).bytes.toString('latin1');
    for (const secret of ['bl-acct', 'bl-mgr', 'Add the engagement reference', 'Initial staffing']) expect(staff).not.toContain(secret);
    // Not issued: refused. Unknown or another client's invoice: not found, without a document.
    const draft = (await call('POST', `/clients/${C}/invoices`, { dueDate: '2026-06-30' })).body.invoiceId;
    const refused = await pdf(`/clients/${C}/invoices/${draft}/document`);
    expect(refused.status).toBe(409); expect(JSON.parse(refused.bytes.toString())).toEqual({ code: 'INVOICE_DOCUMENT_NOT_ISSUED' });
    expect((await pdf(`/clients/${C}/invoices/not-an-invoice/document`)).status).toBe(404);
    expect((await pdf(`/clients/${C}/invoices/${encodeURIComponent('../x')}/document`)).status).toBe(404);
    as('other');
    const foreign = await pdf(`/clients/${C}/invoices/${inv}/document`);
    expect(foreign.status).toBe(404); expect(foreign.type).not.toBe('application/pdf');
    expect((await pdf(`/clients/${OTHER}/invoices/${inv}/document`)).status).toBe(404);
    as('mgr', 'tenantOther');
    expect((await pdf(`/clients/${C}/invoices/${inv}/document`)).type).not.toBe('application/pdf');
  });
});
