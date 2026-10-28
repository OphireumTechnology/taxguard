import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { api, apiLogin, C, closeBrowser, control, dumpOnFailure, ensureStaffed, openModule, realErrors, sees, selectByText, sessionWithToken, staffLogin, type Session } from './helpers';

// Phase 3 in the browser: firm checklist -> engagement-year requests -> client uploads into a
// request -> scan -> staff review fulfils it -> client notices; missing tracker, reminder, waiver.
let mgr: Session; let client: Session; let mgrToken = ''; let clientToken = '';
const row = (s: Session, text: string) => s.page.getByRole('row', { name: new RegExp(text) });
beforeAll(async () => {
  mgr = await staffLogin('e2e-mgr');
  mgrToken = (await mgr.page.evaluate(() => localStorage.getItem('artax_session_token')))!;
  await ensureStaffed(mgrToken);
  clientToken = await apiLogin('e2e-client');
});
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(async () => { await closeBrowser(); });

describe('document requests and checklists', () => {
  it('a manager saves a firm checklist and applies it to the client\'s 2025 engagement', async () => {
    const { page } = mgr;
    await openModule(page, 'Document Requests');
    await page.getByLabel('Checklist identifier').fill('e2e-individual');
    await page.getByLabel('Name', { exact: true }).fill('Synthetic individual checklist');
    await page.getByLabel(/Items, one per line/).fill('Synthetic wage statements | income | required\nSynthetic photo identification | identity | required\nSynthetic prior-year return | prior_return | optional');
    await page.getByRole('button', { name: 'Save checklist' }).click();
    await sees(page, 'Checklist saved.');
    await page.getByLabel('Client identifier').fill(C);
    await page.getByRole('button', { name: 'Open client requests' }).click();
    const apply = page.locator('form', { has: page.getByRole('button', { name: 'Apply checklist' }) });
    await selectByText(apply.getByLabel('Checklist'), 'Synthetic individual checklist');
    await selectByText(apply.getByLabel('Engagement and tax year'), '2025');
    await apply.getByRole('button', { name: 'Apply checklist' }).click();
    await sees(page, 'Checklist applied.');
    for (const t of ['Synthetic wage statements', 'Synthetic photo identification', 'Synthetic prior-year return (optional)']) await sees(page, t);
    expect(realErrors(mgr)).toEqual([]);
  });

  it('the client sees the requests and a notice, and uploads straight into one', async () => {
    client = await sessionWithToken(clientToken, '/portal/documents');
    const { page } = client;
    await sees(page, 'Requested documents');
    await sees(page, 'Document requested: Synthetic wage statements');
    await row(client, 'Synthetic wage statements').getByLabel('Upload for Synthetic wage statements')
      .setInputFiles({ name: 'synthetic-w2-request.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nSynthetic W-2 for the request\n%%EOF') });
    await sees(page, 'Uploaded for "Synthetic wage statements"');
    await row(client, 'Synthetic wage statements').getByText('Received — awaiting review').waitFor();
    expect(realErrors(client)).toEqual([]);
  });

  it('after a clean scan the manager accepts it and the request completes for the client', async () => {
    const docs = (await api(clientToken, 'GET', `/api/vault/clients/${C}/documents`)).body.items;
    const doc = docs.find((d: any) => d.fileName === 'synthetic-w2-request.pdf');
    const c = control();
    expect((await fetch(c.origin + '/e2e/scan', { method: 'POST', headers: { apikey: c.key, 'content-type': 'application/json' },
      body: JSON.stringify({ tenant: 'tenantE2E', client: C, documentId: doc.documentId, version: 1, result: 'CLEAN' }) })).status).toBe(200);
    await openModule(mgr.page, 'Document Review');
    await mgr.page.getByRole('row', { name: /synthetic-w2-request\.pdf/ }).getByRole('button', { name: 'Review' }).click();
    await mgr.page.getByRole('button', { name: 'Accept document' }).click();
    await sees(mgr.page, 'Document accepted.');
    await client.page.reload();
    await row(client, 'Synthetic wage statements').getByText('Complete').waitFor();
    await sees(client.page, 'Received: Synthetic wage statements');
    const unreadBefore = (await api(clientToken, 'GET', `/api/vault/clients/${C}/notifications`)).body.unread;
    await client.page.getByRole('button', { name: 'Mark "Received: Synthetic wage statements" as read' }).click();
    await client.page.getByRole('button', { name: 'Mark "Received: Synthetic wage statements" as read' }).waitFor({ state: 'detached' });
    expect((await api(clientToken, 'GET', `/api/vault/clients/${C}/notifications`)).body.unread).toBe(unreadBefore - 1);
  });

  it('the missing tracker lists what is outstanding; the manager reminds and waives with a recorded reason', async () => {
    const { page } = mgr;
    await openModule(page, 'Document Requests');
    const panel = page.locator('section[aria-labelledby="doc-requests-heading"]');
    await panel.getByLabel('Tax year').fill('2025');
    await panel.getByRole('button', { name: 'Refresh', exact: true }).click();
    const missingTable = page.locator('table', { has: page.locator('caption', { hasText: 'Outstanding document requests' }) });
    await missingTable.getByText('Synthetic photo identification').waitFor();
    expect(await missingTable.innerText()).not.toContain('Synthetic wage statements');
    await missingTable.getByRole('row', { name: /Synthetic photo identification/ }).getByRole('button', { name: 'Remind' }).click();
    await sees(page, 'Reminder recorded in the client portal.');
    await page.getByLabel('Client identifier').fill(C);
    await page.getByRole('button', { name: 'Open client requests' }).click();
    await page.getByLabel(/Reason for waiver or withdrawal/).fill('Identity verified in person at the synthetic office');
    const clientTable = page.locator('table', { has: page.locator('caption', { hasText: `Requests for ${C}` }) });
    await clientTable.getByRole('row', { name: /Synthetic photo identification/ }).getByRole('button', { name: 'Waive' }).click();
    await sees(page, 'Request waived.');
    await clientTable.getByText(/No longer needed — Identity verified in person/).waitFor();
    await client.page.reload();
    await sees(client.page, 'Reminder: Synthetic photo identification');
    await row(client, 'Synthetic photo identification').getByText('No longer needed').waitFor();
    expect(await client.page.locator('body').innerText()).not.toContain('Identity verified in person');
    expect(realErrors(mgr)).toEqual([]); expect(realErrors(client)).toEqual([]);
  });
});
