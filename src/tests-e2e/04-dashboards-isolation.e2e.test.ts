import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { api, apiLogin, C, closeBrowser, dumpOnFailure, FOREIGN_CLIENT, openModule, realErrors, sees, sessionWithToken, staffLogin, UNASSIGNED_CLIENT } from './helpers';

// Each role lands on its own workspace with only its own modules, and every cross-tenant,
// cross-client and unassigned access is refused by the real server. Synthetic data only.
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(async () => { await closeBrowser(); });
const body = (s: { page: { locator(q: string): { innerText(): Promise<string> } } }) => s.page.locator('body').innerText();

describe('role dashboards', () => {
  it.each([
    ['e2e-admin', 'Administrator', ['Practice Staff & Roles', 'Compliance Audit Log'], ['Ledger Workspace']],
    ['e2e-mgr', 'Practice Manager Dashboard', ['Clients & Engagements', 'Case Workflow', 'Document Review', 'Billing'], ['Ledger Workspace', 'Compliance Audit Log']],
    ['e2e-bk', 'Bookkeeper Dashboard', ['Ledger Workspace', 'Reconciliation', 'Chart of Accounts'], ['Billing', 'Case Workflow', 'Practice Staff & Roles']],
    ['e2e-acct', 'Accountant Dashboard', ['My Cases', 'Document Review'], ['Ledger Workspace', 'Practice Staff & Roles']],
    ['e2e-rev', 'Review Center', ['MY REVIEW QUEUE', 'Approval'], ['Ledger Workspace', 'Practice Staff & Roles']],
  ])('%s sees its own workspace (%s) and no other role\'s modules', async (id, heading, present, absent) => {
    const s = await staffLogin(id);
    await sees(s.page, heading);
    const text = await body(s);
    for (const p of present) expect(text, p).toContain(p);
    for (const a of absent) expect(text, a).not.toContain(a);
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });

  it('the client portal shows the client\'s own documents and invoices only', async () => {
    const token = await apiLogin('e2e-client');
    const s = await sessionWithToken(token, '/portal/documents');
    await sees(s.page, 'Client Tax Center');
    await sees(s.page, 'Secure document upload');
    await sees(s.page, 'Invoices');
    expect(await body(s)).not.toMatch(/Synthetic Foreign Client|Synthetic Unassigned Client/);
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });

  it('a recruiter signs in but reaches no tax, document, ledger or billing data', async () => {
    const token = await apiLogin('e2e-recruiter');
    for (const path of [`/api/practice/clients/${C}`, `/api/vault/clients/${C}/documents`, `/api/billing/clients/${C}/invoices`, '/api/cases', `/api/bookkeeping/work-queue?clientId=${C}&taxYear=2025`])
      expect((await api(token, 'GET', path)).status, path).toBeGreaterThanOrEqual(400);
  });
});

describe('cross-tenant and cross-client refusals', () => {
  it('a manager of another tenant sees only their own tenant in the UI and reaches nothing of this tenant', async () => {
    const s = await staffLogin('e2e-foreign');
    await openModule(s.page, 'Clients & Engagements');
    await sees(s.page, 'Synthetic Foreign Client');
    expect(await body(s)).not.toMatch(/Synthetic Client One|Synthetic Unassigned Client/);
    const token = (await s.page.evaluate(() => localStorage.getItem('artax_session_token')))!;
    const caseList = (await api(token, 'GET', '/api/cases')).body;
    expect(JSON.stringify(caseList)).not.toContain(C);
    for (const [method, path, payload] of [
      ['GET', `/api/practice/clients/${C}`], ['POST', `/api/practice/clients/${C}/notes`, { body: 'Cross-tenant attempt' }],
      ['GET', `/api/vault/clients/${C}/documents`], ['GET', `/api/billing/clients/${C}/invoices`],
      ['POST', `/api/billing/clients/${C}/invoices`, { dueDate: '2026-12-31' }],
      ['POST', '/api/cases', { clientId: C, engagementId: 'x', taxYear: 2025, returnFamily: '1040' }],
    ] as Array<[string, string, unknown?]>) {
      const r = await api(token, method, path, payload);
      expect([403, 404], `${method} ${path} -> ${r.status} ${r.body?.code}`).toContain(r.status);
    }
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });

  it('this tenant\'s manager cannot reach the other tenant\'s client', async () => {
    const token = await apiLogin('e2e-mgr');
    for (const path of [`/api/practice/clients/${FOREIGN_CLIENT}`, `/api/vault/clients/${FOREIGN_CLIENT}/documents`, `/api/billing/clients/${FOREIGN_CLIENT}/invoices`])
      expect([403, 404], path).toContain((await api(token, 'GET', path)).status);
    expect(JSON.stringify((await api(token, 'GET', '/api/practice/clients')).body)).not.toContain(FOREIGN_CLIENT);
  });

  it('a client cannot reach another client, and unassigned staff cannot reach an unassigned client', async () => {
    const client = await apiLogin('e2e-client');
    for (const path of [`/api/vault/clients/${UNASSIGNED_CLIENT}/documents`, `/api/billing/clients/${UNASSIGNED_CLIENT}/invoices`, `/api/practice/clients/${C}`, '/api/vault/review-queue'])
      expect([401, 403, 404], path).toContain((await api(client, 'GET', path)).status);
    const acct = await apiLogin('e2e-acct');
    for (const path of [`/api/practice/clients/${UNASSIGNED_CLIENT}`, `/api/vault/clients/${UNASSIGNED_CLIENT}/documents`, `/api/bookkeeping/work-queue?clientId=${UNASSIGNED_CLIENT}&taxYear=2025`])
      expect([403, 404], path).toContain((await api(acct, 'GET', path)).status);
    const bk = await apiLogin('e2e-bk');
    const scope = await api(bk, 'GET', `/api/bookkeeping/work-queue?clientId=${UNASSIGNED_CLIENT}&taxYear=2025`);
    expect(scope.status).toBe(403); expect(scope.body.code).toBe('BOOKKEEPER_SCOPE_DENIED');
    expect((await api(bk, 'POST', `/api/bookkeeping/journal-entries/x/approve`, { clientId: C, taxYear: 2025, version: 1 })).status).toBe(403);
  });
});
