import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { ORIGIN, api, apiLogin, C, closeBrowser, control, dumpOnFailure, ensureStaffed, openModule, realErrors, sees, staffLogin } from './helpers';
import { syntheticRuleSet, SYNTHETIC_SOURCE_ID } from '../server/taxguard/taxEngine/syntheticFixtures';

// Phase 5 through the real server and its real capability lists: synthetic source and rule set,
// independent verification and approval, a deterministic pinned run on the E2E case, reviewer-only
// review, and stage 9 still blocked. SYNTHETIC values only — nothing here is tax law.
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(closeBrowser);
// Calculation inputs cite durable evidence (proposal 20261018190000): the current version of a reviewed document of the
// case's engagement year, accepted in suite 02.
async function reviewedDocument(token: string, engagementId: string) {
  const docs = (await api(token, 'GET', `/api/vault/clients/${C}/documents`)).body.items as any[];
  const latest = new Map<string, any>();
  for (const d of docs) if (!latest.has(d.documentId) || latest.get(d.documentId).version < d.version) latest.set(d.documentId, d);
  const found = [...latest.values()].find(d => d.engagementId === engagementId && d.taxYear === 2025 && d.status === 'VERIFIED' && d.quarantineStatus === 'CLEAN');
  expect(found, 'a reviewed document of the engagement year').toBeTruthy();
  return 'document:' + found.documentId;
}

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
    // Evidence that resolves to nothing is refused before a run is recorded.
    expect((await api(acct, 'POST', `/api/tax-engine/cases/${caseId}/runs`, { ruleSetId: draft.body.ruleSetId,
      inputs: [{ factPath: 'synthetic.income_a', value: '5000.00', evidenceIds: ['doc:e2e-synthetic'] }] })).body)
      .toEqual({ code: 'TAX_CALC_EVIDENCE_UNRESOLVED', detail: 'synthetic.income_a|doc:e2e-synthetic|UNRECOGNISED_REFERENCE' });
    const inputs = [{ factPath: 'synthetic.income_a', value: '5000.00', evidenceIds: [await reviewedDocument(mgr, engagementId)] }];
    const run = await api(acct, 'POST', `/api/tax-engine/cases/${caseId}/runs`, { ruleSetId: draft.body.ruleSetId, inputs });
    expect(run.status).toBe(201);
    expect(run.body).toMatchObject({ status: 'COMPUTED', synthetic: true, returnUse: 'BLOCKED', outputs: { synthetic_base: '4000.00', synthetic_amount: '290.00' } });
    expect((await api(acct, 'POST', `/api/tax-engine/cases/${caseId}/runs`, { ruleSetId: draft.body.ruleSetId, inputs })).body).toMatchObject({ run_id: run.body.run_id, replayed: true });
    expect((await api(acct, 'POST', `/api/tax-engine/runs/${run.body.run_id}/approve`, { note: 'Self review attempt' })).status).toBe(403);
    expect((await api(rev, 'POST', `/api/tax-engine/runs/${run.body.run_id}/approve`, { note: 'Synthetic inputs traced to evidence' })).body)
      .toMatchObject({ status: 'REVIEW_APPROVED', returnUse: 'BLOCKED', lineageRecorded: 1 });
    expect((await api(mgr, 'GET', `/api/tax-engine/runs/${run.body.run_id}/lineage`)).body).toMatchObject({ recorded: true, complete: true,
      citations: [{ factPath: 'synthetic.income_a', ref: inputs[0].evidenceIds[0], resolution: { kind: 'DOCUMENT', documentId: inputs[0].evidenceIds[0].slice('document:'.length) } }] });
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

  it('calculation runs in Case Workflow: the preparer cannot review their own run; the reviewer checks its evidence and approves it', async () => {
    const [mgr, acct] = [await apiLogin('e2e-mgr'), await apiLogin('e2e-acct')];
    const target = (await api(mgr, 'GET', '/api/cases')).body.items.find((c: any) => c.clientId === C && c.taxYear === 2025);
    const caseId = target.caseId;
    const ruleSetId = (await api(mgr, 'GET', '/api/tax-engine/rule-sets?taxYear=2025')).body.items.find((r: any) => r.returnFamily === 'SYN-1' && r.status === 'APPROVED').ruleSetId;
    const evidence = await reviewedDocument(mgr, target.engagementId);
    const run = await api(acct, 'POST', `/api/tax-engine/cases/${caseId}/runs`, { ruleSetId, inputs: [{ factPath: 'synthetic.income_a', value: '6000.00', evidenceIds: [evidence] }] });
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
    // The reviewer reads what each input cites before deciding: resolved now, recorded on approval.
    const short = run.body.run_id.slice(0, 8);
    await rev.page.getByRole('button', { name: `Show evidence for run ${short}` }).click();
    const evidenceView = rev.page.getByRole('region', { name: `Evidence for run ${short}` });
    await evidenceView.getByText('Every input cites resolved evidence. It is recorded when the run is approved.').waitFor();
    expect(await evidenceView.innerText()).toContain(`synthetic.income_a = 6000.00 · ${evidence} · Reviewed document ${evidence.slice('document:'.length)} v`);
    const revForm = rev.page.getByRole('form', { name: runLabel });
    await revForm.getByLabel('Review note').fill(NOTE);
    await revForm.getByRole('button', { name: 'Approve run' }).click();
    await sees(rev.page, 'Calculation run approved.');
    await rev.page.getByRole('button', { name: `Show evidence for run ${short}` }).click();
    await rev.page.getByRole('region', { name: `Evidence for run ${short}` }).getByText('Evidence recorded when the run was approved.').waitFor();
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

// Block 66 (proposal 20261019100000): a conclusion traced to verified evidence, made stale by a replaced source document,
// revised on revalidated sources and re-approved, on the real server with reloads. Synthetic data only.
describe('tax conclusions with evidence-to-conclusion lineage on the real server', () => {
  it('conclusions in Case Workflow: traced to evidence, stale after the source is replaced, revised and re-approved', async () => {
    const [mgr, acct, rev, clientToken] = [await apiLogin('e2e-mgr'), await apiLogin('e2e-acct'), await apiLogin('e2e-rev'), await apiLogin('e2e-client')];
    const target = (await api(mgr, 'GET', '/api/cases')).body.items.find((c: any) => c.clientId === C && c.taxYear === 2025);
    const caseId = target.caseId;
    const evidence = await reviewedDocument(mgr, target.engagementId);
    const documentId = evidence.slice('document:'.length);
    const ruleSetId = (await api(mgr, 'GET', '/api/tax-engine/rule-sets?taxYear=2025')).body.items.find((r: any) => r.returnFamily === 'SYN-1' && r.status === 'APPROVED').ruleSetId;
    const approvedRun = async (value: string) => {
      const run = await api(acct, 'POST', `/api/tax-engine/cases/${caseId}/runs`, { ruleSetId, inputs: [{ factPath: 'synthetic.income_a', value, evidenceIds: [evidence] }] });
      expect(run.status, run.body?.code).toBe(201);
      expect((await api(rev, 'POST', `/api/tax-engine/runs/${run.body.run_id}/approve`, { note: 'Synthetic inputs traced to evidence' })).body.status).toBe('REVIEW_APPROVED');
      return run.body.run_id as string;
    };
    const run1 = await approvedRun('7000.00');
    type S = Awaited<ReturnType<typeof staffLogin>>;
    const openCase = async (s: S) => {
      await s.page.getByRole('button', { name: caseId.slice(0, 16) }).first().click();
      await s.page.getByRole('heading', { name: 'Tax conclusions' }).waitFor();
    };
    const article = (s: S, id: string) => s.page.getByRole('article', { name: `Conclusion ${id.slice(0, 8)}` });
    const badge = (s: S, id: string) => article(s, id).locator('strong[data-conclusion-status]').innerText();
    const focused = (s: S) => s.page.evaluate(() => { const e = document.activeElement as HTMLElement | null;
      return e ? { tag: e.tagName, text: (e.textContent ?? '').trim(), label: e.closest('label')?.firstChild?.textContent ?? null, outline: getComputedStyle(e).outlineStyle } : null; });
    const latest = async () => (await api(mgr, 'GET', `/api/tax-engine/cases/${caseId}/conclusions`)).body.items[0];
    // The preparer proposes the conclusion on verified evidence and the approved calculation, and submits it.
    const prep = await staffLogin('e2e-acct');
    await openCase(prep);
    const form = prep.page.getByRole('form', { name: 'Propose a conclusion' });
    // Accessibility: the disabled save button says why; a refusal is announced as an alert, in words.
    expect(await form.getByRole('button', { name: 'Propose conclusion' }).getAttribute('aria-describedby')).toBe('case-conclusion-save-hint');
    await prep.page.getByText('A statement of at least 10 characters and at least one verified evidence reference are required.').waitFor();
    await form.getByLabel('Statement').fill('Synthetic statement citing a document that does not exist.');
    await form.getByLabel(/^Verified evidence/).fill('document:e2e-no-such-document');
    await form.getByRole('button', { name: 'Propose conclusion' }).click();
    expect(await prep.page.getByRole('alert').filter({ hasText: 'Refused: a cited source does not resolve' }).innerText()).toMatch(/document:e2e-no-such-document/);
    await form.getByLabel('Conclusion type').selectOption('INCOME_INCLUSION');
    await form.getByLabel('Statement').fill('Synthetic wages are included in income for 2025.');
    await form.getByLabel('Amount (optional)').fill('7000.00');
    await form.getByLabel(/^Verified evidence/).fill(evidence);
    await form.getByLabel('Calculation run ids (optional)').fill(run1);
    await form.getByRole('button', { name: 'Propose conclusion' }).click();
    await sees(prep.page, 'Conclusion recorded as a draft.');
    const v1 = (await latest()).conclusionId as string;
    await article(prep, v1).getByRole('button', { name: `Submit conclusion ${v1.slice(0, 8)} for review` }).click();
    await prep.page.getByRole('status', { name: 'Conclusion action result' }).getByText('Conclusion submitted for review.').waitFor();
    // The reviewer traces it back to the calculation, its rule set and the original document, approves, and reloads.
    const reviewer = await staffLogin('e2e-rev');
    await openCase(reviewer);
    // Keyboard only: the lineage toggle, the review note and the decision buttons, in that order, with a visible focus ring.
    const toggle = article(reviewer, v1).getByRole('button', { name: new RegExp(`^(Show|Hide) lineage of conclusion ${v1.slice(0, 8)}$`) });
    expect(await toggle.innerText()).toBe(`Show lineage of conclusion ${v1.slice(0, 8)}`);
    await toggle.focus(); await reviewer.page.keyboard.press('Enter');
    const lineage = article(reviewer, v1).getByRole('region', { name: 'Conclusion lineage' });
    await lineage.getByText('Calculation and rule').waitFor();
    expect(await toggle.getAttribute('aria-expanded')).toBe('true');
    expect(await reviewer.page.locator(`#${await toggle.getAttribute('aria-controls')}`).getByRole('region', { name: 'Conclusion lineage' }).count()).toBe(1);
    expect((await focused(reviewer))?.text).toBe(`Hide lineage of conclusion ${v1.slice(0, 8)}`);
    // Reading order: the opened lineage comes before the decision it informs.
    expect(await article(reviewer, v1).evaluate(a => {
      const lineageRegion = a.querySelector('[aria-label="Conclusion lineage"]'), review = a.querySelector('form[aria-label^="Review conclusion"]');
      return !!lineageRegion && !!review && !!(lineageRegion.compareDocumentPosition(review) & Node.DOCUMENT_POSITION_FOLLOWING);
    })).toBe(true);
    await reviewer.page.keyboard.press('Tab');
    expect(await focused(reviewer)).toMatchObject({ tag: 'TEXTAREA', label: 'Review note' });
    await reviewer.page.keyboard.press('Tab');
    expect(await focused(reviewer)).toMatchObject({ tag: 'BUTTON', text: `Approve conclusion ${v1.slice(0, 8)}` });
    expect((await focused(reviewer))?.outline).not.toBe('none');
    // Headings never skip a level: Case Workflow h2, stage h3, Tax conclusions h4, conclusion h5, lineage sections h6.
    const levels = await reviewer.page.locator('section[aria-labelledby="case-workflow-heading"]').evaluate(root =>
      [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => Number(h.tagName[1])));
    expect(levels[0]).toBe(2);
    levels.forEach((l, n) => { if (n > 0) expect(l - levels[n - 1], `heading ${n}`).toBeLessThanOrEqual(1); });
    expect(await article(reviewer, v1).getByRole('heading', { level: 5 }).innerText()).toMatch(/version 1 · status REVIEW REQUIRED$/);
    for (const name of ['Calculation and rule', 'Research and authority', 'Workpaper', 'Verified evidence and original documents', 'Review history', 'Audit'])
      await lineage.getByRole('heading', { level: 6, name, exact: true }).waitFor();
    if (process.env.E2E_A11Y_SNAPSHOT_DIR) (await import('node:fs')).writeFileSync(process.env.E2E_A11Y_SNAPSHOT_DIR + '/conclusions-review.aria.yml',
      await reviewer.page.getByRole('region', { name: 'Tax conclusions' }).ariaSnapshot());
    const traced = await lineage.innerText();
    expect(traced).toContain(`Run ${run1.slice(0, 8)}`);
    expect(traced).toContain(`${evidence} · linked: Reviewed document ${documentId} v`);
    expect(traced).toContain('VERIFIED');
    await reviewer.page.keyboard.press('Enter');
    await reviewer.page.getByRole('status', { name: 'Conclusion action result' }).getByText('Conclusion approved.').waitFor();
    // The used control is gone once approved; focus stays in the panel, on its heading.
    await expect.poll(async () => (await focused(reviewer))?.text).toBe('Tax conclusions');
    await reviewer.page.reload(); await openCase(reviewer);
    expect(await badge(reviewer, v1)).toBe('APPROVED');
    await reviewer.page.getByText('All current conclusions are approved and current.').waitFor();
    // The client supplies a new version of the source document; once scanned it awaits review.
    const versions = (await api(mgr, 'GET', `/api/vault/clients/${C}/documents/${documentId}`)).body.versions as any[];
    const top = versions.reduce((a, b) => (b.version > a.version ? b : a));
    const query = new URLSearchParams({ engagementId: target.engagementId, taxYear: '2025', category: top.category, fileName: 'synthetic-corrected.pdf', documentId });
    const uploaded = await fetch(ORIGIN + `/api/vault/clients/${C}/documents?` + query, { method: 'POST',
      headers: { Authorization: `Bearer ${clientToken}`, 'Content-Type': 'application/pdf', 'Idempotency-Key': 'e2e-conclusion-replacement' },
      body: '%PDF-1.4\nSynthetic corrected statement only\n%%EOF' }).then(async r => ({ status: r.status, body: await r.json() as any }));
    expect(uploaded.status, JSON.stringify(uploaded.body)).toBe(201);
    const c = control();
    expect((await fetch(c.origin + '/e2e/scan', { method: 'POST', headers: { apikey: c.key, 'content-type': 'application/json' },
      body: JSON.stringify({ tenant: 'tenantE2E', client: C, documentId, version: uploaded.body.version, result: 'CLEAN' }) })).status).toBe(200);
    // Nothing is replaced silently: the approved conclusion is shown as stale and finalization is blocked.
    await reviewer.page.reload(); await openCase(reviewer);
    expect(await badge(reviewer, v1)).toBe('STALE');
    await article(reviewer, v1).getByRole('list', { name: 'Stale sources' }).waitFor();
    await reviewer.page.getByRole('status', { name: 'Conclusion readiness' }).getByText(/^Finalization blocked: version 1 stale/).waitFor();
    expect(await article(reviewer, v1).getByRole('heading', { level: 5 }).innerText()).toMatch(/status STALE$/);
    if (process.env.E2E_A11Y_SNAPSHOT_DIR) (await import('node:fs')).writeFileSync(process.env.E2E_A11Y_SNAPSHOT_DIR + '/conclusions-stale.aria.yml',
      await reviewer.page.getByRole('region', { name: 'Tax conclusions' }).ariaSnapshot());
    // Revalidation: staff review the new version, the calculation is rerun and approved, the preparer revises.
    const next = (await api(mgr, 'GET', `/api/vault/clients/${C}/documents/${documentId}`)).body.versions.find((v: any) => v.version === uploaded.body.version);
    expect((await api(mgr, 'POST', `/api/vault/clients/${C}/documents/${documentId}/versions/${next.version}/review`, { decision: 'approve', rowVersion: next.rowVersion })).body.status).toBe('VERIFIED');
    const run2 = await approvedRun('7100.00');
    await prep.page.reload(); await openCase(prep);
    await article(prep, v1).getByRole('button', { name: `Revise conclusion ${v1.slice(0, 8)}` }).click();
    const revise = prep.page.getByRole('form', { name: 'Revise the conclusion' });
    await expect.poll(async () => (await focused(prep))?.label).toBe('Statement'); // focus moves to the form being filled
    await revise.getByLabel('Amount (optional)').fill('7100.00');
    await revise.getByLabel(/^Verified evidence/).fill(evidence);
    await revise.getByLabel('Calculation run ids (optional)').fill(run2);
    await revise.getByRole('button', { name: 'Record new version' }).click();
    await sees(prep.page, 'New conclusion version recorded as a draft.');
    const v2 = (await latest()).conclusionId as string;
    expect(v2).not.toBe(v1);
    await article(prep, v2).getByRole('button', { name: `Submit conclusion ${v2.slice(0, 8)} for review` }).click();
    await sees(prep.page, 'Conclusion submitted for review.');
    await reviewer.page.reload(); await openCase(reviewer);
    await article(reviewer, v2).getByRole('button', { name: `Approve conclusion ${v2.slice(0, 8)}` }).click();
    await sees(reviewer.page, 'Conclusion approved.');
    await reviewer.page.reload(); await openCase(reviewer);
    expect(await badge(reviewer, v2)).toBe('APPROVED');
    await reviewer.page.getByText('All current conclusions are approved and current.').waitFor();
    expect(await reviewer.page.getByRole('article', { name: `Conclusion ${v1.slice(0, 8)}` }).count()).toBe(0); // superseded versions leave the list
    const history = (await api(rev, 'GET', `/api/tax-engine/conclusions/${v2}/trace`)).body;
    expect(history.versions.map((v: any) => [v.version, v.status])).toEqual([[1, 'SUPERSEDED'], [2, 'APPROVED']]);
    // Clients have no access to conclusions, traces or reviewer notes.
    expect((await api(clientToken, 'GET', `/api/tax-engine/conclusions/${v2}/trace`)).status).toBe(403);
    // The panel stays usable at 375 px without horizontal overflow.
    await reviewer.page.setViewportSize({ width: 375, height: 812 });
    await reviewer.page.getByRole('heading', { name: 'Tax conclusions' }).waitFor();
    expect(await reviewer.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    for (const s of [prep, reviewer]) expect(realErrors(s)).toEqual([]);
    await prep.context.close(); await reviewer.context.close();
  });
});

// Block 67 (proposal 20261019110000): the approved conclusion of the case reaches a synthetic form through an approved,
// versioned mapping rule; the reviewer reads every value with its provenance; a revised conclusion makes the mapping
// stale until the preparer maps again. Synthetic data and a synthetic form only.
describe('deterministic form mapping on the real server', () => {
  it('Case Workflow → Form mapping: mapped with provenance, stale after the conclusion is revised, mapped again as version 2', async () => {
    const [mgr, acct, rev] = [await apiLogin('e2e-mgr'), await apiLogin('e2e-acct'), await apiLogin('e2e-rev')];
    const target = (await api(mgr, 'GET', '/api/cases')).body.items.find((c: any) => c.clientId === C && c.taxYear === 2025);
    const caseId = target.caseId;
    const income = (await api(mgr, 'GET', `/api/tax-engine/cases/${caseId}/conclusions`)).body.items.filter((k: any) => k.type === 'INCOME_INCLUSION' && k.status === 'APPROVED');
    expect(income).toHaveLength(1); // left by the Block 66 journey: one approved, current wages conclusion with its calculation run
    const definition = { jurisdiction: 'federal', jurisdictionCode: 'US', returnFamily: target.returnFamily, taxYear: 2025, formId: 'SYN-1040', formVersion: '2025.0',
      effectiveFrom: '2025-01-01', sourceId: SYNTHETIC_SOURCE_ID, lines: [
        { schedule: 'MAIN', line: '1a', field: 'f1_wages', valueType: 'MONEY', required: true, aggregate: 'SINGLE', source: { conclusionType: 'INCOME_INCLUSION', value: 'AMOUNT' } },
        { schedule: 'MAIN', line: '16', field: 'f1_tax', valueType: 'MONEY', required: true, aggregate: 'SINGLE',
          source: { conclusionType: 'INCOME_INCLUSION', value: 'OUTPUT', outputKey: 'synthetic_amount' } }] };
    const rule = await api(acct, 'POST', '/api/tax-engine/form-rules', { definition });
    expect(rule.status, JSON.stringify(rule.body)).toBe(201);
    expect((await api(acct, 'POST', `/api/tax-engine/form-rules/${rule.body.ruleId}/approve`, {})).status).toBe(403); // maker-checker: not the drafter
    expect((await api(acct, 'POST', `/api/tax-engine/form-rules/${rule.body.ruleId}/submit`, {})).body.status).toBe('PENDING_REVIEW');
    expect((await api(rev, 'POST', `/api/tax-engine/form-rules/${rule.body.ruleId}/approve`, {})).body.status).toBe('APPROVED');
    type S = Awaited<ReturnType<typeof staffLogin>>;
    const openCase = async (s: S) => {
      await s.page.getByRole('button', { name: caseId.slice(0, 16) }).first().click();
      await s.page.getByRole('heading', { name: 'Form mapping' }).waitFor();
    };
    const panel = (s: S) => s.page.getByRole('region', { name: 'Form mapping' });
    const article = (s: S, version: number) => panel(s).getByRole('article', { name: `Form mapping SYN-1040 2025.0 version ${version}` });
    const badge = (s: S, version: number) => article(s, version).locator('strong[data-mapping-status]').innerText();
    const result = (s: S) => panel(s).getByRole('status', { name: 'Form mapping result' });
    // The reviewer cannot map: the refusal is announced as an alert.
    const reviewer = await staffLogin('e2e-rev');
    await openCase(reviewer);
    await panel(reviewer).getByLabel('Approved mapping rule').selectOption(rule.body.ruleId);
    // The chosen rule is described, beside the choice, with its jurisdiction and the dates it is in effect.
    const ruleChoice = panel(reviewer).getByLabel('Approved mapping rule');
    const described = await ruleChoice.getAttribute('aria-describedby');
    expect(described).toBe('case-form-mapping-rule');
    expect(await panel(reviewer).locator('#' + described).innerText()).toBe('federal US · in effect 2025-01-01 to open');
    await panel(reviewer).getByRole('button', { name: 'Map to form' }).click();
    await panel(reviewer).getByRole('alert').getByText("Only the case's preparer can map the case to a form.").waitFor();
    // The preparer maps.
    const prep = await staffLogin('e2e-acct');
    await openCase(prep);
    await panel(prep).getByLabel('Approved mapping rule').selectOption(rule.body.ruleId);
    await panel(prep).getByRole('button', { name: 'Map to form' }).click();
    await result(prep).getByText('Mapped SYN-1040 as version 1.').waitFor();
    expect(await badge(prep, 1)).toBe('CURRENT');
    // The reviewer opens the values with the keyboard and reads their provenance.
    await reviewer.page.reload(); await openCase(reviewer);
    const show = article(reviewer, 1).getByRole('button', { name: /^(Show|Hide) values of SYN-1040 2025.0 version 1$/ });
    await show.focus(); await reviewer.page.keyboard.press('Enter');
    const table = article(reviewer, 1).getByRole('table', { name: 'Values of SYN-1040 2025.0 version 1, with provenance' });
    await table.waitFor();
    expect(await show.getAttribute('aria-expanded')).toBe('true');
    const wages = table.getByRole('row').filter({ has: reviewer.page.getByRole('rowheader', { name: '1a', exact: true }) });
    const text = await wages.innerText();
    expect(text).toContain(`${income[0].amount} (money)`);
    expect(text).toContain(`Conclusion ${income[0].conclusionId.slice(0, 8)} version ${income[0].version} (income inclusion)`);
    expect(text).toMatch(/run [0-9a-f]{8} · rule set [0-9a-f]{8} version \d+ \(sha256 [0-9a-f]{12}…\) · evidence document:/);
    await table.getByRole('rowheader', { name: '16', exact: true }).waitFor();
    // The preparer revises the conclusion on the same sources with a corrected amount; the reviewer approves it.
    const k = income[0];
    const revised = await api(acct, 'POST', `/api/tax-engine/conclusions/${k.conclusionId}/revise`, { amount: '7150.00',
      links: k.links.map((l: any) => ({ type: l.type, ref: l.ref })) });
    expect(revised.status, JSON.stringify(revised.body)).toBe(201);
    expect((await api(acct, 'POST', `/api/tax-engine/conclusions/${revised.body.conclusionId}/submit`)).body.status).toBe('READY_FOR_REVIEW');
    expect((await api(rev, 'POST', `/api/tax-engine/conclusions/${revised.body.conclusionId}/approve`, {})).body.status).toBe('APPROVED');
    // Nothing is replaced silently: the mapping reads STALE with its reasons until the preparer maps again.
    await prep.page.reload(); await openCase(prep);
    expect(await badge(prep, 1)).toBe('STALE');
    await article(prep, 1).getByRole('list', { name: 'Stale reasons' }).getByText('line 1a (f1_wages): a source conclusion or its calculation changed').waitFor();
    await panel(prep).getByLabel('Approved mapping rule').selectOption(rule.body.ruleId);
    await panel(prep).getByRole('button', { name: 'Map to form' }).click();
    await result(prep).getByText('Mapped SYN-1040 as version 2.').waitFor();
    expect(await badge(prep, 2)).toBe('CURRENT');
    expect(await badge(prep, 1)).toBe('SUPERSEDED');
    await expect.poll(async () => prep.page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('Form mapping'); // focus stays in the panel
    const v2 = (await api(rev, 'GET', `/api/tax-engine/cases/${caseId}/form-mappings`)).body.items.find((m: any) => m.version === 2);
    const detail = (await api(rev, 'GET', `/api/tax-engine/form-mappings/${v2.mappingId}`)).body;
    expect(detail.values.find((v: any) => v.line === '1a')).toMatchObject({ value: '7150.00', sources: [{ conclusionId: revised.body.conclusionId, conclusionVersion: k.version + 1 }] });
    expect((await api(rev, 'GET', `/api/tax-engine/conclusions/${revised.body.conclusionId}/trace`)).body.formLines).toEqual(expect.arrayContaining([
      { formId: 'SYN-1040', formVersion: '2025.0', line: '1a' }]));
    // Clients have no access to form mappings.
    const clientToken = await apiLogin('e2e-client');
    expect((await api(clientToken, 'GET', `/api/tax-engine/form-mappings/${v2.mappingId}`)).status).toBe(403);
    await prep.page.setViewportSize({ width: 375, height: 812 });
    await prep.page.getByRole('heading', { name: 'Form mapping' }).waitFor();
    expect(await prep.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    for (const s of [prep, reviewer]) expect(realErrors(s)).toEqual([]);
    await prep.context.close(); await reviewer.context.close();
  });
});

describe('draft return preparation on the real server', () => {
  it('Case Workflow → Draft return: prepared from the current mapping, reviewed independently, stale after a revision, prepared again', async () => {
    const [mgr, acct, rev] = [await apiLogin('e2e-mgr'), await apiLogin('e2e-acct'), await apiLogin('e2e-rev')];
    const target = (await api(mgr, 'GET', '/api/cases')).body.items.find((c: any) => c.clientId === C && c.taxYear === 2025);
    const caseId = target.caseId;
    // Left by the Block 67 journey: a current, non-stale mapping of SYN-1040 2025.0.
    const mapping = (await api(rev, 'GET', `/api/tax-engine/cases/${caseId}/form-mappings`)).body.items.find((m: any) => m.status === 'CURRENT' && m.formId === 'SYN-1040');
    expect(mapping?.stale).toEqual([]);
    const definition = { templateId: 'SYN-1040-RETURN', jurisdiction: 'federal', jurisdictionCode: 'US', returnFamily: target.returnFamily, taxYear: 2025,
      effectiveFrom: '2025-01-01', sourceId: SYNTHETIC_SOURCE_ID, forms: [{ formId: 'SYN-1040', formVersion: '2025.0', required: true }] };
    const tpl = await api(acct, 'POST', '/api/tax-engine/return-templates', { definition });
    expect(tpl.status, JSON.stringify(tpl.body)).toBe(201);
    expect((await api(acct, 'POST', `/api/tax-engine/return-templates/${tpl.body.templateRuleId}/approve`, {})).status).toBe(403); // maker-checker
    expect((await api(acct, 'POST', `/api/tax-engine/return-templates/${tpl.body.templateRuleId}/submit`, {})).body.status).toBe('PENDING_REVIEW');
    expect((await api(rev, 'POST', `/api/tax-engine/return-templates/${tpl.body.templateRuleId}/approve`, {})).body.status).toBe('APPROVED');
    type S = Awaited<ReturnType<typeof staffLogin>>;
    const openCase = async (s: S) => {
      await s.page.getByRole('button', { name: caseId.slice(0, 16) }).first().click();
      await s.page.getByRole('heading', { name: 'Draft return' }).waitFor();
    };
    const panel = (s: S) => s.page.getByRole('region', { name: 'Draft return' });
    const article = (s: S, version: number) => panel(s).getByRole('article', { name: `Draft return SYN-1040-RETURN version ${version}` });
    const badge = (s: S, version: number) => article(s, version).locator('strong[data-return-status]').innerText();
    const result = (s: S) => panel(s).getByRole('status', { name: 'Draft return result' });
    // The reviewer cannot prepare: the refusal is announced as an alert.
    const reviewer = await staffLogin('e2e-rev');
    await openCase(reviewer);
    await panel(reviewer).getByLabel('Approved return template').selectOption(tpl.body.templateRuleId);
    expect(await panel(reviewer).locator('#case-draft-return-template').innerText()).toBe('federal US · in effect 2025-01-01 to open');
    await panel(reviewer).getByRole('button', { name: 'Prepare draft return' }).click();
    await panel(reviewer).getByRole('alert').getByText("Only the case's preparer can prepare or submit the draft return.").waitFor();
    // The preparer prepares and submits.
    const prep = await staffLogin('e2e-acct');
    await openCase(prep);
    await panel(prep).getByLabel('Approved return template').selectOption(tpl.body.templateRuleId);
    await panel(prep).getByRole('button', { name: 'Prepare draft return' }).click();
    await result(prep).getByText('Prepared SYN-1040-RETURN as version 1.').waitFor();
    expect(await badge(prep, 1)).toBe('DRAFT');
    await article(prep, 1).getByRole('list', { name: 'Forms of SYN-1040-RETURN version 1' })
      .getByText(`SYN-1040 (2025.0): form mapping ${mapping.mappingId.slice(0, 8)} version ${mapping.version}`).waitFor();
    await article(prep, 1).getByRole('button', { name: 'Submit SYN-1040-RETURN version 1 for review' }).click();
    await result(prep).getByText('Version 1 of SYN-1040-RETURN: submitted.').waitFor();
    expect(await badge(prep, 1)).toBe('SUBMITTED'); // announced only after the list shows the server's state
    // The reviewer reads the lineage with the keyboard and approves.
    await reviewer.page.reload(); await openCase(reviewer);
    const show = article(reviewer, 1).getByRole('button', { name: /^(Show|Hide) lineage of SYN-1040-RETURN version 1$/ });
    await show.focus(); await reviewer.page.keyboard.press('Enter');
    const table = article(reviewer, 1).getByRole('table', { name: `SYN-1040 2025.0, form mapping version ${mapping.version}: lines with provenance` });
    await table.waitFor();
    expect(await show.getAttribute('aria-expanded')).toBe('true');
    expect(await table.getByRole('row').filter({ has: reviewer.page.getByRole('rowheader', { name: '1a', exact: true }) }).innerText())
      .toMatch(/Conclusion [0-9a-f]{8} version \d+ · run [0-9a-f]{8}/);
    // Block 69: approval needs an independent calculation verification first.
    await article(reviewer, 1).getByRole('button', { name: 'Approve SYN-1040-RETURN version 1' }).click();
    await panel(reviewer).getByRole('alert').getByText('Approval refused: verify the calculations of this version first.').waitFor();
    await article(reviewer, 1).getByRole('button', { name: 'Verify calculations of SYN-1040-RETURN version 1' }).click();
    await result(reviewer).getByText(/^Calculation verification of SYN-1040-RETURN version 1: verified: \d+ calculation runs? recalculated with identical results\.$/).waitFor();
    await article(reviewer, 1).getByRole('button', { name: 'Approve SYN-1040-RETURN version 1' }).click();
    await result(reviewer).getByText('Version 1 of SYN-1040-RETURN: approved.').waitFor();
    expect(await badge(reviewer, 1)).toBe('APPROVED');
    expect((await api(rev, 'GET', `/api/tax-engine/cases/${caseId}/returns/stage-facts`)).body)
      .toMatchObject({ draftReturnGenerated: true, preparerReviewComplete: true, provenanceComplete: true, returnUse: 'BLOCKED' });
    // Block 71: the reviewer assesses the approved version's risk; with no approved materiality policy it is human review.
    await article(reviewer, 1).getByRole('button', { name: 'Assess risk of SYN-1040-RETURN version 1' }).click();
    await panel(reviewer).getByRole('alert').getByText('Enter the amount at stake in dollars and cents (zero or more).').waitFor();
    await article(reviewer, 1).getByLabel('Amount at stake for SYN-1040-RETURN version 1 (dollars)').fill('5000.00');
    await article(reviewer, 1).getByRole('button', { name: 'Assess risk of SYN-1040-RETURN version 1' }).click();
    await result(reviewer).getByText(/^Risk assessment of SYN-1040-RETURN version 1: human review required: Every return has human review \(practice decision\);.*The practice has no approved materiality policy, so materiality is unknown\.$/).waitFor();
    // A revised conclusion makes the mapping and then the approved return STALE; nothing is replaced silently.
    const k = (await api(mgr, 'GET', `/api/tax-engine/cases/${caseId}/conclusions`)).body.items.find((c: any) => c.type === 'INCOME_INCLUSION' && c.status === 'APPROVED');
    const revised = await api(acct, 'POST', `/api/tax-engine/conclusions/${k.conclusionId}/revise`, { amount: '7300.00', links: k.links.map((l: any) => ({ type: l.type, ref: l.ref })) });
    expect(revised.status, JSON.stringify(revised.body)).toBe(201);
    expect((await api(acct, 'POST', `/api/tax-engine/conclusions/${revised.body.conclusionId}/submit`)).body.status).toBe('READY_FOR_REVIEW');
    expect((await api(rev, 'POST', `/api/tax-engine/conclusions/${revised.body.conclusionId}/approve`, {})).body.status).toBe('APPROVED');
    await prep.page.reload(); await openCase(prep);
    expect(await badge(prep, 1)).toBe('STALE');
    await article(prep, 1).getByRole('list', { name: 'Stale reasons' }).getByText('SYN-1040 2025.0: the form mapping is stale; map the form again').waitFor();
    expect((await api(rev, 'GET', `/api/tax-engine/cases/${caseId}/returns/stage-facts`)).body).toMatchObject({ draftReturnGenerated: false });
    // The preparer maps the form again and prepares a new version; version 1 is kept, superseded.
    const formRule = (await api(rev, 'GET', `/api/tax-engine/form-mappings/${mapping.mappingId}`)).body.ruleId;
    expect((await api(acct, 'POST', `/api/tax-engine/cases/${caseId}/form-mappings`, { ruleId: formRule })).status).toBe(201);
    await prep.page.reload(); await openCase(prep);
    await panel(prep).getByLabel('Approved return template').selectOption(tpl.body.templateRuleId);
    await panel(prep).getByRole('button', { name: 'Prepare draft return' }).click();
    await result(prep).getByText('Prepared SYN-1040-RETURN as version 2.').waitFor();
    expect(await badge(prep, 2)).toBe('DRAFT');
    expect(await badge(prep, 1)).toBe('SUPERSEDED');
    await expect.poll(async () => prep.page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('Draft return'); // focus stays in the panel
    // Clients have no access to draft returns.
    const clientToken = await apiLogin('e2e-client');
    const v1 = (await api(rev, 'GET', `/api/tax-engine/cases/${caseId}/returns`)).body.items.find((v: any) => v.version === 1);
    expect((await api(clientToken, 'GET', `/api/tax-engine/returns/${v1.returnVersionId}`)).status).toBe(403);
    await prep.page.setViewportSize({ width: 375, height: 812 });
    await prep.page.getByRole('heading', { name: 'Draft return' }).waitFor();
    expect(await prep.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    for (const s of [prep, reviewer]) expect(realErrors(s)).toEqual([]);
    await prep.context.close(); await reviewer.context.close();
  });
});
