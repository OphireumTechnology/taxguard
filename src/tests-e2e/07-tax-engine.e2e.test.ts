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
});
