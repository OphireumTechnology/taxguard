import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SANDBOX_SUCCESS_CARD } from '../server/taxguard/billing/billingStore';
import { api, apiLogin, C, closeBrowser, control, dumpOnFailure, openModule, selectByText, ORIGIN, realErrors, sees, sessionWithToken, staffLogin, type Session } from './helpers';

// Practice manager staffing, client document upload -> scan -> staff review, and billing from
// draft to sandbox payment, through the real UI and server. Synthetic data only.
let mgr: Session; let mgrToken = ''; let clientToken = ''; let acctToken = '';
const ENGAGEMENT = 'Synthetic 2025 individual return';
beforeAll(async () => {
  mgr = await staffLogin('e2e-mgr');
  mgrToken = (await mgr.page.evaluate(() => localStorage.getItem('artax_session_token')))!;
});
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(async () => { await closeBrowser(); });

describe('clients, engagements and team (practice manager UI)', () => {
  it('creates and activates an engagement and staffs it with preparer, reviewer and bookkeeper', async () => {
    const { page } = mgr;
    await openModule(page, 'Clients & Engagements');
    await page.getByRole('button', { name: /Synthetic Client One/ }).click();
    const create = page.locator('form', { has: page.getByRole('button', { name: 'Create engagement' }) });
    await create.getByLabel('Title').fill(ENGAGEMENT);
    await create.getByLabel('Type').selectOption('tax_preparation');
    await create.getByLabel('Tax year').fill('2025');
    await create.getByRole('button', { name: 'Create engagement' }).click();
    await sees(page, ENGAGEMENT);
    await page.getByRole('button', { name: 'Set active' }).first().click();
    await sees(page, /· active ·/);
    const team = page.locator('form', { has: page.getByRole('button', { name: 'Assign' }) });
    for (const [role, userId] of [['preparer', 'e2e-acct'], ['reviewer', 'e2e-rev'], ['bookkeeper', 'e2e-bk']]) {
      await selectByText(team.getByLabel('Engagement'), ENGAGEMENT);
      await team.getByLabel('Tax year').fill('2025');
      await team.getByLabel('Role').selectOption(role);
      await team.getByLabel('Staff identifier').fill(userId);
      await team.getByLabel('Reason (recorded)').fill('Synthetic initial staffing for E2E');
      await team.getByRole('button', { name: 'Assign' }).click();
      await sees(page, userId);
    }
    const detail = await api(mgrToken, 'GET', `/api/practice/clients/${C}`);
    expect(detail.status).toBe(200);
    expect(detail.body.engagements.map((e: any) => [e.title, e.status])).toEqual([[ENGAGEMENT, 'active']]);
    expect(detail.body.team.map((t: any) => [t.role, t.userId]).sort())
      .toEqual([['bookkeeper', 'e2e-bk'], ['preparer', 'e2e-acct'], ['reviewer', 'e2e-rev']]);
    expect(realErrors(mgr)).toEqual([]);
  });
});

