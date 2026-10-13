import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { api, apiLogin, C, closeBrowser, dumpOnFailure, ensureStaffed, openModule, realErrors, sees, selectByText, staffLogin, type Session } from './helpers';

// Bookkeeping and reconciliation in the bookkeeper's Ledger Workspace with independent review,
// book-to-tax mapping and workpapers, and the case workflow through stages 1-8 (9-18 blocked).
// Real UI and server; synthetic data only.
let tokens: Record<string, string> = {};
let engagementId = '';
let bk: Session;
let acct: Record<string, string> = {};
const Y = 2025;
const ledger = (who: string, method: string, path: string, body: Record<string, unknown> = {}) =>
  method === 'GET' ? api(tokens[who], 'GET', `/api/bookkeeping${path}${path.includes('?') ? '&' : '?'}clientId=${C}&taxYear=${Y}`)
    : api(tokens[who], 'POST', `/api/bookkeeping${path}`, { clientId: C, taxYear: Y, ...body });
const approveAllPrepared = async () => {
  const prepared = (await ledger('rev', 'GET', '/journal-entries?status=PREPARED')).body.entries;
  for (const e of prepared) expect((await ledger('rev', 'POST', `/journal-entries/${e.id}/approve`, { version: e.version })).body.entry.status).toBe('POSTED');
  return prepared.length;
};

beforeAll(async () => {
  for (const [k, id] of [['mgr', 'e2e-mgr'], ['acct', 'e2e-acct'], ['rev', 'e2e-rev'], ['admin', 'e2e-admin']]) tokens[k] = await apiLogin(id);
  engagementId = await ensureStaffed(tokens.mgr);
  bk = await staffLogin('e2e-bk');
  tokens.bk = (await bk.page.evaluate(() => localStorage.getItem('artax_session_token')))!;
});
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(async () => { await closeBrowser(); });

