import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ORIGIN, api, apiLogin, C, FOREIGN_CLIENT, UNASSIGNED_CLIENT, closeBrowser, control, dumpOnFailure, ensureStaffed, openModule, realErrors, sees, selectByText, staffLogin, type Session } from './helpers';

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

/** Latest document versions for the engagement year that await a requested replacement. */
const requestedReplacements = async () => {
  const items: any[] = (await api(tokens.mgr, 'GET', `/api/vault/clients/${C}/documents`)).body.items;
  const latest = new Map<string, any>();
  for (const d of items) if ((latest.get(d.documentId)?.version ?? 0) < d.version) latest.set(d.documentId, d);
  return [...latest.values()].filter(d => d.status === 'REPLACEMENT_REQUESTED' && d.engagementId === engagementId && d.taxYear === Y);
};
const supplyReplacement = async (d: any) => {
  const query = new URLSearchParams({ engagementId: d.engagementId, taxYear: String(d.taxYear), category: d.category, fileName: 'synthetic-replacement.pdf', documentId: d.documentId });
  const uploaded = await fetch(ORIGIN + `/api/vault/clients/${C}/documents?` + query, { method: 'POST',
    headers: { Authorization: `Bearer ${tokens.client}`, 'Content-Type': 'application/pdf', 'Idempotency-Key': `e2e-replacement-${d.documentId}` },
    body: '%PDF-1.4\nSynthetic replacement only\n%%EOF' }).then(async r => ({ status: r.status, body: await r.json() as any }));
  expect(uploaded.status).toBe(201); expect(uploaded.body.version).toBe(d.version + 1);
  const c = control();
  expect((await fetch(c.origin + '/e2e/scan', { method: 'POST', headers: { apikey: c.key, 'content-type': 'application/json' },
    body: JSON.stringify({ tenant: 'tenantE2E', client: C, documentId: d.documentId, version: d.version + 1, result: 'CLEAN' }) })).status).toBe(200);
  const next = (await api(tokens.mgr, 'GET', `/api/vault/clients/${C}/documents/${d.documentId}`)).body.versions.find((v: any) => v.version === d.version + 1);
  expect(next.status).toBe('PENDING_REVIEW');
  const reviewed = await api(tokens.mgr, 'POST', `/api/vault/clients/${C}/documents/${d.documentId}/versions/${next.version}/review`, { decision: 'approve', rowVersion: next.rowVersion });
  expect(reviewed.body.status).toBe('VERIFIED');
};

