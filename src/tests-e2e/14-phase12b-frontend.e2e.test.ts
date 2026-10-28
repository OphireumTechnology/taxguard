import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { api, apiLogin, C, closeBrowser, dumpOnFailure, ensureStaffed, newSession, ORIGIN, realErrors, sees, sessionWithToken, staffLogin, type Session } from './helpers';

// Phase 12B frontend completion: real navigation against the loopback server with synthetic users.
// Client portal truthfulness (blocked stages, durable Stage 02, notifications, refresh), staff
// workspaces, the AI commissioning view, honest public forms, responsive layout and session isolation.
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(async () => { await closeBrowser(); });
const body = (s: Session) => s.page.locator('body').innerText();
const FABRICATED = /Filing Integrity|100% Certified|Elena Rostova|Payment Confirmed|Message Transmitted|IRS Accepted|Return Filed|Clean Regulatory Standing|Cleared & Certified/;
const dialogs = (s: Session) => { const seen: string[] = []; s.page.on('dialog', d => { seen.push(d.type()); void d.dismiss(); }); return seen; };
const noPageOverflow = (s: Session) => s.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

describe('client portal', () => {
  it('shows durable notifications created by the practice, marks one read, and keeps the view after a refresh', async () => {
    const mgr = await apiLogin('e2e-mgr');
    const engagementId = await ensureStaffed(mgr);
    const title = 'Synthetic Phase 12B request ' + Date.now();
    const created = await api(mgr, 'POST', `/api/vault/clients/${C}/requests`, { engagementId, taxYear: 2025, title, category: 'income', required: true });
    expect(created.status).toBeLessThan(300);
    const s = await sessionWithToken(await apiLogin('e2e-client'), '/portal/dashboard');
    const seen = dialogs(s);
    await s.page.getByRole('navigation', { name: 'Client portal' }).getByRole('button', { name: 'Notifications', exact: true }).click();
    await sees(s.page, title);
    expect(new URL(s.page.url()).hash).toBe('#nav=notifications');
    const markRead = s.page.getByRole('button', { name: new RegExp('Mark ".*' + title + '.*" as read') });
    await markRead.first().click();
    await s.page.waitForTimeout(1000);
    await s.page.reload();
    await sees(s.page, title);
    expect(new URL(s.page.url()).hash).toBe('#nav=notifications');
    expect(await markRead.count()).toBe(0);
    expect(seen).toEqual([]);
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });

  it('presents stages 09-18 as unavailable without figures, signatures or filing claims', async () => {
    const s = await sessionWithToken(await apiLogin('e2e-client'), '/portal/dashboard#nav=stage_12');
    await sees(s.page, 'This stage is not available.');
    await sees(s.page, 'TaxGuard has not filed any return');
    for (const nav of ['stage_09', 'stage_11', 'stage_16']) {
      await s.page.goto(ORIGIN + '/portal/dashboard#nav=' + nav);
      await s.page.reload();
      await sees(s.page, 'This stage is not available.');
      expect(await body(s)).not.toMatch(FABRICATED);
    }
    const stageList = await s.page.getByText('Workflow (18 Stages)').count();
    expect(stageList).toBeGreaterThan(0);
    expect(await body(s)).not.toMatch(/\d{2} [A-Za-z ]+ \? (locked|active|completed)/);
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });

  it('uses the durable collection workspace, keeps Stage 02 honestly locked before the server opens it, and never calls retired or legacy APIs', async () => {
    const s = await sessionWithToken(await apiLogin('e2e-client'), '/portal/collection');
    const seen = dialogs(s);
    await sees(s.page, 'Document collection · 2025');
    // The synthetic client is at server Stage 01: Stage 02 must not open from browser-side hints.
    await s.page.goto(ORIGIN + '/portal/dashboard#nav=stage_02'); await s.page.reload();
    await sees(s.page, 'This stage is not available in the verified client tax-year workflow.');
    await s.page.goto(ORIGIN + '/portal/dashboard#nav=documents'); await s.page.reload();
    await sees(s.page, 'Secure document upload');
    expect(s.api.filter(r => /^\/api\/(documents|payments|engagements|messages|appointments|legal)(\/|\?|$)/.test(r.path))).toEqual([]);
    expect(await body(s)).not.toMatch(FABRICATED);
    expect(seen).toEqual([]);
    await s.context.close();
  });

  it('keeps the client portal within the viewport on a phone', async () => {
    const s = await newSession();
    await s.page.setViewportSize({ width: 375, height: 812 });
    await s.context.addInitScript(t => { localStorage.setItem('artax_session_token', t); localStorage.setItem('token', t); localStorage.setItem('taxguard_environment', 'local'); }, await apiLogin('e2e-client'));
    for (const nav of ['home', 'documents', 'notifications', 'stage_12']) {
      await s.page.goto(ORIGIN + '/portal/dashboard#nav=' + nav, { waitUntil: 'domcontentloaded' });
      await s.page.waitForTimeout(800);
      expect(await noPageOverflow(s), nav).toBe(true);
    }
    await s.context.close();
  });

  it('shows nothing from the previous session after the session token is removed', async () => {
    // Token placed once (no init script), so a reload cannot re-insert it.
    const s = await newSession();
    const token = await apiLogin('e2e-client');
    await s.page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
    await s.page.evaluate(t => { localStorage.setItem('artax_session_token', t); localStorage.setItem('token', t); localStorage.setItem('taxguard_environment', 'local'); }, token);
    await s.page.goto(ORIGIN + '/portal/dashboard#nav=notifications', { waitUntil: 'domcontentloaded' });
    await sees(s.page, 'Synthetic Phase 12B request');
    await s.page.evaluate(() => { for (const store of [localStorage, sessionStorage]) { store.removeItem('artax_session_token'); store.removeItem('token'); } });
    await s.context.clearCookies();
    await s.page.reload();
    await s.page.waitForTimeout(1500);
    const text = await body(s);
    expect(text).not.toContain('Synthetic Phase 12B request');
    expect(text).not.toContain('Document collection');
    await s.context.close();
  });
});

