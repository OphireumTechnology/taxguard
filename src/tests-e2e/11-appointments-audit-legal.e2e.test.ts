import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { api, apiLogin, C, closeBrowser, dumpOnFailure, ensureStaffed, FOREIGN_CLIENT, openModule, realErrors, sees, sessionWithToken, staffLogin, type Session } from './helpers';

// Phase 8 in the browser on the real server with PostgreSQL: durable appointments (proposal 040),
// the administrative audit center (041) and legal-coordination tracking (042). Synthetic only.
let mgr: Session; let mgrToken = ''; let clientToken = ''; let acctToken = '';
const inDays = (d: number, hour = 15) => { const t = new Date(Date.now() + d * 86_400_000); t.setUTCHours(hour, 0, 0, 0); return t; };
const local = (t: Date) => t.toISOString().slice(0, 16); // datetime-local value in UTC
const title = 'Synthetic planning appointment';
beforeAll(async () => {
  mgr = await staffLogin('e2e-mgr');
  mgrToken = (await mgr.page.evaluate(() => localStorage.getItem('artax_session_token')))!;
  await ensureStaffed(mgrToken);
  clientToken = await apiLogin('e2e-client');
  acctToken = await apiLogin('e2e-acct');
});
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(async () => { await closeBrowser(); });

describe('durable appointments', () => {
  it('the client requests an appointment from the portal', async () => {
    const client = await sessionWithToken(clientToken, '/portal');
    const { page } = client;
    await page.getByRole('button', { name: 'Appointments', exact: true }).first().click();
    await sees(page, 'My appointments');
    const form = page.getByRole('form', { name: 'Request an appointment' });
    expect(await form.getByText('Responsible staff UID').count()).toBe(0);
    await form.getByLabel('Title').fill(title);
    await form.getByLabel('Category').selectOption('TAX_PLANNING');
    await form.getByLabel(/^Start/).fill(local(inDays(3)));
    await form.getByLabel('Time zone').fill('UTC');
    await form.getByRole('button', { name: 'Request appointment' }).click();
    await sees(page, 'Appointment requested. The practice will confirm it.');
    await page.getByRole('list', { name: 'Upcoming appointments' }).getByText(title).waitFor();
    expect(realErrors(client)).toEqual([]);
    await client.context.close();
  });

  it('the manager assigns the accountant and confirms it on the practice calendar', async () => {
    const { page } = mgr;
    await openModule(page, 'Appointments');
    await sees(page, 'Practice appointment calendar');
    await page.getByRole('button', { name: new RegExp(title) }).click();
    const detail = page.getByLabel(`Appointment details: ${title}`);
    const move = detail.getByRole('form', { name: 'Reschedule appointment' });
    await move.getByLabel(/^New start/).fill(local(inDays(3, 16)));
    await move.getByLabel('Time zone').fill('UTC');
    await move.getByLabel(/^Responsible staff UID/).fill('e2e-acct');
    await move.getByRole('button', { name: 'Reschedule' }).click();
    await sees(page, 'Appointment rescheduled.');
    await detail.getByRole('button', { name: 'Confirm appointment' }).click();
    await sees(page, 'Appointment confirmed.');
    await detail.getByText(/Responsible staff: e2e-acct/).waitFor();
    expect(realErrors(mgr)).toEqual([]);
  });

  it('the accountant sees it on their schedule; the client sees it confirmed; conflicts are refused by the server', async () => {
    const acct = await staffLogin('e2e-acct');
    await acct.page.getByRole('region', { name: 'My appointment schedule' }).getByText(title).waitFor();
    expect(realErrors(acct)).toEqual([]);
    await acct.context.close();
    const mine = (await api(clientToken, 'GET', `/api/scheduling/clients/${C}/appointments`)).body.find((a: any) => a.title === title);
    expect(mine).toMatchObject({ status: 'CONFIRMED', hasStaff: true });
    expect(mine.staffUid).toBeUndefined();
    // Overlapping booking for the same accountant is refused by the database, not the browser.
    const s = inDays(3, 16);
    const clash = await api(mgrToken, 'POST', `/api/scheduling/clients/${C}/appointments`, { title: 'Synthetic overlap', mode: 'PHONE', startsAt: new Date(s.getTime() + 15 * 60_000).toISOString(),
      endsAt: new Date(s.getTime() + 75 * 60_000).toISOString(), timezone: 'UTC', staffUid: 'e2e-acct' });
    expect(clash.body.code).toMatch(/^APPOINTMENT_(STAFF|CLIENT)_CONFLICT$/);
    expect((await api(clientToken, 'POST', `/api/scheduling/clients/${C}/appointments/${mine.appointmentId}/status`, { version: mine.version, action: 'confirm' })).body.code).toBe('APPOINTMENT_STAFF_REQUIRED');
    expect((await api(acctToken, 'GET', `/api/scheduling/clients/${FOREIGN_CLIENT}/appointments`)).status).toBeGreaterThanOrEqual(403);
  });
});

