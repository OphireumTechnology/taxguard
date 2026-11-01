import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { Page } from 'playwright-core';
import { api, apiLogin, C, closeBrowser, dumpOnFailure, ensureStaffed, openModule, realErrors, sees, sessionWithToken, staffLogin } from './helpers';

// Phase 4 in the browser: every durable dashboard figure shown to a role equals what the server
// computes from recorded rows for that same signed-in user. Synthetic data only.
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(async () => { await closeBrowser(); });
const tile = async (page: Page, region: string, label: string) =>
  (await page.locator(`[aria-label="${region}"] li`, { has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) }).locator('strong').innerText()).trim();
const token = (page: Page) => page.evaluate(() => localStorage.getItem('artax_session_token')) as Promise<string>;

describe('durable role dashboards', () => {
  it.each([['e2e-acct', 'My durable work queue'], ['e2e-rev', 'My durable review queue']])('%s sees their own durable work queue with server-matching counts', async (id, heading) => {
    const s = await staffLogin(id);
    await sees(s.page, heading);
    await s.page.locator('[aria-label="Work queue counts"]').waitFor();
    const w = (await api(await token(s.page), 'GET', '/api/practice/my-work')).body;
    expect(await tile(s.page, 'Work queue counts', 'Cases awaiting me')).toBe(String(w.cases.filter((c: any) => c.awaitingMe).length));
    expect(await tile(s.page, 'Work queue counts', 'Documents to review')).toBe(String(w.documentsToReview.length));
    expect(await tile(s.page, 'Work queue counts', 'Requests outstanding')).toBe(String(w.requestsOutstanding.length));
    expect(await tile(s.page, 'Work queue counts', 'Entries to review')).toBe(String(w.entriesAwaitingMyReview.length));
    for (const c of w.cases) await s.page.getByRole('row', { name: new RegExp(`${c.taxYear}.*${String(c.activeStage).padStart(2, '0')}`) }).first().waitFor();
    if (w.cases.some((c: any) => c.evidence === 'BLOCKED')) await sees(s.page, 'Blocked until a verified tax engine exists');
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });

  it('practice operations show the server\'s workload, notifications and search for the signed-in staff member', async () => {
    const s = await staffLogin('e2e-acct');
    await sees(s.page, 'Practice operations');
    await s.page.locator('[aria-label="Workload counts"]').waitFor();
    const t = await token(s.page);
    const [w, n, d] = await Promise.all([api(t, 'GET', '/api/practice/workload'), api(t, 'GET', '/api/practice/notifications'),
      api(t, 'GET', '/api/practice/deadline-escalations?minLevel=2')]);
    expect(await tile(s.page, 'Workload counts', 'Open tasks')).toBe(String(w.body.openTasks));
    expect(await tile(s.page, 'Workload counts', 'Overdue tasks')).toBe(String(w.body.overdueTasks));
    expect(await tile(s.page, 'Workload counts', 'Assigned clients')).toBe(String(w.body.assignedClients));
    expect((await s.page.getByLabel('Unread notifications').innerText()).trim()).toBe(`(${n.body.unread} unread)`);
    for (const x of d.body.deadlines) await sees(s.page, x.title);
    if (d.body.deadlines.length === 0) await sees(s.page, 'No deadline in your scope is due within');
    const found = (await api(t, 'GET', `/api/practice/search?q=${encodeURIComponent(C)}`)).body;
    await s.page.getByLabel('Search clients, cases, tasks and document requests').fill(C);
    await s.page.getByRole('button', { name: 'Search', exact: true }).click();
    if (found.matches.length === 0) await sees(s.page, 'No records you may see match');
    else for (const m of found.matches) await s.page.locator('[aria-label="Search results"] li', { hasText: m.label }).first().waitFor();
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });

  it('the practice manager sees the recorded practice summary', async () => {
    const s = await staffLogin('e2e-mgr');
    await ensureStaffed(await token(s.page));
    await s.page.reload();
    await sees(s.page, 'Durable practice summary');
    await s.page.locator('[aria-label="Recorded practice figures"]').waitFor();
    const sum = (await api(await token(s.page), 'GET', '/api/practice/summary')).body;
    const active = sum.casesByStage.reduce((n: number, x: any) => n + x.active, 0);
    expect(await tile(s.page, 'Recorded practice figures', 'Active cases')).toBe(String(active));
    expect(await tile(s.page, 'Recorded practice figures', 'Active clients')).toBe(String(sum.activeClients));
    expect(await tile(s.page, 'Recorded practice figures', 'Documents awaiting review')).toBe(String(sum.documentsAwaitingReview));
    expect(await tile(s.page, 'Recorded practice figures', 'Open invoices')).toBe(String(sum.receivables.openInvoices));
    expect(await tile(s.page, 'Recorded practice figures', 'Balance due')).toBe('$' + sum.receivables.balanceDue);
    expect(await tile(s.page, 'Recorded practice figures', 'Document requests outstanding')).toBe(String(sum.documentRequests.open + sum.documentRequests.submitted));
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });

  it('the practice manager and the administrator see the recorded team workload and deadline escalation', async () => {
    const s = await staffLogin('e2e-mgr');
    const t = await token(s.page);
    const summary = (await api(t, 'GET', '/api/practice/summary')).body;
    await openModule(s.page, 'Team Capacity');
    const team = s.page.getByRole('table', { name: 'Team workload' });
    if (summary.staffCaseCounts.length === 0) await sees(s.page, 'No staff member holds an active case.');
    else await team.waitFor();
    for (const { userId } of summary.staffCaseCounts.slice(0, 25)) {
      const w = (await api(t, 'GET', `/api/practice/workload?userId=${encodeURIComponent(userId)}`)).body;
      const cells = await team.getByRole('row', { name: new RegExp(`^${userId}\\b`) }).locator('td').allInnerTexts();
      expect(cells.slice(0, 3).map(c => c.trim())).toEqual([w.role, String(w.openTasks), String(w.overdueTasks)]);
    }
    await openModule(s.page, 'SLA & Escalations');
    await s.page.locator('[aria-label="Open deadlines by level"]').waitFor();
    const d = (await api(t, 'GET', '/api/practice/deadline-escalations?minLevel=1')).body;
    for (const [label, key] of [['Critical', 'CRITICAL'], ['Overdue', 'OVERDUE'], ['Due soon', 'DUE_SOON'], ['Approaching', 'APPROACHING']])
      expect(await tile(s.page, 'Open deadlines by level', label)).toBe(String(d.counts[key]));
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
    const admin = await staffLogin('e2e-admin');
    await openModule(admin.page, 'Caseload & Tasks');
    const adminTeam = admin.page.getByRole('table', { name: 'Team workload' });
    if (summary.staffCaseCounts.length === 0) await sees(admin.page, 'No staff member holds an active case.');
    else await adminTeam.waitFor();
    for (const { userId } of summary.staffCaseCounts.slice(0, 25)) await adminTeam.getByRole('row', { name: new RegExp(`^${userId}\\b`) }).waitFor();
    expect(realErrors(admin)).toEqual([]);
    await admin.context.close();
  });

  it('the bookkeeper\'s existing panels read the durable ledger', async () => {
    const s = await staffLogin('e2e-bk');
    await s.page.getByLabel('Authorized client').selectOption(C);
    await s.page.getByLabel('Tax year (2022+)').fill('2025');
    const dash = (await api(await token(s.page), 'GET', `/api/bookkeeping/bookkeeper-dashboard?clientId=${C}&taxYear=2025`)).body;
    expect(dash.provider).toBe('DURABLE_LEDGER');
    const records = s.page.locator('.tg-book-kpis button', { has: s.page.locator('span', { hasText: 'Transactions / Records' }) }).locator('strong');
    await s.page.waitForFunction(([sel, v]) => document.querySelector(sel as string)?.textContent?.includes(v as string), ['.tg-book-kpis button strong', String(dash.transactions.length)]);
    expect((await records.innerText()).trim()).toBe(String(dash.transactions.length));
    await openModule(s.page, 'Transactions');
    for (const t of dash.transactions) await sees(s.page, t.description);
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });

  it('the client sees their own status from their documents, requests, invoices and notices', async () => {
    const clientToken = await apiLogin('e2e-client');
    const s = await sessionWithToken(clientToken, '/portal/documents');
    await sees(s.page, 'Your status');
    const [docs, reqs, notes] = await Promise.all([api(clientToken, 'GET', `/api/vault/clients/${C}/documents`), api(clientToken, 'GET', `/api/vault/clients/${C}/requests`),
      api(clientToken, 'GET', `/api/vault/clients/${C}/notifications`)]);
    const status = s.page.locator('section[aria-labelledby="client-status-heading"]');
    const value = async (label: string) => (await status.locator('li', { has: s.page.locator('span', { hasText: new RegExp(`^${label}$`) }) }).locator('strong').innerText()).trim();
    expect(await value('Accepted')).toBe(String(docs.body.items.filter((d: any) => d.status === 'VERIFIED').length));
    expect(await value('Documents still needed')).toBe(String(reqs.body.items.filter((q: any) => q.status === 'OPEN').length));
    expect(await value('Unread notices')).toBe(String(notes.body.unread));
    expect(await status.innerText()).not.toMatch(/Synthetic Foreign|Unassigned/);
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });
});