describe('staff workspaces', () => {
  it.each([['e2e-acct', 'Accountant Dashboard'], ['e2e-rev', 'Review Center']])('%s reaches the durable case workflow and document review panels', async (id, heading) => {
    const s = await staffLogin(id);
    await sees(s.page, heading);
    await sees(s.page, 'Case Workflow');
    await sees(s.page, 'Document Review');
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });

  it('the staff workspace stays within the viewport on a phone', async () => {
    const s = await staffLogin('e2e-acct');
    await s.page.setViewportSize({ width: 375, height: 812 });
    await s.page.reload();
    await sees(s.page, 'Case Workflow');
    expect(await noPageOverflow(s)).toBe(true);
    await s.context.close();
  });

  it('the administrator sees commissioning readiness with nothing commissioned', async () => {
    const s = await staffLogin('e2e-admin');
    await s.page.getByRole('button', { name: /AI Control Center/ }).first().click();
    await s.page.getByRole('tab', { name: 'Commissioning readiness' }).click();
    const view = s.page.getByTestId('ai-commissioning-view');
    await view.waitFor();
    const text = await view.innerText();
    expect(text).toContain('No agent is operational');
    expect(text).toMatch(/Production commissioned\s*0 \/ 61/);
    expect(text).toMatch(/Provider configured\s*0 \/ 61/);
    expect(text).toContain('AI-16 material-action approval');
    // Keyboard: arrow keys move between tabs.
    await s.page.getByRole('tab', { name: 'Commissioning readiness' }).press('ArrowRight');
    expect(await s.page.getByRole('tab', { name: 'Execution history' }).getAttribute('aria-selected')).toBe('true');
    await s.context.close();
  });
});

describe('public website', () => {
  it('plan selection takes no payment and collects no card details', async () => {
    const s = await newSession();
    await s.page.goto(ORIGIN + '/pricing', { waitUntil: 'domcontentloaded' });
    await s.page.getByRole('button', { name: /^Request / }).first().click();
    const dialog = s.page.getByRole('dialog');
    await dialog.waitFor();
    expect(await dialog.innerText()).toContain('Online payment is not available');
    expect(await dialog.locator('input').count()).toBe(0);
    await s.page.keyboard.press('Escape');
    expect(await s.page.getByRole('dialog').count()).toBe(0);
    expect(await body(s)).not.toMatch(/Payment Confirmed|4242|Michael Perotti/);
    await s.context.close();
  });

  it('the contact form does not claim delivery', async () => {
    const s = await newSession();
    await s.page.goto(ORIGIN + '/contact', { waitUntil: 'domcontentloaded' });
    await sees(s.page, /Open in my e-mail app/);
    expect(await body(s)).not.toMatch(/Message Transmitted|routed to Desmond Hinds/);
    expect(await s.page.locator('input[type=file]').count()).toBe(0);
    await s.context.close();
  });
});
