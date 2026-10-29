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

// Block 67: deterministic form mapping (proposal 20261019110000, review only) over HTTP on real PostgreSQL with every
// proposal applied. Approved, current conclusions reach a form line only through an approved, versioned mapping rule;
// every value carries its provenance; anything that cannot be mapped deterministically is refused; a changed source makes
// the mapping stale until the preparer maps again. SYNTHETIC data and a synthetic form only: nothing here is tax law.
const T = 'tenantFormMap', T2 = 'tenantFormMapOther', C = 'fmClient';
const roles: Record<string, string> = { 'fm-mgr': 'practice_manager', 'fm-prep': 'accountant', 'fm-rev': 'reviewer', 'fm-out': 'accountant', 'fm-client': 'client',
  'fm-prep24': 'accountant' };
let db: TestDatabase; let caseId = '', engagementId = '', ruleSetId = '', ruleId = '', mapping1 = '', income1 = '';
let server: Server; let origin = ''; let user: any = null;
const as = (uid: string, tenantId = T) => { user = { id: uid, role: roles[uid] ?? 'practice_manager', tenantId, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown) => fetch(origin + '/tax' + path, { method, headers: { 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).then(async r => ({ status: r.status, body: await r.json() as any }));
const rpc = async (fn: string, args: Record<string, unknown>) => { const r = await pgRpc(db.pool).rpc(fn, args); if (r.error) throw new Error(r.error.message); return r.data as any; };
const doc = (id: string, version: number, status: string) => db.pool.query(`INSERT INTO taxguard_documents(document_id, tenant_id, client_id, engagement_id,
    tax_year, case_id, version, hash, mime_type, status, quarantine_status, created_by) VALUES ($1, $2, $3, $4, 2025, $5, $6, repeat($7, 64), 'application/pdf', $8, 'CLEAN', 'fm-client')`,
  [id, T, C, engagementId, caseId, version, String(version), status]);
async function approvedRun(value: string, evidence: string) {
  as('fm-prep');
  const run = await call('POST', `/cases/${caseId}/runs`, { ruleSetId, inputs: [{ factPath: 'synthetic.income_a', value, evidenceIds: [evidence] }] });
  expect(run.status, run.body?.code).toBe(201);
  as('fm-rev'); expect((await call('POST', `/runs/${run.body.run_id}/approve`, { note: 'Synthetic inputs traced to evidence' })).body.status).toBe('REVIEW_APPROVED');
  return run.body.run_id as string;
}
async function approvedConclusion(type: string, amount: string, links: unknown[]) {
  as('fm-prep');
  const k = (await call('POST', `/cases/${caseId}/conclusions`, { type, statement: `Synthetic ${type.toLowerCase()} for the year.`, amount, links })).body;
  expect(k.status, k.code).toBe('DRAFT');
  expect((await call('POST', `/conclusions/${k.conclusionId}/submit`)).body.status).toBe('READY_FOR_REVIEW');
  as('fm-rev'); expect((await call('POST', `/conclusions/${k.conclusionId}/approve`, {})).body.status).toBe('APPROVED');
  return k.conclusionId as string;
}
const line = (lineNo: string, field: string, source: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({ schedule: 'MAIN', line: lineNo, field, valueType: 'MONEY', required: true, aggregate: 'SINGLE', source, ...extra });
const definition = (lines: unknown[], over: Record<string, unknown> = {}) => ({ jurisdiction: 'federal', jurisdictionCode: 'US', returnFamily: '1040', taxYear: 2025,
  formId: 'SYN-1040', formVersion: '2025.0', effectiveFrom: '2025-01-01', sourceId: SYNTHETIC_SOURCE_ID, lines, ...over });
const LINES = [
  line('1a', 'f1_wages', { conclusionType: 'INCOME_INCLUSION', value: 'AMOUNT' }),
  line('16', 'f1_tax', { conclusionType: 'INCOME_INCLUSION', value: 'OUTPUT', outputKey: 'synthetic_amount' }),
  line('12', 'f1_deductions', { conclusionType: 'DEDUCTION', value: 'AMOUNT' }, { required: false, aggregate: 'SUM' }),
];
async function approvedRule(lines: unknown[], over: Record<string, unknown> = {}) {
  as('fm-prep'); const r = await call('POST', '/form-rules', { definition: definition(lines, over) });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  expect((await call('POST', `/form-rules/${r.body.ruleId}/submit`)).body.status).toBe('PENDING_REVIEW');
  as('fm-rev'); expect((await call('POST', `/form-rules/${r.body.ruleId}/approve`)).body.status).toBe('APPROVED');
  return r.body.ruleId as string;
}
const map = (rule = ruleId, uid = 'fm-prep') => { as(uid); return call('POST', `/cases/${caseId}/form-mappings`, { ruleId: rule }); };

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic form mapping practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'fm-client', 'Synthetic Mapping Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ('${T}', 'fm-mgr', 'practice_manager', 'active', NULL), ('${T}', 'fm-prep', 'accountant', 'active', NULL),
      ('${T}', 'fm-rev', 'reviewer', 'active', NULL), ('${T}', 'fm-out', 'accountant', 'active', NULL), ('${T}', 'fm-client', 'client', 'active', '${C}'),
      ('${T}', 'fm-prep24', 'accountant', 'active', NULL), ('${T2}', 'fm-foreign', 'practice_manager', 'active', NULL);`);
  const practice = new PracticeStore(pgRpc(db.pool));
  engagementId = (await practice.createEngagement(T, C, 'fm-mgr', 'fm-engagement-1', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'fm-mgr', engagementId, 'active', 1);
  for (const [role, userId] of [['preparer', 'fm-prep'], ['reviewer', 'fm-rev']])
    await practice.assign(T, C, 'fm-mgr', `fm-assign-${role}`, { engagementId, taxYear: 2025, role, userId, reason: 'Synthetic staffing' });
  // Same client, another tax year only.
  await db.pool.query(`INSERT INTO taxguard_staff_assignments(id, tenant_id, client_id, engagement_id, tax_year, role, user_id, assigned_by, status, effective_from, effective_to)
    VALUES ('fm-prep24-1', '${T}', '${C}', '${engagementId}', 2024, 'preparer', 'fm-prep24', 'fm-mgr', 'ACTIVE', now() - interval '1 day', NULL)`);
  caseId = (await new CaseStore(pgRpc(db.pool)).create(T, C, 'fm-mgr', 'fm-case-key-1', { engagementId, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  const app = express();
  app.use('/tax', createTaxEngineRouter({ store: () => new TaxEngineStore(pgRpc(db.pool)), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  as('fm-prep');
  expect((await call('POST', '/sources', { sourceId: SYNTHETIC_SOURCE_ID, jurisdiction: 'state', jurisdictionCode: 'ZZ', authorityType: 'synthetic_test',
    title: 'Synthetic fixture source (not tax law)', issuer: 'Synthetic test issuer', citation: 'Synthetic fixture', taxYears: [2025] })).status).toBe(201);
  as('fm-rev'); await call('POST', `/sources/${SYNTHETIC_SOURCE_ID}/verify`, { documentSha256: 'a'.repeat(64) });
  as('fm-prep'); ruleSetId = (await call('POST', '/rule-sets', { definition: syntheticRuleSet() })).body.ruleSetId;
  for (const [filingStatus, expected] of [[undefined, { synthetic_base: '4000.00', synthetic_amount: '290.00' }], ['synthetic_joint', { synthetic_base: '3000.00', synthetic_amount: '217.50' }]] as const)
    await call('POST', `/rule-sets/${ruleSetId}/tests`, { name: 'Synthetic example ' + (filingStatus ?? 'single'), sourceId: SYNTHETIC_SOURCE_ID, citation: 'Synthetic fixture example',
      ...(filingStatus ? { filingStatus } : {}), inputs: [{ factPath: 'synthetic.income_a', value: '5000.00', evidenceIds: ['doc:rule-test-fixture'] }], expected });
  await call('POST', `/rule-sets/${ruleSetId}/run-tests`); await call('POST', `/rule-sets/${ruleSetId}/submit`);
  as('fm-rev'); expect((await call('POST', `/rule-sets/${ruleSetId}/approve`)).body.status).toBe('APPROVED');
  await doc('fm-w2', 1, 'VERIFIED');
}, 240_000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await db?.stop(); });

describe('mapping rules are governed tax content', () => {
  it('validated, hashed, versioned, maker-checker approved on a verified source, frozen once submitted', async () => {
    as('fm-prep');
    expect((await call('POST', '/form-rules', { definition: definition([line('1a', 'f1', { conclusionType: 'GUESS', value: 'AMOUNT' })]) })).body)
      .toEqual({ code: 'TAX_FORM_RULE_INPUT_INVALID', detail: 'LINE' });
    expect((await call('POST', '/form-rules', { definition: definition([line('1a', 'f1', { conclusionType: 'OTHER', value: 'OUTPUT' })]) })).body.detail).toBe('LINE');
    expect((await call('POST', '/form-rules', { definition: definition([LINES[0], LINES[0]]) })).body.detail).toBe('DUPLICATE_LINE');
    const unverified = (await call('POST', '/form-rules', { definition: definition([LINES[0]], { sourceId: 'syn-unverified-src' }) })).body;
    expect((await call('POST', `/form-rules/${unverified.ruleId}/submit`)).body).toEqual({ code: 'TAX_SOURCE_NOT_VERIFIED', detail: 'syn-unverified-src' });
    const drafted = await call('POST', '/form-rules', { definition: definition(LINES) });
    expect(drafted.status).toBe(201);
    expect(drafted.body).toMatchObject({ formId: 'SYN-1040', formVersion: '2025.0', version: 2, status: 'DRAFT', lines: 3 });
    expect(drafted.body.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect((await call('POST', '/form-rules', { definition: definition(LINES) })).body.code).toBe('TAX_FORM_RULE_DUPLICATE');
    ruleId = drafted.body.ruleId;
    expect((await call('POST', `/form-rules/${ruleId}/approve`)).body.code).toBe('TAX_CONTENT_REVIEWER_REQUIRED');
    expect((await call('POST', `/form-rules/${ruleId}/submit`)).body.status).toBe('PENDING_REVIEW');
    await expect(db.pool.query(`UPDATE taxguard_tax_form_rules SET definition = '{}'::jsonb WHERE tenant_id = $1 AND rule_id = $2`, [T, ruleId])).rejects.toThrow('TAX_FORM_MAPPING_IMMUTABLE');
    // The reviewer may not approve a rule they drafted.
    as('fm-rev'); const own = (await call('POST', '/form-rules', { definition: definition(LINES, { formVersion: '2025.9' }) })).body;
    await call('POST', `/form-rules/${own.ruleId}/submit`);
    expect((await call('POST', `/form-rules/${own.ruleId}/approve`)).body.code).toBe('MAKER_CHECKER_VIOLATION');
    expect((await call('POST', `/form-rules/${ruleId}/reject`, { note: 'short' })).body.code).toBe('TAX_FORM_RULE_INPUT_INVALID');
    // Proposal 20261019130000: approving a mapping rule needs the FORM_RULE_APPROVAL authority; with nothing configured it
    // fails closed, and a reviewer role alone is not enough.
    expect((await call('POST', `/form-rules/${ruleId}/approve`)).body).toEqual({ code: 'TAX_FORM_RULE_APPROVER_REQUIRED', detail: 'NO_POLICY' });
    await db.pool.query(`INSERT INTO taxguard_tax_approval_policies(tenant_id, function_code, policy_version, requires_eligibility, requires_designation,
      requires_case_assignment, accepted_credentials, eligibility_text, approved_by) VALUES ($1, 'FORM_RULE_APPROVAL', 1, true, true, false, ARRAY['CPA','EA'],
      'Synthetic policy for tests: verified CPA or EA with a designation.', 'fm-owner')`, [T]);
    expect((await call('POST', `/form-rules/${ruleId}/approve`)).body).toEqual({ code: 'TAX_FORM_RULE_APPROVER_REQUIRED', detail: 'NO_DESIGNATION' });
    await db.pool.query(`INSERT INTO taxguard_tax_function_designations(tenant_id, person_uid, function_code, policy_version, designation_reference, designated_by)
      VALUES ($1, 'fm-rev', 'FORM_RULE_APPROVAL', 1, 'synthetic-designation-fm-rev', 'fm-owner')`, [T]);
    expect((await call('POST', `/form-rules/${ruleId}/approve`)).body).toEqual({ code: 'TAX_FORM_RULE_APPROVER_REQUIRED', detail: 'NO_ELIGIBILITY' });
    await db.pool.query(`INSERT INTO taxguard_tax_professional_eligibility(tenant_id, person_uid, credential_type, credential_reference, issuing_jurisdiction,
      scope_jurisdictions, valid_from, expires_on, verified_by, verification_reference) VALUES ($1, 'fm-rev', 'EA', 'synthetic-enrolment-ref', 'US', ARRAY['US'],
      '2025-01-01', '2099-12-31', 'fm-owner', 'synthetic-registry-lookup')`, [T]);
    expect((await call('POST', `/form-rules/${ruleId}/approve`)).body).toMatchObject({ status: 'APPROVED', reviewedBy: 'fm-rev',
      approvalBasis: { function: 'FORM_RULE_APPROVAL', policyVersion: 1, jurisdiction: 'US', credentialType: 'EA', designatedBy: 'fm-owner', approverUid: 'fm-rev', ruleVersion: 2 } });
    await expect(db.pool.query(`UPDATE taxguard_tax_form_rules SET approval_basis = '{}'::jsonb WHERE tenant_id = $1 AND rule_id = $2`, [T, ruleId]))
      .rejects.toThrow('TAX_FORM_MAPPING_IMMUTABLE');
    expect((await call('GET', `/form-rules/${ruleId}`)).body.definition.lines).toHaveLength(3);
  });

  it('names only a supported jurisdiction and valid effective dates, frozen with the rule', async () => {
    as('fm-prep');
    const invalid = async (over: Record<string, unknown>) => (await call('POST', '/form-rules', { definition: definition([LINES[0]], { formVersion: '2025.5', ...over }) })).body;
    for (const over of [{ jurisdictionCode: 'ZZ' }, { jurisdiction: 'state', jurisdictionCode: 'US' }, { jurisdiction: 'state', jurisdictionCode: 'ZZ' },
      { jurisdiction: 'federal', jurisdictionCode: 'CA' }])
      expect(await invalid(over), JSON.stringify(over)).toEqual({ code: 'TAX_FORM_RULE_INPUT_INVALID', detail: 'JURISDICTION' });
    for (const over of [{ effectiveFrom: undefined }, { effectiveFrom: '2025-02-30' }, { effectiveFrom: '2025-1-01' }, { effectiveFrom: 20250101 },
      { effectiveTo: '2024-12-31' }, { effectiveTo: 'never' }, { effectiveTo: 2026 }])
      expect(await invalid(over), JSON.stringify(over)).toEqual({ code: 'TAX_FORM_RULE_INPUT_INVALID', detail: 'EFFECTIVE_DATES' });
    const state = (await call('POST', '/form-rules', { definition: definition([LINES[0]], { jurisdiction: 'state', jurisdictionCode: 'CA', formId: 'SYN-540',
      effectiveTo: '2026-12-31' }) })).body;
    expect(state).toMatchObject({ jurisdiction: 'state', jurisdictionCode: 'CA', effectiveFrom: '2025-01-01', effectiveTo: '2026-12-31', status: 'DRAFT' });
    expect((await call('GET', `/form-rules/${ruleId}`)).body).toMatchObject({ effectiveFrom: '2025-01-01', effectiveTo: null });
    // Dates and jurisdiction cannot be changed after drafting, and the table refuses an unsupported pair outright.
    for (const sql of [`UPDATE taxguard_tax_form_rules SET effective_to = '2030-01-01' WHERE tenant_id = $1 AND rule_id = $2`,
      `UPDATE taxguard_tax_form_rules SET jurisdiction_code = 'NY' WHERE tenant_id = $1 AND rule_id = $2`])
      await expect(db.pool.query(sql, [T, state.ruleId]), sql).rejects.toThrow('TAX_FORM_MAPPING_IMMUTABLE');
    await expect(db.pool.query(`INSERT INTO taxguard_tax_form_rules(tenant_id, jurisdiction, jurisdiction_code, effective_from, return_family, tax_year, form_id,
      form_version, version, definition, content_sha256, source_id, prepared_by) VALUES ($1, 'state', 'ZZ', '2025-01-01', '1040', 2025, 'SYN-X', '1', 1, '{}'::jsonb,
      repeat('c', 64), 'syn-src', 'fm-prep')`, [T])).rejects.toThrow(/check/i);
    await expect(db.pool.query(`INSERT INTO taxguard_tax_form_rules(tenant_id, jurisdiction, jurisdiction_code, effective_from, effective_to, return_family, tax_year,
      form_id, form_version, version, definition, content_sha256, source_id, prepared_by) VALUES ($1, 'federal', 'US', '2025-06-01', '2025-01-01', '1040', 2025, 'SYN-X',
      '1', 1, '{}'::jsonb, repeat('c', 64), 'syn-src', 'fm-prep')`, [T])).rejects.toThrow(/check/i);
  });

  it('FORM_RULE_APPROVAL: revoked eligibility fails closed; rules approved before the authority keep their status and cannot be backfilled', async () => {
    as('fm-prep'); const r = (await call('POST', '/form-rules', { definition: definition([LINES[0]], { formVersion: '2025.6' }) })).body.ruleId;
    await call('POST', `/form-rules/${r}/submit`);
    await db.pool.query(`UPDATE taxguard_tax_professional_eligibility SET revoked_by = 'fm-owner', revoked_at = now(), revocation_reason = 'Synthetic: enrolment lapsed'
      WHERE tenant_id = $1 AND person_uid = 'fm-rev' AND revoked_at IS NULL`, [T]);
    as('fm-rev'); expect((await call('POST', `/form-rules/${r}/approve`)).body).toEqual({ code: 'TAX_FORM_RULE_APPROVER_REQUIRED', detail: 'ELIGIBILITY_REVOKED' });
    // Maker-checker still applies to an authorized approver: the drafter cannot approve their own rule.
    await db.pool.query(`INSERT INTO taxguard_tax_professional_eligibility(tenant_id, person_uid, credential_type, credential_reference, issuing_jurisdiction,
      scope_jurisdictions, valid_from, expires_on, verified_by, verification_reference, verified_at) VALUES ($1, 'fm-rev', 'EA', 'synthetic-enrolment-ref-2', 'US',
      ARRAY['US'], '2025-01-01', '2099-12-31', 'fm-owner', 'synthetic-registry-lookup-2', now() + interval '1 second')`, [T]);
    const own = (await call('POST', '/form-rules', { definition: definition([LINES[0]], { formVersion: '2025.4' }) })).body.ruleId;
    await call('POST', `/form-rules/${own}/submit`);
    expect((await call('POST', `/form-rules/${own}/approve`)).body.code).toBe('MAKER_CHECKER_VIOLATION');
    expect((await call('POST', `/form-rules/${r}/approve`)).body).toMatchObject({ status: 'APPROVED', approvalBasis: { credentialType: 'EA', function: 'FORM_RULE_APPROVAL' } });
    // A rule approved before this proposal (no recorded basis) stays APPROVED; its basis cannot be filled in afterwards.
    const legacy = (await db.pool.query(`INSERT INTO taxguard_tax_form_rules(tenant_id, jurisdiction, jurisdiction_code, effective_from, return_family, tax_year,
      form_id, form_version, version, definition, content_sha256, source_id, status, prepared_by, submitted_at, reviewed_by, reviewed_at)
      VALUES ($1, 'federal', 'US', '2025-01-01', '1040', 2025, 'SYN-LEGACY', '2025.0', 1, $2, repeat('d', 64), $3, 'APPROVED', 'fm-prep', now(), 'fm-legacy-reviewer', now())
      RETURNING rule_id`, [T, JSON.stringify(definition([LINES[0]], { formId: 'SYN-LEGACY' })), SYNTHETIC_SOURCE_ID])).rows[0].rule_id;
    expect((await call('GET', `/form-rules/${legacy}`)).body).toMatchObject({ status: 'APPROVED', reviewedBy: 'fm-legacy-reviewer', approvalBasis: null });
    await expect(db.pool.query(`UPDATE taxguard_tax_form_rules SET approval_basis = '{"backfilled": true}'::jsonb WHERE tenant_id = $1 AND rule_id = $2`, [T, legacy]))
      .rejects.toThrow('TAX_FORM_MAPPING_IMMUTABLE');
    const audit = (await db.pool.query(`SELECT metadata FROM taxguard_audit_log WHERE tenant_id = $1 AND action = 'TAX_FORM_RULE_APPROVED' AND metadata->>'ruleId' = $2`, [T, r])).rows;
    expect(audit).toEqual([{ metadata: expect.objectContaining({ approvalBasis: expect.objectContaining({ credentialType: 'EA', approverUid: 'fm-rev' }) }) }]);
  });
});

describe('form values come only from approved, current conclusions through the approved rule', () => {
  it('refuses what cannot be mapped deterministically, and only the case preparer maps', async () => {
    const none = (await map()).body;
    expect(none.code).toBe('TAX_FORM_MAPPING_REFUSED');
    expect(JSON.parse(none.detail)).toEqual([
      { schedule: 'MAIN', line: '16', field: 'f1_tax', reason: 'SOURCE_MISSING' }, { schedule: 'MAIN', line: '1a', field: 'f1_wages', reason: 'SOURCE_MISSING' }]);
    expect((await map(ruleId, 'fm-rev')).body.code).toBe('TAX_FORM_MAPPING_PREPARER_REQUIRED');
    // An approved conclusion without a calculation run cannot be a form value.
    const bare = await approvedConclusion('INCOME_INCLUSION', '100.00', [{ type: 'EVIDENCE', ref: 'document:fm-w2' }]);
    const refused = await map();
    expect(refused.body.code).toBe('TAX_FORM_MAPPING_REFUSED');
    expect(JSON.parse(refused.body.detail)).toEqual(expect.arrayContaining([expect.objectContaining({ line: '1a', reason: 'CALCULATION_SOURCE_REQUIRED', conclusionId: bare })]));
    // Retire it (rejected on revision) and add a calculated one; a second calculated one makes SINGLE lines ambiguous.
    as('fm-prep'); const withdrawn = (await call('POST', `/conclusions/${bare}/revise`, { links: [{ type: 'EVIDENCE', ref: 'document:fm-w2' }] })).body.conclusionId;
    await call('POST', `/conclusions/${withdrawn}/submit`); as('fm-rev'); await call('POST', `/conclusions/${withdrawn}/reject`, { note: 'Synthetic: not a separate income item' });
    const run1 = await approvedRun('5000.00', 'document:fm-w2');
    income1 = await approvedConclusion('INCOME_INCLUSION', '5000.00', [{ type: 'EVIDENCE', ref: 'document:fm-w2' }, { type: 'CALCULATION', ref: run1 }]);
    const extra = await approvedConclusion('INCOME_INCLUSION', '5000.00', [{ type: 'EVIDENCE', ref: 'document:fm-w2' }, { type: 'CALCULATION', ref: run1 }]);
    expect(JSON.parse((await map()).body.detail)).toEqual([
      { schedule: 'MAIN', line: '16', field: 'f1_tax', reason: 'AMBIGUOUS_SOURCE', candidates: 2 }, { schedule: 'MAIN', line: '1a', field: 'f1_wages', reason: 'AMBIGUOUS_SOURCE', candidates: 2 }]);
    as('fm-prep'); const gone = (await call('POST', `/conclusions/${extra}/revise`, { links: [{ type: 'EVIDENCE', ref: 'document:fm-w2' }] })).body.conclusionId;
    await call('POST', `/conclusions/${gone}/submit`); as('fm-rev'); await call('POST', `/conclusions/${gone}/reject`, { note: 'Synthetic: duplicate of the wages conclusion' });
    // Scope: a rule for another return family, and a rule that is not approved, are refused.
    const otherFamily = await approvedRule([LINES[0]], { returnFamily: '1065', formId: 'SYN-1065' });
    expect((await map(otherFamily)).body.code).toBe('TAX_FORM_RULE_SCOPE_MISMATCH');
    as('fm-prep'); const draft = (await call('POST', '/form-rules', { definition: definition([LINES[0]], { formVersion: '2025.1' }) })).body.ruleId;
    expect((await map(draft)).body.code).toBe('TAX_FORM_RULE_NOT_APPROVED');
    // A rejected rule and a rule that does not exist are refused too.
    await call('POST', `/form-rules/${draft}/submit`);
    as('fm-rev'); expect((await call('POST', `/form-rules/${draft}/reject`, { note: 'Synthetic: line 1a field name is wrong' })).body.status).toBe('REJECTED');
    expect((await map(draft)).body.code).toBe('TAX_FORM_RULE_NOT_APPROVED');
    expect((await map('00000000-0000-4000-8000-000000000000')).body.code).toBe('TAX_FORM_RULE_NOT_FOUND');
    expect(await map('not-a-rule').then(r => [r.status, r.body.code])).toEqual([404, 'TAX_FORM_RULE_NOT_FOUND']);
    // An approved rule maps only while in effect: not before its first day, not after its last.
    const future = await approvedRule([LINES[0]], { formVersion: '2025.7', effectiveFrom: '2099-01-01' });
    expect((await map(future)).body).toEqual({ code: 'TAX_FORM_RULE_NOT_EFFECTIVE', detail: '2099-01-01 to open' });
    const expired = await approvedRule([LINES[0]], { formVersion: '2025.8', effectiveTo: '2025-12-31' });
    expect((await map(expired)).body).toEqual({ code: 'TAX_FORM_RULE_NOT_EFFECTIVE', detail: '2025-01-01 to 2025-12-31' });
    expect((await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_tax_form_mappings WHERE tenant_id = $1`, [T])).rows[0].n).toBe(0);
  });

  it('maps every value with its full provenance; mapping again is idempotent; the conclusion trace reaches the form line', async () => {
    const mapped = await map();
    expect(mapped.status, JSON.stringify(mapped.body)).toBe(201);
    mapping1 = mapped.body.mappingId;
    expect(mapped.body).toMatchObject({ caseId, taxYear: 2025, formId: 'SYN-1040', formVersion: '2025.0', version: 1, status: 'CURRENT', ruleId, ruleVersion: 2,
      stale: [], returnUse: 'BLOCKED', missing: [{ schedule: 'MAIN', line: '12', field: 'f1_deductions' }] });
    expect(mapped.body.values.map((v: any) => [v.line, v.field, v.valueType, v.value])).toEqual([['16', 'f1_tax', 'MONEY', '290.00'], ['1a', 'f1_wages', 'MONEY', '5000.00']]);
    const source = mapped.body.values[1].sources[0];
    const ruleSet = (await db.pool.query(`SELECT version, content_sha256 FROM taxguard_tax_rule_sets WHERE tenant_id = $1 AND rule_set_id = $2`, [T, ruleSetId])).rows[0];
    expect(source).toMatchObject({ conclusionId: income1, conclusionVersion: 1, conclusionType: 'INCOME_INCLUSION', value: '5000.00', ruleSetId,
      ruleSetVersion: ruleSet.version, ruleSetSha256: ruleSet.content_sha256,
      evidence: [{ ref: 'document:fm-w2', snapshot: { kind: 'DOCUMENT', documentId: 'fm-w2', documentVersion: 1, documentSha256: '1'.repeat(64) } }] });
    // The form line reaches the exact source document version and hash that was reviewed.
    const stored = (await db.pool.query(`SELECT version, hash FROM taxguard_documents WHERE tenant_id = $1 AND document_id = 'fm-w2'`, [T])).rows[0];
    expect(source.evidence[0].snapshot).toMatchObject({ documentVersion: stored.version, documentSha256: stored.hash });
    expect(source.runId).toMatch(/^[0-9a-f-]{36}$/);
    const row = (await db.pool.query(`SELECT tax_year, form_id, form_version, schedule, line, field, value_type, value::text, rule_id, rule_version, rule_sha256, mapped_at
      FROM taxguard_tax_form_values WHERE tenant_id = $1 AND mapping_id = $2 AND line = '1a'`, [T, mapping1])).rows[0];
    expect(row).toMatchObject({ tax_year: 2025, form_id: 'SYN-1040', form_version: '2025.0', schedule: 'MAIN', field: 'f1_wages', value_type: 'MONEY', value: '5000.00',
      rule_id: ruleId, rule_version: 2 });
    expect(row.rule_sha256).toMatch(/^[a-f0-9]{64}$/); expect(row.mapped_at).toBeInstanceOf(Date);
    const again = await map();
    expect(again.body).toMatchObject({ mappingId: mapping1, replayed: true });
    as('fm-rev'); expect((await call('GET', `/conclusions/${income1}/trace`)).body.formLines).toEqual([
      { formId: 'SYN-1040', formVersion: '2025.0', line: '16' }, { formId: 'SYN-1040', formVersion: '2025.0', line: '1a' }]);
    expect((await call('GET', `/form-mappings/${mapping1}`)).body.values).toHaveLength(2);
    const audit = (await db.pool.query(`SELECT actor_uid, metadata FROM taxguard_audit_log WHERE tenant_id = $1 AND action = 'TAX_FORM_MAPPED'`, [T])).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor_uid: 'fm-prep', metadata: { mappingId: mapping1, version: 1, ruleId, lines: 2 } });
  });

  it('values cannot be injected, edited or removed by anyone', async () => {
    await expect(db.pool.query(`INSERT INTO taxguard_tax_form_values(tenant_id, mapping_id, tax_year, form_id, form_version, schedule, line, field, value_type, value, sources, rule_id, rule_version, rule_sha256)
      VALUES ($1, $2, 2025, 'SYN-1040', '2025.0', 'MAIN', '99', 'f1_orphan', 'MONEY', 1, '[]'::jsonb, $3, 2, repeat('a', 64))`, [T, mapping1, ruleId])).rejects.toThrow(/check/i);
    for (const sql of [`UPDATE taxguard_tax_form_values SET value = 1 WHERE tenant_id = '${T}'`, `DELETE FROM taxguard_tax_form_values WHERE tenant_id = '${T}'`,
      `UPDATE taxguard_tax_form_mappings SET values_sha256 = repeat('b', 64) WHERE tenant_id = '${T}'`, `DELETE FROM taxguard_tax_form_mappings WHERE tenant_id = '${T}'`,
      'TRUNCATE taxguard_tax_form_values', 'TRUNCATE taxguard_tax_form_mappings CASCADE', 'TRUNCATE taxguard_tax_form_rules CASCADE'])
      await expect(db.pool.query(sql), sql).rejects.toThrow('TAX_FORM_MAPPING_IMMUTABLE');
    for (const table of ['taxguard_tax_form_rules', 'taxguard_tax_form_mappings', 'taxguard_tax_form_values'])
      for (const role of ['anon', 'authenticated', 'service_role'])
        expect((await db.pool.query(`SELECT has_table_privilege($1, $2, 'SELECT') OR has_table_privilege($1, $2, 'INSERT') OR has_table_privilege($1, $2, 'UPDATE') AS ok`,
          [role, 'public.' + table])).rows[0].ok, `${role} ${table}`).toBe(false);
    for (const fn of ['taxguard_tax_form_derive(taxguard_cases,taxguard_tax_form_rules)', 'taxguard_tax_form_mapping_stale(text,uuid)', 'taxguard_tax_form_stored(text,uuid)'])
      expect((await db.pool.query(`SELECT has_function_privilege('service_role', $1, 'EXECUTE') AS ok`, ['public.' + fn])).rows[0].ok, fn).toBe(false);
  });

  it('is isolated by tenant, client, case assignment, tax year and role', async () => {
    for (const uid of ['fm-out', 'fm-prep24']) {
      as(uid);
      expect((await call('GET', `/form-mappings/${mapping1}`)).body, uid).toEqual({ code: 'TAX_FORM_MAPPING_NOT_FOUND' });
      expect((await call('GET', `/cases/${caseId}/form-mappings`)).status, uid).toBe(404);
      expect((await call('POST', `/cases/${caseId}/form-mappings`, { ruleId })).status, uid).toBe(404);
    }
    as('fm-foreign', T2); expect((await call('GET', `/form-mappings/${mapping1}`)).body).toEqual({ code: 'TAX_FORM_MAPPING_NOT_FOUND' });
    expect((await call('GET', `/form-rules/${ruleId}`)).body.code).toBe('TAX_FORM_RULE_NOT_FOUND');
    as('fm-client'); expect((await call('GET', `/form-mappings/${mapping1}`)).status).toBe(403);
    as('fm-mgr'); expect((await call('GET', `/form-mappings/${mapping1}`)).body.mappingId).toBe(mapping1);
    expect((await call('GET', '/form-mappings/not-a-uuid')).status).toBe(404);
  });
});

