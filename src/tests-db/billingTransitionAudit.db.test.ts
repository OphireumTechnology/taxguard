import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { BillingStore, SandboxPaymentProvider } from '../server/taxguard/billing/billingStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { clientInvoiceView } from '../server/taxguard/billing/clientBillingView';

// Maker-checker audit completeness for invoice transitions, on a real PostgreSQL server. A reviewer's return
// note lives on the invoice only until the preparer resubmits (then it is cleared), so the audit trail is the
// only lasting record of why the checker sent it back. Synthetic data only.
const T = 'tenantTransitionAudit', C = 'taClient';
let db: TestDatabase; let store: BillingStore;
const auditRows = async (action: string, invoiceId: string) => (await db.pool.query(
  `SELECT actor_uid, actor_role, metadata FROM taxguard_audit_log WHERE tenant_id = $1 AND action = $2 AND metadata->>'invoiceId' = $3 ORDER BY "timestamp"`, [T, action, invoiceId])).rows;
async function draftInvoice(key: string) {
  const id = (await store.createInvoice(T, C, 'ta-acct', key, { dueDate: '2026-04-30' }) as any).invoiceId as string;
  const lined: any = await store.addLine(T, C, 'ta-acct', id, { serviceCode: 'TA-1040', quantity: 1 });
  return { id, rowVersion: lined.rowVersion as number };
}

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic transition audit practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'ta-client', 'Synthetic Audit Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ('${T}', 'ta-mgr', 'practice_manager', 'active', NULL),
      ('${T}', 'ta-acct', 'accountant', 'active', NULL), ('${T}', 'ta-client', 'client', 'active', '${C}');`);
  const practice = new PracticeStore(pgRpc(db.pool));
  const eng = (await practice.createEngagement(T, C, 'ta-mgr', 'ta-engagement', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'ta-mgr', eng, 'active', 1);
  await practice.assign(T, C, 'ta-mgr', 'ta-assignment', { engagementId: eng, taxYear: 2025, role: 'preparer', userId: 'ta-acct', reason: 'Initial staffing' });
  store = new BillingStore(pgRpc(db.pool), new SandboxPaymentProvider());
  await store.upsertService(T, 'ta-mgr', { serviceCode: 'TA-1040', name: 'Synthetic return', category: 'INDIVIDUAL_TAX', billingMethod: 'FLAT_FEE', baseFee: '100.00' });
}, 240_000);
afterAll(async () => { await db?.stop(); });

describe('invoice transition audit trail', () => {
  it('keeps the reviewer\'s return reason in the audit trail after the preparer resubmits', async () => {
    const inv = await draftInvoice('ta-invoice-return');
    const submitted: any = await store.transition(T, C, 'ta-acct', inv.id, 'submit', inv.rowVersion);
    const returned: any = await store.transition(T, C, 'ta-mgr', inv.id, 'return', submitted.rowVersion, 'AUDIT-PRIVATE add the state return line.');
    expect(returned).toMatchObject({ status: 'DRAFT', reviewNote: 'AUDIT-PRIVATE add the state return line.' });
    const resubmitted: any = await store.transition(T, C, 'ta-acct', inv.id, 'submit', returned.rowVersion);
    expect(resubmitted.reviewNote).toBeNull(); // cleared on the invoice by design
    const rows = await auditRows('BILLING_INVOICE_RETURN', inv.id);
    expect(rows).toEqual([expect.objectContaining({ actor_uid: 'ta-mgr', actor_role: 'manager' })]);
    expect(rows[0].metadata).toMatchObject({ invoiceId: inv.id, note: 'AUDIT-PRIVATE add the state return line.', fromStatus: 'PENDING_APPROVAL', toStatus: 'DRAFT' });
    // Submit and approve audits carry the transition but no note.
    const approved: any = await store.transition(T, C, 'ta-mgr', inv.id, 'approve', resubmitted.rowVersion);
    expect((await auditRows('BILLING_INVOICE_SUBMIT', inv.id)).map(r => r.metadata)).toEqual([
      expect.objectContaining({ fromStatus: 'DRAFT', toStatus: 'PENDING_APPROVAL' }), expect.objectContaining({ fromStatus: 'DRAFT', toStatus: 'PENDING_APPROVAL' })]);
    expect((await auditRows('BILLING_INVOICE_APPROVE', inv.id))[0].metadata).toMatchObject({ fromStatus: 'PENDING_APPROVAL', toStatus: 'ISSUED', invoiceNumber: approved.invoiceNumber });
    expect((await auditRows('BILLING_INVOICE_SUBMIT', inv.id))[0].metadata).not.toHaveProperty('note');
  });

  it('records the void reason and the prior status; the client projection never carries either reason', async () => {
    const inv = await draftInvoice('ta-invoice-void');
    const submitted: any = await store.transition(T, C, 'ta-acct', inv.id, 'submit', inv.rowVersion);
    const issued: any = await store.transition(T, C, 'ta-mgr', inv.id, 'approve', submitted.rowVersion);
    const voided: any = await store.transition(T, C, 'ta-mgr', inv.id, 'void', issued.rowVersion, 'AUDIT-PRIVATE issued to the wrong engagement.');
    expect(voided.status).toBe('VOID');
    expect((await auditRows('BILLING_INVOICE_VOID', inv.id))[0].metadata).toMatchObject({ note: 'AUDIT-PRIVATE issued to the wrong engagement.', fromStatus: 'ISSUED', toStatus: 'VOID' });
    const clientView = JSON.stringify(clientInvoiceView(voided));
    expect(clientView).not.toMatch(/AUDIT-PRIVATE|voidReason|reviewNote|ta-mgr|ta-acct/);
  });

  it('a refused transition writes no audit row', async () => {
    const inv = await draftInvoice('ta-invoice-refused');
    const submitted: any = await store.transition(T, C, 'ta-acct', inv.id, 'submit', inv.rowVersion);
    await expect(store.transition(T, C, 'ta-mgr', inv.id, 'return', submitted.rowVersion, 'no')).rejects.toMatchObject({ code: 'BILLING_INPUT_INVALID' });
    await expect(store.transition(T, C, 'ta-acct', inv.id, 'approve', submitted.rowVersion)).rejects.toMatchObject({ code: 'BILLING_MANAGER_REQUIRED' });
    expect(await auditRows('BILLING_INVOICE_RETURN', inv.id)).toEqual([]);
    expect(await auditRows('BILLING_INVOICE_APPROVE', inv.id)).toEqual([]);
  });
});