describe('bookkeeping in the Ledger Workspace (bookkeeper UI)', () => {
  it('prepares a balanced entry that waits for an independent reviewer before it posts', async () => {
    const chart = await ledger('bk', 'POST', '/chart-of-accounts/standard');
    expect(chart.status).toBeLessThan(300);
    acct = Object.fromEntries(chart.body.accounts.map((a: any) => [a.accountNumber, a.id]));
    const { page } = bk;
    await openModule(page, 'Ledger Workspace');
    await page.getByLabel('Authorized client').selectOption(C);
    await page.getByLabel('Tax year (2022+)').fill(String(Y));
    await sees(page, `Ledger workspace — ${C} / ${Y}`);
    await sees(page, 'held for independent review');
    const form = page.locator('form', { has: page.getByRole('button', { name: 'Submit entry for review' }) });
    await form.getByLabel('Posting date').fill(`${Y}-03-15`);
    await form.getByLabel('Description').fill('Synthetic owner contribution');
    const lines = form.locator('fieldset');
    await selectByText(lines.nth(0).getByLabel('Account'), '1010');
    await lines.nth(0).getByLabel('Debit', { exact: true }).fill('1000');
    await selectByText(lines.nth(1).getByLabel('Account'), '3010');
    await lines.nth(1).getByLabel('Credit', { exact: true }).fill('1000');
    await sees(page, /Debits \$1000\.00 · Credits \$1000\.00 · balanced/);
    await form.getByRole('button', { name: 'Submit entry for review' }).click();
    await sees(page, 'Entry submitted for review.');
    await sees(page, '1 entry awaiting reviewer approval');
    // Nothing posts before review; the bookkeeper cannot approve.
    expect((await ledger('bk', 'GET', '/trial-balance')).body.trialBalance.totalPeriodDebit).toBe(0);
    const pending = (await ledger('rev', 'GET', '/journal-entries?status=PREPARED')).body.entries[0];
    expect((await ledger('bk', 'POST', `/journal-entries/${pending.id}/approve`, { version: pending.version })).status).toBe(403);
    expect(await approveAllPrepared()).toBe(1);
    await page.getByLabel('Tax year (2022+)').fill(String(Y)); // refresh
    await page.reload(); await openModule(page, 'Ledger Workspace');
    await page.getByLabel('Authorized client').selectOption(C);
    await page.getByLabel('Tax year (2022+)').fill(String(Y));
    await sees(page, /Trial balance balanced · net income \$0\.00 · total assets \$1000\.00/);
    expect(realErrors(bk)).toEqual([]);
  });

  it('categorizes a bank transaction for review and reconciles the account to zero variance', async () => {
    await ledger('bk', 'POST', '/transactions/ingest', { accountId: acct['1010'], rawTransactions: [{ transactionDate: `${Y}-03-20`, description: 'Synthetic office supplies', amount: -42.5, externalTransactionId: 'e2e-txn-1' }] });
    const { page } = bk;
    await page.reload(); await openModule(page, 'Ledger Workspace');
    await page.getByLabel('Authorized client').selectOption(C);
    await page.getByLabel('Tax year (2022+)').fill(String(Y));
    await selectByText(page.getByLabel('Account for Synthetic office supplies'), '6070');
    await page.getByRole('row', { name: /Synthetic office supplies/ }).getByRole('button', { name: 'Submit' }).click();
    await sees(page, 'Categorization submitted for review.');
    expect(await approveAllPrepared()).toBe(1);
    const recon = page.locator('form', { has: page.getByRole('button', { name: 'Start reconciliation' }) });
    await selectByText(recon.getByLabel('Account'), '1010');
    await recon.getByLabel('Statement start').fill(`${Y}-03-01`);
    await recon.getByLabel('Statement end').fill(`${Y}-03-31`);
    await recon.getByLabel('Beginning balance').fill('0');
    await recon.getByLabel('Ending balance').fill('-42.50');
    await recon.getByRole('button', { name: 'Start reconciliation' }).click();
    await sees(page, 'Reconciliation started.');
    const r = (await ledger('bk', 'GET', '/reconciliations')).body.reconciliations.find((x: any) => x.status !== 'CLOSED');
    const txn = (await ledger('bk', 'GET', '/transactions')).body.transactions.find((t: any) => t.description === 'Synthetic office supplies');
    expect((await ledger('bk', 'POST', `/reconciliations/${r.id}/clear`, { transactionId: txn.id, isCleared: true })).status).toBeLessThan(300);
    await page.reload(); await openModule(page, 'Ledger Workspace');
    await page.getByLabel('Authorized client').selectOption(C);
    await page.getByLabel('Tax year (2022+)').fill(String(Y));
    await page.getByRole('button', { name: 'Finalize' }).click();
    await sees(page, 'Reconciliation finalized.');
    expect((await ledger('bk', 'GET', '/reconciliations')).body.reconciliations.map((x: any) => x.status)).toEqual(['CLOSED']);
    expect(realErrors(bk)).toEqual([]);
  });
});

describe('book-to-tax mapping and workpaper (maker-checker)', () => {
  it('maps every balance, has the reviewer approve, and produces a reconciled approved workpaper', async () => {
    const b2t = (who: string, method: string, path: string, body?: unknown) => api(tokens[who], method, '/api/book-to-tax' + path, body);
    for (const [code, label] of [['CASH', 'Cash (synthetic)'], ['OWNER_EQUITY', 'Owner equity (synthetic)'], ['SUPPLIES', 'Supplies (synthetic)']])
      expect((await b2t('admin', 'POST', '/categories', { returnFamily: '1040', categoryCode: code, label })).status).toBe(200);
    const set = (await b2t('acct', 'POST', `/clients/${C}/${Y}/1040/mapping-sets`)).body;
    for (const [num, cat] of [['1010', 'CASH'], ['3010', 'OWNER_EQUITY'], ['6070', 'SUPPLIES']])
      expect((await b2t('acct', 'POST', `/clients/${C}/mapping-sets/${set.setId}/mappings`, { accountId: acct[num], categoryCode: cat })).status).toBeLessThan(300);
    await b2t('acct', 'POST', `/clients/${C}/mapping-sets/${set.setId}/submit`);
    expect((await b2t('acct', 'POST', `/clients/${C}/mapping-sets/${set.setId}/approve`)).body.code).toBe('B2T_REVIEWER_REQUIRED');
    expect((await b2t('rev', 'POST', `/clients/${C}/mapping-sets/${set.setId}/approve`)).status).toBe(200);
    const wp = await b2t('acct', 'POST', `/clients/${C}/${Y}/1040/workpapers`);
    expect(wp.body).toMatchObject({ reconciled: true });
    expect((await b2t('rev', 'POST', `/clients/${C}/workpapers/${wp.body.workpaperId}/approve`)).body.status).toBe('APPROVED');
  });
});

