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

// Block 72: independent quality control and final draft readiness (proposal 20261019170000, review only) over HTTP on
// real PostgreSQL with every proposal applied. A manager assigns a third person; the QC authority policy, designation,
// eligibility and checklist are synthetic stand-ins for the owner's reviewed configuration; readiness needs every input
// current. The setup is Block 71's (an approved return version) in its own tenant. SYNTHETIC data only.
const T = 'tenantReturnQc', T2 = 'tenantReturnQcOther', C = 'rvClient';
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
      'Synthetic policy for tests: the case reviewer assignment.', 'rv-owner'), ($1, 'FORM_RULE_APPROVAL', 1, true, true, false, ARRAY['CPA'],
      'Synthetic policy for tests: verified CPA with a form-rule designation.', 'rv-owner')`, [T]);
  await db.pool.query(`INSERT INTO taxguard_tax_professional_eligibility(tenant_id, person_uid, credential_type, credential_reference, issuing_jurisdiction,
      scope_jurisdictions, valid_from, expires_on, verified_by, verification_reference) VALUES ($1, 'rv-rev', 'CPA', 'synthetic-licence', 'NY', ARRAY['US'],
      '2025-01-01', '2099-12-31', 'rv-owner', 'synthetic-registry-lookup')`, [T]);
  await db.pool.query(`INSERT INTO taxguard_tax_function_designations(tenant_id, person_uid, function_code, policy_version, designation_reference, designated_by)
      VALUES ($1, 'rv-rev', 'RETURN_TEMPLATE_APPROVAL', 1, 'synthetic-designation', 'rv-owner'),
        ($1, 'rv-rev', 'FORM_RULE_APPROVAL', 1, 'synthetic-form-rule-designation', 'rv-owner')`, [T]);
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
  await call('POST', `/form-rules/${rule}/submit`); as('rv-rev'); expect((await call('POST', `/form-rules/${rule}/approve`)).body.status).toBe('APPROVED');
  as('rv-prep'); expect((await call('POST', `/cases/${caseId}/form-mappings`, { ruleId: rule })).status).toBe(201);
  const tpl = (await call('POST', '/return-templates', { definition: { templateId: 'SYN-1040-RETURN', jurisdiction: 'federal', jurisdictionCode: 'US', returnFamily: '1040',
    taxYear: 2025, effectiveFrom: '2025-01-01', sourceId: SYNTHETIC_SOURCE_ID, forms: [{ formId: 'SYN-1040', formVersion: '2025.0', required: true }] } })).body.templateRuleId;
  await call('POST', `/return-templates/${tpl}/submit`); as('rv-rev'); expect((await call('POST', `/return-templates/${tpl}/approve`)).body.status).toBe('APPROVED');
  as('rv-prep'); version = (await call('POST', `/cases/${caseId}/returns`, { templateRuleId: tpl })).body.returnVersionId;
}, 240_000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await db?.stop(); });

Object.assign(roles, { 'rv-qc': 'reviewer', 'rv-qc2': 'reviewer', 'rv-mgr2': 'practice_manager' });
const qcPost = (uid: string, results: unknown, note?: string) => { as(uid); return call('POST', `/returns/${version}/qc`, { results, ...(note === undefined ? {} : { note }) }); };
const readiness = async (uid = 'rv-prep') => { as(uid); const r = await call('GET', `/returns/${version}/readiness`); expect(r.status, JSON.stringify(r.body)).toBe(200); return r.body; };
const diagnoseCase = async () => { as('rv-rev'); expect((await call('POST', `/cases/${caseId}/diagnostics/run`)).status).toBeLessThan(300); };
const allPass = [{ code: 'TIES_TO_SOURCES', result: 'PASS' }, { code: 'PRIOR_YEAR_COMPARED', result: 'PASS' }];

beforeAll(async () => {
  await db.pool.query(`INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ($1, 'rv-qc', 'reviewer', 'active', NULL),
    ($1, 'rv-qc2', 'reviewer', 'active', NULL), ($1, 'rv-mgr2', 'practice_manager', 'active', NULL)`, [T]);
  // Synthetic stand-in for an approved book-to-tax workpaper, so that the case has no open ERROR finding.
  const set = (await db.pool.query(`INSERT INTO taxguard_b2t_mapping_sets(tenant_id, client_id, tax_year, return_family, version, status, prepared_by, reviewed_by)
    VALUES ($1, $2, 2025, '1040', 1, 'APPROVED', 'rv-prep', 'rv-rev') RETURNING set_id`, [T, C])).rows[0].set_id;
  await db.pool.query(`INSERT INTO taxguard_b2t_workpapers(tenant_id, client_id, tax_year, return_family, set_id, snapshot, snapshot_sha256, reconciled, unmapped_accounts,
    status, generated_by, reviewed_by) VALUES ($1, $2, 2025, '1040', $3, '{}'::jsonb, repeat('c', 64), true, 0, 'APPROVED', 'rv-prep', 'rv-rev')`, [T, C, set]);
  as('rv-prep'); expect((await call('POST', `/returns/${version}/submit`)).body.status).toBe('SUBMITTED');
  expect((await verify('rv-rev')).body.result).toBe('VERIFIED');
  expect((await approve()).body.status).toBe('APPROVED');
}, 120_000);

describe('independent quality control', () => {
  it('fails closed: only a manager assigns an independent staff member, and without a policy nothing is recorded', async () => {
    expect((await readiness()).reasons).toEqual(['DIAGNOSTICS_NOT_CURRENT', 'RISK_NOT_CURRENT', 'QC_NOT_RECORDED']);
    as('rv-qc'); expect((await call('GET', `/returns/${version}/qc-context`)).body.code).toBe('TAX_RETURN_NOT_FOUND');
    as('rv-prep'); expect((await call('POST', `/returns/${version}/qc-assignment`, { qcUid: 'rv-qc' })).body.code).toBe('TAX_RETURN_QC_ASSIGNER_REQUIRED');
    as('rv-mgr');
    for (const qcUid of ['rv-prep', 'rv-rev', 'rv-mgr'])
      expect((await call('POST', `/returns/${version}/qc-assignment`, { qcUid })).body.code, qcUid).toBe('TAX_RETURN_QC_NOT_INDEPENDENT');
    for (const qcUid of ['rv-client', 'rv-nobody', 'rv-foreign'])
      expect((await call('POST', `/returns/${version}/qc-assignment`, { qcUid })).body.code, qcUid).toBe('TAX_RETURN_QC_ASSIGNEE_INVALID');
    const assigned = await call('POST', `/returns/${version}/qc-assignment`, { qcUid: 'rv-qc' });
    expect(assigned.status, JSON.stringify(assigned.body)).toBe(201);
    expect((await call('POST', `/returns/${version}/qc-assignment`, { qcUid: 'rv-qc2' })).body.code).toBe('TAX_RETURN_QC_ALREADY_ASSIGNED');
    as('rv-qc');
    const queue = await call('GET', '/qc/queue');
    expect(queue.body.items).toMatchObject([{ returnVersionId: version, templateId: 'SYN-1040-RETURN', status: 'APPROVED', latestOutcome: null }]);
    const context = await call('GET', `/returns/${version}/qc-context`);
    expect(context.status).toBe(200);
    expect(context.body).toMatchObject({ checklist: null, assignment: { qcUid: 'rv-qc', assignedBy: 'rv-mgr' }, verification: { result: 'VERIFIED' }, returnUse: 'BLOCKED' });
    expect(context.body.returnVersion.lineage.length).toBeGreaterThan(0);
    const refused = await qcPost('rv-qc', allPass);
    expect([refused.status, refused.body.code, refused.body.detail]).toEqual([403, 'TAX_RETURN_QC_AUTHORITY_REQUIRED', 'NO_POLICY']);
    expect((await qcPost('rv-mgr', allPass)).body.code).toBe('TAX_RETURN_QC_REVIEWER_REQUIRED');
    expect((await qcPost('rv-rev', allPass)).body.code).toBe('TAX_RETURN_QC_REVIEWER_REQUIRED');
  });

  it('with the owner configuration (synthetic here), records PASS/FAIL per checklist item; a FAIL returns the version with a note', async () => {
    await db.pool.query(`INSERT INTO taxguard_tax_approval_policies(tenant_id, function_code, policy_version, requires_eligibility, requires_designation,
      requires_case_assignment, accepted_credentials, eligibility_text, approved_by) VALUES ($1, 'RETURN_QC_REVIEW', 1, true, true, true, ARRAY['CPA'],
      'Synthetic QC policy for tests: verified CPA, designation and the QC assignment.', 'rv-owner')`, [T]);
    expect((await qcPost('rv-qc', allPass)).body.detail).toBe('NO_DESIGNATION');
    await db.pool.query(`INSERT INTO taxguard_tax_function_designations(tenant_id, person_uid, function_code, policy_version, designation_reference, designated_by)
      VALUES ($1, 'rv-qc', 'RETURN_QC_REVIEW', 1, 'synthetic-qc-designation', 'rv-owner')`, [T]);
    expect((await qcPost('rv-qc', allPass)).body.detail).toBe('NO_ELIGIBILITY');
    await db.pool.query(`INSERT INTO taxguard_tax_professional_eligibility(tenant_id, person_uid, credential_type, credential_reference, issuing_jurisdiction,
      scope_jurisdictions, valid_from, expires_on, verified_by, verification_reference) VALUES ($1, 'rv-qc', 'CPA', 'synthetic-qc-licence', 'NY', ARRAY['US'],
      '2025-01-01', '2099-12-31', 'rv-owner', 'synthetic-registry-lookup')`, [T]);
    expect((await qcPost('rv-qc', allPass)).body.code).toBe('TAX_RETURN_QC_CHECKLIST_REQUIRED');
    await db.pool.query(`INSERT INTO taxguard_tax_qc_checklists(tenant_id, checklist_version, items, rationale, created_by, approved_by) VALUES ($1, 1,
      '[{"code":"TIES_TO_SOURCES","text":"Synthetic item: every line ties to its cited sources."},{"code":"PRIOR_YEAR_COMPARED","text":"Synthetic item: compared with the prior year."}]',
      'Synthetic checklist for tests only, not a practice checklist.', 'rv-author', 'rv-owner')`, [T]);
    for (const bad of [[allPass[0]], [...allPass, allPass[0]], [allPass[0], { code: 'OTHER', result: 'PASS' }], [allPass[0], { code: 'PRIOR_YEAR_COMPARED', result: 'N/A' }],
      [allPass[0], { ...allPass[1], outcome: 'QC_PASSED' }], 'all pass'])
      expect((await qcPost('rv-qc', bad)).body.code, JSON.stringify(bad)).toBe('TAX_RETURN_QC_INPUT_INVALID');
    const fail = [allPass[0], { code: 'PRIOR_YEAR_COMPARED', result: 'FAIL', note: 'Synthetic: line 16 moved a lot' }];
    expect((await qcPost('rv-qc', fail)).body.code).toBe('TAX_RETURN_QC_INPUT_INVALID'); // a FAIL needs an overall note
    const returned = await qcPost('rv-qc', fail, 'Synthetic: explain the change in line 16 and prepare again.');
    expect(returned.status, JSON.stringify(returned.body)).toBe(201);
    expect(returned.body).toMatchObject({ outcome: 'QC_RETURNED', checklistVersion: 1, reviewedBy: 'rv-qc', returnUse: 'BLOCKED',
      results: [{ code: 'TIES_TO_SOURCES', result: 'PASS', text: 'Synthetic item: every line ties to its cited sources.' },
        { code: 'PRIOR_YEAR_COMPARED', result: 'FAIL', note: 'Synthetic: line 16 moved a lot' }] });
    expect((await readiness()).reasons).toContain('QC_RETURNED');
    as('rv-qc'); expect((await call('GET', '/qc/queue')).body.items[0].latestOutcome).toBe('QC_RETURNED');
    const status = (await db.pool.query(`SELECT status FROM taxguard_tax_return_versions WHERE tenant_id = $1 AND return_version_id = $2`, [T, version])).rows[0].status;
    expect(status).toBe('APPROVED'); // QC never changes the approved version
  });

  it('final readiness needs diagnostics, risk and QC in that order and current; a later input makes it not ready again', async () => {
    await diagnoseCase();
    expect((await readiness()).reasons).toEqual(['RISK_NOT_CURRENT', 'QC_RETURNED']);
    as('rv-prep'); expect((await call('POST', `/returns/${version}/risk`, { amountCents: 500_000 })).body.outcome).toBe('HUMAN_REVIEW_REQUIRED');
    expect((await readiness()).reasons).toEqual(['QC_RETURNED']);
    expect((await qcPost('rv-qc', allPass)).body.outcome).toBe('QC_PASSED');
    const ready = await readiness('rv-rev');
    expect(ready).toMatchObject({ ready: true, reasons: [], stage10: 'FINAL_AUTHORIZATION_REQUIRED', returnUse: 'BLOCKED' });
    expect((await readiness('rv-qc')).ready).toBe(true); // the QC assignee may read it too
    // A newer diagnostics run makes the risk assessment, and so the QC review, not current.
    await diagnoseCase();
    expect((await readiness()).reasons).toEqual(['RISK_NOT_CURRENT', 'QC_NOT_CURRENT']);
    as('rv-prep'); await call('POST', `/returns/${version}/risk`, { amountCents: 500_000 });
    expect((await readiness()).reasons).toEqual(['QC_NOT_CURRENT']);
    expect((await qcPost('rv-qc', allPass)).body.outcome).toBe('QC_PASSED');
    expect((await readiness()).ready).toBe(true);
    // A new checklist version makes the QC review not current.
    await db.pool.query(`INSERT INTO taxguard_tax_qc_checklists(tenant_id, checklist_version, items, rationale, created_by, approved_by) VALUES ($1, 2,
      '[{"code":"TIES_TO_SOURCES","text":"Synthetic item: every line ties to its cited sources."},{"code":"PRIOR_YEAR_COMPARED","text":"Synthetic item: compared with the prior year."}]',
      'Synthetic checklist version 2 for tests only.', 'rv-author', 'rv-owner')`, [T]);
    expect((await readiness()).reasons).toEqual(['QC_NOT_CURRENT']);
    expect((await qcPost('rv-qc', allPass)).body.checklistVersion).toBe(2);
    expect((await readiness()).ready).toBe(true);
    as('rv-qc2'); expect((await call('GET', `/returns/${version}/readiness`)).body.code).toBe('TAX_RETURN_NOT_FOUND');
  });

  it('assignments are revoked with a reason, history is immutable, and nothing is reachable without the service', async () => {
    as('rv-prep'); expect((await call('POST', `/returns/${version}/qc-assignment/revoke`, { reason: 'Synthetic: rotating QC reviewers' })).body.code)
      .toBe('TAX_RETURN_QC_ASSIGNER_REQUIRED');
    as('rv-mgr2'); expect((await call('POST', `/returns/${version}/qc-assignment/revoke`, { reason: 'short' })).body.code).toBe('TAX_RETURN_QC_INPUT_INVALID');
    expect((await call('POST', `/returns/${version}/qc-assignment/revoke`, { reason: 'Synthetic: rotating QC reviewers' })).status).toBe(200);
    expect((await call('POST', `/returns/${version}/qc-assignment/revoke`, { reason: 'Synthetic: rotating QC reviewers' })).body.code).toBe('TAX_RETURN_QC_NOT_ASSIGNED');
    expect((await qcPost('rv-qc', allPass)).body.code).toBe('TAX_RETURN_NOT_FOUND'); // a revoked assignee is an outsider again
    as('rv-qc'); expect((await call('GET', '/qc/queue')).body.items).toEqual([]);
    as('rv-mgr2'); expect((await call('POST', `/returns/${version}/qc-assignment`, { qcUid: 'rv-qc2' })).status).toBe(201);
    // rv-qc2 holds no designation or eligibility: refused with the reason.
    expect((await qcPost('rv-qc2', allPass)).body.detail).toBe('NO_DESIGNATION');
    // The readiness of the version still rests on the QC review recorded under the earlier assignment.
    expect((await readiness()).ready).toBe(true);
    for (const sql of [`UPDATE taxguard_tax_return_qc_reviews SET outcome = 'QC_PASSED' WHERE tenant_id = '${T}'`, `DELETE FROM taxguard_tax_return_qc_reviews WHERE tenant_id = '${T}'`,
      'TRUNCATE taxguard_tax_return_qc_reviews', `UPDATE taxguard_tax_qc_checklists SET rationale = 'Synthetic tampering attempt here' WHERE tenant_id = '${T}'`,
      `DELETE FROM taxguard_tax_qc_checklists WHERE tenant_id = '${T}'`, `UPDATE taxguard_tax_return_qc_assignments SET qc_uid = 'rv-prep' WHERE tenant_id = '${T}' AND revoked_at IS NULL`,
      `UPDATE taxguard_tax_return_qc_assignments SET revoke_reason = 'Synthetic: rewriting history' WHERE tenant_id = '${T}' AND revoked_at IS NOT NULL`,
      `DELETE FROM taxguard_tax_return_qc_assignments WHERE tenant_id = '${T}'`])
      await expect(db.pool.query(sql), sql).rejects.toThrow('TAX_RETURN_QC_HISTORY_IMMUTABLE');
    for (const table of ['taxguard_tax_qc_checklists', 'taxguard_tax_return_qc_assignments', 'taxguard_tax_return_qc_reviews'])
      for (const role of ['anon', 'authenticated', 'service_role'])
        expect((await db.pool.query(`SELECT has_table_privilege($1, $2, 'SELECT') OR has_table_privilege($1, $2, 'INSERT') AS ok`, [role, 'public.' + table])).rows[0].ok,
          role + ' ' + table).toBe(false);
    expect((await db.pool.query(`SELECT has_function_privilege('service_role', 'public.taxguard_tax_return_qc_scope(text,text,uuid)', 'EXECUTE') AS ok`)).rows[0].ok).toBe(false);
    const audit = (await db.pool.query(`SELECT action, count(*)::int AS n FROM taxguard_audit_log WHERE tenant_id = $1 AND action LIKE 'TAX_RETURN_QC_%' GROUP BY action ORDER BY action`, [T])).rows;
    expect(audit).toEqual([{ action: 'TAX_RETURN_QC_ASSIGNED', n: 2 }, { action: 'TAX_RETURN_QC_RECORDED', n: 4 }, { action: 'TAX_RETURN_QC_UNASSIGNED', n: 1 }]);
    as('rv-foreign', T2); expect((await call('GET', `/returns/${version}/qc-reviews`)).body.code).toBe('TAX_RETURN_NOT_FOUND');
    as('rv-client'); expect((await call('GET', `/returns/${version}/readiness`)).status).toBe(403);
    as('rv-prep'); expect((await call('GET', `/returns/${version}/qc-reviews`)).body.items).toHaveLength(4);
    // An open ERROR finding of the case (synthetic, as if detected by a later run) makes the version not ready.
    const run = (await db.pool.query(`INSERT INTO taxguard_case_diagnostic_runs(tenant_id, case_id, client_id, tax_year, run_by, detected, run_at)
      VALUES ($1, $2, $3, 2025, 'rv-rev', 1, now() - interval '1 day') RETURNING run_id`, [T, caseId, C])).rows[0].run_id;
    await db.pool.query(`INSERT INTO taxguard_case_diagnostics(tenant_id, case_id, client_id, tax_year, rule_code, rule_version, severity, affected_type,
      affected_id, message, detected_run, last_detected_run) VALUES ($1, $2, $3, 2025, 'LEDGER_ENTRIES_UNREVIEWED', 1, 'ERROR', 'LEDGER', '1', 'Synthetic entry', $4, $4)`,
      [T, caseId, C, run]);
    expect((await readiness()).reasons).toEqual(['DIAGNOSTICS_OPEN']);
  });

  it('a stale version is neither assigned nor reviewed, and is not ready', async () => {
    as('rv-prep'); const k = (await call('GET', `/cases/${caseId}/conclusions`)).body.items.find((x: any) => x.status === 'APPROVED');
    const revised = (await call('POST', `/conclusions/${k.conclusionId}/revise`, { amount: '5000.00', statement: 'Synthetic wages for the year, restated.',
      links: k.links.map((l: any) => ({ type: l.type, ref: l.ref })) })).body.conclusionId;
    await call('POST', `/conclusions/${revised}/submit`); as('rv-rev'); expect((await call('POST', `/conclusions/${revised}/approve`, {})).body.status).toBe('APPROVED');
    expect((await readiness()).reasons).toContain('STALE');
    expect((await qcPost('rv-qc2', allPass)).body.code).toBe('TAX_RETURN_STALE');
    as('rv-mgr'); await call('POST', `/returns/${version}/qc-assignment/revoke`, { reason: 'Synthetic: the version went stale' });
    expect((await call('POST', `/returns/${version}/qc-assignment`, { qcUid: 'rv-qc' })).body.code).toBe('TAX_RETURN_STALE');
  });
});
