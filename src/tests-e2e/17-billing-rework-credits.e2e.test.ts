import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { api, apiLogin, C, closeBrowser, dumpOnFailure, openModule, sees, sessionWithToken, staffLogin, type Session } from './helpers';

// Journeys F and K in the browser: an independent reviewer returns an invoice for rework, the preparer
// revises and resubmits, a manager approves; then a billing adjustment (credit) needs a second manager,
// and the client projection shows the adjusted amounts without staff reasons or identities.
// Runs after suite 02, which creates the catalog service and the client's first invoice. Synthetic data only.
let mgr: Session; let mgrToken = ''; let acctToken = ''; let clientToken = '';
let invoiceId = ''; let invoiceNumber = '';
const RETURN_NOTE = 'F-PRIVATE add the state return preparation line.';
const CREDIT_NOTE = 'K-PRIVATE goodwill adjustment for a delayed filing.';
const staffInvoice = async () => (await api(mgrToken, 'GET', `/api/billing/clients/${C}/invoices`)).body.items.find((i: any) => i.invoiceId === invoiceId);
const openBilling = async (s: Session) => {
  await s.page.getByLabel('Client identifier').fill(C);
  await s.page.getByRole('button', { name: 'Open client billing' }).click();
};
beforeAll(async () => {
  mgr = await staffLogin('e2e-mgr');
  mgrToken = (await mgr.page.evaluate(() => localStorage.getItem('artax_session_token')))!;
  acctToken = await apiLogin('e2e-acct');
  clientToken = await apiLogin('e2e-client');
});
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(async () => { await closeBrowser(); });