describe('case workflow stages 1-8 (stages 9-18 blocked)', () => {
  it('advances with system-verified and reviewer-attested evidence and shows the result to the manager', async () => {
    const cases = (who: string, method: string, path: string, body?: unknown, key?: string) => api(tokens[who], method, '/api/cases' + path, body, key);
    const created = await cases('mgr', 'POST', '', { clientId: C, engagementId, taxYear: Y, returnFamily: '1040' }, 'e2e-case-1');
    expect(created.status).toBe(201);
    const caseId = created.body.caseId;
    let version = (await cases('mgr', 'GET', '/' + caseId)).body.case.version;
    const attest = (confirmed: string[]) => ({ confirmed, statement: 'Synthetic reviewer attestation for E2E testing only.' });
    const advance = async (who: string, fromStage: number, attestation?: unknown) => {
      const r = await cases(who, 'POST', `/${caseId}/advance`, { fromStage, version, attestation });
      if (r.status === 200) version = r.body.version;
      return r;
    };
    expect((await advance('acct', 1)).body.activeStage).toBe(2);
    expect((await advance('acct', 2, attest(['documents_received_or_waived', 'documents_in_private_storage']))).status).toBeGreaterThanOrEqual(400); // preparer cannot attest
    expect((await advance('rev', 2, attest(['documents_received_or_waived', 'documents_in_private_storage']))).body.activeStage).toBe(3);
    expect((await advance('rev', 3, attest(['documents_reviewed_for_completeness', 'discrepancies_recorded_or_resolved']))).body.activeStage).toBe(4);
    expect((await advance('acct', 4)).body.activeStage).toBe(5); // posted entries, none awaiting review
    expect((await advance('acct', 5)).body.activeStage).toBe(6); // closed reconciliation, every bank transaction posted
    expect((await advance('rev', 6, attest(['workpapers_reviewed', 'no_unresolved_blocking_exceptions']))).body.activeStage).toBe(7);
    expect((await advance('rev', 7, attest(['reports_reviewed_for_release']))).body.activeStage).toBe(8);
    expect((await advance('rev', 8, attest(['planning_considerations_documented']))).body.activeStage).toBe(9);
    const blocked = await advance('rev', 9, attest([]));
    expect(blocked.status).toBe(409); expect(blocked.body.code).toBe('STAGE_BLOCKED_VERIFIED_TAX_ENGINE_REQUIRED');
    const detail = (await cases('mgr', 'GET', '/' + caseId)).body;
    expect(detail.stages.filter((s: any) => s.status === 'COMPLETED')).toHaveLength(8);
    // The manager sees the case at stage 9 in the Case Workflow module.
    const mgr = await staffLogin('e2e-mgr');
    await openModule(mgr.page, 'Case Workflow');
    await mgr.page.getByRole('button', { name: caseId.slice(0, 16) }).click();
    await sees(mgr.page, /· ACTIVE/);
    expect(await mgr.page.locator('body').innerText()).toMatch(/9/);
    expect(realErrors(mgr)).toEqual([]);
  });
});
