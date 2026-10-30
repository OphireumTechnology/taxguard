import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ORIGIN, api, apiLogin, C, closeBrowser, dumpOnFailure, ensureStaffed, FOREIGN_CLIENT, newSession, realErrors, sees, sessionWithToken, staffLogin, UNASSIGNED_CLIENT, type Session } from './helpers';

// Phase 13A contracts in the browser on the real server with PostgreSQL (synthetic users only):
// C3 client stages 04-08, C1 consultation history, C5 consultation rooms, C6 notification
// preferences, C7 live commissioning records (fail-closed here), C2 blocked MFA enrolment and C8
// disabled contact intake, plus refusals and the absence of unapproved tax figures or filing.
// Runs after 03 (case advanced to stage 09) and 12 (consultation converted) in name order.
let mgrToken = '', clientToken = '';
const tokens: Record<string, string> = {};
const body = (s: Session) => s.page.locator('body').innerText();
const dialogs = (s: Session) => { const seen: string[] = []; s.page.on('dialog', d => { seen.push(d.type()); void d.dismiss(); }); return seen; };
// Anything resembling a computed tax figure, a filed / transmitted return or a commissioned agent.
const UNAPPROVED = /\$\s?\d[\d,]*(\.\d{2})?|Refund (due|amount)|Amount owed|Return (filed|transmitted|accepted)|IRS Accepted|E-?filed|Transmitted to (the )?IRS/;
const FILING_CONTROL = /e-?file|transmit|file (the |my )?return|submit (the |my )?return|sign (the |my )?return/i;
async function filingControlsDisabled(s: Session) {
  const buttons = s.page.getByRole('button', { name: FILING_CONTROL });
  for (let i = 0; i < await buttons.count(); i++) expect(await buttons.nth(i).isEnabled(), await buttons.nth(i).innerText()).toBe(false);
}

beforeAll(async () => {
  mgrToken = await apiLogin('e2e-mgr');
  await ensureStaffed(mgrToken);
  clientToken = await apiLogin('e2e-client');
  for (const id of ['e2e-admin', 'e2e-acct', 'e2e-bk', 'e2e-recruiter', 'e2e-foreign']) tokens[id] = await apiLogin(id);
});
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(async () => { await closeBrowser(); });

describe('C3 client stages 04-08', () => {
  it('shows the recorded case status for each stage with counts only, no figures and no filing', async () => {
    const s = await sessionWithToken(clientToken, '/portal/dashboard#nav=stage_04');
    const seen = dialogs(s);
    const view = s.page.getByTestId('client-case-stage-4');
    await view.waitFor();
    const choose = view.getByRole('combobox');
    if (await choose.count()) await choose.selectOption({ index: 1 });
    await view.getByText(/current stage 09/).waitFor();
    for (const stage of [4, 5, 6, 7, 8]) {
      await s.page.goto(ORIGIN + '/portal/dashboard#nav=stage_0' + stage); await s.page.reload();
      const v = s.page.getByTestId('client-case-stage-' + stage);
      await v.waitFor();
      if (await v.getByRole('combobox').count()) await v.getByRole('combobox').selectOption({ index: 1 });
      await v.getByText('Completed', { exact: false }).first().waitFor();
      const t = await v.innerText();
      expect(t, 'stage ' + stage).toMatch(/Stage 0\d of 18/i);
      expect(t).toMatch(/Accepted documents/);
      expect(t).not.toMatch(UNAPPROVED);
      expect(t).not.toMatch(/e2e-acct|e2e-rev|Synthetic Accountant|Synthetic Reviewer/); // no staff identities
      await filingControlsDisabled(s);
    }
    // Keyboard: the next-step navigation is reachable and works.
    await s.page.getByRole('navigation', { name: 'Next steps' }).getByRole('button', { name: 'Open documents' }).focus();
    await s.page.keyboard.press('Enter');
    await sees(s.page, 'Secure document upload');
    expect(seen).toEqual([]);
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });
  it('refuses other clients, other tenants and unauthorized roles at the API', async () => {
    const path = (client: string) => `/api/client-portal/clients/${client}/case-stages?engagementId=eng_${'0'.repeat(32)}&taxYear=2025`;
    expect([403, 404]).toContain((await api(clientToken, 'GET', path(UNASSIGNED_CLIENT))).status);
    expect([403, 404]).toContain((await api(clientToken, 'GET', path(FOREIGN_CLIENT))).status);
    expect([403, 404]).toContain((await api(tokens['e2e-foreign'], 'GET', path(C))).status);
    expect([403, 404]).toContain((await api(tokens['e2e-recruiter'], 'GET', path(C))).status);
    expect((await fetch(ORIGIN + path(C))).status).toBe(401);
  });
});