describe('a changed source makes the mapping stale; mapping again records a new version', () => {
  it('a revised, re-approved conclusion: STALE, then mapped again as version 2 with version 1 kept', async () => {
    const run2 = await approvedRun('5200.00', 'document:fm-w2');
    as('fm-prep'); const v2 = (await call('POST', `/conclusions/${income1}/revise`, { amount: '5200.00',
      links: [{ type: 'EVIDENCE', ref: 'document:fm-w2' }, { type: 'CALCULATION', ref: run2 }] })).body.conclusionId;
    expect((await call('GET', `/form-mappings/${mapping1}`)).body.stale).toEqual([
      { reason: 'SOURCE_MISSING', schedule: 'MAIN', line: '16', field: 'f1_tax' }, { reason: 'SOURCE_MISSING', schedule: 'MAIN', line: '1a', field: 'f1_wages' }]); // a required line lost its only source
    await call('POST', `/conclusions/${v2}/submit`); as('fm-rev'); await call('POST', `/conclusions/${v2}/approve`, {});
    const stale = (await call('GET', `/form-mappings/${mapping1}`)).body;
    expect(stale).toMatchObject({ status: 'CURRENT', values: [{ line: '16', value: '290.00' }, { line: '1a', value: '5000.00' }] }); // nothing changed silently
    expect(stale.stale).toEqual([{ reason: 'SOURCE_CHANGED', schedule: 'MAIN', line: '16', field: 'f1_tax' }, { reason: 'SOURCE_CHANGED', schedule: 'MAIN', line: '1a', field: 'f1_wages' }]);
    const remapped = await map();
    expect(remapped.status, JSON.stringify(remapped.body)).toBe(201);
    expect(remapped.body).toMatchObject({ version: 2, status: 'CURRENT', stale: [] });
    expect(remapped.body.values.map((v: any) => [v.line, v.value, v.sources[0].conclusionId, v.sources[0].conclusionVersion])).toEqual([
      ['16', '304.50', v2, 2], ['1a', '5200.00', v2, 2]]);
    as('fm-rev');
    const list = (await call('GET', `/cases/${caseId}/form-mappings`)).body.items;
    expect(list.map((m: any) => [m.version, m.status])).toEqual([[2, 'CURRENT'], [1, 'SUPERSEDED']]);
    const old = (await call('GET', `/form-mappings/${mapping1}`)).body;
    expect(old).toMatchObject({ status: 'SUPERSEDED', stale: [], values: [{ line: '16', value: '290.00' }, { line: '1a', value: '5000.00', sources: [{ conclusionId: income1 }] }] });
  });

  it('a stale source document or a superseded mapping rule makes the current mapping stale; mapping on a stale source is refused', async () => {
    as('fm-rev'); const current = (await call('GET', `/cases/${caseId}/form-mappings`)).body.items[0].mappingId;
    await approvedRule(LINES.slice(0, 2));
    expect((await call('GET', `/form-mappings/${current}`)).body.stale).toEqual([{ reason: 'MAPPING_RULE_SUPERSEDED' }]);
    await doc('fm-w2', 2, 'PENDING_REVIEW');
    const s = (await call('GET', `/form-mappings/${current}`)).body.stale;
    expect(s[0]).toEqual({ reason: 'MAPPING_RULE_SUPERSEDED' });
    expect(s.slice(1).map((x: any) => [x.line, x.reason])).toEqual([['16', 'SOURCE_STALE'], ['1a', 'SOURCE_STALE']]);
    expect((await map(ruleId)).body.code).toBe('TAX_FORM_RULE_NOT_APPROVED');
    const latest = (await call('GET', '/form-rules?taxYear=2025')).body.items.find((r: any) => r.formId === 'SYN-1040' && r.status === 'APPROVED').ruleId;
    expect(JSON.parse((await map(latest)).body.detail).map((p: any) => p.reason)).toEqual(['SOURCE_STALE', 'SOURCE_STALE']);
    as('fm-rev'); expect((await call('GET', `/form-mappings/${current}`)).body.status).toBe('CURRENT');
  });
});
