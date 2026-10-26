import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { api, apiLogin, C, closeBrowser, dumpOnFailure, ensureStaffed, openModule, realErrors, sees, staffLogin } from './helpers';
import { syntheticRuleSet, SYNTHETIC_SOURCE_ID } from '../server/taxguard/taxEngine/syntheticFixtures';

// Phase 5 through the real server and its real capability lists: synthetic source and rule set,
// independent verification and approval, a deterministic pinned run on the E2E case, reviewer-only
// review, and stage 9 still blocked. SYNTHETIC values only — nothing here is tax law.
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(closeBrowser);

describe('tax engine foundation on the real server', () => {
  it('runs end to end with maker-checker at every step and returns stay blocked', async () => {
    const [mgr, acct, rev] = [await apiLogin('e2e-mgr'), await apiLogin('e2e-acct'), await apiLogin('e2e-rev')];
    const engagementId = await ensureStaffed(mgr);
    // Source: registered by a manager, verified by the reviewer.
    const src = await api(mgr, 'POST', '/api/tax-engine/sources', { sourceId: SYNTHETIC_SOURCE_ID, jurisdiction: 'state', jurisdictionCode: 'ZZ', authorityType: 'synthetic_test',
      title: 'Synthetic fixture source (not tax law)', issuer: 'Synthetic test issuer', citation: 'Synthetic fixture', taxYears: [2025] });
    expect([201, 409]).toContain(src.status);
    expect((await api(mgr, 'POST', `/api/tax-engine/sources/${SYNTHETIC_SOURCE_ID}/verify`, { documentSha256: 'a'.repeat(64) })).status).toBe(403); // capability list: managers do not verify
    const verified = await api(rev, 'POST', `/api/tax-engine/sources/${SYNTHETIC_SOURCE_ID}/verify`, { documentSha256: 'a'.repeat(64) });
    expect([200, 409]).toContain(verified.status);
    // Rule set: drafted and submitted by the manager, approved by the reviewer.
    const draft = await api(mgr, 'POST', '/api/tax-engine/rule-sets', { definition: syntheticRuleSet() });
    expect(draft.status).toBe(201);
    // Proposal 036: a source-cited worked case must pass before the rule set can be submitted.
    expect((await api(mgr, 'POST', `/api/tax-engine/rule-sets/${draft.body.ruleSetId}/submit`)).body.code).toBe('TAX_RULE_SET_TESTS_REQUIRED');
    expect((await api(mgr, 'POST', `/api/tax-engine/rule-sets/${draft.body.ruleSetId}/tests`, { name: 'Synthetic worked example', sourceId: SYNTHETIC_SOURCE_ID,
      citation: 'Synthetic fixture example 1', inputs: [{ factPath: 'synthetic.income_a', value: '5000.00', evidenceIds: ['doc:e2e-case'] }],
      expected: { synthetic_base: '4000.00', synthetic_amount: '290.00' } })).status).toBe(201);
    expect((await api(mgr, 'POST', `/api/tax-engine/rule-sets/${draft.body.ruleSetId}/run-tests`)).body).toMatchObject({ allPassed: true });
    // Proposal 038: the filing-status variant with its own parameter needs its own case.
    expect((await api(mgr, 'POST', `/api/tax-engine/rule-sets/${draft.body.ruleSetId}/submit`)).body).toEqual({ code: 'TAX_RULE_SET_COVERAGE_INCOMPLETE', detail: 'filingStatuses=synthetic_joint' });
    expect((await api(mgr, 'POST', `/api/tax-engine/rule-sets/${draft.body.ruleSetId}/tests`, { name: 'Synthetic joint example', sourceId: SYNTHETIC_SOURCE_ID, filingStatus: 'synthetic_joint',
      citation: 'Synthetic fixture example 2', inputs: [{ factPath: 'synthetic.income_a', value: '5000.00', evidenceIds: ['doc:e2e-case'] }],
      expected: { synthetic_base: '3000.00', synthetic_amount: '217.50' } })).status).toBe(201);
    expect((await api(mgr, 'POST', `/api/tax-engine/rule-sets/${draft.body.ruleSetId}/run-tests`)).body).toMatchObject({ testCount: 2, allPassed: true });
    expect((await api(mgr, 'POST', `/api/tax-engine/rule-sets/${draft.body.ruleSetId}/submit`)).body.status).toBe('PENDING_REVIEW');
    expect((await api(mgr, 'POST', `/api/tax-engine/rule-sets/${draft.body.ruleSetId}/approve`)).status).toBe(403);
    expect((await api(rev, 'POST', `/api/tax-engine/rule-sets/${draft.body.ruleSetId}/approve`)).body.status).toBe('APPROVED');
    // A case for the engagement year (created in earlier files when run in order; created here otherwise).
    let caseId = (await api(mgr, 'GET', '/api/cases')).body.items?.find((c: any) => c.clientId === C && c.taxYear === 2025)?.caseId;
    if (!caseId) caseId = (await api(mgr, 'POST', '/api/cases', { clientId: C, engagementId, taxYear: 2025, returnFamily: '1040' }, 'e2e-tax-engine-case')).body.caseId;
    const inputs = [{ factPath: 'synthetic.income_a', value: '5000.00', evidenceIds: ['doc:e2e-synthetic'] }];
    const run = await api(acct, 'POST', `/api/tax-engine/cases/${caseId}/runs`, { ruleSetId: draft.body.ruleSetId, inputs });
    expect(run.status).toBe(201);
    expect(run.body).toMatchObject({ status: 'COMPUTED', synthetic: true, returnUse: 'BLOCKED', outputs: { synthetic_base: '4000.00', synthetic_amount: '290.00' } });
    expect((await api(acct, 'POST', `/api/tax-engine/cases/${caseId}/runs`, { ruleSetId: draft.body.ruleSetId, inputs })).body).toMatchObject({ run_id: run.body.run_id, replayed: true });
    expect((await api(acct, 'POST', `/api/tax-engine/runs/${run.body.run_id}/approve`, { note: 'Self review attempt' })).status).toBe(403);
    expect((await api(rev, 'POST', `/api/tax-engine/runs/${run.body.run_id}/approve`, { note: 'Synthetic inputs traced to evidence' })).body).toMatchObject({ status: 'REVIEW_APPROVED', returnUse: 'BLOCKED' });
    // Stage 9 remains blocked regardless of reviewed foundation runs.
    const detail = (await api(mgr, 'GET', `/api/cases/${caseId}`)).body;
    if (detail.case.activeStage === 9) expect(detail.stagePolicy).toMatchObject({ evidence: 'BLOCKED', dependency: 'VERIFIED_TAX_ENGINE_REQUIRED' });
    expect(detail.stages.filter((s: any) => s.stage >= 9 && s.status === 'COMPLETED')).toEqual([]);
    // Clients and bookkeepers have no access.
    for (const id of ['e2e-client', 'e2e-bk']) expect((await api(await apiLogin(id), 'GET', '/api/tax-engine/rule-sets')).status).toBe(403);
  });

  it('the Tax Rules console: a manager registers a source, only a reviewer verifies it, and a refusal keeps what was entered', async () => {
    const SOURCE = 'ZZ-UI-SYNTHETIC-1';
    const HASH = 'b'.repeat(64);
    const mgr = await staffLogin('e2e-mgr');
    await openModule(mgr.page, 'Tax Rules');
    const panel = (s: typeof mgr) => s.page.locator('section', { has: s.page.getByRole('heading', { name: 'Tax Rules', exact: true }) });
    await panel(mgr).getByText('Register a source').click();
    const reg = panel(mgr).getByRole('form', { name: 'Register a source' });
    await reg.getByLabel('Identifier').fill(SOURCE);
    await reg.getByLabel('Jurisdiction level').selectOption('state');
    await reg.getByLabel('Jurisdiction code').fill('ZZ');
    await reg.getByLabel('Authority type').selectOption('synthetic_test');
    await reg.getByLabel('Title').fill('Synthetic console source (not tax law)');
    await reg.getByLabel('Issuer').fill('Synthetic test issuer');
    await reg.getByLabel('Citation').fill('Synthetic console fixture');
    await reg.getByLabel('Tax years (comma-separated)').fill('2025');
    await reg.getByRole('button', { name: 'Register source' }).click();
    await sees(mgr.page, 'Source registered; it needs verification by a different reviewer.');
    const row = (s: typeof mgr) => panel(s).getByRole('row', { name: new RegExp(SOURCE) });
    expect(await row(mgr).innerText()).toMatch(/\(synthetic test\)[\s\S]*PROPOSED/);
    // A manager cannot verify: the server refuses and the entered hash stays.
    const verify = (s: typeof mgr) => panel(s).getByRole('form', { name: `Verify ${SOURCE}` });
    await verify(mgr).getByLabel('Document SHA-256').fill(HASH);
    await verify(mgr).getByRole('button', { name: 'Verify' }).click();
    await sees(mgr.page, 'Your role is not authorized for this action.');
    expect(await verify(mgr).getByLabel('Document SHA-256').inputValue()).toBe(HASH);
    expect(realErrors(mgr)).toEqual([]);
    await mgr.context.close();
    // The reviewer verifies it in the console and reads the approved synthetic rule set with its coverage.
    const rev = await staffLogin('e2e-rev');
    await panel(rev).waitFor();
    await verify(rev).getByLabel('Document SHA-256').fill(HASH);
    await verify(rev).getByRole('button', { name: 'Verify' }).click();
    await sees(rev.page, `Source ${SOURCE} verified.`);
    expect(await row(rev).innerText()).toMatch(/VERIFIED/);
    await panel(rev).getByRole('button', { name: /state ZZ SYN-1 \(synthetic\)/ }).first().click();
    await sees(rev.page, /SYN-1 2025 · version \d+ · APPROVED/);
    await sees(rev.page, 'Tests cover every output and filing status.');
    expect(await panel(rev).getByRole('table', { name: 'Parameters' }).innerText()).toContain('synthetic_rate');
    // The approved rule set's source-cited tests and their recorded run.
    const tests = await panel(rev).getByRole('table', { name: 'Source-cited tests' }).innerText();
    expect(tests).toContain('Synthetic worked example'); expect(tests).toContain('Synthetic joint example'); expect(tests).not.toMatch(/Failed|Not run/);
    await sees(rev.page, /Latest run: 2 of 2 passed/);
    expect(realErrors(rev)).toEqual([]);
    await rev.context.close();
  });

  it('calculation runs in Case Workflow: the preparer cannot review their own run; the independent reviewer approves it', async () => {
    const [mgr, acct] = [await apiLogin('e2e-mgr'), await apiLogin('e2e-acct')];
    const caseId = (await api(mgr, 'GET', '/api/cases')).body.items.find((c: any) => c.clientId === C && c.taxYear === 2025).caseId;
    const ruleSetId = (await api(mgr, 'GET', '/api/tax-engine/rule-sets?taxYear=2025')).body.items.find((r: any) => r.returnFamily === 'SYN-1' && r.status === 'APPROVED').ruleSetId;
    const run = await api(acct, 'POST', `/api/tax-engine/cases/${caseId}/runs`, { ruleSetId, inputs: [{ factPath: 'synthetic.income_a', value: '6000.00', evidenceIds: ['doc:e2e-console'] }] });
    expect(run.status, run.body?.code).toBe(201);
    const runLabel = `Review run ${run.body.run_id.slice(0, 8)}`;
    const NOTE = 'Synthetic inputs traced to the source document';
    const openCase = async (s: Awaited<ReturnType<typeof staffLogin>>) => {
      await s.page.getByRole('button', { name: caseId.slice(0, 16) }).first().click();
      await s.page.getByRole('heading', { name: 'Tax calculation runs' }).waitFor();
    };
    // The preparer who requested the run: refused by the server, and the note stays.
    const prep = await staffLogin('e2e-acct');
    await openCase(prep);
    const prepForm = prep.page.getByRole('form', { name: runLabel });
    await prepForm.getByLabel('Review note').fill(NOTE);
    await prepForm.getByRole('button', { name: 'Approve run' }).click();
    await sees(prep.page, "Only the case's independent reviewer can decide on a calculation run.");
    expect(await prepForm.getByLabel('Review note').inputValue()).toBe(NOTE);
    expect(realErrors(prep)).toEqual([]);
    await prep.context.close();
    // The independent reviewer approves it in the same view.
    const rev = await staffLogin('e2e-rev');
    await openCase(rev);
    const revForm = rev.page.getByRole('form', { name: runLabel });
    await revForm.getByLabel('Review note').fill(NOTE);
    await revForm.getByRole('button', { name: 'Approve run' }).click();
    await sees(rev.page, 'Calculation run approved.');
    const after = (await api(mgr, 'GET', `/api/tax-engine/cases/${caseId}/runs`)).body.items.find((r: any) => r.run_id === run.body.run_id);
    expect(after).toMatchObject({ status: 'REVIEW_APPROVED', review_note: NOTE, returnUse: 'BLOCKED' });
    expect(realErrors(rev)).toEqual([]);
    await rev.context.close();
  });

  it('rule-set authoring in the console: draft, add and remove source-cited tests, run them, submit; the reviewer approves', async () => {
    const mgr = await staffLogin('e2e-mgr');
    await openModule(mgr.page, 'Tax Rules');
    const panel = (s: typeof mgr) => s.page.locator('section', { has: s.page.getByRole('heading', { name: 'Tax Rules', exact: true }) });
    await panel(mgr).getByText('Draft a rule set').click();
    const draft = panel(mgr).getByRole('form', { name: 'Draft a rule set' });
    await draft.getByLabel('Definition (JSON)').fill('{ not json');
    await draft.getByText('The definition is not a JSON object.').waitFor();
    await draft.getByLabel('Definition (JSON)').fill(JSON.stringify(syntheticRuleSet(2025, { returnFamily: 'SYN-UI' })));
    await draft.getByRole('button', { name: 'Draft rule set' }).click();
    await sees(mgr.page, 'Rule set drafted;');
    await panel(mgr).getByRole('button', { name: /state ZZ SYN-UI \(synthetic\)/ }).first().click();
    await sees(mgr.page, /SYN-UI 2025 · version 1 · DRAFT/);
    const add = panel(mgr).getByRole('form', { name: 'Add a test' });
    const addTest = async (name: string, filingStatus: string, expected: string) => {
      await add.getByLabel('Test name').fill(name);
      await add.getByLabel(/^Source \(verified for 2025\)/).selectOption(SYNTHETIC_SOURCE_ID);
      await add.getByLabel('Citation for the expected result').fill('Synthetic console example');
      await add.getByLabel('Filing status (optional)').fill(filingStatus);
      await add.getByLabel(/^Inputs/).fill('synthetic.income_a = 5000.00');
      await add.getByLabel('Evidence reference for the inputs').fill('doc:e2e-console');
      await add.getByLabel(/^Expected outputs/).fill(expected);
      await add.getByRole('button', { name: 'Add test' }).click();
      await sees(mgr.page, 'Test added; run the tests again before submitting.');
    };
    await addTest('Synthetic console single', '', 'synthetic_base = 4000.00\nsynthetic_amount = 290.00');
    await addTest('Synthetic console joint', 'synthetic_joint', 'synthetic_base = 3000.00\nsynthetic_amount = 217.50');
    await addTest('Synthetic console mistake', '', 'synthetic_base = 1.00');
    await panel(mgr).getByRole('button', { name: 'Remove test Synthetic console mistake' }).click();
    await sees(mgr.page, 'Test removed.');
    expect(await panel(mgr).getByRole('table', { name: 'Source-cited tests' }).innerText()).not.toContain('Synthetic console mistake');
    await panel(mgr).getByRole('button', { name: 'Run tests' }).click();
    await sees(mgr.page, /Latest run: 2 of 2 passed/);
    await panel(mgr).getByRole('button', { name: 'Submit for review' }).click();
    await sees(mgr.page, 'Submitted for independent review.');
    expect(realErrors(mgr)).toEqual([]);
    await mgr.context.close();
    // The reviewer approves the submitted version in the console.
    const rev = await staffLogin('e2e-rev');
    await panel(rev).getByRole('button', { name: /state ZZ SYN-UI \(synthetic\)/ }).first().click();
    await sees(rev.page, /SYN-UI 2025 · version 1 · PENDING_REVIEW/);
    await panel(rev).getByRole('form', { name: 'Review decision' }).getByRole('button', { name: 'Approve' }).click();
    await sees(rev.page, 'Rule set approved.');
    await sees(rev.page, /SYN-UI 2025 · version 1 · APPROVED/);
    expect(realErrors(rev)).toEqual([]);
    await rev.context.close();
  });
});