describe('documents: upload, quarantine, scan and independent review', () => {
  let client: Session; let documentId = '';
  it('a client uploads through the portal and the file stays quarantined until scanned', async () => {
    clientToken = await apiLogin('e2e-client');
    client = await sessionWithToken(clientToken, '/portal/documents');
    const { page } = client;
    await sees(page, 'Secure document upload');
    const form = page.locator('form', { has: page.getByRole('button', { name: /Upload securely/ }) });
    const target = form.getByLabel('Engagement and tax year');
    const value = await target.locator('option').evaluateAll(os => (os as HTMLOptionElement[]).map(o => o.value).find(v => v));
    await target.selectOption(value!);
    await form.locator('input[type=file]').setInputFiles({ name: 'synthetic-w2.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nSynthetic W-2 for E2E only\n%%EOF') });
    await form.getByRole('button', { name: /Upload securely/ }).click();
    await sees(page, 'synthetic-w2.pdf');
    expect(await page.getByRole('button', { name: 'Download synthetic-w2.pdf' }).count()).toBe(0);
    const list = await api(clientToken, 'GET', `/api/vault/clients/${C}/documents`);
    const doc = list.body.items.find((d: any) => d.fileName === 'synthetic-w2.pdf');
    expect(doc).toMatchObject({ status: 'SCAN_PENDING', quarantineStatus: 'QUARANTINED' });
    documentId = doc.documentId;
    // Not downloadable and not in the staff review queue while quarantined.
    expect((await api(clientToken, 'POST', `/api/vault/clients/${C}/documents/${documentId}/versions/1/download`)).status).toBeGreaterThanOrEqual(400);
    expect((await api(mgrToken, 'GET', '/api/vault/review-queue')).body.items.map((d: any) => d.documentId)).not.toContain(documentId);
  });

  it('after a clean scan verdict a manager accepts it in Document Review and the client can download it', async () => {
    const c = control();
    const scan = await fetch(c.origin + '/e2e/scan', { method: 'POST', headers: { apikey: c.key, 'content-type': 'application/json' },
      body: JSON.stringify({ tenant: 'tenantE2E', client: C, documentId, version: 1, result: 'CLEAN' }) });
    expect(scan.status).toBe(200);
    const { page } = mgr;
    await openModule(page, 'Document Review');
    await page.getByRole('row', { name: /synthetic-w2\.pdf/ }).getByRole('button', { name: 'Review' }).click();
    await page.getByLabel('Internal review note (staff only)').fill('C9 PRIVATE approved review discussion');
    await page.getByRole('button', { name: 'Accept document' }).click();
    await sees(page, 'Document accepted.');
    const detail = await api(mgrToken, 'GET', `/api/vault/clients/${C}/documents/${documentId}`);
    expect(detail.body.versions[0]).toMatchObject({ status: 'VERIFIED', reviewedBy: 'e2e-mgr' });
    await client.page.reload();
    await client.page.getByRole('button', { name: 'Download synthetic-w2.pdf' }).waitFor();
    const download = await api(clientToken, 'POST', `/api/vault/clients/${C}/documents/${documentId}/versions/1/download`);
    expect(download.status).toBe(200); expect(download.body.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/storage\/v1\/object\/sign\//);
    expect(realErrors(client)).toEqual([]);
  });
  it('shows an explicitly public replacement reason while API responses conceal staff notes and history', async () => {
    const previous = await api(mgrToken, 'GET', `/api/vault/clients/${C}/documents/${documentId}`);
    const query = new URLSearchParams({ engagementId: previous.body.versions[0].engagementId, taxYear: '2025', category: 'income', fileName: 'c9-unreadable.pdf' });
    const uploaded = await fetch(ORIGIN + `/api/vault/clients/${C}/documents?` + query, { method: 'POST',
      headers: { Authorization: `Bearer ${clientToken}`, 'Content-Type': 'application/pdf', 'Idempotency-Key': 'c9-browser-upload' },
      body: '%PDF-1.4\nSynthetic C9 document only\n%%EOF' });
    expect(uploaded.status).toBe(201); const id = (await uploaded.json()).documentId;
    const c = control();
    expect((await fetch(c.origin + '/e2e/scan', { method: 'POST', headers: { apikey: c.key, 'content-type': 'application/json' },
      body: JSON.stringify({ tenant: 'tenantE2E', client: C, documentId: id, version: 1, result: 'CLEAN' }) })).status).toBe(200);
    await mgr.page.reload();
    await openModule(mgr.page, 'Document Review');
    await mgr.page.getByRole('row', { name: /c9-unreadable\.pdf/ }).getByRole('button', { name: 'Review' }).click();
    await mgr.page.getByLabel('Internal review note (staff only)').fill('C9 PRIVATE replacement review discussion');
    const reason = 'Please replace the unreadable second page.';
    await mgr.page.getByLabel('Reason shown to client', { exact: false }).fill(reason);
    await mgr.page.getByRole('button', { name: 'Request replacement', exact: true }).click();
    await sees(mgr.page, 'Replacement requested.');
    const detail = await api(clientToken, 'GET', `/api/vault/clients/${C}/documents/${id}?includeInternal=true`);
    expect(detail.body.versions[0].clientReason).toBe(reason);
    expect(detail.body.history).toEqual([]);
    expect(JSON.stringify(detail.body)).not.toMatch(/C9 PRIVATE|reviewNote|reviewedBy|actorUid|uploadedBy|e2e-mgr/);
    const list = await api(clientToken, 'GET', `/api/vault/clients/${C}/documents`);
    expect(JSON.stringify(list.body)).not.toMatch(/C9 PRIVATE|reviewNote|reviewedBy|actorUid|uploadedBy|e2e-mgr/);
    await client.page.reload(); await sees(client.page, reason);
    expect(await client.page.getByText('C9 PRIVATE', { exact: false }).count()).toBe(0);
  });
});

