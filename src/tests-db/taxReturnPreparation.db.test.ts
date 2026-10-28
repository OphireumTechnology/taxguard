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

// Block 68: draft return preparation (proposal 20261019120000, review only) over HTTP on real PostgreSQL with every
// proposal applied. A return version is assembled only from the case's current, non-stale form mappings (Block 67)
// through an approved, versioned return template; the preparer submits and the case's independent reviewer approves or
// returns it; a changed input makes the version stale. SYNTHETIC data, form and template only: nothing here is tax law.
const T = 'tenantReturnPrep', T2 = 'tenantReturnPrepOther', C = 'rpClient';
const roles: Record<string, string> = { 'rp-mgr': 'practice_manager', 'rp-prep': 'accountant', 'rp-rev': 'reviewer', 'rp-out': 'accountant', 'rp-client': 'client',
  'rp-prep24': 'accountant', 'rp-admin': 'admin' };
let db: TestDatabase; let caseId = '', engagementId = '', ruleSetId = '', formRuleId = '', templateId = '', income = '', return1 = '';
let server: Server; let origin = ''; let user: any = null;
const as = (uid: string, tenantId = T) => { user = { id: uid, role: roles[uid] ?? 'practice_manager', tenantId, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown) => fetch(origin + '/tax' + path, { method, headers: { 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).then(async r => ({ status: r.status, body: await r.json() as any }));
const doc = (id: string, version: number, status: string) => db.pool.query(`INSERT INTO taxguard_documents(document_id, tenant_id, client_id, engagement_id,
    tax_year, case_id, version, hash, mime_type, status, quarantine_status, created_by) VALUES ($1, $2, $3, $4, 2025, $5, $6, repeat($7, 64), 'application/pdf', $8, 'CLEAN', 'rp-client')`,
  [id, T, C, engagementId, caseId, version, String(version), status]);
async function approvedRun(value: string, evidence: string) {
  as('rp-prep');
  const run = await call('POST', `/cases/${caseId}/runs`, { ruleSetId, inputs: [{ factPath: 'synthetic.income_a', value, evidenceIds: [evidence] }] });
  expect(run.status, run.body?.code).toBe(201);
  as('rp-rev'); expect((await call('POST', `/runs/${run.body.run_id}/approve`, { note: 'Synthetic inputs traced to evidence' })).body.status).toBe('REVIEW_APPROVED');
  return run.body.run_id as string;
}
async function approvedConclusion(amount: string, links: unknown[]) {
  as('rp-prep');
  const k = (await call('POST', `/cases/${caseId}/conclusions`, { type: 'INCOME_INCLUSION', statement: 'Synthetic wages for the year.', amount, links })).body;
  expect(k.status, k.code).toBe('DRAFT');
  expect((await call('POST', `/conclusions/${k.conclusionId}/submit`)).body.status).toBe('READY_FOR_REVIEW');
  as('rp-rev'); expect((await call('POST', `/conclusions/${k.conclusionId}/approve`, {})).body.status).toBe('APPROVED');
  return k.conclusionId as string;
}
const template = (over: Record<string, unknown> = {}, forms: unknown[] = [{ formId: 'SYN-1040', formVersion: '2025.0', required: true },
  { formId: 'SYN-SCH1', formVersion: '2025.0', required: false }]) => ({ templateId: 'SYN-1040-RETURN', jurisdiction: 'federal', jurisdictionCode: 'US',
  returnFamily: '1040', taxYear: 2025, effectiveFrom: '2025-01-01', sourceId: SYNTHETIC_SOURCE_ID, forms, ...over });
async function approvedTemplate(over: Record<string, unknown> = {}, forms?: unknown[]) {
  as('rp-prep'); const r = await call('POST', '/return-templates', { definition: template(over, forms) });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  expect((await call('POST', `/return-templates/${r.body.templateRuleId}/submit`)).body.status).toBe('PENDING_REVIEW');
  as('rp-rev'); expect((await call('POST', `/return-templates/${r.body.templateRuleId}/approve`)).body.status).toBe('APPROVED');
  return r.body.templateRuleId as string;
}
const prepare = (tpl = templateId, uid = 'rp-prep') => { as(uid); return call('POST', `/cases/${caseId}/returns`, { templateRuleId: tpl }); };
const act = (id: string, action: 'submit' | 'approve' | 'return', uid: string, note?: string) => { as(uid); return call('POST', `/returns/${id}/${action}`, note === undefined ? {} : { note }); };
let verifiedSeq = 0;
const policy = (fn: string, version: number, o: { eligibility: boolean; designation: boolean; caseAssignment: boolean; credentials?: string[] }) =>
  db.pool.query(`INSERT INTO taxguard_tax_approval_policies(tenant_id, function_code, policy_version, requires_eligibility, requires_designation, requires_case_assignment,
    accepted_credentials, eligibility_text, approved_by) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Synthetic policy for tests: verified, recorded credentials only.', 'rp-owner')`,
    [T, fn, version, o.eligibility, o.designation, o.caseAssignment, o.credentials ?? []]);
// Each record is verified one second after the previous one, so "most recently verified" is unambiguous.
const eligibility = async (uid: string, o: { credential?: string; scope?: string[]; validFrom?: string; expiresOn?: string }) =>
  (await db.pool.query(`INSERT INTO taxguard_tax_professional_eligibility(tenant_id, person_uid, credential_type, credential_reference, issuing_jurisdiction,
    scope_jurisdictions, valid_from, expires_on, verified_by, verification_reference, verified_at) VALUES ($1, $2, $3, 'synthetic-licence-ref', 'NY', $4, $5, $6, 'rp-owner',
    'synthetic-registry-lookup', now() + make_interval(secs => $7)) RETURNING eligibility_id`,
    [T, uid, o.credential ?? 'CPA', o.scope ?? ['US'], o.validFrom ?? '2025-01-01', o.expiresOn ?? '2099-12-31', ++verifiedSeq])).rows[0].eligibility_id as string;
const designate = (uid: string, fn: string, version: number, ref: string, by = 'rp-owner') =>
  db.pool.query(`INSERT INTO taxguard_tax_function_designations(tenant_id, person_uid, function_code, policy_version, designation_reference, designated_by)
    VALUES ($1, $2, $3, $4, $5, $6)`, [T, uid, fn, version, ref, by]);
const facts = () => { as('rp-rev'); return call('GET', `/cases/${caseId}/returns/stage-facts`).then(r => r.body); };

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic return preparation practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'rp-client', 'Synthetic Return Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ('${T}', 'rp-mgr', 'practice_manager', 'active', NULL), ('${T}', 'rp-prep', 'accountant', 'active', NULL),
      ('${T}', 'rp-rev', 'reviewer', 'active', NULL), ('${T}', 'rp-out', 'accountant', 'active', NULL), ('${T}', 'rp-client', 'client', 'active', '${C}'),
      ('${T}', 'rp-prep24', 'accountant', 'active', NULL), ('${T}', 'rp-admin', 'admin', 'active', NULL), ('${T2}', 'rp-foreign', 'practice_manager', 'active', NULL);`);
  const practice = new PracticeStore(pgRpc(db.pool));
  engagementId = (await practice.createEngagement(T, C, 'rp-mgr', 'rp-engagement-1', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'rp-mgr', engagementId, 'active', 1);
  for (const [role, userId] of [['preparer', 'rp-prep'], ['reviewer', 'rp-rev']])
    await practice.assign(T, C, 'rp-mgr', `rp-assign-${role}`, { engagementId, taxYear: 2025, role, userId, reason: 'Synthetic staffing' });
  await db.pool.query(`INSERT INTO taxguard_staff_assignments(id, tenant_id, client_id, engagement_id, tax_year, role, user_id, assigned_by, status, effective_from, effective_to)
    VALUES ('rp-prep24-1', '${T}', '${C}', '${engagementId}', 2024, 'preparer', 'rp-prep24', 'rp-mgr', 'ACTIVE', now() - interval '1 day', NULL)`);
  caseId = (await new CaseStore(pgRpc(db.pool)).create(T, C, 'rp-mgr', 'rp-case-key-1', { engagementId, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  const app = express();
  app.use('/tax', createTaxEngineRouter({ store: () => new TaxEngineStore(pgRpc(db.pool)), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  as('rp-prep');
  expect((await call('POST', '/sources', { sourceId: SYNTHETIC_SOURCE_ID, jurisdiction: 'state', jurisdictionCode: 'ZZ', authorityType: 'synthetic_test',
    title: 'Synthetic fixture source (not tax law)', issuer: 'Synthetic test issuer', citation: 'Synthetic fixture', taxYears: [2025] })).status).toBe(201);
  as('rp-rev'); await call('POST', `/sources/${SYNTHETIC_SOURCE_ID}/verify`, { documentSha256: 'a'.repeat(64) });
  as('rp-prep'); ruleSetId = (await call('POST', '/rule-sets', { definition: syntheticRuleSet() })).body.ruleSetId;
  for (const [filingStatus, expected] of [[undefined, { synthetic_base: '4000.00', synthetic_amount: '290.00' }], ['synthetic_joint', { synthetic_base: '3000.00', synthetic_amount: '217.50' }]] as const)
    await call('POST', `/rule-sets/${ruleSetId}/tests`, { name: 'Synthetic example ' + (filingStatus ?? 'single'), sourceId: SYNTHETIC_SOURCE_ID, citation: 'Synthetic fixture example',
      ...(filingStatus ? { filingStatus } : {}), inputs: [{ factPath: 'synthetic.income_a', value: '5000.00', evidenceIds: ['doc:rule-test-fixture'] }], expected });
  await call('POST', `/rule-sets/${ruleSetId}/run-tests`); await call('POST', `/rule-sets/${ruleSetId}/submit`);
  as('rp-rev'); expect((await call('POST', `/rule-sets/${ruleSetId}/approve`)).body.status).toBe('APPROVED');
  await doc('rp-w2', 1, 'VERIFIED');
  // A synthetic mapping rule for the required form (Block 67).
  as('rp-prep'); const rule = await call('POST', '/form-rules', { definition: { jurisdiction: 'federal', jurisdictionCode: 'US', returnFamily: '1040', taxYear: 2025,
    formId: 'SYN-1040', formVersion: '2025.0', effectiveFrom: '2025-01-01', sourceId: SYNTHETIC_SOURCE_ID, lines: [
      { schedule: 'MAIN', line: '1a', field: 'f1_wages', valueType: 'MONEY', required: true, aggregate: 'SINGLE', source: { conclusionType: 'INCOME_INCLUSION', value: 'AMOUNT' } }] } });
  formRuleId = rule.body.ruleId;
  await call('POST', `/form-rules/${formRuleId}/submit`); as('rp-rev'); expect((await call('POST', `/form-rules/${formRuleId}/approve`)).body.status).toBe('APPROVED');
}, 240_000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await db?.stop(); });

describe('return templates are governed tax content', () => {
  it('validated, hashed, versioned, maker-checker approved on a verified source, frozen once submitted', async () => {
    as('rp-prep');
    const invalid = async (over: Record<string, unknown>, forms?: unknown[]) => (await call('POST', '/return-templates', { definition: template(over, forms) })).body;
    expect(await invalid({ jurisdictionCode: 'ZZ' })).toEqual({ code: 'TAX_RETURN_TEMPLATE_INPUT_INVALID', detail: 'JURISDICTION' });
    expect(await invalid({ effectiveTo: '2024-12-31' })).toEqual({ code: 'TAX_RETURN_TEMPLATE_INPUT_INVALID', detail: 'EFFECTIVE_DATES' });
    expect((await invalid({}, [])).detail).toBe('FORMS');
    expect((await invalid({}, [{ formId: 'SYN-1040', formVersion: '2025.0', required: true, guess: true }])).detail).toBe('FORM');
    expect((await invalid({}, [{ formId: 'SYN-1040', formVersion: '2025.0', required: true }, { formId: 'SYN-1040', formVersion: '2025.0', required: false }])).detail).toBe('DUPLICATE_FORM');
    expect((await invalid({}, [{ formId: 'SYN-SCH1', formVersion: '2025.0', required: false }])).detail).toBe('NO_REQUIRED_FORM');
    const unverified = (await call('POST', '/return-templates', { definition: template({ sourceId: 'syn-unverified-src' }) })).body;
    expect((await call('POST', `/return-templates/${unverified.templateRuleId}/submit`)).body).toEqual({ code: 'TAX_SOURCE_NOT_VERIFIED', detail: 'syn-unverified-src' });
    const drafted = await call('POST', '/return-templates', { definition: template() });
    expect(drafted.status).toBe(201);
    expect(drafted.body).toMatchObject({ templateId: 'SYN-1040-RETURN', version: 2, status: 'DRAFT', forms: 2, effectiveFrom: '2025-01-01', effectiveTo: null });
    expect((await call('POST', '/return-templates', { definition: template() })).body.code).toBe('TAX_RETURN_TEMPLATE_DUPLICATE');
    templateId = drafted.body.templateRuleId;
    expect((await call('POST', `/return-templates/${templateId}/approve`)).body.code).toBe('TAX_CONTENT_REVIEWER_REQUIRED');
    expect((await call('POST', `/return-templates/${templateId}/submit`)).body.status).toBe('PENDING_REVIEW');
    await expect(db.pool.query(`UPDATE taxguard_tax_return_templates SET definition = '{}'::jsonb WHERE tenant_id = $1 AND template_rule_id = $2`, [T, templateId]))
      .rejects.toThrow('TAX_RETURN_IMMUTABLE');
    as('rp-rev'); const own = (await call('POST', '/return-templates', { definition: template({ templateId: 'SYN-OWN' }) })).body;
    await call('POST', `/return-templates/${own.templateRuleId}/submit`);
    expect((await call('POST', `/return-templates/${own.templateRuleId}/approve`)).body.code).toBe('MAKER_CHECKER_VIOLATION');
    // Fail closed: no role, case assignment or administrator status approves a template. The function needs the owner's
    // policy, a designation under it and verified eligibility in scope for the template's jurisdiction.
    const refusal = async (uid: string) => { as(uid); const b = (await call('POST', `/return-templates/${templateId}/approve`)).body; return [b.code, b.detail]; };
    expect(await refusal('rp-rev')).toEqual(['TAX_RETURN_TEMPLATE_APPROVER_REQUIRED', 'NO_POLICY']);
    await policy('RETURN_TEMPLATE_APPROVAL', 1, { eligibility: true, designation: true, caseAssignment: false, credentials: ['CPA', 'EA'] });
    expect(await refusal('rp-rev')).toEqual(['TAX_RETURN_TEMPLATE_APPROVER_REQUIRED', 'NO_DESIGNATION']);
    expect(await refusal('rp-admin')).toEqual(['TAX_RETURN_TEMPLATE_APPROVER_REQUIRED', 'NO_DESIGNATION']); // admin role alone: nothing
    await designate('rp-rev', 'RETURN_TEMPLATE_APPROVAL', 1, 'synthetic-designation-rp-rev');
    expect(await refusal('rp-rev')).toEqual(['TAX_RETURN_TEMPLATE_APPROVER_REQUIRED', 'NO_ELIGIBILITY']); // a designation is not a qualification
    await eligibility('rp-rev', { credential: 'ATTORNEY' });
    expect(await refusal('rp-rev')).toEqual(['TAX_RETURN_TEMPLATE_APPROVER_REQUIRED', 'CREDENTIAL_NOT_ACCEPTED']);
    await eligibility('rp-rev', { expiresOn: '2025-06-30' });
    expect(await refusal('rp-rev')).toEqual(['TAX_RETURN_TEMPLATE_APPROVER_REQUIRED', 'ELIGIBILITY_EXPIRED']);
    await eligibility('rp-rev', { validFrom: '2099-01-01', expiresOn: '2099-12-31' });
    expect(await refusal('rp-rev')).toEqual(['TAX_RETURN_TEMPLATE_APPROVER_REQUIRED', 'ELIGIBILITY_NOT_YET_VALID']);
    await eligibility('rp-rev', { scope: ['CA'] });
    expect(await refusal('rp-rev')).toEqual(['TAX_RETURN_TEMPLATE_APPROVER_REQUIRED', 'OUTSIDE_ELIGIBILITY_SCOPE']);
    expect((await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_tax_return_templates WHERE tenant_id = $1 AND status = 'APPROVED'`, [T])).rows[0].n).toBe(0);
    const cpa = await eligibility('rp-rev', {});
    as('rp-rev'); const approved = (await call('POST', `/return-templates/${templateId}/approve`)).body;
    expect(approved).toMatchObject({ status: 'APPROVED', reviewedBy: 'rp-rev', approvalBasis: { approverUid: 'rp-rev', function: 'RETURN_TEMPLATE_APPROVAL',
      policyVersion: 1, jurisdiction: 'US', designationReference: 'synthetic-designation-rp-rev', designatedBy: 'rp-owner', eligibilityId: cpa,
      credentialType: 'CPA', issuingJurisdiction: 'NY', verifiedBy: 'rp-owner', templateVersion: 2, contentSha256: drafted.body.contentSha256,
      sourceId: SYNTHETIC_SOURCE_ID, sourceVerifiedForTaxYear: 2025 } });
    expect(approved.approvalBasis.approvedAt).toEqual(expect.any(String));
    const audit = (await db.pool.query(`SELECT actor_uid, metadata FROM taxguard_audit_log WHERE tenant_id = $1 AND action = 'TAX_RETURN_TEMPLATE_APPROVED'`, [T])).rows;
    expect(audit).toEqual([expect.objectContaining({ actor_uid: 'rp-rev', metadata: expect.objectContaining({ approvalBasis: expect.objectContaining({ eligibilityId: cpa }) }) })]);
    await expect(db.pool.query(`UPDATE taxguard_tax_return_templates SET approval_basis = '{}'::jsonb WHERE tenant_id = $1 AND template_rule_id = $2`, [T, templateId]))
      .rejects.toThrow('TAX_RETURN_IMMUTABLE');
    expect((await call('GET', `/return-templates/${templateId}`)).body.definition.forms).toHaveLength(2);
  });

  it('approval authority: revocation and a new policy version fail closed; the records are immutable and unreachable through the API', async () => {
    as('rp-prep'); const t = (await call('POST', '/return-templates', { definition: template({ templateId: 'SYN-REVOKE' }) })).body.templateRuleId;
    await call('POST', `/return-templates/${t}/submit`);
    const approve = async () => { as('rp-rev'); const b = (await call('POST', `/return-templates/${t}/approve`)).body; return [b.code, b.detail]; };
    await db.pool.query(`UPDATE taxguard_tax_professional_eligibility SET revoked_by = 'rp-owner', revoked_at = now(), revocation_reason = 'Synthetic: licence lapsed'
      WHERE tenant_id = $1 AND person_uid = 'rp-rev' AND revoked_at IS NULL`, [T]);
    expect(await approve()).toEqual(['TAX_RETURN_TEMPLATE_APPROVER_REQUIRED', 'ELIGIBILITY_REVOKED']);
    await eligibility('rp-rev', {});
    await policy('RETURN_TEMPLATE_APPROVAL', 2, { eligibility: true, designation: true, caseAssignment: false, credentials: ['CPA'] });
    expect(await approve()).toEqual(['TAX_RETURN_TEMPLATE_APPROVER_REQUIRED', 'DESIGNATION_UNDER_OLD_POLICY']);
    // Rejecting grants nothing, so it stays open to content reviewers.
    expect((await call('POST', `/return-templates/${t}/reject`, { note: 'Synthetic: superseded by the corrected template' })).body).toMatchObject({ status: 'REJECTED', approvalBasis: null });
    for (const sql of [`UPDATE taxguard_tax_professional_eligibility SET revoked_at = NULL, revoked_by = NULL, revocation_reason = NULL WHERE tenant_id = '${T}' AND revoked_at IS NOT NULL`,
      `UPDATE taxguard_tax_professional_eligibility SET credential_reference = 'changed-ref' WHERE tenant_id = '${T}'`,
      `UPDATE taxguard_tax_professional_eligibility SET expires_on = '2199-01-01' WHERE tenant_id = '${T}' AND revoked_at IS NULL`,
      `UPDATE taxguard_tax_function_designations SET designation_reference = 'changed-ref' WHERE tenant_id = '${T}'`,
      `UPDATE taxguard_tax_approval_policies SET accepted_credentials = ARRAY['CPA','EA','ATTORNEY'] WHERE tenant_id = '${T}'`,
      `DELETE FROM taxguard_tax_function_designations WHERE tenant_id = '${T}'`, 'TRUNCATE taxguard_tax_approval_policies CASCADE'])
      await expect(db.pool.query(sql), sql).rejects.toThrow('TAX_APPROVAL_AUTHORITY_IMMUTABLE');
    await expect(db.pool.query(`INSERT INTO taxguard_tax_professional_eligibility(tenant_id, person_uid, credential_type, credential_reference, issuing_jurisdiction,
      scope_jurisdictions, valid_from, expires_on, verified_by, verification_reference) VALUES ($1, 'rp-rev', 'CPA', 'self-ref', 'NY', ARRAY['US'], '2025-01-01', '2099-12-31',
      'rp-rev', 'self-verified')`, [T])).rejects.toThrow(/check/i);
    await expect(designate('rp-rev', 'RETURN_TEMPLATE_APPROVAL', 2, 'self-designation', 'rp-rev')).rejects.toThrow(/check/i);
    for (const table of ['taxguard_tax_approval_policies', 'taxguard_tax_professional_eligibility', 'taxguard_tax_function_designations'])
      for (const role of ['anon', 'authenticated', 'service_role'])
        expect((await db.pool.query(`SELECT has_table_privilege($1, $2, 'SELECT') OR has_table_privilege($1, $2, 'INSERT') OR has_table_privilege($1, $2, 'UPDATE') AS ok`,
          [role, 'public.' + table])).rows[0].ok, `${role} ${table}`).toBe(false);
    expect((await db.pool.query(`SELECT has_function_privilege('service_role', 'public.taxguard_tax_approval_authority(text,text,text,text,boolean)', 'EXECUTE') AS ok`)).rows[0].ok).toBe(false);
    // Re-designation under the current policy restores the authority; the earlier designation is revoked, never deleted.
    await db.pool.query(`UPDATE taxguard_tax_function_designations SET revoked_by = 'rp-owner', revoked_at = now(), revocation_reason = 'Synthetic: policy version 2'
      WHERE tenant_id = $1 AND person_uid = 'rp-rev' AND revoked_at IS NULL`, [T]);
    await designate('rp-rev', 'RETURN_TEMPLATE_APPROVAL', 2, 'synthetic-designation-rp-rev-v2');
    expect((await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_tax_function_designations WHERE tenant_id = $1 AND person_uid = 'rp-rev'`, [T])).rows[0].n).toBe(2);
  });
});

describe('a draft return is assembled only from current form mappings', () => {
  it('refuses what cannot be assembled, outside scope or out of effect, and only the case preparer prepares', async () => {
    const none = (await prepare()).body;
    expect(none.code).toBe('TAX_RETURN_PREPARATION_REFUSED');
    expect(JSON.parse(none.detail)).toEqual([{ formId: 'SYN-1040', formVersion: '2025.0', reason: 'RETURN_FORM_MISSING' }]);
    expect((await prepare(templateId, 'rp-rev')).body.code).toBe('TAX_RETURN_PREPARER_REQUIRED');
    expect((await prepare(await approvedTemplate({ templateId: 'SYN-1065-RETURN', returnFamily: '1065' }))).body.code).toBe('TAX_RETURN_SCOPE_MISMATCH');
    as('rp-prep'); const draft = (await call('POST', '/return-templates', { definition: template({ templateId: 'SYN-DRAFT' }) })).body.templateRuleId;
    expect((await prepare(draft)).body.code).toBe('TAX_RETURN_TEMPLATE_NOT_APPROVED');
    expect((await prepare(await approvedTemplate({ templateId: 'SYN-FUTURE', effectiveFrom: '2099-01-01' }))).body)
      .toEqual({ code: 'TAX_RETURN_TEMPLATE_NOT_EFFECTIVE', detail: '2099-01-01 to open' });
    expect((await prepare(await approvedTemplate({ templateId: 'SYN-EXPIRED', effectiveTo: '2025-12-31' }))).body)
      .toEqual({ code: 'TAX_RETURN_TEMPLATE_NOT_EFFECTIVE', detail: '2025-01-01 to 2025-12-31' });
    expect((await prepare('00000000-0000-4000-8000-000000000000')).body.code).toBe('TAX_RETURN_TEMPLATE_NOT_FOUND');
    expect(await prepare('not-a-template').then(r => [r.status, r.body.code])).toEqual([404, 'TAX_RETURN_TEMPLATE_NOT_FOUND']);
    expect((await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_tax_return_versions WHERE tenant_id = $1`, [T])).rows[0].n).toBe(0);
  });

  it('a case with blocking diagnostics cannot be prepared', async () => {
    const run = (await db.pool.query(`INSERT INTO taxguard_case_diagnostic_runs(tenant_id, case_id, client_id, tax_year, run_by, detected)
      VALUES ($1, $2, $3, 2025, 'rp-rev', 1) RETURNING run_id`, [T, caseId, C])).rows[0].run_id;
    const d = (await db.pool.query(`INSERT INTO taxguard_case_diagnostics(tenant_id, case_id, client_id, tax_year, rule_code, rule_version, severity, affected_type,
      affected_id, message, detected_run, last_detected_run) VALUES ($1, $2, $3, 2025, 'CASE_ON_HOLD', 1, 'BLOCKING', 'CASE', $2, 'Synthetic hold', $4, $4)
      RETURNING diagnostic_id`, [T, caseId, C, run])).rows[0].diagnostic_id;
    expect(JSON.parse((await prepare()).body.detail)).toContainEqual({ reason: 'RETURN_BLOCKING_DIAGNOSTICS', blocking: 1 });
    await db.pool.query(`UPDATE taxguard_case_diagnostics SET status = 'CLEARED', cleared_run = $3, cleared_at = now() WHERE tenant_id = $1 AND diagnostic_id = $2`, [T, d, run]);
  });

  it('prepares version 1 from the current mapping with lineage to the source document; preparing again replays', async () => {
    const run = await approvedRun('5000.00', 'document:rp-w2');
    income = await approvedConclusion('5000.00', [{ type: 'EVIDENCE', ref: 'document:rp-w2' }, { type: 'CALCULATION', ref: run }]);
    as('rp-prep'); const mapping = await call('POST', `/cases/${caseId}/form-mappings`, { ruleId: formRuleId });
    expect(mapping.status, JSON.stringify(mapping.body)).toBe(201);
    const prepared = await prepare();
    expect(prepared.status, JSON.stringify(prepared.body)).toBe(201);
    return1 = prepared.body.returnVersionId;
    expect(prepared.body).toMatchObject({ caseId, taxYear: 2025, templateId: 'SYN-1040-RETURN', version: 1, status: 'DRAFT', stale: [], returnUse: 'BLOCKED',
      forms: [{ formId: 'SYN-1040', formVersion: '2025.0', mappingId: mapping.body.mappingId, mappingVersion: 1, valuesSha256: mapping.body.valuesSha256 }],
      missing: [{ formId: 'SYN-SCH1', formVersion: '2025.0' }] });
    expect((await prepare()).body).toMatchObject({ returnVersionId: return1, replayed: true });
    as('rp-rev'); const detail = (await call('GET', `/returns/${return1}`)).body;
    const source = detail.lineage[0].values[0].sources[0];
    const stored = (await db.pool.query(`SELECT version, hash FROM taxguard_documents WHERE tenant_id = $1 AND document_id = 'rp-w2'`, [T])).rows[0];
    expect(detail.lineage[0]).toMatchObject({ mappingId: mapping.body.mappingId, formId: 'SYN-1040' });
    expect(source).toMatchObject({ conclusionId: income, conclusionVersion: 1, runId: run, ruleSetId });
    expect(source.evidence[0].snapshot).toMatchObject({ documentId: 'rp-w2', documentVersion: stored.version, documentSha256: stored.hash });
    const audit = (await db.pool.query(`SELECT actor_uid, metadata FROM taxguard_audit_log WHERE tenant_id = $1 AND action = 'TAX_RETURN_PREPARED'`, [T])).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor_uid: 'rp-prep', metadata: { returnVersionId: return1, version: 1, forms: 1 } });
  });

  it('the preparer submits and only the independent reviewer approves; Stage 09 facts follow the approval', async () => {
    expect(await facts()).toMatchObject({ draftReturnGenerated: false, preparerReviewComplete: false, openReturns: 1 });
    expect((await act(return1, 'submit', 'rp-rev')).body.code).toBe('TAX_RETURN_PREPARER_REQUIRED');
    expect((await act(return1, 'approve', 'rp-rev')).body.code).toBe('TAX_RETURN_NOT_SUBMITTED');
    expect((await act(return1, 'submit', 'rp-prep')).body.status).toBe('SUBMITTED');
    expect((await act(return1, 'submit', 'rp-prep')).body.code).toBe('TAX_RETURN_NOT_DRAFT');
    expect((await act(return1, 'approve', 'rp-prep')).body.code).toBe('TAX_RETURN_REVIEWER_REQUIRED');
    expect((await act(return1, 'approve', 'rp-mgr')).body.code).toBe('TAX_RETURN_REVIEWER_REQUIRED');
    expect((await act(return1, 'return', 'rp-rev', 'short')).body.code).toBe('TAX_RETURN_INPUT_INVALID');
    // The Stage 09 draft review also needs the owner's review policy; without it the case reviewer cannot approve.
    expect((await act(return1, 'approve', 'rp-rev')).body).toEqual({ code: 'TAX_RETURN_REVIEW_AUTHORITY_REQUIRED', detail: 'NO_POLICY' });
    await policy('RETURN_DRAFT_REVIEW', 1, { eligibility: false, designation: false, caseAssignment: true });
    expect((await act(return1, 'approve', 'rp-rev')).body).toMatchObject({ status: 'APPROVED', reviewedBy: 'rp-rev', stale: [],
      approvalBasis: { function: 'RETURN_DRAFT_REVIEW', policyVersion: 1, jurisdiction: 'US', caseReviewer: true, approverUid: 'rp-rev' } });
    await expect(db.pool.query(`UPDATE taxguard_tax_return_versions SET approval_basis = '{}'::jsonb WHERE tenant_id = $1 AND return_version_id = $2`, [T, return1]))
      .rejects.toThrow('TAX_RETURN_IMMUTABLE');
    expect(await facts()).toEqual({ draftReturnGenerated: true, preparerReviewComplete: true, provenanceComplete: true, openReturns: 1,
      approvedCurrentReturns: 1, returnUse: 'BLOCKED' });
    const audit = (await db.pool.query(`SELECT action, actor_uid FROM taxguard_audit_log WHERE tenant_id = $1 AND action IN ('TAX_RETURN_SUBMITTED','TAX_RETURN_APPROVED') ORDER BY action`, [T])).rows;
    expect(audit).toEqual([{ action: 'TAX_RETURN_APPROVED', actor_uid: 'rp-rev' }, { action: 'TAX_RETURN_SUBMITTED', actor_uid: 'rp-prep' }]);
  });

  it('versions cannot be edited, deleted or written directly by anyone', async () => {
    for (const sql of [`UPDATE taxguard_tax_return_versions SET forms = '[]'::jsonb WHERE tenant_id = '${T}'`,
      `UPDATE taxguard_tax_return_versions SET status = 'DRAFT' WHERE tenant_id = '${T}'`,
      `UPDATE taxguard_tax_return_versions SET reviewed_by = 'rp-out' WHERE tenant_id = '${T}'`,
      `DELETE FROM taxguard_tax_return_versions WHERE tenant_id = '${T}'`, 'TRUNCATE taxguard_tax_return_versions',
      'TRUNCATE taxguard_tax_return_templates CASCADE'])
      await expect(db.pool.query(sql), sql).rejects.toThrow('TAX_RETURN_IMMUTABLE');
    await expect(db.pool.query(`INSERT INTO taxguard_tax_return_versions(tenant_id, case_id, client_id, engagement_id, tax_year, template_id, version,
      template_rule_id, template_version, template_sha256, forms, forms_sha256, prepared_by) VALUES ($1, $2, $3, $4, 2025, 'X', 99, $5, 1, repeat('a', 64), '[]'::jsonb,
      repeat('a', 64), 'rp-prep')`, [T, caseId, C, engagementId, templateId])).rejects.toThrow(/check/i);
    for (const table of ['taxguard_tax_return_templates', 'taxguard_tax_return_versions'])
      for (const role of ['anon', 'authenticated', 'service_role'])
        expect((await db.pool.query(`SELECT has_table_privilege($1, $2, 'SELECT') OR has_table_privilege($1, $2, 'INSERT') OR has_table_privilege($1, $2, 'UPDATE') AS ok`,
          [role, 'public.' + table])).rows[0].ok, `${role} ${table}`).toBe(false);
    for (const fn of ['taxguard_tax_return_derive(taxguard_cases,taxguard_tax_return_templates)', 'taxguard_tax_return_stale(text,uuid)', 'taxguard_tax_return_json(text,uuid,boolean)'])
      expect((await db.pool.query(`SELECT has_function_privilege('service_role', $1, 'EXECUTE') AS ok`, ['public.' + fn])).rows[0].ok, fn).toBe(false);
  });

  it('is isolated by tenant, client, case assignment, tax year and role', async () => {
    for (const uid of ['rp-out', 'rp-prep24']) {
      as(uid);
      expect((await call('GET', `/returns/${return1}`)).body, uid).toEqual({ code: 'TAX_RETURN_NOT_FOUND' });
      expect((await call('GET', `/cases/${caseId}/returns`)).status, uid).toBe(404);
      expect((await call('POST', `/cases/${caseId}/returns`, { templateRuleId: templateId })).status, uid).toBe(404);
      expect((await call('POST', `/returns/${return1}/approve`)).body, uid).toEqual({ code: 'TAX_RETURN_NOT_FOUND' });
    }
    as('rp-foreign', T2); expect((await call('GET', `/returns/${return1}`)).body).toEqual({ code: 'TAX_RETURN_NOT_FOUND' });
    expect((await call('GET', `/return-templates/${templateId}`)).body.code).toBe('TAX_RETURN_TEMPLATE_NOT_FOUND');
    as('rp-client'); expect((await call('GET', `/returns/${return1}`)).status).toBe(403);
    as('rp-mgr'); expect((await call('GET', `/returns/${return1}`)).body.returnVersionId).toBe(return1);
    expect((await call('GET', '/returns/not-a-uuid')).status).toBe(404);
  });
});

