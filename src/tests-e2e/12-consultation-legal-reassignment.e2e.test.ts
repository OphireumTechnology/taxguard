import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ORIGIN, api, apiLogin, C, closeBrowser, dumpOnFailure, ensureStaffed, newSession, openModule, realErrors, sees, sessionWithToken, staffLogin, type Session } from './helpers';

// Phase 9 in the browser on the real server with PostgreSQL: public consultation request (043) ->
// manager review and conversion into a real appointment (040); client legal coordination (042/044);
// client reassignment request and leadership review (045). Synthetic visitors, staff and clients.
let mgr: Session; let mgrToken = ''; let clientToken = '';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
beforeAll(async () => {
  mgr = await staffLogin('e2e-mgr');
  mgrToken = (await mgr.page.evaluate(() => localStorage.getItem('artax_session_token')))!;
  await ensureStaffed(mgrToken);
  clientToken = await apiLogin('e2e-client');
});
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(async () => { await closeBrowser(); });

describe('public consultation requests', () => {
  it('a visitor submits a request without an account; nothing is booked', async () => {
    const visitor = await newSession();
    const { page } = visitor;
    await page.goto(ORIGIN + '/book-consultation', { waitUntil: 'domcontentloaded' });
    const form = page.getByRole('form', { name: 'Consultation request' });
    await form.getByText('It does not create an account or book a time.').waitFor();
    await form.getByLabel('Full name').fill('Synthetic Prospect');
    await form.getByRole('textbox', { name: 'E-mail' }).fill('prospect@example.test');
    await form.getByLabel('Topic').selectOption('TAX_PLANNING');
    const target = new Date(Date.now() + 5 * 86_400_000);
    await form.getByRole('button', { name: 'Preferred date 1' }).click();
    if (target.getMonth() !== new Date().getMonth()) await page.getByRole('button', { name: 'Next month' }).click();
    await page.getByRole('gridcell', { name: new RegExp(`^${MONTHS[target.getMonth()]} ${target.getDate()}, ${target.getFullYear()}`) }).click();
    await form.getByRole('checkbox').check();
    await form.getByRole('button', { name: 'Send request' }).click();
    const received = page.getByRole('status', { name: 'Consultation request received' });
    await received.getByText('No appointment is booked until we do.').waitFor();
    expect(await received.innerText()).toMatch(/Your reference: [A-F0-9]{8}/);
    expect(await page.evaluate(() => localStorage.getItem('artax_session_token'))).toBeNull();
    expect(realErrors(visitor)).toEqual([]);
    await visitor.context.close();
  });

  it('the manager reviews it and converts it into a real appointment for an existing client', async () => {
    const { page } = mgr;
    await openModule(page, 'Consultation Requests');
    const panel = page.getByRole('region', { name: 'Consultation requests' });
    await panel.getByRole('button', { name: /Synthetic Prospect/ }).click();
    await panel.getByRole('button', { name: 'Start review' }).click();
    await sees(page, 'Request marked in review.');
    await panel.getByLabel('Status').selectOption('IN_REVIEW');
    // The request stays expanded across the refresh.
    const convert = panel.getByRole('form', { name: 'Convert to appointment' });
    const start = new Date(Date.now() + 6 * 86_400_000); start.setUTCHours(14, 0, 0, 0);
    await convert.getByLabel('Existing client ID').fill(C);
    await convert.getByLabel(/^Start/).fill(start.toISOString().slice(0, 16));
    await convert.getByLabel('Time zone').fill('UTC');
    await convert.getByLabel('Responsible staff UID').fill('e2e-acct');
    await convert.getByRole('button', { name: 'Convert to appointment' }).click();
    await sees(page, 'Request converted into an appointment.');
    const apts = (await api(mgrToken, 'GET', `/api/scheduling/clients/${C}/appointments`)).body;
    expect(apts.some((a: any) => a.category === 'CONSULTATION' && a.status === 'CONFIRMED' && a.staffUid === 'e2e-acct')).toBe(true);
    expect(realErrors(mgr)).toEqual([]);
  });

  it('refuses unauthenticated review, client review, and forged public submissions', async () => {
    expect((await fetch(ORIGIN + '/api/consultations/requests')).status).toBe(401);
    expect((await api(clientToken, 'GET', '/api/consultations/requests')).status).toBe(403);
    const forged = await fetch(ORIGIN + '/api/public/consultation-requests', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'e2e-forged-0001' },
      body: JSON.stringify({ fullName: 'Forged', email: 'forged@example.test', preferredContact: 'EMAIL', topic: 'OTHER', modePreference: 'REMOTE',
        preferredWindows: [{ date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), partOfDay: 'MORNING' }], timezone: 'UTC', consent: false, consentVersion: 'x' }) });
    expect((await forged.json()).code).toBe('CONSULTATION_CONSENT_REQUIRED');
    const oversize = await fetch(ORIGIN + '/api/public/consultation-requests', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'e2e-oversize-1' },
      body: JSON.stringify({ message: 'x'.repeat(20_000) }) });
    expect(oversize.status).toBe(413);
  });
});

describe('client legal coordination and advisor requests', () => {
  it('the client opens a legal coordination request and asks for a different advisor', async () => {
    const client = await sessionWithToken(clientToken, '/portal');
    const { page } = client;
    await page.getByRole('button', { name: 'Legal Coordination', exact: true }).first().click();
    const legal = page.getByRole('region', { name: 'Legal coordination' });
    await legal.getByText(/independent licensed attorneys/).waitFor();
    const form = legal.getByRole('form', { name: 'Request legal coordination' });
    await form.getByLabel('Title').fill('Synthetic estate question');
    await form.getByRole('checkbox').check();
    await form.getByRole('button', { name: 'Send request' }).click();
    await sees(page, 'Request received. The practice will review it.');
    await legal.getByText('Synthetic estate question').waitFor();
    await legal.getByText('Request received —', { exact: false }).first().waitFor();
    await page.getByRole('button', { name: 'My Advisor', exact: true }).first().click();
    const advisor = page.getByRole('region', { name: 'My advisor' });
    await advisor.getByLabel(/^Reason/).fill('Synthetic: I would prefer a bookkeeping specialist');
    await advisor.getByRole('button', { name: 'Send request' }).click();
    await sees(page, 'Your request was sent to practice leadership for review.');
    await advisor.getByText('Under review').waitFor();
    expect(realErrors(client)).toEqual([]);
    await client.context.close();
  });

  it('leadership approves the reassignment request; the team is unchanged until a manager reassigns', async () => {
    const { page } = mgr;
    await openModule(page, 'Reassignment Requests');
    const panel = page.getByRole('region', { name: 'Reassignment requests' });
    await panel.getByText(/bookkeeping specialist/).waitFor();
    await panel.getByRole('button', { name: 'Approve request' }).first().click();
    await sees(page, 'Request approved. Change the team in Clients & Engagements; approval alone does not reassign.');
    const mine = (await api(clientToken, 'GET', `/api/reassignment/clients/${C}/requests`)).body;
    expect(mine[0]).toMatchObject({ status: 'APPROVED' });
    expect(mine[0].reviewedBy).toBeUndefined();
    expect(realErrors(mgr)).toEqual([]);
  });
});