describe('billing: maker-checker approval, numbering and sandbox payment', () => {
  let invoiceId = '';
  it('an accountant drafts and submits; a different manager approves in the Billing UI and the invoice is numbered', async () => {
    expect((await api(mgrToken, 'POST', '/api/billing/catalog', { serviceCode: 'IND-1040', name: 'Individual return (synthetic)', category: 'INDIVIDUAL_TAX', billingMethod: 'FLAT_FEE', baseFee: '450.00' })).status).toBeLessThan(300);
    acctToken = await apiLogin('e2e-acct');
    const created = await api(acctToken, 'POST', `/api/billing/clients/${C}/invoices`, { dueDate: '2026-12-31' });
    expect(created.status).toBe(201); invoiceId = created.body.invoiceId;
    const lined = await api(acctToken, 'POST', `/api/billing/clients/${C}/invoices/${invoiceId}/lines`, { serviceCode: 'IND-1040', quantity: '1' });
    const submitted = await api(acctToken, 'POST', `/api/billing/clients/${C}/invoices/${invoiceId}/submit`, { rowVersion: lined.body.rowVersion });
    expect(submitted.body.status).toBe('PENDING_APPROVAL');
    // The client sees nothing before issue.
    expect((await api(clientToken, 'GET', `/api/billing/clients/${C}/invoices`)).body.items).toEqual([]);
    const { page } = mgr;
    await openModule(page, 'Billing');
    await page.getByLabel('Client identifier').fill(C);
    await page.getByRole('button', { name: 'Open client billing' }).click();
    await page.getByRole('button', { name: 'Approve and issue' }).click();
    await sees(page, 'Invoice approved and issued.');
    const issued = (await api(mgrToken, 'GET', `/api/billing/clients/${C}/invoices`)).body.items.find((i: any) => i.invoiceId === invoiceId);
    expect(issued).toMatchObject({ status: 'ISSUED', preparedBy: 'e2e-acct', approvedBy: 'e2e-mgr', total: '450.00', balanceDue: '450.00' });
    expect(issued.invoiceNumber).toMatch(/^INV-\d{4}-000001$/);
  });

  it('the client pays the issued invoice with the sandbox test card exactly once', async () => {
    const client = await sessionWithToken(clientToken, '/portal/documents');
    const { page } = client;
    await sees(page, /INV-\d{4}-000001/);
    await page.getByLabel('Sandbox test card').fill(SANDBOX_SUCCESS_CARD);
    const pay = page.getByRole('button', { name: 'Pay $450.00 (sandbox)' });
    await pay.click();
    await page.getByRole('button', { name: /Pay \$450\.00/ }).waitFor({ state: 'detached' });
    const after = (await api(clientToken, 'GET', `/api/billing/clients/${C}/invoices`)).body.items[0];
    expect(after).toMatchObject({ status: 'PAID', amountPaid: '450.00', balanceDue: '0.00' });
    // A second payment of the settled invoice is refused.
    const again = await api(clientToken, 'POST', `/api/billing/clients/${C}/invoices/${invoiceId}/pay-sandbox`, { amount: '1.00', testCard: SANDBOX_SUCCESS_CARD });
    expect(again.status).toBeGreaterThanOrEqual(400);
    // The issued invoice document downloads as a PDF of the recorded amounts; nothing is delivered.
    const [download] = await Promise.all([page.waitForEvent('download'),
      page.getByRole('button', { name: /^Download invoice INV-\d{4}-000001 \(PDF\)$/ }).click()]);
    expect(download.suggestedFilename()).toMatch(/^invoice-INV-\d{4}-000001\.pdf$/);
    const fs = await import('node:fs');
    const pdf = fs.readFileSync((await download.path())!).toString('latin1');
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('Status: PAID');
    expect(pdf).toMatch(/Balance due\s+0\.00 USD/);
    await sees(page, 'Invoice document downloaded. It is not a receipt.');
    expect(realErrors(client)).toEqual([]);
  });

  it('a manager records a refund made outside TaxGuard exactly once; the client never sees its reason', async () => {
    const paymentId = (await api(mgrToken, 'GET', `/api/billing/clients/${C}/invoices`)).body.items.find((i: any) => i.invoiceId === invoiceId).payments[0].paymentId;
    // Only managers record refunds.
    expect((await api(acctToken, 'POST', `/api/billing/clients/${C}/payments/${paymentId}/refund`, { amount: '1.00', reason: 'Synthetic accountant attempt' })).body.code).toBe('BILLING_MANAGER_REQUIRED');
    const { page } = mgr;
    await page.getByRole('button', { name: 'Open client billing' }).click();
    await page.getByRole('button', { name: `Record a refund for payment ${paymentId}` }).click();
    const form = page.getByRole('form', { name: `Refund for payment ${paymentId}` });
    await form.getByLabel('Refund amount').fill('10.00');
    await form.getByLabel('Refund reason (recorded)').fill('Synthetic overpayment returned by cheque');
    await form.getByRole('button', { name: 'Record refund' }).click();
    await sees(page, 'Refund recorded. TaxGuard records refunds made outside the system; no money was moved.');
    const after = (await api(mgrToken, 'GET', `/api/billing/clients/${C}/invoices`)).body.items.find((i: any) => i.invoiceId === invoiceId);
    expect(after).toMatchObject({ amountPaid: '440.00', balanceDue: '10.00', status: 'PARTIALLY_PAID' });
    expect(after.payments[0].refundedAmount).toBe('10.00');
    const clientView = (await api(clientToken, 'GET', `/api/billing/clients/${C}/invoices`)).body.items.find((i: any) => i.invoiceId === invoiceId);
    expect(clientView.payments[0].refundedAmount).toBe('10.00');
    expect(JSON.stringify(clientView)).not.toMatch(/overpayment returned|e2e-mgr/);
    expect(realErrors(mgr)).toEqual([]);
  });
});
