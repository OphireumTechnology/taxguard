import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';
import { createTaxEngineRouter } from '../server/routes/taxEngine.routes';
import { TaxEngineStore } from '../server/taxguard/taxEngine/taxEngineStore';
import { TAX_ENGINE_VERSION } from '../server/taxguard/taxEngine/ruleSetDefinition';
import { syntheticRuleSet, SYNTHETIC_SOURCE_ID } from '../server/taxguard/taxEngine/syntheticFixtures';

// Block 70: return-level diagnostics (proposal 20261019150000, review only) over HTTP on real PostgreSQL with every
// proposal applied. The governed diagnostics run detects findings on open draft return versions at each point of their
// life; severity comes from the governed rule table; return-level findings never block preparing a fixing version.
// The setup is Block 69's (a submitted return version) in its own tenant. SYNTHETIC data only.
const T = 'tenantReturnDiag', T2 = 'tenantReturnDiagOther', C = 'rvClient';
const roles: Record<string, string> = { 'rv-mgr': 'practice_manager', 'rv-prep': 'accountant', 'rv-rev': 'reviewer', 'rv-out': 'reviewer', 'rv-client': 'client' };
let db: TestDatabase; let caseId = '', engagementId = '', ruleSetId = '', version = '';
let server: Server; let origin = ''; let user: any = null;
const as = (uid: string, tenantId = T) => { user = { id: uid, role: roles[uid] ?? 'practice_manager', tenantId, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown) => fetch(origin + '/tax' + path, { method, headers: { 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).then(async r => ({ status: r.status, body: await r.json() as any }));
const rpc = async (fn: string, args: Record<string, unknown>) => { const r = await pgRpc(db.pool).rpc(fn, args); return r; };
const verify = (uid: string) => { as(uid); return call('POST', `/returns/${version}/verify`); };
const approve = () => { as('rv-rev'); return call('POST', `/returns/${version}/approve`, {}); };

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic verification practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'rv-client', 'Synthetic Verification Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ('${T}', 'rv-mgr', 'practice_manager', 'active', NULL), ('${T}', 'rv-prep', 'accountant', 'active', NULL),
      ('${T}', 'rv-rev', 'reviewer', 'active', NULL), ('${T}', 'rv-out', 'reviewer', 'active', NULL), ('${T}', 'rv-client', 'client', 'active', '${C}'),
      ('${T2}', 'rv-foreign', 'practice_manager', 'active', NULL);`);
  const practice = new PracticeStore(pgRpc(db.pool));
  engagementId = (await practice.createEngagement(T, C, 'rv-mgr', 'rv-engagement-1', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'rv-mgr', engagementId, 'active', 1);
  for (const [role, userId] of [['preparer', 'rv-prep'], ['reviewer', 'rv-rev']])
    await practice.assign(T, C, 'rv-mgr', `rv-assign-${role}`, { engagementId, taxYear: 2025, role, userId, reason: 'Synthetic staffing' });
  caseId = (await new CaseStore(pgRpc(db.pool)).create(T, C, 'rv-mgr', 'rv-case-key-1', { engagementId, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  const app = express();
  app.use('/tax', createTaxEngineRouter({ store: () => new TaxEngineStore(pgRpc(db.pool)), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  // Synthetic stand-in for the owner's authority configuration (reviewed database change in reality).
  await db.pool.query(`INSERT INTO taxguard_tax_approval_policies(tenant_id, function_code, policy_version, requires_eligibility, requires_designation,
      requires_case_assignment, accepted_credentials, eligibility_text, approved_by) VALUES ($1, 'RETURN_TEMPLATE_APPROVAL', 1, true, true, false, ARRAY['CPA'],
      'Synthetic policy for tests: verified CPA with a designation.', 'rv-owner'), ($1, 'RETURN_DRAFT_REVIEW', 1, false, false, true, '{}',
      'Synthetic policy for tests: the case reviewer assignment.', 'rv-owner')`, [T]);
  await db.pool.query(`INSERT INTO taxguard_tax_professional_eligibility(tenant_id, person_uid, credential_type, credential_reference, issuing_jurisdiction,
      scope_jurisdictions, valid_from, expires_on, verified_by, verification_reference) VALUES ($1, 'rv-rev', 'CPA', 'synthetic-licence', 'NY', ARRAY['US'],
      '2025-01-01', '2099-12-31', 'rv-owner', 'synthetic-registry-lookup')`, [T]);
  await db.pool.query(`INSERT INTO taxguard_tax_function_designations(tenant_id, person_uid, function_code, policy_version, designation_reference, designated_by)
      VALUES ($1, 'rv-rev', 'RETURN_TEMPLATE_APPROVAL', 1, 'synthetic-designation', 'rv-owner')`, [T]);
  as('rv-prep');
  expect((await call('POST', '/sources', { sourceId: SYNTHETIC_SOURCE_ID, jurisdiction: 'state', jurisdictionCode: 'ZZ', authorityType: 'synthetic_test',
    title: 'Synthetic fixture source (not tax law)', issuer: 'Synthetic test issuer', citation: 'Synthetic fixture', taxYears: [2025] })).status).toBe(201);
  as('rv-rev'); await call('POST', `/sources/${SYNTHETIC_SOURCE_ID}/verify`, { documentSha256: 'a'.repeat(64) });
  as('rv-prep'); ruleSetId = (await call('POST', '/rule-sets', { definition: syntheticRuleSet() })).body.ruleSetId;
  for (const [filingStatus, expected] of [[undefined, { synthetic_base: '4000.00', synthetic_amount: '290.00' }], ['synthetic_joint', { synthetic_base: '3000.00', synthetic_amount: '217.50' }]] as const)
    await call('POST', `/rule-sets/${ruleSetId}/tests`, { name: 'Synthetic example ' + (filingStatus ?? 'single'), sourceId: SYNTHETIC_SOURCE_ID, citation: 'Synthetic fixture example',
      ...(filingStatus ? { filingStatus } : {}), inputs: [{ factPath: 'synthetic.income_a', value: '5000.00', evidenceIds: ['doc:rule-test-fixture'] }], expected });
  await call('POST', `/rule-sets/${ruleSetId}/run-tests`); await call('POST', `/rule-sets/${ruleSetId}/submit`);
  as('rv-rev'); expect((await call('POST', `/rule-sets/${ruleSetId}/approve`)).body.status).toBe('APPROVED');
  await db.pool.query(`INSERT INTO taxguard_documents(document_id, tenant_id, client_id, engagement_id, tax_year, case_id, version, hash, mime_type, status, quarantine_status, created_by)
    VALUES ('rv-w2', $1, $2, $3, 2025, $4, 1, repeat('1', 64), 'application/pdf', 'VERIFIED', 'CLEAN', 'rv-client')`, [T, C, engagementId, caseId]);
  // Calculation run, conclusion, mapping rule, mapping, template and a submitted return version.
  as('rv-prep'); const run = (await call('POST', `/cases/${caseId}/runs`, { ruleSetId, inputs: [{ factPath: 'synthetic.income_a', value: '5000.00', evidenceIds: ['document:rv-w2'] }] })).body.run_id;
  as('rv-rev'); await call('POST', `/runs/${run}/approve`, { note: 'Synthetic inputs traced to evidence' });
  as('rv-prep'); const k = (await call('POST', `/cases/${caseId}/conclusions`, { type: 'INCOME_INCLUSION', statement: 'Synthetic wages for the year.', amount: '5000.00',
    links: [{ type: 'EVIDENCE', ref: 'document:rv-w2' }, { type: 'CALCULATION', ref: run }] })).body.conclusionId;
  await call('POST', `/conclusions/${k}/submit`); as('rv-rev'); await call('POST', `/conclusions/${k}/approve`, {});
  as('rv-prep'); const rule = (await call('POST', '/form-rules', { definition: { jurisdiction: 'federal', jurisdictionCode: 'US', returnFamily: '1040', taxYear: 2025,
    formId: 'SYN-1040', formVersion: '2025.0', effectiveFrom: '2025-01-01', sourceId: SYNTHETIC_SOURCE_ID, lines: [
      { schedule: 'MAIN', line: '1a', field: 'f1_wages', valueType: 'MONEY', required: true, aggregate: 'SINGLE', source: { conclusionType: 'INCOME_INCLUSION', value: 'AMOUNT' } },
      { schedule: 'MAIN', line: '16', field: 'f1_tax', valueType: 'MONEY', required: true, aggregate: 'SINGLE',
        source: { conclusionType: 'INCOME_INCLUSION', value: 'OUTPUT', outputKey: 'synthetic_amount' } }] } })).body.ruleId;
  await call('POST', `/form-rules/${rule}/submit`); as('rv-rev'); await call('POST', `/form-rules/${rule}/approve`);
  as('rv-prep'); expect((await call('POST', `/cases/${caseId}/form-mappings`, { ruleId: rule })).status).toBe(201);
  const tpl = (await call('POST', '/return-templates', { definition: { templateId: 'SYN-1040-RETURN', jurisdiction: 'federal', jurisdictionCode: 'US', returnFamily: '1040',
    taxYear: 2025, effectiveFrom: '2025-01-01', sourceId: SYNTHETIC_SOURCE_ID, forms: [{ formId: 'SYN-1040', formVersion: '2025.0', required: true }] } })).body.templateRuleId;
  await call('POST', `/return-templates/${tpl}/submit`); as('rv-rev'); expect((await call('POST', `/return-templates/${tpl}/approve`)).body.status).toBe('APPROVED');
  as('rv-prep'); version = (await call('POST', `/cases/${caseId}/returns`, { templateRuleId: tpl })).body.returnVersionId;
}, 240_000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await db?.stop(); });

const diagnose = async () => { as('rv-rev'); const r = await call('POST', `/cases/${caseId}/diagnostics/run`); expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  return (r.body.items ?? r.body.diagnostics ?? []).filter((d: any) => d.affected_type === 'RETURN_VERSION').map((d: any) => [d.rule_code, d.severity, d.status]).sort(); };

describe('return-level diagnostics', () => {
  it('follow the version: awaiting verification, awaiting review, discrepancy (blocking), then nothing once approved', async () => {
    expect(await diagnose()).toEqual([]); // a draft version has no return-level finding
    as('rv-prep'); expect((await call('POST', `/returns/${version}/submit`)).body.status).toBe('SUBMITTED');
    expect(await diagnose()).toEqual([['RETURN_AWAITING_VERIFICATION', 'WARNING', 'OPEN']]);
    expect((await verify('rv-rev')).body.result).toBe('VERIFIED');
    expect(await diagnose()).toEqual([['RETURN_AWAITING_REVIEW', 'WARNING', 'OPEN']]);
    const runId = (await db.pool.query(`SELECT run_id FROM taxguard_tax_calc_runs WHERE tenant_id = $1`, [T])).rows[0].run_id;
    await rpc('taxguard_tax_return_verify', { p_tenant: T, p_actor: 'rv-rev', p_version: version, p_runs: [{ runId, recomputedOutputSha256: 'f'.repeat(64) }],
      p_engine_version: TAX_ENGINE_VERSION });
    expect(await diagnose()).toEqual([['RETURN_VERIFICATION_DISCREPANCY', 'BLOCKING', 'OPEN']]);
    // A blocking finding cannot be acknowledged away.
    const d = (await db.pool.query(`SELECT diagnostic_id FROM taxguard_case_diagnostics WHERE tenant_id = $1 AND rule_code = 'RETURN_VERIFICATION_DISCREPANCY' AND status = 'OPEN'`, [T])).rows[0];
    as('rv-rev'); expect((await call('POST', `/diagnostics/${d.diagnostic_id}/acknowledge`, { note: 'Synthetic: trying to waive a blocking finding' })).body.code).toBe('DIAGNOSTIC_NOT_WAIVABLE');
    expect((await verify('rv-rev')).body.result).toBe('VERIFIED');
    expect((await approve()).body.status).toBe('APPROVED');
    expect(await diagnose()).toEqual([]);
    const history = (await db.pool.query(`SELECT rule_code, status FROM taxguard_case_diagnostics WHERE tenant_id = $1 AND affected_type = 'RETURN_VERSION' ORDER BY detected_at`, [T])).rows;
    expect(history.map((h: any) => h.status)).toEqual(['CLEARED', 'CLEARED', 'CLEARED']); // history is kept, cleared by later runs
  });

  it('severity comes from the governed rule table, which no API role can change', async () => {
    const rules = (await db.pool.query(`SELECT rule_code, severity FROM taxguard_diagnostic_rules WHERE rule_code LIKE 'RETURN\_%' ORDER BY rule_code`)).rows;
    expect(rules).toEqual([{ rule_code: 'RETURN_AWAITING_REVIEW', severity: 'WARNING' }, { rule_code: 'RETURN_AWAITING_VERIFICATION', severity: 'WARNING' },
      { rule_code: 'RETURN_OPTIONAL_FORM_UNMAPPED', severity: 'INFO' }, { rule_code: 'RETURN_VERIFICATION_DISCREPANCY', severity: 'BLOCKING' },
      { rule_code: 'RETURN_VERSION_STALE', severity: 'BLOCKING' }]);
    for (const role of ['anon', 'authenticated', 'service_role'])
      expect((await db.pool.query(`SELECT has_table_privilege($1, 'public.taxguard_diagnostic_rules', 'UPDATE') OR has_table_privilege($1, 'public.taxguard_diagnostic_rules', 'INSERT') AS ok`,
        [role])).rows[0].ok, role).toBe(false);
  });

  it('a stale version is a blocking finding, and a return-level finding never blocks preparing the fixing version', async () => {
    // Revise the conclusion on the same sources: the mapping and the approved version go stale.
    as('rv-prep'); const k = (await call('GET', `/cases/${caseId}/conclusions`)).body.items.find((x: any) => x.status === 'APPROVED');
    const revised = (await call('POST', `/conclusions/${k.conclusionId}/revise`, { amount: '5000.00', statement: 'Synthetic wages for the year, restated.',
      links: k.links.map((l: any) => ({ type: l.type, ref: l.ref })) })).body.conclusionId;
    await call('POST', `/conclusions/${revised}/submit`); as('rv-rev'); expect((await call('POST', `/conclusions/${revised}/approve`, {})).body.status).toBe('APPROVED');
    expect(await diagnose()).toEqual([['RETURN_VERSION_STALE', 'BLOCKING', 'OPEN']]);
    // The fix: map the form again and prepare a new version, despite the open return-level blocking finding.
    const ruleId = (await call('GET', `/cases/${caseId}/form-mappings`)).body.items.find((m: any) => m.status === 'CURRENT').ruleId;
    as('rv-prep'); expect((await call('POST', `/cases/${caseId}/form-mappings`, { ruleId })).status).toBe(201);
    const tpl = (await call('GET', '/return-templates?taxYear=2025')).body.items[0].templateRuleId;
    const prepared = await call('POST', `/cases/${caseId}/returns`, { templateRuleId: tpl });
    expect(prepared.status, JSON.stringify(prepared.body)).toBe(201);
    expect(prepared.body).toMatchObject({ version: 2, status: 'DRAFT', stale: [] });
    expect(await diagnose()).toEqual([]); // the stale version is superseded; nothing open remains
    // A case-level blocking finding still refuses preparation.
    const run = (await db.pool.query(`INSERT INTO taxguard_case_diagnostic_runs(tenant_id, case_id, client_id, tax_year, run_by, detected)
      VALUES ($1, $2, $3, 2025, 'rv-rev', 1) RETURNING run_id`, [T, caseId, C])).rows[0].run_id;
    await db.pool.query(`INSERT INTO taxguard_case_diagnostics(tenant_id, case_id, client_id, tax_year, rule_code, rule_version, severity, affected_type,
      affected_id, message, detected_run, last_detected_run) VALUES ($1, $2, $3, 2025, 'CASE_ON_HOLD', 1, 'BLOCKING', 'CASE', $2, 'Synthetic hold', $4, $4)`, [T, caseId, C, run]);
    as('rv-prep'); expect(JSON.parse((await call('POST', `/cases/${caseId}/returns`, { templateRuleId: tpl })).body.detail ?? '[]'))
      .toContainEqual({ reason: 'RETURN_BLOCKING_DIAGNOSTICS', blocking: 1 });
  });
});