describe('tax research in Case Workflow', () => {
  // The preparer drafts, cites and submits through the UI; the case's reviewer decides there. API calls only set up a
  // second engagement year and revoke an assignment, and read back what the UI did.
  const research = (s: Awaited<ReturnType<typeof staffLogin>>) => s.page.locator('section', { has: s.page.getByRole('heading', { name: 'Tax research', exact: true }) });
  const openCase = async (s: Awaited<ReturnType<typeof staffLogin>>, caseId: string) => {
    await s.page.getByRole('button', { name: caseId.slice(0, 16) }).first().click();
    await research(s).getByRole('heading', { name: 'Tax research', exact: true }).waitFor();
  };
  const QUESTION = 'Synthetic question: does the fixture source support the synthetic deduction?';

  it('the preparer drafts and submits cited research; the case reviewer approves it; it stays approved and audited, and return use stays blocked', async () => {
    const mgr = await apiLogin('e2e-mgr');
    const caseId = (await api(mgr, 'GET', '/api/cases')).body.items.find((c: any) => c.clientId === C && c.taxYear === 2025).caseId;
    const prep = await staffLogin('e2e-acct');
    await openCase(prep, caseId);
    const panel = research(prep);
    await panel.getByLabel('Research question').fill(QUESTION);
    await panel.getByRole('button', { name: 'Open research memo' }).click();
    await panel.getByText('Research memo opened.').waitFor();
    const memo = panel.getByRole('article', { name: `Research memo: ${QUESTION.slice(0, 60)}` });
    await memo.getByLabel('Verified source for 2025').selectOption(SYNTHETIC_SOURCE_ID);
    await memo.getByLabel('Note').fill('Synthetic fixture provision read in full.');
    await memo.getByRole('button', { name: 'Add citation' }).click();
    await panel.getByText('Citation added.').waitFor();
    await memo.getByLabel('Authority level').selectOption('AI_INFERENCE');
    await memo.getByText('AI inference is recorded as reasoning only. It cites no source and never supports an approval.').waitFor();
    await memo.getByLabel('Note').fill('Assistant suggested checking the synthetic threshold.');
    await memo.getByRole('button', { name: 'Add citation' }).click();
    await memo.getByText('[AI inference — not tax authority]').waitFor();
    await memo.getByText('[Authoritative (verified source)]').waitFor();
    await memo.getByLabel('Conclusion').fill('Synthetic conclusion supported by the verified fixture source.');
    await memo.getByRole('button', { name: 'Submit for review' }).click();
    await panel.getByText('Memo submitted for review.').waitFor();
    await memo.getByText(/Status: submitted/).waitFor();
    // The preparer is not the case's reviewer: the server refuses the decision and the memo stays submitted.
    await memo.getByLabel('Review note').fill('Synthetic self-review attempt by the preparer.');
    await memo.getByRole('button', { name: 'Approve research' }).click();
    await panel.getByRole('alert').filter({ hasText: "Only the case's independent reviewer can decide on research." }).waitFor();
    expect(realErrors(prep)).toEqual([]);
    await prep.context.close();

    const rev = await staffLogin('e2e-rev');
    await openCase(rev, caseId);
    const revMemo = research(rev).getByRole('article', { name: `Research memo: ${QUESTION.slice(0, 60)}` });
    await revMemo.getByText('[Authoritative (verified source)]').waitFor();
    await revMemo.getByText('[AI inference — not tax authority]').waitFor();
    await revMemo.getByLabel('Review note').fill('Synthetic independent review of the cited fixture source.');
    await revMemo.getByRole('button', { name: 'Approve research' }).click();
    await research(rev).getByText('Research approved.').waitFor();
    await rev.page.reload();
    await openCase(rev, caseId);
    const reloaded = research(rev).getByRole('article', { name: `Research memo: ${QUESTION.slice(0, 60)}` });
    await reloaded.getByText(/Status: approved · prepared by e2e-acct · reviewed by e2e-rev/).waitFor();
    await reloaded.getByText(/Return use: BLOCKED/).waitFor();
    expect(await reloaded.getByRole('button', { name: /Approve research|Reject research|Add citation/ }).count()).toBe(0);
    expect(realErrors(rev)).toEqual([]);
    await rev.context.close();

    const stored = (await api(mgr, 'GET', `/api/tax-engine/cases/${caseId}/research`)).body;
    expect(stored.returnUse).toBe('BLOCKED');
    const approved = stored.items.find((m: any) => m.question === QUESTION);
    expect(approved).toMatchObject({ status: 'APPROVED', prepared_by: 'e2e-acct', reviewed_by: 'e2e-rev', returnUse: 'BLOCKED' });
    expect(approved.citations.map((c: any) => c.authority_level)).toEqual(['AUTHORITATIVE', 'AI_INFERENCE']);

    // Audit: the decision is recorded in the audit center.
    const admin = await staffLogin('e2e-admin');
    await openModule(admin.page, 'Compliance Audit Log');
    await admin.page.getByRole('region', { name: 'Audit center' }).getByRole('cell', { name: 'TAX_RESEARCH_APPROVED' }).first().waitFor();
    await admin.context.close();
  });

  it('access ends with the live assignment: after revocation the open page cannot extend the memo, and nothing changes', async () => {
    const mgr = await apiLogin('e2e-mgr');
    // A separate 2026 engagement, so the 2025 work above and other suites keep their staffing.
    const engagement = await api(mgr, 'POST', `/api/practice/clients/${C}/engagements`, { title: 'Synthetic 2026 research engagement', type: 'tax_preparation', taxYears: [2026] }, 'e2e-research-eng-2026');
    expect(engagement.status, JSON.stringify(engagement.body)).toBeLessThan(300);
    const engagementId = engagement.body.engagementId;
    await api(mgr, 'POST', `/api/practice/clients/${C}/engagements/${engagementId}/status`, { status: 'active', version: engagement.body.version ?? 1 });
    for (const [role, userId] of [['preparer', 'e2e-acct'], ['reviewer', 'e2e-rev']])
      expect((await api(mgr, 'POST', `/api/practice/clients/${C}/engagements/${engagementId}/team`, { taxYear: 2026, role, userId, reason: 'Synthetic research staffing' }, `e2e-research-${role}-2026`)).status).toBeLessThan(300);
    const created = await api(mgr, 'POST', '/api/cases', { clientId: C, engagementId, taxYear: 2026, returnFamily: '1040' }, 'e2e-research-case-2026');
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const caseId = created.body.caseId;

    const prep = await staffLogin('e2e-acct');
    await openCase(prep, caseId);
    const panel = research(prep);
    const question = 'Synthetic 2026 question opened before the assignment ends.';
    await panel.getByLabel('Research question').fill(question);
    await panel.getByRole('button', { name: 'Open research memo' }).click();
    await panel.getByText('Research memo opened.').waitFor();
    const memo = panel.getByRole('article', { name: `Research memo: ${question.slice(0, 60)}` });

    const team = (await api(mgr, 'GET', `/api/practice/clients/${C}`)).body.team;
    const assignment = team.find((t: any) => t.userId === 'e2e-acct' && t.role === 'preparer' && t.taxYear === 2026);
    expect((await api(mgr, 'POST', `/api/practice/clients/${C}/team/${assignment.assignmentId}/revoke`, { reason: 'Synthetic revocation for E2E' })).status).toBeLessThan(300);

    // The page is still open and still shows the memo; the server refuses the next action.
    await memo.getByLabel('Authority level').selectOption('AI_INFERENCE');
    await memo.getByLabel('Note').fill('Attempt after the assignment ended.');
    await memo.getByRole('button', { name: 'Add citation' }).click();
    await panel.getByRole('alert').filter({ hasText: 'This research memo is not available to you.' }).waitFor();
    expect((await api(await apiLogin('e2e-acct'), 'GET', `/api/tax-engine/cases/${caseId}/research`)).body.code).toBe('CASE_NOT_FOUND');
    const asReviewer = (await api(await apiLogin('e2e-rev'), 'GET', `/api/tax-engine/cases/${caseId}/research`)).body.items.find((m: any) => m.question === question);
    expect(asReviewer).toMatchObject({ status: 'DRAFT', prepared_by: 'e2e-acct', citations: [] });
    expect(realErrors(prep)).toEqual([]);
    await prep.context.close();
  });

  it('keeps the research panel within a 375 px viewport', async () => {
    const mgr = await apiLogin('e2e-mgr');
    const caseId = (await api(mgr, 'GET', '/api/cases')).body.items.find((c: any) => c.clientId === C && c.taxYear === 2025).caseId;
    const rev = await staffLogin('e2e-rev');
    await rev.page.setViewportSize({ width: 375, height: 812 });
    await openCase(rev, caseId);
    await research(rev).getByRole('article', { name: `Research memo: ${QUESTION.slice(0, 60)}` }).waitFor();
    expect(await rev.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await rev.context.close();
  });
});

describe('readiness and risk in Case Workflow', () => {
  // A fresh 2027 engagement and case, so the findings are known and other suites keep their staffing. The preparer runs
  // diagnostics and records a risk assessment through the UI; the case reviewer acknowledges an INFO finding there.
  const readiness = (s: Awaited<ReturnType<typeof staffLogin>>) => s.page.locator('section', { has: s.page.getByRole('heading', { name: 'Readiness and risk', exact: true }) });
  const openCase = async (s: Awaited<ReturnType<typeof staffLogin>>, caseId: string) => {
    await s.page.getByRole('button', { name: caseId.slice(0, 16) }).first().click();
    await readiness(s).getByRole('heading', { name: 'Readiness and risk', exact: true }).waitFor();
  };
  let caseId = '';

  it('the preparer runs diagnostics and records a risk assessment; blocking findings cannot be waived; the case reviewer acknowledges an INFO finding; it persists and is audited', async () => {
    const mgr = await apiLogin('e2e-mgr');
    const engagement = await api(mgr, 'POST', `/api/practice/clients/${C}/engagements`, { title: 'Synthetic 2027 readiness engagement', type: 'tax_preparation', taxYears: [2027] }, 'e2e-readiness-eng-2027');
    expect(engagement.status, JSON.stringify(engagement.body)).toBeLessThan(300);
    const engagementId = engagement.body.engagementId;
    await api(mgr, 'POST', `/api/practice/clients/${C}/engagements/${engagementId}/status`, { status: 'active', version: engagement.body.version ?? 1 });
    for (const [role, userId] of [['preparer', 'e2e-acct'], ['reviewer', 'e2e-rev']])
      expect((await api(mgr, 'POST', `/api/practice/clients/${C}/engagements/${engagementId}/team`, { taxYear: 2027, role, userId, reason: 'Synthetic readiness staffing' }, `e2e-readiness-${role}-2027`)).status).toBeLessThan(300);
    const created = await api(mgr, 'POST', '/api/cases', { clientId: C, engagementId, taxYear: 2027, returnFamily: '1040' }, 'e2e-readiness-case-2027');
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    caseId = created.body.caseId;

    const prep = await staffLogin('e2e-acct');
    await openCase(prep, caseId);
    const panel = readiness(prep);
    await panel.getByText('Not diagnosed yet: run the diagnostics to check readiness.').waitFor();
    // A draft research memo gives the case an INFO finding.
    const research = prep.page.locator('section', { has: prep.page.getByRole('heading', { name: 'Tax research', exact: true }) });
    await research.getByLabel('Research question').fill('Synthetic 2027 question left as a draft for readiness.');
    await research.getByRole('button', { name: 'Open research memo' }).click();
    await research.getByText('Research memo opened.').waitFor();
    await panel.getByRole('button', { name: 'Run diagnostics' }).click();
    await panel.getByText('Diagnostics run recorded.').waitFor();
    await panel.getByText(/^Not ready: 1 blocking, 1 error as of /).waitFor();
    const blocking = panel.getByRole('listitem', { name: 'BLOCKING finding: CALC_NO_APPROVED_RUN' });
    await blocking.getByText('No approved calculation run for this case.').waitFor();
    await blocking.getByText('Fix the underlying record and run the diagnostics again; this finding cannot be acknowledged.').waitFor();
    expect(await blocking.getByRole('button', { name: 'Acknowledge finding' }).count()).toBe(0);
    await panel.getByRole('listitem', { name: 'ERROR finding: B2T_NO_APPROVED_WORKPAPER' }).waitFor();
    // The preparer is not the case reviewer: the server refuses the acknowledgement and the finding stays open.
    const info = panel.getByRole('listitem', { name: 'INFO finding: RESEARCH_DRAFT_OPEN' });
    await info.getByLabel('Acknowledgement note').fill('Synthetic preparer acknowledgement attempt.');
    await info.getByRole('button', { name: 'Acknowledge finding' }).click();
    await panel.getByRole('alert').filter({ hasText: "Only the case's reviewer or a practice manager can acknowledge a finding." }).waitFor();
    await info.getByText(/RESEARCH_DRAFT_OPEN v1 · open/).waitFor();
    // Risk: a malformed amount cannot be sent; a stated amount is recorded against the (absent) practice policy.
    await panel.getByLabel('Amount at stake (USD)').fill('12,000');
    expect(await panel.getByRole('button', { name: 'Record risk assessment' }).isDisabled()).toBe(true);
    await panel.getByLabel('Amount at stake (USD)').fill('1250.50');
    await panel.getByLabel('A position lacks support').check();
    await panel.getByRole('button', { name: 'Record risk assessment' }).click();
    await panel.getByText('Risk assessment recorded.').waitFor();
    const assessment = panel.getByRole('listitem', { name: /^Risk assessment / }).first();
    await assessment.getByText(/Blocked/).first().waitFor();
    expect(await assessment.innerText()).toMatch(/Blocked · \$1250\.50 · materiality unknown · risk unknown · no approved policy · e2e-acct/);
    for (const reason of ['A blocking readiness finding is open.', 'Readiness errors are open.', 'The practice has no approved materiality policy, so a person reviews.', 'A position lacks support.'])
      await assessment.getByText(reason, { exact: true }).waitFor();
    expect(realErrors(prep)).toEqual([]);
    await prep.context.close();

    const rev = await staffLogin('e2e-rev');
    await openCase(rev, caseId);
    const revInfo = readiness(rev).getByRole('listitem', { name: 'INFO finding: RESEARCH_DRAFT_OPEN' });
    await revInfo.getByLabel('Acknowledgement note').fill('Synthetic reviewer acknowledgement: the draft is intentional.');
    await revInfo.getByRole('button', { name: 'Acknowledge finding' }).click();
    await readiness(rev).getByText('Finding acknowledged.').waitFor();
    await rev.page.reload();
    await openCase(rev, caseId);
    const reloaded = readiness(rev).getByRole('listitem', { name: 'INFO finding: RESEARCH_DRAFT_OPEN' });
    await reloaded.getByText(/RESEARCH_DRAFT_OPEN v1 · acknowledged/).waitFor();
    await reloaded.getByText('Acknowledged by e2e-rev: Synthetic reviewer acknowledgement: the draft is intentional.').waitFor();
    expect(await reloaded.getByRole('button', { name: 'Acknowledge finding' }).count()).toBe(0);
    // Acknowledging changes nothing about readiness.
    await readiness(rev).getByText(/^Not ready: 1 blocking, 1 error as of /).waitFor();
    expect(realErrors(rev)).toEqual([]);
    await rev.context.close();

    const diagnostics = (await api(mgr, 'GET', `/api/tax-engine/cases/${caseId}/diagnostics`)).body;
    expect(diagnostics).toMatchObject({ blocking: 1, errors: 1, ready: false, returnUse: 'BLOCKED' });
    const risk = (await api(mgr, 'GET', `/api/tax-engine/cases/${caseId}/risk`)).body;
    expect(risk.returnUse).toBe('BLOCKED');
    expect(risk.items).toHaveLength(1);
    expect(risk.items[0]).toMatchObject({ outcome: 'BLOCKED', amount_cents: 125050, unsupported_position: true, ai_confidence: null, policy_version: null, assessed_by: 'e2e-acct' });

    const admin = await staffLogin('e2e-admin');
    await openModule(admin.page, 'Compliance Audit Log');
    const audit = admin.page.getByRole('region', { name: 'Audit center' });
    for (const action of ['CASE_DIAGNOSTICS_RUN', 'CASE_DIAGNOSTIC_ACKNOWLEDGED', 'CASE_RISK_ASSESSED']) await audit.getByRole('cell', { name: action }).first().waitFor();
    await admin.context.close();
  });

  it('closes the readiness routes to a bookkeeper on the real server', async () => {
    const bk = await apiLogin('e2e-bk');
    expect((await api(bk, 'GET', `/api/tax-engine/cases/${caseId}/diagnostics`)).status).toBe(403);
    expect((await api(bk, 'POST', `/api/tax-engine/cases/${caseId}/risk`, { amountCents: 1 })).status).toBe(403);
  });

  it('keeps the readiness panel within a 375 px viewport', async () => {
    const rev = await staffLogin('e2e-rev');
    await rev.page.setViewportSize({ width: 375, height: 812 });
    await openCase(rev, caseId);
    await readiness(rev).getByRole('listitem', { name: 'BLOCKING finding: CALC_NO_APPROVED_RUN' }).waitFor();
    await readiness(rev).getByRole('list', { name: 'Risk assessments' }).waitFor();
    expect(await rev.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await rev.context.close();
  });
});