describe('a changed input makes the return stale; preparing again records a new version', () => {
  it('a revised conclusion: mapping stale -> return stale; mapped again -> changed; prepared again as version 2; returned -> version 3', async () => {
    const run2 = await approvedRun('5200.00', 'document:rp-w2');
    as('rp-prep'); const v2 = (await call('POST', `/conclusions/${income}/revise`, { amount: '5200.00',
      links: [{ type: 'EVIDENCE', ref: 'document:rp-w2' }, { type: 'CALCULATION', ref: run2 }] })).body.conclusionId;
    await call('POST', `/conclusions/${v2}/submit`); as('rp-rev'); await call('POST', `/conclusions/${v2}/approve`, {});
    as('rp-rev'); const stale = (await call('GET', `/returns/${return1}`)).body;
    expect(stale.status).toBe('APPROVED'); // nothing changes silently
    expect(stale.stale).toEqual([{ formId: 'SYN-1040', formVersion: '2025.0', reason: 'RETURN_MAPPING_STALE', mappingId: stale.forms[0].mappingId }]);
    expect(await facts()).toMatchObject({ draftReturnGenerated: false, preparerReviewComplete: false });
    expect(JSON.parse((await prepare()).body.detail)).toEqual([expect.objectContaining({ reason: 'RETURN_MAPPING_STALE' })]);
    as('rp-prep'); expect((await call('POST', `/cases/${caseId}/form-mappings`, { ruleId: formRuleId })).body.version).toBe(2);
    as('rp-rev'); expect((await call('GET', `/returns/${return1}`)).body.stale).toEqual([{ formId: 'SYN-1040', formVersion: '2025.0', reason: 'RETURN_MAPPING_CHANGED' }]);
    const second = (await prepare()).body;
    expect(second).toMatchObject({ version: 2, status: 'DRAFT', stale: [], forms: [{ mappingVersion: 2 }] });
    as('rp-rev'); const list = (await call('GET', `/cases/${caseId}/returns`)).body.items;
    expect(list.map((v: any) => [v.version, v.status])).toEqual([[2, 'DRAFT'], [1, 'SUPERSEDED']]);
    expect((await act(return1, 'approve', 'rp-rev')).body.code).toBe('TAX_RETURN_NOT_SUBMITTED');
    expect((await act(second.returnVersionId, 'submit', 'rp-prep')).body.status).toBe('SUBMITTED');
    expect((await act(second.returnVersionId, 'return', 'rp-rev', 'Synthetic: wages line needs the corrected W-2')).body).toMatchObject({ status: 'RETURNED' });
    const third = (await prepare()).body;
    expect(third).toMatchObject({ version: 3, status: 'DRAFT' }); // a returned version is never replayed
  });

  it('a stale version cannot be submitted', async () => {
    as('rp-rev'); const open = (await call('GET', `/cases/${caseId}/returns`)).body.items.find((v: any) => v.status === 'DRAFT');
    await doc('rp-w2', 2, 'PENDING_REVIEW');
    const refused = (await act(open.returnVersionId, 'submit', 'rp-prep')).body;
    expect(refused.code).toBe('TAX_RETURN_STALE');
    expect(JSON.parse(refused.detail).map((p: any) => p.reason)).toEqual(['RETURN_MAPPING_STALE']);
  });

  it('a mapping made under a superseded mapping rule is refused, and the open version reads stale', async () => {
    as('rp-prep'); const newer = (await call('POST', '/form-rules', { definition: { jurisdiction: 'federal', jurisdictionCode: 'US', returnFamily: '1040', taxYear: 2025,
      formId: 'SYN-1040', formVersion: '2025.0', effectiveFrom: '2025-01-01', sourceId: SYNTHETIC_SOURCE_ID, lines: [
        { schedule: 'MAIN', line: '1a', field: 'f1_wages_v2', valueType: 'MONEY', required: true, aggregate: 'SINGLE', source: { conclusionType: 'INCOME_INCLUSION', value: 'AMOUNT' } }] } })).body.ruleId;
    await call('POST', `/form-rules/${newer}/submit`);
    as('rp-rev'); expect((await call('POST', `/form-rules/${newer}/approve`)).body.status).toBe('APPROVED'); // supersedes the rule of the current mapping
    const before = (await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_tax_return_versions WHERE tenant_id = $1`, [T])).rows[0].n;
    const refused = (await prepare()).body;
    expect(refused.code).toBe('TAX_RETURN_PREPARATION_REFUSED');
    expect(JSON.parse(refused.detail)).toEqual([expect.objectContaining({ formId: 'SYN-1040', formVersion: '2025.0', reason: 'RETURN_MAPPING_RULE_NOT_APPROVED' })]);
    expect((await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_tax_return_versions WHERE tenant_id = $1`, [T])).rows[0].n).toBe(before);
    as('rp-rev'); const open = (await call('GET', `/cases/${caseId}/returns`)).body.items.find((v: any) => v.status === 'DRAFT');
    expect(open.stale.map((p: any) => p.reason)).toContain('RETURN_MAPPING_RULE_NOT_APPROVED');
  });
});