beforeAll(async () => {
  for (const [k, id] of [['mgr', 'e2e-mgr'], ['acct', 'e2e-acct'], ['rev', 'e2e-rev'], ['admin', 'e2e-admin'], ['client', 'e2e-client']]) tokens[k] = await apiLogin(id);
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
    // Validate requires every requested replacement for the engagement year to have arrived and been
    // reviewed (proposal 20261018000000). Earlier suites may leave one outstanding: prove the gate holds,
    // then supply the replacement through the real vault (upload, CLEAN scan, staff review).
    const validate = () => advance('rev', 3, attest(['documents_reviewed_for_completeness', 'discrepancies_recorded_or_resolved']));
    const outstanding = await requestedReplacements();
    if (outstanding.length) {
      const blocked = await validate();
      expect(blocked.status).toBe(409);
      expect(blocked.body).toMatchObject({ code: 'STAGE_GATE_NOT_MET', failedChecks: expect.arrayContaining(['noOutstandingReplacementRequests']) });
      for (const d of outstanding) await supplyReplacement(d);
      expect(await requestedReplacements()).toEqual([]);
    }
    expect((await validate()).body.activeStage).toBe(4);
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

describe('the bookkeeper ledger workspace never shows a previous scope', () => {
  it('discards slower responses for the previously selected tax year', async () => {
    // The bookkeeper is staffed for 2025 only. Every 2025 ledger request is delayed past the switch to 2026, which the
    // server refuses at once; the late 2025 responses must not appear under the 2026 heading.
    const s = await staffLogin('e2e-bk');
    const { page } = s;
    const slow2025 = (url: URL) => url.pathname.startsWith('/api/bookkeeping/') && url.searchParams.get('taxYear') === String(Y);
    await page.route(slow2025, async route => { await new Promise(r => setTimeout(r, 2500)); await route.continue(); });
    await openModule(page, 'Ledger Workspace');
    await page.getByLabel('Authorized client').selectOption(C);
    await page.getByLabel('Tax year (2022+)').fill(String(Y));
    await sees(page, `Ledger workspace — ${C} / ${Y}`);
    await page.getByLabel('Tax year (2022+)').fill(String(Y + 1));
    await sees(page, `Ledger workspace — ${C} / ${Y + 1}`);
    const workspace = page.locator('section', { has: page.getByRole('heading', { name: `Ledger workspace — ${C} / ${Y + 1}` }) });
    await workspace.getByRole('alert').first().waitFor();
    await page.waitForTimeout(4000); // every delayed 2025 response has now arrived
    expect(await workspace.getByRole('heading', { name: 'Work queue' }).count()).toBe(0);
    expect(await workspace.innerText()).not.toMatch(/Trial balance (balanced|NOT balanced)/);
    await page.unroute(slow2025);
    await s.context.close();
  });
});

describe('independent ledger and book-to-tax review in the reviewer workspace', () => {
  // Maker steps go through the API as controlled setup (the bookkeeper's own UI for them is proven above). Every
  // checker step, every refusal claimed here and the persistence and audit evidence go through the reviewer's UI.
  const prepare = (who: string, description: string, amount: number, extra: Record<string, unknown> = {}) =>
    ledger(who, 'POST', '/journal-entries', { postingDate: `${Y}-04-02`, description, ...extra,
      lines: [{ accountId: acct['6070'], debit: amount, credit: 0 }, { accountId: acct['1010'], debit: 0, credit: amount }] });
  const entryByNumber = async (n: string) => (await ledger('rev', 'GET', '/journal-entries')).body.entries.find((e: any) => e.entryNumber === n);
  const reviewPanel = (page: Session['page']) => page.locator('section', { has: page.getByRole('heading', { name: 'Ledger review', exact: true }) });
  const openLedger = async (page: Session['page'], client: string, year: number) => {
    const open = reviewPanel(page).getByRole('form', { name: 'Open a client ledger for review' });
    await open.getByLabel('Client identifier').fill(client);
    await open.getByLabel('Ledger tax year').fill(String(year));
    await open.getByRole('button', { name: 'Open ledger' }).click();
  };
  const FAM = '1065';
  let approveNo = '', returnNo = '', ownNo = '';

  it('the reviewer approves, returns and is refused self-approval in the UI; the preparer corrects; state and audit persist', async () => {
    const toApprove = await prepare('bk', 'Synthetic supplies accrual for review', 25);
    const toReturn = await prepare('bk', 'Synthetic misclassified supplies', 12);
    // Adjusting entries always await independent review (proposal 024), whoever prepares them. The reviewer prepares
    // one, so approving it would be self-approval.
    const own = await prepare('rev', 'Synthetic adjusting entry prepared by the reviewer', 7, { isAdjusting: true, adjustingType: 'ACCRUAL' });
    for (const r of [toApprove, toReturn, own]) expect(r.status).toBeLessThan(300);
    for (const r of [toApprove, toReturn, own]) expect(r.body.entry.status).toBe('PREPARED');
    [approveNo, returnNo, ownNo] = [toApprove, toReturn, own].map(r => r.body.entry.entryNumber);

    const rev = await staffLogin('e2e-rev');
    const { page } = rev;
    const review = reviewPanel(page);
    await openLedger(page, C, Y);
    await review.getByRole('heading', { name: `${C} · ${Y}` }).waitFor();

    // Approve: the entry posts with the reviewer recorded.
    await review.getByRole('button', { name: `Approve ${approveNo}` }).click();
    await review.getByText(`${approveNo} approved and posted.`).waitFor();
    expect(await entryByNumber(approveNo)).toMatchObject({ status: 'POSTED', reviewerUid: 'e2e-rev' });
    // A repeated approval of the same version (a retry or a second tab) is refused and posts nothing twice.
    const posted = await entryByNumber(approveNo);
    expect((await ledger('rev', 'POST', `/journal-entries/${posted.id}/approve`, { version: toApprove.body.entry.version })).status).toBeGreaterThanOrEqual(400);
    expect((await ledger('rev', 'GET', '/journal-entries')).body.entries.filter((e: any) => e.entryNumber === approveNo)).toHaveLength(1);

    // Return for correction with a recorded note.
    await review.getByRole('button', { name: `Return ${returnNo} for correction` }).click();
    await review.getByLabel('Correction requested (recorded)').fill('Synthetic: post this to the correct expense account.');
    await review.getByRole('button', { name: 'Confirm' }).click();
    await review.getByText(`${returnNo} returned to the preparer.`).waitFor();
    expect(await entryByNumber(returnNo)).toMatchObject({ status: 'CORRECTION_REQUIRED' });

    // Self-approval: the reviewer prepared this entry, so the server refuses its approval and nothing posts.
    await review.getByRole('button', { name: `Approve ${ownNo}` }).click();
    await review.getByRole('alert').filter({ hasText: 'An independent reviewer must perform this action' }).waitFor();
    expect(await entryByNumber(ownNo)).toMatchObject({ status: 'PREPARED' });

    // The preparer responds to the correction with a replacement entry; the reviewer gives the final disposition.
    const replacement = await prepare('bk', 'Synthetic corrected supplies entry', 12, { replacesEntryId: (await entryByNumber(returnNo)).id });
    expect(replacement.status).toBeLessThan(300);
    const replacementNo = replacement.body.entry.entryNumber;

    // Persistence: a fresh load shows the server's state, not React memory.
    await page.reload();
    await openLedger(page, C, Y);
    await review.getByRole('heading', { name: `${C} · ${Y}` }).waitFor();
    await review.getByRole('button', { name: `Approve ${replacementNo}` }).waitFor();
    expect(await review.getByRole('button', { name: `Approve ${approveNo}` }).count()).toBe(0);
    await review.getByRole('button', { name: `Approve ${ownNo}` }).waitFor();
    await review.getByRole('button', { name: `Approve ${replacementNo}` }).click();
    await review.getByText(`${replacementNo} approved and posted.`).waitFor();

    // Audit evidence through the UI: who did what, recorded by the database.
    await review.getByRole('button', { name: 'Show financial audit history' }).click();
    await review.getByText(/^Entry posted · e2e-rev \(senior_reviewer\) · /).first().waitFor();
    await review.getByText(/^Entry correction required · e2e-rev \(senior_reviewer\) · /).first().waitFor();
    await review.getByText(/^Entry created · e2e-bk \(bookkeeper\) · /).first().waitFor();
    expect(realErrors(rev)).toEqual([]);
    await rev.context.close();
  });

  it('book-to-tax: the reviewer approves the mapping and the workpaper in the UI; the preparer cannot; state persists', async () => {
    for (const [code, label] of [['CASH', 'Cash (synthetic)'], ['OWNER_EQUITY', 'Owner equity (synthetic)'], ['SUPPLIES', 'Supplies (synthetic)']])
      expect((await api(tokens.admin, 'POST', '/api/book-to-tax/categories', { returnFamily: FAM, categoryCode: code, label })).status).toBe(200);
    const b2t = (who: string, method: string, path: string, body?: unknown) => api(tokens[who], method, '/api/book-to-tax' + path, body);
    const set = (await b2t('acct', 'POST', `/clients/${C}/${Y}/${FAM}/mapping-sets`)).body;
    for (const [num, cat] of [['1010', 'CASH'], ['3010', 'OWNER_EQUITY'], ['6070', 'SUPPLIES']])
      expect((await b2t('acct', 'POST', `/clients/${C}/mapping-sets/${set.setId}/mappings`, { accountId: acct[num], categoryCode: cat })).status).toBeLessThan(300);
    expect((await b2t('acct', 'POST', `/clients/${C}/mapping-sets/${set.setId}/submit`)).status).toBeLessThan(300);
    expect((await b2t('acct', 'POST', `/clients/${C}/mapping-sets/${set.setId}/approve`)).body.code).toBe('B2T_REVIEWER_REQUIRED');

    const rev = await staffLogin('e2e-rev');
    const { page } = rev;
    const review = reviewPanel(page);
    // The first family's overview is delayed past the switch to FAM. The stale response must be discarded, so the
    // screen (and the approve buttons on it) stays on the family in the selector.
    const firstFamily = `**/api/book-to-tax/clients/${C}/${Y}/1040`;
    await page.route(firstFamily, async route => { await new Promise(r => setTimeout(r, 2500)); await route.continue(); });
    await openLedger(page, C, Y);
    await review.getByLabel('Return family').selectOption(FAM);
    await review.getByText(/Account mapping v\d+ \(pending review\)/).waitFor();
    await page.waitForTimeout(3500);
    await review.getByText(/Account mapping v\d+ \(pending review\)/).waitFor({ timeout: 1000 });
    await page.unroute(firstFamily);
    await review.getByRole('button', { name: 'Approve mapping' }).click();
    await review.getByText('Mapping approved.').waitFor();

    const wp = await b2t('acct', 'POST', `/clients/${C}/${Y}/${FAM}/workpapers`);
    expect(wp.body).toMatchObject({ reconciled: true });
    expect((await b2t('acct', 'POST', `/clients/${C}/workpapers/${wp.body.workpaperId}/approve`)).body.code).toBe('B2T_REVIEWER_REQUIRED');

    await page.reload();
    await openLedger(page, C, Y);
    await review.getByLabel('Return family').selectOption(FAM);
    await review.getByText(/Account mapping v\d+ \(approved\)/).waitFor();
    await review.getByRole('button', { name: 'Approve workpaper' }).click();
    await review.getByText('Workpaper approved.').waitFor();
    await page.reload();
    await openLedger(page, C, Y);
    await review.getByLabel('Return family').selectOption(FAM);
    await review.getByText(/· approved · reconciled ·/).waitFor();
    expect(await review.getByRole('button', { name: 'Approve workpaper' }).count()).toBe(0);
    expect(realErrors(rev)).toEqual([]);
    await rev.context.close();
  });

  it('refuses the reviewer another client, a foreign client and an unstaffed tax year: no entries, no controls, no mutation', async () => {
    const rev = await staffLogin('e2e-rev');
    const { page } = rev;
    const review = reviewPanel(page);
    for (const [client, year] of [[UNASSIGNED_CLIENT, Y], [FOREIGN_CLIENT, Y], [C, Y + 1]] as const) {
      await openLedger(page, client, year);
      await review.getByRole('alert').first().waitFor();
      expect(await review.getByRole('button', { name: /^Approve / }).count(), `${client}/${year}`).toBe(0);
      expect(await review.innerText(), `${client}/${year}`).not.toMatch(/Synthetic (supplies|entry|misclassified|corrected)/);
    }
    // The protected operation itself, attempted against the reviewer's own pending entry through another scope.
    const own = await entryByNumber(ownNo);
    for (const scope of [{ clientId: UNASSIGNED_CLIENT, taxYear: Y }, { clientId: FOREIGN_CLIENT, taxYear: Y }, { clientId: C, taxYear: Y + 1 }]) {
      const attempt = await api(tokens.rev, 'POST', `/api/bookkeeping/journal-entries/${own.id}/approve`, { ...scope, version: own.version });
      expect(attempt.status, `${JSON.stringify(scope)} -> ${attempt.status} ${JSON.stringify(attempt.body)}`).toBeGreaterThanOrEqual(400);
      expect(await entryByNumber(ownNo), `after ${JSON.stringify(scope)}`).toMatchObject({ status: 'PREPARED', version: own.version });
    }
    await rev.context.close();
  });

  it('keeps the reviewer dashboard and its ledger review within a 375 px viewport', async () => {
    const rev = await staffLogin('e2e-rev');
    const { page } = rev;
    const pageOverflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.setViewportSize({ width: 375, height: 812 });
    // The dashboard's own tables (My cases, Case work queue) scroll inside their containers, not the page.
    await page.getByRole('table', { name: 'My cases' }).waitFor();
    await page.getByRole('table', { name: 'Case work queue' }).waitFor();
    expect(await pageOverflow(), 'dashboard').toBeLessThanOrEqual(0);
    await openLedger(page, C, Y);
    const review = reviewPanel(page);
    await review.getByRole('heading', { name: `${C} · ${Y}` }).waitFor();
    await review.getByRole('button', { name: `Approve ${ownNo}` }).waitFor();
    await review.getByLabel('Return family').selectOption(FAM);
    await review.getByText(/Account mapping v\d+/).waitFor();
    await review.getByRole('table', { name: 'Workpaper categories' }).first().waitFor();
    await review.getByRole('button', { name: 'Show financial audit history' }).click();
    await review.getByText(/^Entry posted · e2e-rev \(senior_reviewer\) · /).first().waitFor();
    expect(await pageOverflow(), 'ledger review, workpapers and history').toBeLessThanOrEqual(0);
    // Review controls stay reachable at phone width.
    const approve = review.getByRole('button', { name: `Approve ${ownNo}` });
    await approve.scrollIntoViewIfNeeded();
    const box = await approve.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 375, 'approve control within the viewport').toBe(true);
    await rev.context.close();
  });
});