describe('C1 consultation history', () => {
  it('lists the converted consultation with its confirmed appointment and is scoped to the client', async () => {
    const converted = (await api(mgrToken, 'GET', '/api/consultations/requests?status=CONVERTED')).body;
    expect((converted.items ?? converted).length, 'spec 12 converts one request first').toBeGreaterThan(0);
    const s = await sessionWithToken(clientToken, '/portal/dashboard#nav=appointments');
    const panel = s.page.getByRole('region', { name: 'Consultation history' });
    await panel.getByText('Tax planning').first().waitFor();
    const t = await panel.innerText();
    expect(t).toMatch(/Confirmed/);
    expect(t).not.toMatch(/prospect@example\.test|Synthetic Prospect/); // the visitor's contact details are not echoed
    expect([403, 404]).toContain((await api(clientToken, 'GET', `/api/client-portal/clients/${UNASSIGNED_CLIENT}/consultations`)).status);
    expect([403, 404]).toContain((await api(tokens['e2e-foreign'], 'GET', `/api/client-portal/clients/${C}/consultations`)).status);
    expect((await api(clientToken, 'GET', `/api/client-portal/clients/${C}/consultations?after=not-a-cursor`)).status).toBe(400);
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });
});

describe('C5 consultation rooms', () => {
  let appointmentId = '';
  beforeAll(async () => {
    const start = new Date(Date.now() + 5 * 60_000);
    const created = await api(mgrToken, 'POST', `/api/scheduling/clients/${C}/appointments`, { title: 'Synthetic Phase 13A room', category: 'CONSULTATION', mode: 'REMOTE',
      startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 30 * 60_000).toISOString(), timezone: 'UTC', staffUid: 'e2e-acct',
      meetingUrl: 'https://meet.example.test/synthetic-13a', confirm: true });
    expect(created.status, JSON.stringify(created.body)).toBeLessThan(300);
    appointmentId = created.body.appointmentId;
  });
  it('the client joins an open room through the practice link; no video service is implied', async () => {
    const s = await sessionWithToken(clientToken, '/portal/dashboard#nav=appointments');
    await s.context.route('https://meet.example.test/**', r => r.fulfill({ status: 200, contentType: 'text/plain', body: 'synthetic meeting page' }));
    await s.page.getByRole('button', { name: /Synthetic Phase 13A room/ }).click();
    const room = s.page.getByRole('region', { name: 'Consultation room' });
    await room.getByText('The room is open.').waitFor();
    expect(await room.innerText()).toContain('TaxGuard does not provide or record the video call');
    const popup = s.context.waitForEvent('page');
    await room.getByRole('button', { name: 'Join and open meeting link' }).click();
    expect((await popup).url()).toBe('https://meet.example.test/synthetic-13a');
    await room.getByText('Your attendance was recorded.').waitFor();
    await room.getByRole('button', { name: 'Leave room' }).click();
    await room.getByText('Your departure was recorded.').waitFor();
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });
  it('lets the host in and refuses other staff, other tenants, unauthorized roles and guessed ids', async () => {
    const room = (client: string, id = appointmentId) => `/api/scheduling/clients/${client}/appointments/${id}/room`;
    const host = await api(tokens['e2e-acct'], 'GET', room(C));
    expect(host.body).toMatchObject({ participant: 'HOST', roomState: 'OPEN', videoProvider: 'NOT_COMMISSIONED' });
    for (const who of ['e2e-bk', 'e2e-recruiter', 'e2e-foreign']) {
      const r = await api(tokens[who], 'GET', room(C));
      expect([403, 404], who).toContain(r.status);
      expect(JSON.stringify(r.body)).not.toContain('meet.example.test');
      expect([403, 404], who).toContain((await api(tokens[who], 'POST', room(C) + '/join')).status);
    }
    expect([403, 404]).toContain((await api(clientToken, 'GET', room(UNASSIGNED_CLIENT))).status);
    expect((await api(clientToken, 'GET', room(C, 'apt_' + 'f'.repeat(32)))).status).toBe(404);
  });
});

describe('C6 notification preferences', () => {
  it('turns reminders off and on, keeps required notices locked and offers no e-mail or SMS', async () => {
    const s = await sessionWithToken(clientToken, '/portal/dashboard#nav=notifications');
    const prefs = s.page.getByRole('region', { name: 'Notification preferences' });
    const reminders = prefs.getByRole('checkbox', { name: /Reminders/ });
    await reminders.waitFor();
    expect(await prefs.getByRole('checkbox', { name: /Document requests/ }).isDisabled()).toBe(true);
    expect(await prefs.getByRole('checkbox', { name: /Account security and legal notices/ }).isDisabled()).toBe(true);
    expect(await prefs.innerText()).toMatch(/E-mail: not offered/);
    expect(await prefs.innerText()).toMatch(/Text message: not offered/);
    if (!(await reminders.isChecked())) { await reminders.click(); await prefs.getByText('Reminders will be shown.').waitFor(); }
    // The checkbox reflects the server's answer, so click and wait for the confirmation.
    await reminders.click();
    await prefs.getByText('Reminders are hidden.').waitFor();
    await s.page.reload();
    await prefs.getByRole('checkbox', { name: /Reminders/ }).waitFor();
    expect(await prefs.getByRole('checkbox', { name: /Reminders/ }).isChecked()).toBe(false);
    await prefs.getByRole('checkbox', { name: /Reminders/ }).click();
    await prefs.getByText('Reminders will be shown.').waitFor();
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });
  it('lets only the client user read or change preferences', async () => {
    const path = (client: string) => `/api/vault/clients/${client}/notification-preferences`;
    for (const who of ['e2e-mgr', 'e2e-acct', 'e2e-foreign']) expect([403, 404], who).toContain((await api(who === 'e2e-mgr' ? mgrToken : tokens[who], 'GET', path(C))).status);
    expect([403, 404]).toContain((await api(clientToken, 'GET', path(UNASSIGNED_CLIENT))).status);
    expect((await api(clientToken, 'POST', path(C), { category: 'DOCUMENT_REQUESTS', enabled: false, version: 0 })).body.code).toBe('NOTIFICATION_CATEGORY_MANDATORY');
    expect((await api(clientToken, 'POST', path(C), { category: 'DOCUMENT_REMINDERS', channel: 'EMAIL', enabled: true, version: 0 })).body.code).toBe('NOTIFICATION_CHANNEL_UNAVAILABLE');
  });
});

