import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTaxEngineRouter } from '../server/routes/taxEngine.routes';
import { TaxEngineStore } from '../server/taxguard/taxEngine/taxEngineStore';
import { syntheticRuleSet, SYNTHETIC_SOURCE_ID } from '../server/taxguard/taxEngine/syntheticFixtures';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Proposal 038: a rule set is submitted or approved only when its verification cases assert every
// declared output and exercise every filing-status variant (and the default path).
// SYNTHETIC sources, rule sets and cases only — nothing here is tax law.
const T = 'tenantA';
const roles: Record<string, string> = { 'cv-prep': 'accountant', 'cv-rev': 'senior_reviewer', 'cv-bk': 'bookkeeper' };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let user: any; let rs = '';
const as = (uid: string) => { user = { id: uid, role: roles[uid], tenantId: T, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown) => fetch(origin + '/tax' + path, { method, headers: { 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).then(async r => ({ status: r.status, body: await r.json() as any }));
const inputs = [{ factPath: 'synthetic.income_a', value: '5000.00', evidenceIds: ['doc:synthetic-case'] }];
const testCase = (expected: Record<string, string>, filingStatus?: string) =>
  ({ name: 'Synthetic worked example', inputs, expected, sourceId: SYNTHETIC_SOURCE_ID, citation: 'Synthetic fixture example 1', ...(filingStatus ? { filingStatus } : {}) });

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(250000|260000|330000|360000|380000)_/);
  await fixture.pg.exec(`INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES ('${T}','cv-prep','accountant','active'),('${T}','cv-rev','senior_reviewer','active'),('${T}','cv-bk','bookkeeper','active');`);
  const app = express();
  app.use('/tax', createTaxEngineRouter({ store: () => new TaxEngineStore(pgliteRpc(() => fixture.pg)), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  as('cv-prep');
  await call('POST', '/sources', { sourceId: SYNTHETIC_SOURCE_ID, jurisdiction: 'state', jurisdictionCode: 'ZZ', authorityType: 'synthetic_test', title: 'Synthetic fixture source', issuer: 'Synthetic', citation: 'Synthetic', taxYears: [2025] });
  as('cv-rev'); await call('POST', `/sources/${SYNTHETIC_SOURCE_ID}/verify`, { documentSha256: 'a'.repeat(64) });
  as('cv-prep'); rs = (await call('POST', '/rule-sets', { definition: syntheticRuleSet() })).body.ruleSetId;
}, 90000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

describe('verification-case coverage', () => {
  it('reports every uncovered output and filing-status variant from the definition', async () => {
    as('cv-prep');
    expect((await call('GET', `/rule-sets/${rs}/coverage`)).body).toMatchObject({ ruleSetId: rs, missingOutputs: ['synthetic_amount', 'synthetic_base'], missingFilingStatuses: ['default', 'synthetic_joint'] });
    as('cv-bk'); expect((await call('GET', `/rule-sets/${rs}/coverage`)).status).toBe(403);
  });
  it('refuses submission with passing but incomplete cases and names what is missing', async () => {
    as('cv-prep');
    await call('POST', `/rule-sets/${rs}/tests`, testCase({ synthetic_amount: '290.00' }));
    expect((await call('POST', `/rule-sets/${rs}/run-tests`)).body).toMatchObject({ testCount: 1, allPassed: true });
    const refused = await call('POST', `/rule-sets/${rs}/submit`);
    expect(refused.status).toBe(409);
    expect(refused.body).toEqual({ code: 'TAX_RULE_SET_COVERAGE_INCOMPLETE', detail: 'outputs=synthetic_base;filingStatuses=synthetic_joint' });
    await call('POST', `/rule-sets/${rs}/tests`, testCase({ synthetic_amount: '217.50' }, 'synthetic_joint'));
    expect((await call('POST', `/rule-sets/${rs}/submit`)).body).toEqual({ code: 'TAX_RULE_SET_COVERAGE_INCOMPLETE', detail: 'outputs=synthetic_base' });
  });
  it('accepts full coverage only with a passing run of the current cases; approval re-checks', async () => {
    as('cv-prep');
    await call('POST', `/rule-sets/${rs}/tests`, testCase({ synthetic_base: '4000.00' }));
    expect((await call('GET', `/rule-sets/${rs}/coverage`)).body).toMatchObject({ missingOutputs: [], missingFilingStatuses: [] });
    expect((await call('POST', `/rule-sets/${rs}/submit`)).body.code).toBe('TAX_RULE_SET_TESTS_NOT_RUN');
    expect((await call('POST', `/rule-sets/${rs}/run-tests`)).body).toMatchObject({ testCount: 3, passedCount: 3, allPassed: true });
    expect((await call('POST', `/rule-sets/${rs}/submit`)).body.status).toBe('PENDING_REVIEW');
    as('cv-rev');
    expect((await call('POST', `/rule-sets/${rs}/approve`)).body.status).toBe('APPROVED');
  });
  it('exposes the coverage functions to service_role only', async () => {
    const rows = (await fixture.pg.query<{ proname: string; anon: boolean; auth: boolean; svc: boolean }>(`SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth, has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc FROM pg_proc p
      WHERE p.proname IN ('taxguard_tax_rule_coverage','taxguard_tax_rule_coverage_get','taxguard_tax_require_passing_tests') ORDER BY 1`)).rows;
    expect(rows).toEqual([{ proname: 'taxguard_tax_require_passing_tests', anon: false, auth: false, svc: false }, { proname: 'taxguard_tax_rule_coverage', anon: false, auth: false, svc: false },
      { proname: 'taxguard_tax_rule_coverage_get', anon: false, auth: false, svc: true }]);
  });
});