describe('journey F: independent review returns an invoice for rework', () => {
  it('a manager returns the submitted invoice with a required note; it goes back to draft, unseen by the client', async () => {
    const created = await api(acctToken, 'POST', `/api/billing/clients/${C}/invoices`, { dueDate: '2026-12-31' });
    expect(created.status).toBe(201); invoiceId = created.body.invoiceId;
    const lined = await api(acctToken, 'POST', `/api/billing/clients/${C}/invoices/${invoiceId}/lines`, { serviceCode: 'IND-1040', quantity: '1' });
    expect((await api(acctToken, 'POST', `/api/billing/clients/${C}/invoices/${invoiceId}/submit`, { rowVersion: lined.body.rowVersion })).body.status).toBe('PENDING_APPROVAL');
    const { page } = mgr;
    await openModule(page, 'Billing');
    await openBilling(mgr);
    const card = page.locator('article', { hasText: 'PENDING_APPROVAL' });
    const returnButton = card.getByRole('button', { name: 'Return', exact: true });
    expect(await returnButton.isDisabled()).toBe(true); // a return needs a reason
    await card.getByLabel('Note (required to return)').fill(RETURN_NOTE);
    await returnButton.click();
    await sees(page, 'Returned to preparer.');
    await sees(page, `Reviewer note: ${RETURN_NOTE}`);
    expect(await staffInvoice()).toMatchObject({ status: 'DRAFT', reviewNote: RETURN_NOTE, invoiceNumber: null, preparedBy: 'e2e-acct' });
    const client = JSON.stringify((await api(clientToken, 'GET', `/api/billing/clients/${C}/invoices`)).body);
    expect(client).not.toContain(invoiceId);
    expect(client).not.toContain('F-PRIVATE');
  });

  it('the preparer revises and resubmits; the preparer cannot approve; the manager approves and the invoice is numbered', async () => {
    const draft = await staffInvoice();
    const revised = await api(acctToken, 'POST', `/api/billing/clients/${C}/invoices/${invoiceId}/lines`, { serviceCode: 'IND-1040', quantity: '1', unitRate: '150.00', overrideReason: 'Synthetic state return add-on' });
    expect(revised.status).toBeLessThan(300);
    expect(revised.body.rowVersion).toBeGreaterThan(draft.rowVersion);
    // A stale version is refused rather than silently resubmitting the pre-rework invoice.
    expect((await api(acctToken, 'POST', `/api/billing/clients/${C}/invoices/${invoiceId}/submit`, { rowVersion: draft.rowVersion })).body.code).toBe('INVOICE_VERSION_CONFLICT');
    const resubmitted = await api(acctToken, 'POST', `/api/billing/clients/${C}/invoices/${invoiceId}/submit`, { rowVersion: revised.body.rowVersion });
    expect(resubmitted.body).toMatchObject({ status: 'PENDING_APPROVAL', total: '600.00' });
    expect((await api(acctToken, 'POST', `/api/billing/clients/${C}/invoices/${invoiceId}/approve`, { rowVersion: resubmitted.body.rowVersion })).body.code).toBe('BILLING_MANAGER_REQUIRED');
    const { page } = mgr;
    await openBilling(mgr);
    await page.locator('article', { hasText: 'PENDING_APPROVAL' }).getByRole('button', { name: 'Approve and issue' }).click();
    await sees(page, 'Invoice approved and issued.');
    const issued = await staffInvoice();
    expect(issued).toMatchObject({ status: 'ISSUED', preparedBy: 'e2e-acct', approvedBy: 'e2e-mgr', total: '600.00', balanceDue: '600.00' });
    expect(issued.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
    invoiceNumber = issued.invoiceNumber;
    expect(issued.lines.map((l: any) => l.amount)).toEqual(['450.00', '150.00']);
  });
});

describe('journey K: billing adjustment with independent approval and the client projection', () => {
  it('a manager requests a credit in the Billing UI and cannot apply it; a second manager applies it', async () => {
    const { page } = mgr;
    await openBilling(mgr);
    const card = page.locator('article', { hasText: invoiceNumber });
    await card.getByLabel('Payment amount').fill('100.00');
    await card.getByLabel('Note', { exact: true }).fill(CREDIT_NOTE);
    await card.getByRole('button', { name: 'Request credit (amount + note)' }).click();
    await sees(page, 'Credit requested for approval.');
    await card.getByRole('button', { name: 'Apply', exact: true }).click();
    await sees(page, 'A different manager must approve this.');
    const pending = await staffInvoice();
    expect(pending).toMatchObject({ total: '600.00', balanceDue: '600.00' });
    expect(pending.credits).toEqual([expect.objectContaining({ amount: '100.00', status: 'REQUESTED', requestedBy: 'e2e-mgr' })]);
    // The preparer cannot decide credits at all.
    expect((await api(acctToken, 'POST', `/api/billing/clients/${C}/credits/${pending.credits[0].creditId}/apply`)).body.code).toBe('BILLING_MANAGER_REQUIRED');

    const second = await staffLogin('e2e-mgr2');
    await openModule(second.page, 'Billing');
    await openBilling(second);
    await second.page.locator('article', { hasText: invoiceNumber }).getByRole('button', { name: 'Apply', exact: true }).click();
    await sees(second.page, 'Credit applied.');
    const applied = await staffInvoice();
    expect(applied).toMatchObject({ status: 'ISSUED', creditsApplied: '100.00', total: '500.00', balanceDue: '500.00' });
    expect(applied.credits[0]).toMatchObject({ status: 'APPLIED', requestedBy: 'e2e-mgr', decidedBy: 'e2e-mgr2' });
    // A decided credit cannot be decided again, and over-balance or client-requested credits are refused.
    const mgr2Token = (await second.page.evaluate(() => localStorage.getItem('artax_session_token')))!;
    expect((await api(mgr2Token, 'POST', `/api/billing/clients/${C}/credits/${applied.credits[0].creditId}/reject`)).body.code).toBe('CREDIT_ALREADY_DECIDED');
    expect((await api(acctToken, 'POST', `/api/billing/clients/${C}/invoices/${invoiceId}/credits`, { amount: '500.01', reason: 'Synthetic over-balance credit' })).body.code).toBe('CREDIT_EXCEEDS_BALANCE');
    expect((await api(clientToken, 'POST', `/api/billing/clients/${C}/invoices/${invoiceId}/credits`, { amount: '1.00', reason: 'Synthetic client credit' })).body.code).toBe('BILLING_STAFF_REQUIRED');
    expect((await staffInvoice()).credits).toHaveLength(1);
    await second.context.close();
  });

  it('the client sees the adjusted total and balance, the credit amount only, and no staff reasons or identities', async () => {
    const listed = (await api(clientToken, 'GET', `/api/billing/clients/${C}/invoices`)).body.items.find((i: any) => i.invoiceId === invoiceId);
    expect(listed).toMatchObject({ invoiceNumber, status: 'ISSUED', total: '500.00', balanceDue: '500.00', creditsApplied: '100.00' });
    expect(listed.credits).toEqual([{ creditId: expect.any(String), amount: '100.00', status: 'APPLIED' }]);
    expect(JSON.stringify(listed)).not.toMatch(/F-PRIVATE|K-PRIVATE|Synthetic state return add-on|reviewNote|requestedBy|decidedBy|preparedBy|approvedBy|e2e-mgr|e2e-acct/);
    const client = await sessionWithToken(clientToken, '/portal/documents');
    await sees(client.page, invoiceNumber);
    const row = client.page.getByRole('row', { name: new RegExp(invoiceNumber) });
    await sees(client.page, 'Pay $500.00 (sandbox)');
    expect(await row.innerText()).toContain('$500.00');
    const body = await client.page.locator('body').innerText();
    expect(body).not.toMatch(/F-PRIVATE|K-PRIVATE|goodwill|Synthetic Second Manager/);
    await client.context.close();
  });
});
