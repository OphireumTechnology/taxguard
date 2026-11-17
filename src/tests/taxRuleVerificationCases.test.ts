import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTaxEngineRouter } from '../server/routes/taxEngine.routes';
import { TaxEngineStore } from '../server/taxguard/taxEngine/taxEngineStore';
import { syntheticRuleSet, SYNTHETIC_SOURCE_ID } from '../server/taxguard/taxEngine/syntheticFixtures';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Proposal 036: source-cited verification cases gate rule-set submission and approval.
// SYNTHETIC sources, rule sets and cases only — nothing here is tax law.
const T = 'tenantA';
const roles: Record<string, string> = { 'vc-prep': 'accountant', 'vc-rev': 'senior_reviewer' };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let user: any; let rs = '';
const as = (uid: string) => { user = { id: uid, role: roles[uid], tenantId: T, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown) => fetch(origin + '/tax' + path, { method, headers: { 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).then(async r => ({ status: r.status, body: await r.json() as any }));
const inputs = [{ factPath: 'synthetic.income_a', value: '5000.00', evidenceIds: ['doc:synthetic-case'] }];
const testCase = (expected: Record<string, string>, sourceId = SYNTHETIC_SOURCE_ID) =>
  ({ name: 'Synthetic worked example', inputs, expected, sourceId, citation: 'Synthetic fixture example 1' });

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(250000|260000|330000|360000)_/);
  await fixture.pg.exec(`INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES ('${T}','vc-prep','accountant','active'),('${T}','vc-rev','senior_reviewer','active');`);
  const app = express();
  app.use('/tax', createTaxEngineRouter({ store: () => new TaxEngineStore(pgliteRpc(() => fixture.pg)), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  as('vc-prep');
  await call('POST', '/sources', { sourceId: SYNTHETIC_SOURCE_ID, jurisdiction: 'state', jurisdictionCode: 'ZZ', authorityType: 'synthetic_test', title: 'Synthetic fixture source', issuer: 'Synthetic', citation: 'Synthetic', taxYears: [2025] });
  await call('POST', '/sources', { sourceId: 'SYNTHETIC-UNVERIFIED', jurisdiction: 'state', jurisdictionCode: 'ZZ', authorityType: 'synthetic_test', title: 'Synthetic unverified source', issuer: 'Synthetic', citation: 'Synthetic', taxYears: [2025] });
  as('vc-rev'); await call('POST', `/sources/${SYNTHETIC_SOURCE_ID}/verify`, { documentSha256: 'a'.repeat(64) });
  as('vc-prep'); rs = (await call('POST', '/rule-sets', { definition: syntheticRuleSet() })).body.ruleSetId;
}, 90000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

describe('verification cases', () => {
  it('cannot submit without cases, with an unverified source, without a run, or with a failing case', async () => {
    as('vc-prep');
    expect((await call('POST', `/rule-sets/${rs}/submit`)).body.code).toBe('TAX_RULE_SET_TESTS_REQUIRED');
    expect((await call('POST', `/rule-sets/${rs}/tests`, testCase({ synthetic_amount: '290.00' }, 'SYNTHETIC-UNVERIFIED'))).body.code).toBe('TAX_SOURCE_NOT_VERIFIED');
    const wrong = (await call('POST', `/rule-sets/${rs}/tests`, testCase({ synthetic_amount: '291.00' }))).body;
    expect((await call('POST', `/rule-sets/${rs}/submit`)).body.code).toBe('TAX_RULE_SET_TESTS_NOT_RUN');
    const run = (await call('POST', `/rule-sets/${rs}/run-tests`)).body;
    expect(run).toMatchObject({ testCount: 1, passedCount: 0, allPassed: false });
    const listed = (await call('GET', `/rule-sets/${rs}/tests`)).body;
    expect(listed.latestRun.results[0].mismatches).toEqual([{ output: 'synthetic_amount', expected: '291.00', actual: '290.00' }]);
    expect((await call('POST', `/rule-sets/${rs}/submit`)).body.code).toBe('TAX_RULE_SET_TESTS_FAILING');
    expect((await call('POST', `/rule-sets/${rs}/tests/${wrong.testId}/remove`)).body.removed).toBe(true);
  });
  it('requires a passing run for the CURRENT case set; adding a case invalidates the earlier run', async () => {
    as('vc-prep');
    await call('POST', `/rule-sets/${rs}/tests`, testCase({ synthetic_base: '4000', synthetic_amount: '290.00' }));
    expect((await call('POST', `/rule-sets/${rs}/run-tests`)).body).toMatchObject({ testCount: 1, allPassed: true });
    await call('POST', `/rule-sets/${rs}/tests`, { ...testCase({ synthetic_base: '3000.00' }), filingStatus: 'synthetic_joint' });
    expect((await call('POST', `/rule-sets/${rs}/submit`)).body.code).toBe('TAX_RULE_SET_TESTS_NOT_RUN');
    expect((await call('POST', `/rule-sets/${rs}/run-tests`)).body).toMatchObject({ testCount: 2, passedCount: 2, allPassed: true });
    expect((await call('POST', `/rule-sets/${rs}/submit`)).body.status).toBe('PENDING_REVIEW');
  });
  it('freezes cases and runs after submission; approval still re-checks and needs another reviewer', async () => {
    as('vc-prep');
    expect((await call('POST', `/rule-sets/${rs}/tests`, testCase({ synthetic_amount: '290.00' }))).body.code).toBe('TAX_RULE_SET_NOT_DRAFT');
    await expect(fixture.pg.query(`DELETE FROM taxguard_tax_rule_set_tests WHERE rule_set_id = $1`, [rs])).rejects.toThrow('TAX_RULE_SET_NOT_DRAFT');
    await expect(fixture.pg.query(`UPDATE taxguard_tax_rule_set_test_runs SET passed_count = 0 WHERE rule_set_id = $1`, [rs])).rejects.toThrow('TAX_RULE_TEST_RUN_IMMUTABLE');
    as('vc-rev');
    expect((await call('POST', `/rule-sets/${rs}/approve`)).body.status).toBe('APPROVED');
  });
  it('refuses a run recorded against a different case set', async () => {
    const r = await pgliteRpc(() => fixture.pg).rpc('taxguard_tax_rule_test_run_record', { p_tenant: T, p_actor: 'vc-prep', p_rule_set: rs,
      p_run: { contentSha256: (await call('GET', `/rule-sets/${rs}`)).body.contentSha256, testsSha256: 'f'.repeat(64), engineVersion: 'x', testCount: 2, passedCount: 2, results: [] } });
    expect(r.error?.message).toBe('TAX_RULE_TESTS_CHANGED');
  });
});
