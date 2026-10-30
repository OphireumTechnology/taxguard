import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';
import { createTaxEngineRouter } from '../server/routes/taxEngine.routes';
import { TaxEngineStore } from '../server/taxguard/taxEngine/taxEngineStore';
import { syntheticRuleSet, SYNTHETIC_SOURCE_ID } from '../server/taxguard/taxEngine/syntheticFixtures';

// Block 75: return comparison (proposal 20261019200000, review only) over HTTP on real PostgreSQL with every proposal
// applied. A 2024 and a 2025 return of one client are built through the real functions; the 2025 case has its own
// reviewer, so that access to the prior-year case is tested. The policies, eligibility, designations and the variance
// policy are synthetic stand-ins for the owner's reviewed configuration. Read only: nothing is gated, signed or filed.
// SYNTHETIC data only.
const T = 'tenantReturnComparison', T2 = 'tenantReturnComparisonOther', C = 'rcClient';
const roles: Record<string, string> = { 'rc-mgr': 'practice_manager', 'rc-prep': 'accountant', 'rc-rev': 'reviewer', 'rc-rev25': 'reviewer', 'rc-out': 'reviewer' };
const reviewerOf: Record<number, string> = { 2024: 'rc-rev', 2025: 'rc-rev25' };
let db: TestDatabase; let server: Server; let origin = ''; let user: any = null;
const cases: Record<number, string> = {}; const versions: Record<string, string> = {}; const rules: Record<number, string> = {}; const templates: Record<number, string> = {};
let conclusion2025 = '';
const as = (uid: string, tenantId = T) => { user = { id: uid, role: roles[uid] ?? 'practice_manager', tenantId, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown) => fetch(origin + '/tax' + path, { method, headers: { 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).then(async r => ({ status: r.status, body: await r.json() as any }));
const ok = async <R extends { status: number; body: any }>(p: Promise<R>, status = 200) => { const r = await p; expect(r.status, JSON.stringify(r.body)).toBe(status); return r.body; };
const compare = (uid: string, version: string) => { as(uid); return call('GET', `/returns/${version}/comparison`); };
const line = (lines: any[], field: string) => lines.find(l => l.field === field);

// One approved calculation run and approved INCOME_INCLUSION conclusion of `wages` for the year's case.
const approvedRun = async (year: number, wages: string) => {
  as('rc-prep'); const run = (await ok(call('POST', `/cases/${cases[year]}/runs`, { ruleSetId: rules[year],
    inputs: [{ factPath: 'synthetic.income_a', value: wages, evidenceIds: [`document:rc-w2-${year}`] }] }), 201)).run_id;
  as(reviewerOf[year]); await ok(call('POST', `/runs/${run}/approve`, { note: 'Synthetic inputs traced to evidence' }));
  return run;
};
const links = (year: number, run: string) => [{ type: 'EVIDENCE', ref: `document:rc-w2-${year}` }, { type: 'CALCULATION', ref: run }];

// Everything a year needs before a return can be prepared: rule set, evidence, conclusion, form rule, mapping, template.
const buildYear = async (year: number, wages: string) => {
  as('rc-prep'); const ruleSetId = (await ok(call('POST', '/rule-sets', { definition: syntheticRuleSet(year) }), 201)).ruleSetId; rules[year] = ruleSetId;
  for (const [filingStatus, expected] of [[undefined, { synthetic_base: '4000.00', synthetic_amount: '290.00' }], ['synthetic_joint', { synthetic_base: '3000.00', synthetic_amount: '217.50' }]] as const)
    await ok(call('POST', `/rule-sets/${ruleSetId}/tests`, { name: 'Synthetic example ' + (filingStatus ?? 'single'), sourceId: SYNTHETIC_SOURCE_ID, citation: 'Synthetic fixture example',
      ...(filingStatus ? { filingStatus } : {}), inputs: [{ factPath: 'synthetic.income_a', value: '5000.00', evidenceIds: ['doc:rule-test-fixture'] }], expected }), 201);
  await call('POST', `/rule-sets/${ruleSetId}/run-tests`); await call('POST', `/rule-sets/${ruleSetId}/submit`);
  as('rc-rev'); expect((await call('POST', `/rule-sets/${ruleSetId}/approve`)).body.status).toBe('APPROVED');
  const engagement = (await db.pool.query(`SELECT engagement_id FROM taxguard_cases WHERE tenant_id = $1 AND case_id = $2`, [T, cases[year]])).rows[0].engagement_id;
  await db.pool.query(`INSERT INTO taxguard_documents(document_id, tenant_id, client_id, engagement_id, tax_year, case_id, version, hash, mime_type, status, quarantine_status, created_by)
    VALUES ($5, $1, $2, $3, $6, $4, 1, repeat('1', 64), 'application/pdf', 'VERIFIED', 'CLEAN', 'rc-client')`, [T, C, engagement, cases[year], `rc-w2-${year}`, year]);
  const run = await approvedRun(year, wages);
  as('rc-prep'); const k = (await ok(call('POST', `/cases/${cases[year]}/conclusions`, { type: 'INCOME_INCLUSION', statement: 'Synthetic wages for the year.', amount: wages,
    links: links(year, run) }), 201)).conclusionId;
  await call('POST', `/conclusions/${k}/submit`); as(reviewerOf[year]); expect((await call('POST', `/conclusions/${k}/approve`, {})).body.status).toBe('APPROVED');
  as('rc-prep'); const rule = (await ok(call('POST', '/form-rules', { definition: { jurisdiction: 'federal', jurisdictionCode: 'US', returnFamily: '1040', taxYear: year,
    formId: 'SYN-1040', formVersion: `${year}.0`, effectiveFrom: `${year}-01-01`, sourceId: SYNTHETIC_SOURCE_ID, lines: [
      { schedule: 'MAIN', line: '1a', field: 'f1_wages', valueType: 'MONEY', required: true, aggregate: 'SINGLE', source: { conclusionType: 'INCOME_INCLUSION', value: 'AMOUNT' } },
      { schedule: 'MAIN', line: '16', field: 'f1_tax', valueType: 'MONEY', required: true, aggregate: 'SINGLE',
        source: { conclusionType: 'INCOME_INCLUSION', value: 'OUTPUT', outputKey: 'synthetic_amount' } }] } }), 201)).ruleId;
  await call('POST', `/form-rules/${rule}/submit`); as('rc-rev'); expect((await call('POST', `/form-rules/${rule}/approve`)).body.status).toBe('APPROVED');
  as('rc-prep'); await ok(call('POST', `/cases/${cases[year]}/form-mappings`, { ruleId: rule }), 201);
  const tpl = (await ok(call('POST', '/return-templates', { definition: { templateId: 'SYN-1040-RETURN', jurisdiction: 'federal', jurisdictionCode: 'US', returnFamily: '1040',
    taxYear: year, effectiveFrom: `${year}-01-01`, sourceId: SYNTHETIC_SOURCE_ID, forms: [{ formId: 'SYN-1040', formVersion: `${year}.0`, required: true }] } }), 201)).templateRuleId;
  await call('POST', `/return-templates/${tpl}/submit`); as('rc-rev'); expect((await call('POST', `/return-templates/${tpl}/approve`)).body.status).toBe('APPROVED');
  templates[year] = tpl; (rules as any)[`form-${year}`] = rule;
  return k;
};
const prepare = async (year: number) => { as('rc-prep'); return (await ok(call('POST', `/cases/${cases[year]}/returns`, { templateRuleId: templates[year] }), 201)).returnVersionId as string; };

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic comparison practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'rc-client', 'Synthetic Comparison Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ('${T}', 'rc-mgr', 'practice_manager', 'active', NULL), ('${T}', 'rc-prep', 'accountant', 'active', NULL),
      ('${T}', 'rc-rev', 'reviewer', 'active', NULL), ('${T}', 'rc-rev25', 'reviewer', 'active', NULL), ('${T}', 'rc-out', 'reviewer', 'active', NULL),
      ('${T}', 'rc-client', 'client', 'active', '${C}'), ('${T2}', 'rc-foreign', 'practice_manager', 'active', NULL);`);
  const practice = new PracticeStore(pgRpc(db.pool));
  const engagementId = (await practice.createEngagement(T, C, 'rc-mgr', 'rc-engagement-1', { title: 'Synthetic 2024 and 2025 returns', type: 'tax_preparation',
    taxYears: [2024, 2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'rc-mgr', engagementId, 'active', 1);
  for (const year of [2024, 2025]) {
    for (const [role, userId] of [['preparer', 'rc-prep'], ['reviewer', reviewerOf[year]]])
      await practice.assign(T, C, 'rc-mgr', `rc-assign-${role}-${year}`, { engagementId, taxYear: year, role, userId, reason: 'Synthetic staffing' });
    cases[year] = (await new CaseStore(pgRpc(db.pool)).create(T, C, 'rc-mgr', `rc-case-key-${year}`, { engagementId, taxYear: year, returnFamily: '1040' }) as any).caseId;
  }
  const app = express();
  app.use('/tax', createTaxEngineRouter({ store: () => new TaxEngineStore(pgRpc(db.pool)), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  // Synthetic stand-in for the owner's authority configuration (reviewed database change in reality).
  await db.pool.query(`INSERT INTO taxguard_tax_approval_policies(tenant_id, function_code, policy_version, requires_eligibility, requires_designation,
      requires_case_assignment, accepted_credentials, eligibility_text, approved_by) VALUES ($1, 'RETURN_TEMPLATE_APPROVAL', 1, true, true, false, ARRAY['CPA'],
      'Synthetic policy for tests: verified CPA with a designation.', 'rc-owner'), ($1, 'RETURN_DRAFT_REVIEW', 1, false, false, true, '{}',
      'Synthetic policy for tests: the case reviewer assignment.', 'rc-owner'), ($1, 'FORM_RULE_APPROVAL', 1, true, true, false, ARRAY['CPA'],
      'Synthetic policy for tests: verified CPA with a form-rule designation.', 'rc-owner')`, [T]);
  await db.pool.query(`INSERT INTO taxguard_tax_professional_eligibility(tenant_id, person_uid, credential_type, credential_reference, issuing_jurisdiction,
      scope_jurisdictions, valid_from, expires_on, verified_by, verification_reference) VALUES ($1, 'rc-rev', 'CPA', 'synthetic-licence', 'NY', ARRAY['US'],
      '2024-01-01', '2099-12-31', 'rc-owner', 'synthetic-registry-lookup')`, [T]);
  await db.pool.query(`INSERT INTO taxguard_tax_function_designations(tenant_id, person_uid, function_code, policy_version, designation_reference, designated_by)
      VALUES ($1, 'rc-rev', 'RETURN_TEMPLATE_APPROVAL', 1, 'synthetic-designation', 'rc-owner'),
        ($1, 'rc-rev', 'FORM_RULE_APPROVAL', 1, 'synthetic-form-rule-designation', 'rc-owner')`, [T]);
  as('rc-prep');
  await ok(call('POST', '/sources', { sourceId: SYNTHETIC_SOURCE_ID, jurisdiction: 'state', jurisdictionCode: 'ZZ', authorityType: 'synthetic_test',
    title: 'Synthetic fixture source (not tax law)', issuer: 'Synthetic test issuer', citation: 'Synthetic fixture', taxYears: [2024, 2025] }), 201);
  as('rc-rev'); await call('POST', `/sources/${SYNTHETIC_SOURCE_ID}/verify`, { documentSha256: 'a'.repeat(64) });
  await buildYear(2024, '4000.00');
  conclusion2025 = await buildYear(2025, '5000.00');
  versions.y2024 = await prepare(2024);
  versions.v1 = await prepare(2025);
}, 300_000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await db?.stop(); });

describe('Block 75: return comparison (proposal 20261019200000)', () => {
  it('compares only with a prior-year version approved at Stage 09; without a variance policy nothing is flagged', async () => {
    // The 2024 version exists but is a draft: it is not a basis for comparison.
    const before = await ok(compare('rc-prep', versions.v1));
    expect(before).toMatchObject({ returnVersionId: versions.v1, taxYear: 2025, version: 1, previousVersion: null,
      priorYear: { status: 'NOT_AVAILABLE', taxYear: 2024 }, varianceCheck: 'NOT_CONFIGURED', variancePolicyVersion: null, returnUse: 'BLOCKED' });
    expect(Object.keys(before.priorYear).sort()).toEqual(['status', 'taxYear']);
    as('rc-prep'); expect((await ok(call('POST', `/returns/${versions.y2024}/submit`))).status).toBe('SUBMITTED');
    as('rc-rev'); expect((await ok(call('POST', `/returns/${versions.y2024}/verify`), 201)).result).toBe('VERIFIED');
    expect((await compare('rc-prep', versions.v1)).body.priorYear.status).toBe('NOT_AVAILABLE');
    as('rc-rev'); expect((await ok(call('POST', `/returns/${versions.y2024}/approve`, {}))).status).toBe('APPROVED');

    const after = await ok(compare('rc-prep', versions.v1));
    expect(after.priorYear).toMatchObject({ status: 'COMPARED', taxYear: 2024, returnVersionId: versions.y2024, caseId: cases[2024], templateId: 'SYN-1040-RETURN',
      version: 1, basis: 'STAGE_09_APPROVED', stale: false, matching: 'IDENTICAL_LINE_IDENTIFIERS' });
    expect(after.priorYear.lines.map((l: any) => [l.formId, l.schedule, l.line, l.field])).toEqual([['SYN-1040', 'MAIN', '16', 'f1_tax'], ['SYN-1040', 'MAIN', '1a', 'f1_wages']]);
    expect(line(after.priorYear.lines, 'f1_wages')).toEqual({ formId: 'SYN-1040', priorFormVersion: '2024.0', formVersion: '2025.0', schedule: 'MAIN', line: '1a',
      field: 'f1_wages', valueType: 'MONEY', kind: 'CHANGED', priorValue: '4000.00', value: '5000.00', change: '1000.00', changeBasisPoints: 2500, variance: null });
    const tax = line(after.priorYear.lines, 'f1_tax');
    expect(tax).toMatchObject({ kind: 'CHANGED', variance: null });
    expect(Number(tax.change)).toBeCloseTo(Number(tax.value) - Number(tax.priorValue), 2);
    expect((await ok(compare('rc-mgr', versions.v1)))).toEqual(after);
  });

  it('is scoped: an outsider reads not found, and prior-year values need access to the prior-year case', async () => {
    expect((await compare('rc-out', versions.v1)).body.code).toBe('TAX_RETURN_NOT_FOUND');
    as('rc-foreign', T2); expect((await call('GET', `/returns/${versions.v1}/comparison`)).body.code).toBe('TAX_RETURN_NOT_FOUND');
    expect((await compare('rc-prep', 'not-a-uuid')).status).toBeGreaterThanOrEqual(400);
    // rc-rev reviews only the 2024 case, rc-rev25 only the 2025 case.
    expect((await compare('rc-rev', versions.v1)).body.code).toBe('TAX_RETURN_NOT_FOUND');
    expect((await compare('rc-rev25', versions.y2024)).body.code).toBe('TAX_RETURN_NOT_FOUND');
    const own = await ok(compare('rc-rev25', versions.v1));
    expect(own.priorYear).toEqual({ status: 'NOT_AVAILABLE', taxYear: 2024 });
    expect(JSON.stringify(own)).not.toContain(versions.y2024);
    expect(JSON.stringify(own)).not.toContain('4000.00');
  });

  it('a newer version is compared with the previous one and with the prior year; the earlier version keeps its own comparison', async () => {
    const run = await approvedRun(2025, '6000.00');
    as('rc-prep'); const revised = await ok(call('POST', `/conclusions/${conclusion2025}/revise`, { amount: '6000.00', links: links(2025, run) }), 201);
    await ok(call('POST', `/conclusions/${revised.conclusionId}/submit`));
    as('rc-rev25'); expect((await ok(call('POST', `/conclusions/${revised.conclusionId}/approve`, {}))).status).toBe('APPROVED');
    as('rc-prep'); await ok(call('POST', `/cases/${cases[2025]}/form-mappings`, { ruleId: (rules as any)['form-2025'] }), 201);
    versions.v2 = await prepare(2025);
    expect(versions.v2).not.toBe(versions.v1);
    const c = await ok(compare('rc-prep', versions.v2));
    expect(c).toMatchObject({ version: 2, previousVersion: { returnVersionId: versions.v1, version: 1, status: 'SUPERSEDED' }, varianceCheck: 'NOT_CONFIGURED' });
    expect(line(c.previousVersion.lines, 'f1_wages')).toEqual({ formId: 'SYN-1040', priorFormVersion: '2025.0', formVersion: '2025.0', schedule: 'MAIN', line: '1a',
      field: 'f1_wages', valueType: 'MONEY', kind: 'CHANGED', priorValue: '5000.00', value: '6000.00', change: '1000.00', changeBasisPoints: 2000, variance: null });
    expect(line(c.priorYear.lines, 'f1_wages')).toMatchObject({ priorValue: '4000.00', value: '6000.00', change: '2000.00', changeBasisPoints: 5000, variance: null });
    const first = await ok(compare('rc-prep', versions.v1));
    expect(first.previousVersion).toBeNull();
    expect(line(first.priorYear.lines, 'f1_wages').value).toBe('5000.00');
  });

  it('flags prior-year MONEY lines only under an approved variance policy, never the previous-version comparison', async () => {
    // Synthetic stand-in for the owner's variance policy: at least 1500.00 and at least 30% of the prior value.
    await expect(db.pool.query(`INSERT INTO taxguard_tax_variance_policies(tenant_id, policy_version, min_change_amount, min_change_basis_points, rationale,
      created_by, approved_by) VALUES ($1, 1, 1500.00, 3000, 'Synthetic variance policy for tests only.', 'rc-owner', 'rc-owner')`, [T])).rejects.toThrow(/check/i);
    await db.pool.query(`INSERT INTO taxguard_tax_variance_policies(tenant_id, policy_version, min_change_amount, min_change_basis_points, rationale,
      created_by, approved_by) VALUES ($1, 1, 1500.00, 3000, 'Synthetic variance policy for tests only.', 'rc-author', 'rc-owner')`, [T]);
    const c = await ok(compare('rc-prep', versions.v2));
    expect(c).toMatchObject({ varianceCheck: 'APPLIED', variancePolicyVersion: 1 });
    expect(line(c.priorYear.lines, 'f1_wages').variance).toBe(true); // 2000.00 change, 50%
    const tax = line(c.priorYear.lines, 'f1_tax');
    expect(Math.abs(Number(tax.change))).toBeLessThan(1500);
    expect(tax.variance).toBe(false);
    expect(c.previousVersion.lines.every((l: any) => l.variance === null)).toBe(true);
    // v1 changed by 1000.00 (25%): below both thresholds.
    expect(line((await ok(compare('rc-prep', versions.v1))).priorYear.lines, 'f1_wages').variance).toBe(false);
    // Other tenants are unaffected.
    expect((await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_tax_variance_policies WHERE tenant_id = $1`, [T2])).rows[0].n).toBe(0);
  });

  it('variance policies are immutable; no table privileges; only the entry point is granted', async () => {
    for (const sql of [`UPDATE taxguard_tax_variance_policies SET min_change_amount = 1 WHERE tenant_id = '${T}'`,
      `DELETE FROM taxguard_tax_variance_policies WHERE tenant_id = '${T}'`, 'TRUNCATE taxguard_tax_variance_policies'])
      await expect(db.pool.query(sql), sql).rejects.toThrow('TAX_VARIANCE_POLICY_IMMUTABLE');
    const priv = (await db.pool.query(`SELECT r.rolname,
        has_table_privilege(r.rolname, 'public.taxguard_tax_variance_policies', 'SELECT,INSERT,UPDATE,DELETE') AS tbl,
        has_function_privilege(r.rolname, 'public.taxguard_tax_return_comparison(text,text,uuid)', 'EXECUTE') AS entry,
        has_function_privilege(r.rolname, 'public.taxguard_tax_return_value_rows(text,uuid,boolean)', 'EXECUTE') AS rows_,
        has_function_privilege(r.rolname, 'public.taxguard_tax_return_value_diff(text,uuid,uuid,boolean,public.taxguard_tax_variance_policies)', 'EXECUTE') AS diff
      FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role') ORDER BY r.rolname`)).rows;
    expect(priv).toEqual([{ rolname: 'anon', tbl: false, entry: false, rows_: false, diff: false },
      { rolname: 'authenticated', tbl: false, entry: false, rows_: false, diff: false },
      { rolname: 'service_role', tbl: false, entry: true, rows_: false, diff: false }]);
  });
});
