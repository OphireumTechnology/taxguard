import { describe, expect, it } from 'vitest';
import { api, apiLogin, C, ensureStaffed } from './helpers';
import { syntheticRuleSet, SYNTHETIC_SOURCE_ID } from '../server/taxguard/taxEngine/syntheticFixtures';

// Phase 5 through the real server and its real capability lists: synthetic source and rule set,
// independent verification and approval, a deterministic pinned run on the E2E case, reviewer-only
// review, and stage 9 still blocked. SYNTHETIC values only — nothing here is tax law.
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
});
