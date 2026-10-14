import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BillingStore, SandboxPaymentProvider, SANDBOX_SUCCESS_CARD } from '../server/taxguard/billing/billingStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Proposal 047: the database itself returns the client projection to client actors. These tests call
// the billing functions directly (no HTTP router, no TypeScript allow-list), on PGlite with
// proposals 025, 027, 028 and 047. Synthetic data only; sandbox payments only.
const T = 'tenantA', C = 'bpClient', OTHER = 'bpOther';
const INVOICE_KEYS = ['amountPaid', 'balanceDue', 'clientId', 'createdAt', 'credits', 'creditsApplied', 'currency', 'dueDate', 'engagementId', 'invoiceId', 'invoiceNumber',
  'issueDate', 'lines', 'payments', 'rowVersion', 'status', 'subtotal', 'total'];
const STAFF_ONLY = ['preparedBy', 'approvedBy', 'reviewNote', 'voidReason', 'rateOverrideReason', 'provider', 'reason', 'requestedBy', 'decidedBy'];
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let store: BillingStore; let inv = '';
const rpc = () => pgliteRpc(() => fixture.pg);
const list = (actor: string, client = C, tenant = T) => rpc().rpc('taxguard_bill_list', { p_tenant: tenant, p_client: client, p_actor: actor });
const keysDeep = (v: unknown): string[] => !v || typeof v !== 'object' ? [] : Array.isArray(v) ? v.flatMap(keysDeep) : Object.entries(v).flatMap(([k, x]) => [k, ...keysDeep(x)]);

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(250000|270000|280000)_|^20261014470000_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','bp-client','Synthetic Projection Client'),('${T}','${OTHER}','bp-other','Other Synthetic'),
      ('tenantB','${C}','bp-client-b','Same id, other tenant');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES('${T}','bp-mgr','practice_manager','active',NULL),('${T}','bp-mgr2','admin','active',NULL),
      ('${T}','bp-acct','accountant','active',NULL),('${T}','bp-outsider','accountant','active',NULL),('${T}','bp-client','client','active','${C}'),('${T}','bp-other','client','active','${OTHER}'),
      ('tenantB','bp-mgr-b','practice_manager','active',NULL);`);
  const practice = new PracticeStore(rpc());
  const eng = (await practice.createEngagement(T, C, 'bp-mgr', 'bp-engagement', { title: '2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'bp-mgr', eng, 'active', 1);
  await practice.assign(T, C, 'bp-mgr', 'bp-asg-1', { engagementId: eng, taxYear: 2025, role: 'preparer', userId: 'bp-acct', reason: 'Initial staffing' });
  store = new BillingStore(rpc(), new SandboxPaymentProvider());
  await store.upsertService(T, 'bp-mgr', { serviceCode: 'IND-1040', name: 'Individual return', category: 'INDIVIDUAL_TAX', billingMethod: 'FLAT_FEE', baseFee: '400.00' });
  inv = (await store.createInvoice(T, C, 'bp-acct', 'bp-invoice-1', { dueDate: '2026-04-30' })).invoiceId;
  let r: any = await store.addLine(T, C, 'bp-acct', inv, { serviceCode: 'IND-1040', quantity: 1, unitRate: '380.00', overrideReason: 'Synthetic loyalty discount' });
  r = await store.transition(T, C, 'bp-acct', inv, 'submit', r.rowVersion);
  r = await store.transition(T, C, 'bp-mgr', inv, 'return', r.rowVersion, 'Internal: check the engagement letter');
  r = await store.transition(T, C, 'bp-acct', inv, 'submit', r.rowVersion);
  await store.transition(T, C, 'bp-mgr', inv, 'approve', r.rowVersion);
  const applied = await store.requestCredit(T, C, 'bp-acct', inv, '30.00', 'Internal: goodwill for delay');
  await store.decideCredit(T, C, 'bp-mgr', applied.creditId, true);
  await store.requestCredit(T, C, 'bp-acct', inv, '10.00', 'Internal: pending second credit');
}, 90000);
afterAll(async () => { await fixture?.pg.close(); });

describe('database-enforced client billing projection (047)', () => {
  it('returns only allow-listed invoice fields to the client from taxguard_bill_list', async () => {
    const { data, error } = await list('bp-client');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(Object.keys(data[0]).sort()).toEqual(INVOICE_KEYS);
    expect(Object.keys(data[0].lines[0]).sort()).toEqual(['amount', 'description', 'lineNo', 'quantity', 'serviceCode', 'unitRate']);
    for (const k of STAFF_ONLY) expect(keysDeep(data), k).not.toContain(k);
    // Only applied credits are visible; the pending request and every reason stay internal.
    expect(data[0].credits).toEqual([{ creditId: expect.any(String), amount: '30.00', status: 'APPLIED' }]);
    expect(JSON.stringify(data)).not.toMatch(/Internal:|loyalty|bp-acct|bp-mgr/);
  });

  it('returns only allow-listed fields to the client after a sandbox payment', async () => {
    const paid: any = await store.paySandbox(T, C, 'bp-client', inv, { amount: '50.00', idempotencyKey: 'bp-pay-0001', testCard: SANDBOX_SUCCESS_CARD });
    expect(Object.keys(paid.invoice).sort()).toEqual(INVOICE_KEYS);
    expect(Object.keys(paid.invoice.payments[0]).sort()).toEqual(['amount', 'createdAt', 'method', 'paymentId', 'refundedAmount', 'status']);
    for (const k of STAFF_ONLY) expect(keysDeep(paid), k).not.toContain(k);
    // A replay returns identifiers only.
    expect(await store.paySandbox(T, C, 'bp-client', inv, { amount: '50.00', idempotencyKey: 'bp-pay-0001', testCard: SANDBOX_SUCCESS_CARD })).toEqual({ paymentId: paid.paymentId, replayed: true });
  });

  it('leaves staff responses unchanged', async () => {
    for (const actor of ['bp-mgr', 'bp-acct']) {
      const { data } = await list(actor);
      // The review note is cleared on resubmission; the staff projection still carries the field.
      expect(data[0]).toMatchObject({ preparedBy: 'bp-acct', approvedBy: 'bp-mgr', reviewNote: null, voidReason: null });
      expect(data[0].lines[0].rateOverrideReason).toBe('Synthetic loyalty discount');
      expect(data[0].payments[0].provider).toBe('sandbox');
      expect(data[0].credits.map((c: any) => c.status).sort()).toEqual(['APPLIED', 'REQUESTED']);
    }
  });

  it('fails closed across clients, tenants and unrelated staff', async () => {
    for (const [actor, client, tenant] of [['bp-other', C, T], ['bp-client', OTHER, T], ['bp-client', C, 'tenantB'], ['bp-mgr-b', C, T], ['bp-outsider', C, T], ['bp-nobody', C, T]]) {
      const { data, error } = await list(actor, client, tenant);
      expect(data, `${actor} ${tenant}/${client}`).toBeNull();
      expect(error?.code).toBe('P0001');
    }
    // The client never pays an invoice of another client, and a replayed key of another client is refused.
    await expect(store.paySandbox(T, OTHER, 'bp-other', inv, { amount: '1.00', idempotencyKey: 'bp-pay-0002', testCard: SANDBOX_SUCCESS_CARD })).rejects.toMatchObject({ code: 'INVOICE_NOT_FOUND' });
    // Scope is checked before looking up a replay key, so another client's payment existence is not revealed.
    await expect(store.paySandbox(T, OTHER, 'bp-other', inv, { amount: '50.00', idempotencyKey: 'bp-pay-0001', testCard: SANDBOX_SUCCESS_CARD })).rejects.toMatchObject({ code: 'INVOICE_NOT_FOUND' });
  });

  it('an unexpected actor kind gets the client projection, and the helpers are not callable', async () => {
    const r = await fixture.pg.query<{ v: any }>(`SELECT public.taxguard_bill_view(NULL, i) AS v FROM taxguard_invoices i WHERE id = $1`, [inv]);
    expect(Object.keys(r.rows[0].v).sort()).toEqual(INVOICE_KEYS);
    for (const fn of ['taxguard_bill_view(text,taxguard_invoices)', 'taxguard_bill_client_invoice_json(taxguard_invoices)'])
      for (const role of ['service_role', 'authenticated', 'anon'])
        expect((await fixture.pg.query<{ ok: boolean }>(`SELECT has_function_privilege('${role}', 'public.${fn}', 'EXECUTE') AS ok`)).rows[0].ok, `${role} ${fn}`).toBe(false);
    expect((await fixture.pg.query<{ ok: boolean }>(`SELECT has_function_privilege('service_role', 'public.taxguard_bill_list(text,text,text)', 'EXECUTE') AS ok`)).rows[0].ok).toBe(true);
  });
});