describe('C7 live commissioning records', () => {
  it('fails closed outside a configured governance database and never reports an agent as commissioned', async () => {
    const r = await api(tokens['e2e-admin'], 'GET', '/api/ai-governance/control-center/commissioning');
    expect([403, 503]).toContain(r.status);
    expect([403, 503]).toContain((await api(tokens['e2e-admin'], 'GET', '/api/ai-governance/control-center/evaluations')).status);
    const s = await staffLogin('e2e-admin');
    await s.page.getByRole('button', { name: /AI Control Center/ }).first().click();
    await s.page.getByRole('tab', { name: 'Commissioning readiness' }).click();
    const live = s.page.getByRole('region', { name: 'Live governance records' });
    await live.getByRole('alert').waitFor();
    const t = await live.innerText();
    expect(t).toMatch(/unavailable|governance roles only/);
    expect(t).toContain('Nothing here starts, enables, approves or commissions an agent.');
    expect(await live.getByRole('button', { name: /enable|approve|activate|commission/i }).count()).toBe(0);
    const view = await s.page.getByTestId('ai-commissioning-view').innerText();
    expect(view).toMatch(/Production commissioned\s*0 \/ 61/);
    expect(view).toContain('AI-16 material-action approval');
    await s.context.close();
  });
});

describe('C2 client MFA and C8 contact intake', () => {
  it('shows MFA status without enabling enrolment', async () => {
    const s = await sessionWithToken(clientToken, '/portal/dashboard#nav=security');
    await s.page.getByRole('button', { name: 'MFA & Credentials' }).click();
    const panel = s.page.getByRole('region', { name: 'MFA & Credentials' });
    await panel.getByText('Adding an authenticator is not available yet.').waitFor();
    expect(await panel.getByRole('button', { name: 'Add authenticator (unavailable)' }).isDisabled()).toBe(true);
    expect(await panel.locator('input').count()).toBe(0);
    // Local (non-provider) session: the page says the status cannot be shown instead of guessing.
    await panel.getByText(/cannot be shown|did not report|This sign-in/).first().waitFor();
    expect(await panel.innerText()).not.toMatch(/used an authenticator/);
    await s.context.close();
  });
  it('keeps server contact intake disabled and the contact page never submits to it', async () => {
    const r = await fetch(ORIGIN + '/api/public/contact', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'e2e-contact-0001' },
      body: JSON.stringify({ fullName: 'Synthetic Visitor', email: 'visitor@example.test', topic: 'OTHER', message: 'Synthetic contact message for E2E.', consent: true, consentVersion: 'x' }) });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ code: 'CONTACT_INTAKE_DISABLED' });
    const s = await newSession();
    await s.page.goto(ORIGIN + '/contact', { waitUntil: 'domcontentloaded' });
    await sees(s.page, /Open in my e-mail app/);
    expect(s.api.filter(a => a.path.startsWith('/api/public/contact'))).toEqual([]);
    expect(await body(s)).not.toMatch(/Message (sent|delivered|received by)|We received your message/);
    await s.context.close();
  });
});

describe('no unapproved tax calculations or enabled filing', () => {
  it('client stages 09-18 and the preparer workspace show no figures and no enabled filing control', async () => {
    const s = await sessionWithToken(clientToken, '/portal/dashboard#nav=stage_09');
    for (const n of [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]) {
      await s.page.goto(ORIGIN + '/portal/dashboard#nav=stage_' + String(n).padStart(2, '0')); await s.page.reload();
      await sees(s.page, 'This stage is not available.');
      expect(await body(s), 'stage ' + n).not.toMatch(UNAPPROVED);
      await filingControlsDisabled(s);
    }
    await s.context.close();
    const staff = await staffLogin('e2e-acct');
    await sees(staff.page, 'Case Workflow');
    await filingControlsDisabled(staff);
    expect(await body(staff)).not.toMatch(/Return (filed|transmitted|accepted)|IRS Accepted|E-?filed/);
    await staff.context.close();
  });
});