describe('legal coordination tracking', () => {
  it('a manager opens a matter for the client from the client detail, with the disclaimer', async () => {
    const { page } = mgr;
    await openModule(page, 'Clients & Engagements');
    await page.getByRole('button', { name: /Synthetic Client One/ }).first().click();
    const legal = page.getByRole('region', { name: 'Legal coordination' });
    await legal.getByText(/independent licensed attorneys/).waitFor();
    const form = legal.getByRole('form', { name: 'Open legal coordination matter' });
    await form.getByLabel('Title').fill('Synthetic trust coordination');
    await form.getByLabel(/disclaimer above was presented/).check();
    await form.getByRole('button', { name: 'Open matter' }).click();
    await sees(page, 'Legal coordination matter opened.');
    await legal.getByRole('button', { name: 'Start review' }).click();
    await sees(page, 'Status updated.');
    await legal.getByRole('button', { name: 'Record referral to counsel' }).click();
    await sees(page, 'Record the external attorney and law firm before recording the referral.');
    expect(realErrors(mgr)).toEqual([]);
  });
});

describe('administrative audit center', () => {
  it('shows administrators redacted, tenant-scoped events and refuses everyone else', async () => {
    const admin = await staffLogin('e2e-admin');
    const { page } = admin;
    await openModule(page, 'Compliance Audit Log');
    const center = page.getByRole('region', { name: 'Audit center' });
    await center.getByRole('cell', { name: 'APPOINTMENT_CONFIRMED' }).first().waitFor();
    await center.getByRole('cell', { name: 'LEGAL_MATTER_OPENED' }).first().waitFor();
    await center.getByRole('row', { name: /APPOINTMENT_CONFIRMED/ }).first().getByRole('button', { name: /Inspect event/ }).click();
    const detail = center.getByRole('article', { name: 'Audit event detail' });
    await detail.getByText('appointmentId').waitFor();
    expect(await center.innerText()).not.toMatch(/Synthetic planning appointment|meet\.|disclaimer/i);
    // Security view: event volume per category for the range, with its own 31-day bound.
    const filters = center.getByRole('form', { name: 'Audit filters' });
    await filters.getByLabel(/Security events only/).check();
    await filters.getByRole('button', { name: 'Apply filters' }).click();
    const volume = center.getByRole('region', { name: 'Security event volume' });
    await volume.getByText(/^(Category|No security events were recorded in this range\.)$/).first().waitFor();
    expect(await volume.getByRole('alert').count()).toBe(0);
    await filters.getByLabel('From (UTC date)').fill(new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10));
    await filters.getByRole('button', { name: 'Apply filters' }).click();
    await volume.getByRole('alert').filter({ hasText: 'Security event volume covers at most 31 days.' }).waitFor();
    expect(realErrors(admin)).toEqual([]);
    await admin.context.close();
    const range = `from=${encodeURIComponent(new Date(Date.now() - 86_400_000).toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 86_400_000).toISOString())}`;
    expect((await api(mgrToken, 'GET', `/api/audit-center/events?${range}`)).status).toBe(403);
    expect((await api(clientToken, 'GET', `/api/audit-center/events?${range}`)).status).toBe(403);
    expect((await api(acctToken, 'GET', `/api/audit-center/events?${range}`)).body.code).toBe('AUDIT_ADMIN_REQUIRED');
    expect((await api(mgrToken, 'GET', `/api/audit-center/security-summary?${range}`)).status).toBe(403);
  });
});
