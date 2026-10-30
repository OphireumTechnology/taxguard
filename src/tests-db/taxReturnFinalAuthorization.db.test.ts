import express from 'express';
import { createHash } from 'node:crypto';
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

// Block 73: Stage 10 final authorization (proposal 20261019180000, review only) over HTTP on real PostgreSQL with every
// proposal applied. The setup is Block 72's (an approved version, then QC passed and ready) in its own tenant. The final
// authorization policy, designation, eligibility and attestation text are synthetic stand-ins for the owner's reviewed
// configuration; sessions are synthetic AAL2 session rows. Nothing signs, files or transmits. SYNTHETIC data only.
const T = 'tenantReturnFinal', T2 = 'tenantReturnFinalOther', C = 'rvClient';
const roles: Record<string, string> = { 'rv-mgr': 'practice_manager', 'rv-prep': 'accountant', 'rv-rev': 'reviewer', 'rv-out': 'reviewer', 'rv-client': 'client' };
let db: TestDatabase; let caseId = '', engagementId = '', ruleSetId = '', version = '';
let server: Server; let origin = ''; let user: any = null; let token: string | undefined;
const as = (uid: string, tenantId = T, sessionToken?: string) => { user = { id: uid, role: roles[uid] ?? 'practice_manager', tenantId, status: 'active' }; token = sessionToken; };
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
  app.use('/tax', createTaxEngineRouter({ store: () => new TaxEngineStore(pgRpc(db.pool)), authenticate: (req: any, _res, next) => { req.user = user; req.token = token; next(); } }));
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

// Block 72 configuration (synthetic) and a QC_PASSED review, so that the version is ready for Stage 10.
const qcConfig = async () => {
  await db.pool.query(`INSERT INTO taxguard_tax_approval_policies(tenant_id, function_code, policy_version, requires_eligibility, requires_designation,
    requires_case_assignment, accepted_credentials, eligibility_text, approved_by) VALUES ($1, 'RETURN_QC_REVIEW', 1, true, true, true, ARRAY['CPA'],
    'Synthetic QC policy for tests: verified CPA, designation and the QC assignment.', 'rv-owner')`, [T]);
  await db.pool.query(`INSERT INTO taxguard_tax_function_designations(tenant_id, person_uid, function_code, policy_version, designation_reference, designated_by)
    VALUES ($1, 'rv-qc', 'RETURN_QC_REVIEW', 1, 'synthetic-qc-designation', 'rv-owner')`, [T]);
  await db.pool.query(`INSERT INTO taxguard_tax_professional_eligibility(tenant_id, person_uid, credential_type, credential_reference, issuing_jurisdiction,
    scope_jurisdictions, valid_from, expires_on, verified_by, verification_reference) VALUES ($1, 'rv-qc', 'CPA', 'synthetic-qc-licence', 'NY', ARRAY['US'],
    '2025-01-01', '2099-12-31', 'rv-owner', 'synthetic-registry-lookup')`, [T]);
  await db.pool.query(`INSERT INTO taxguard_tax_qc_checklists(tenant_id, checklist_version, items, rationale, created_by, approved_by) VALUES ($1, 1,
    '[{"code":"TIES_TO_SOURCES","text":"Synthetic item: every line ties to its cited sources."},{"code":"PRIOR_YEAR_COMPARED","text":"Synthetic item: compared with the prior year."}]',
    'Synthetic checklist for tests only, not a practice checklist.', 'rv-author', 'rv-owner')`, [T]);
};
const assessRisk = async () => { as('rv-prep'); expect((await call('POST', `/returns/${version}/risk`, { amountCents: 500_000 })).body.outcome).toBe('HUMAN_REVIEW_REQUIRED'); };
const passQc = async () => { const r = await qcPost('rv-qc', allPass); expect(r.body.outcome, JSON.stringify(r.body)).toBe('QC_PASSED'); };

// Synthetic durable sessions: the route hashes the bearer token; the database checks the session row (AAL2, recent sign-in).
Object.assign(roles, { 'rv-fa': 'senior_reviewer', 'rv-fa2': 'senior_reviewer' });
const tokenOf = (uid: string, n = 0) => 'tg_live_' + createHash('sha256').update(`synthetic-session-${uid}-${n}`).digest('hex');
const session = async (uid: string, n = 0, ageSeconds = 0, aal = 'aal2') => {
  await db.pool.query(`INSERT INTO taxguard_sessions(tenant_id, uid, session_token_hash, auth_time, expires_at, aal)
    VALUES ($1, $2, $3, floor(extract(epoch FROM now()))::bigint - $4, floor(extract(epoch FROM now()) * 1000)::bigint + 3600000, $5)`,
    [T, uid, createHash('sha256').update(tokenOf(uid, n)).digest('hex'), ageSeconds, aal]);
  return tokenOf(uid, n);
};
const decide = (uid: string, sessionToken: string | undefined, body: unknown) => { as(uid, T, sessionToken); return call('POST', `/returns/${version}/final-authorization`, body); };
const authorize = (attestationVersion = 1) => ({ outcome: 'AUTHORIZED', attestationVersion, acknowledged: true });
let faToken = '';

beforeAll(async () => {
  await db.pool.query(`INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ($1, 'rv-fa', 'senior_reviewer', 'active', NULL),
    ($1, 'rv-fa2', 'senior_reviewer', 'active', NULL)`, [T]);
  await db.pool.query(`INSERT INTO taxguard_identities(tenant_id, uid, user_data) SELECT tenant_id, uid, jsonb_build_object('id', uid, 'tenantId', tenant_id, 'role', role,
    'status', status) FROM taxguard_members WHERE tenant_id = $1 AND client_id IS NULL ON CONFLICT DO NOTHING`, [T]);
  await qcConfig();
  as('rv-mgr'); expect((await call('POST', `/returns/${version}/qc-assignment`, { qcUid: 'rv-qc' })).status).toBe(201);
  await diagnoseCase(); await assessRisk(); await passQc();
  expect((await readiness()).ready).toBe(true);
  faToken = await session('rv-fa');
}, 120_000);

describe('Stage 10 final authorization', () => {
  it('fails closed: a manager assigns an independent person, who decides only in a recent AAL2 session under the owner policy', async () => {
    expect(await readiness()).toMatchObject({ ready: true, stage10: 'FINAL_AUTHORIZATION_REQUIRED', stage11: 'NOT_STARTED', finalAuthorization: { decision: null },
      returnUse: 'BLOCKED' });
    as('rv-fa'); expect((await call('GET', `/returns/${version}/final-context`)).body.code).toBe('TAX_RETURN_NOT_FOUND');
    as('rv-prep'); expect((await call('POST', `/returns/${version}/final-assignment`, { authorizerUid: 'rv-fa' })).body.code).toBe('TAX_RETURN_FINAL_ASSIGNER_REQUIRED');
    as('rv-mgr2');
    // Preparer, reviewer, QC assignee and QC reviewer, the manager who assigned QC, and the assigning manager.
    for (const authorizerUid of ['rv-prep', 'rv-rev', 'rv-qc', 'rv-mgr', 'rv-mgr2'])
      expect((await call('POST', `/returns/${version}/final-assignment`, { authorizerUid })).body.code, authorizerUid).toBe('TAX_RETURN_FINAL_NOT_INDEPENDENT');
    for (const authorizerUid of ['rv-client', 'rv-nobody', 'rv-foreign'])
      expect((await call('POST', `/returns/${version}/final-assignment`, { authorizerUid })).body.code, authorizerUid).toBe('TAX_RETURN_FINAL_ASSIGNEE_INVALID');
    const assigned = await call('POST', `/returns/${version}/final-assignment`, { authorizerUid: 'rv-fa' });
    expect(assigned.status, JSON.stringify(assigned.body)).toBe(201);
    expect((await call('POST', `/returns/${version}/final-assignment`, { authorizerUid: 'rv-fa2' })).body.code).toBe('TAX_RETURN_FINAL_ALREADY_ASSIGNED');
    as('rv-fa');
    expect((await call('GET', '/final/queue')).body.items).toMatchObject([{ returnVersionId: version, status: 'APPROVED', latestOutcome: null }]);
    const context = await call('GET', `/returns/${version}/final-context`);
    expect(context.status).toBe(200);
    expect(context.body).toMatchObject({ attestation: null, assignment: { authorizerUid: 'rv-fa', assignedBy: 'rv-mgr2' }, readiness: { ready: true }, returnUse: 'BLOCKED' });
    expect((await readiness('rv-fa')).ready).toBe(true); // the assigned authorizer may read readiness
    // The session: none, unknown, too old, not AAL2.
    for (const sessionToken of [undefined, 'tg_service_' + 'a'.repeat(64), 'synthetic-process-local-session']) {
      const r = await decide('rv-fa', sessionToken, authorize());
      expect([r.status, r.body.code], String(sessionToken)).toEqual([403, 'TAX_RETURN_FINAL_SESSION_REQUIRED']);
    }
    expect((await decide('rv-fa', tokenOf('rv-fa', 99), authorize())).body.code).toBe('TAX_RETURN_FINAL_SESSION_REQUIRED');
    expect((await decide('rv-fa', await session('rv-fa', 1, 3600), authorize())).body.code).toBe('STAFF_RECENT_SIGN_IN_REQUIRED');
    expect((await decide('rv-fa', await session('rv-fa', 2, 0, 'aal1'), authorize())).body.code).toBe('TAX_RETURN_FINAL_SESSION_REQUIRED');
    // Only the live assignee decides; a case actor with a good session is refused.
    expect((await decide('rv-rev', await session('rv-rev'), authorize())).body.code).toBe('TAX_RETURN_FINAL_AUTHORIZER_REQUIRED');
    for (const bad of [{ ...authorize(), acknowledged: false }, { outcome: 'AUTHORIZED', attestationVersion: 1 }, { ...authorize(), outcome: 'APPROVED' },
      { ...authorize(), attestationVersion: '1' }, { ...authorize(), attestationVersion: 1.5 }, { ...authorize(), stage10: 'AUTHORIZED' },
      { outcome: 'DECLINED', attestationVersion: 1, acknowledged: true, note: 'short' }, ['AUTHORIZED']])
      expect((await decide('rv-fa', faToken, bad)).body.code, JSON.stringify(bad)).toBe('TAX_RETURN_FINAL_INPUT_INVALID');
    // A bare string is refused by the JSON parser before the route runs.
    expect((await fetch(origin + `/tax/returns/${version}/final-authorization`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '"AUTHORIZED"' })).status).toBe(400);
    const refused = await decide('rv-fa', faToken, authorize());
    expect([refused.status, refused.body.code, refused.body.detail]).toEqual([403, 'TAX_RETURN_FINAL_AUTHORITY_REQUIRED', 'NO_POLICY']);
  });

  it('the policy must require eligibility, designation and the assignment; then the owner attestation text is required and pinned', async () => {
    await expect(db.pool.query(`INSERT INTO taxguard_tax_approval_policies(tenant_id, function_code, policy_version, requires_eligibility, requires_designation,
      requires_case_assignment, accepted_credentials, eligibility_text, approved_by) VALUES ($1, 'RETURN_FINAL_AUTHORIZATION', 1, true, false, true, ARRAY['CPA'],
      'Synthetic policy without a designation, which must be refused.', 'rv-owner')`, [T])).rejects.toThrow('taxguard_tax_approval_policies_final_authorization');
    await db.pool.query(`INSERT INTO taxguard_tax_approval_policies(tenant_id, function_code, policy_version, requires_eligibility, requires_designation,
      requires_case_assignment, accepted_credentials, eligibility_text, approved_by) VALUES ($1, 'RETURN_FINAL_AUTHORIZATION', 1, true, true, true, ARRAY['CPA','EA'],
      'Synthetic final authorization policy for tests: verified CPA or EA, designation and the assignment.', 'rv-owner')`, [T]);
    expect((await decide('rv-fa', faToken, authorize())).body.detail).toBe('NO_DESIGNATION');
    await db.pool.query(`INSERT INTO taxguard_tax_function_designations(tenant_id, person_uid, function_code, policy_version, designation_reference, designated_by)
      VALUES ($1, 'rv-fa', 'RETURN_FINAL_AUTHORIZATION', 1, 'synthetic-final-designation', 'rv-owner')`, [T]);
    expect((await decide('rv-fa', faToken, authorize())).body.detail).toBe('NO_ELIGIBILITY');
    await db.pool.query(`INSERT INTO taxguard_tax_professional_eligibility(tenant_id, person_uid, credential_type, credential_reference, issuing_jurisdiction,
      scope_jurisdictions, valid_from, expires_on, verified_by, verification_reference) VALUES ($1, 'rv-fa', 'EA', 'synthetic-enrolment', 'US', ARRAY['US'],
      '2025-01-01', '2099-12-31', 'rv-owner', 'synthetic-registry-lookup')`, [T]);
    expect((await decide('rv-fa', faToken, authorize())).body.code).toBe('TAX_RETURN_ATTESTATION_REQUIRED');
    await expect(db.pool.query(`INSERT INTO taxguard_tax_final_attestations(tenant_id, attestation_version, attestation_text, rationale, created_by, approved_by)
      VALUES ($1, 1, 'Synthetic attestation text for tests only, not legal wording.', 'Synthetic attestation for tests only.', 'rv-owner', 'rv-owner')`, [T])).rejects.toThrow();
    await db.pool.query(`INSERT INTO taxguard_tax_final_attestations(tenant_id, attestation_version, attestation_text, rationale, created_by, approved_by)
      VALUES ($1, 1, 'Synthetic attestation text for tests only, not legal wording.', 'Synthetic attestation for tests only.', 'rv-author', 'rv-owner')`, [T]);
    as('rv-fa'); expect((await call('GET', `/returns/${version}/final-context`)).body.attestation)
      .toEqual({ attestationVersion: 1, text: 'Synthetic attestation text for tests only, not legal wording.' });
    expect((await decide('rv-fa', faToken, authorize(2))).body.code).toBe('TAX_RETURN_ATTESTATION_CHANGED');
    const done = await decide('rv-fa', faToken, authorize());
    expect(done.status, JSON.stringify(done.body)).toBe(201);
    expect(done.body).toMatchObject({ outcome: 'AUTHORIZED', attestationVersion: 1, decidedBy: 'rv-fa', stage10: 'AUTHORIZED', stage11: 'CLIENT_SIGNATURE_REQUIRED',
      returnUse: 'BLOCKED' });
    expect(await readiness()).toMatchObject({ ready: true, stage10: 'AUTHORIZED', stage11: 'CLIENT_SIGNATURE_REQUIRED', returnUse: 'BLOCKED',
      finalAuthorization: { current: true, reasons: [], decision: { outcome: 'AUTHORIZED', decidedBy: 'rv-fa' } } });
    expect((await decide('rv-fa', faToken, authorize())).body.code).toBe('TAX_RETURN_FINAL_ALREADY_DECIDED');
    const row = (await db.pool.query(`SELECT status FROM taxguard_tax_return_versions WHERE tenant_id = $1 AND return_version_id = $2`, [T, version])).rows[0];
    expect(row.status).toBe('APPROVED'); // Stage 10 never changes the version, signs or files it
    const basis = (await db.pool.query(`SELECT authority_basis, session_auth_time FROM taxguard_tax_return_final_authorizations WHERE tenant_id = $1`, [T])).rows[0];
    expect(basis.authority_basis).toMatchObject({ function: 'RETURN_FINAL_AUTHORIZATION', credentialType: 'EA', authorizerUid: 'rv-fa', caseReviewer: true });
    expect(Number(basis.session_auth_time)).toBeGreaterThan(0);
  });

  it('a decision is current only while its inputs are: a new attestation, risk assessment or QC review makes a new decision necessary', async () => {
    await db.pool.query(`INSERT INTO taxguard_tax_final_attestations(tenant_id, attestation_version, attestation_text, rationale, created_by, approved_by)
      VALUES ($1, 2, 'Synthetic attestation text version 2 for tests only, not legal wording.', 'Synthetic attestation v2 for tests only.', 'rv-author', 'rv-owner')`, [T]);
    expect(await readiness()).toMatchObject({ stage10: 'FINAL_AUTHORIZATION_REQUIRED', finalAuthorization: { current: false, reasons: ['ATTESTATION_CHANGED'] } });
    const declined = await decide('rv-fa', faToken, { outcome: 'DECLINED', attestationVersion: 2, acknowledged: true, note: 'Synthetic: explain line 16 before I authorize.' });
    expect(declined.status, JSON.stringify(declined.body)).toBe(201);
    expect(declined.body).toMatchObject({ outcome: 'DECLINED', stage10: 'FINAL_AUTHORIZATION_REQUIRED', stage11: 'NOT_STARTED' });
    expect((await readiness()).stage10).toBe('FINAL_AUTHORIZATION_REQUIRED'); // a current DECLINED is not an authorization
    expect((await decide('rv-fa', faToken, authorize(2))).body.code).toBe('TAX_RETURN_FINAL_ALREADY_DECIDED');
    await assessRisk();
    const stale = await readiness();
    expect(stale.reasons).toEqual(['QC_NOT_CURRENT']);
    expect(stale.finalAuthorization.reasons).toEqual(['NOT_READY', 'RISK_REASSESSED']);
    const notReady = await decide('rv-fa', faToken, authorize(2));
    expect([notReady.body.code, notReady.body.detail]).toEqual(['TAX_RETURN_NOT_READY', '["QC_NOT_CURRENT"]']);
    await passQc();
    expect((await readiness()).finalAuthorization.reasons).toEqual(['RISK_REASSESSED', 'QC_REVIEWED_AGAIN']);
    // Two concurrent decisions on the same inputs (a double submit or a replay): exactly one is recorded.
    as('rv-fa', T, faToken);
    const post = () => call('POST', `/returns/${version}/final-authorization`, authorize(2));
    const both = await Promise.all([post(), post()]);
    expect(both.map(r => r.status).sort()).toEqual([201, 409]);
    expect(both.find(r => r.status === 409)!.body.code).toBe('TAX_RETURN_FINAL_ALREADY_DECIDED');
    expect(both.find(r => r.status === 201)!.body.stage10).toBe('AUTHORIZED');
    expect((await readiness()).stage10).toBe('AUTHORIZED');
    // A revoked designation stops any further decision; the recorded one stays as it was.
    await db.pool.query(`UPDATE taxguard_tax_function_designations SET revoked_by = 'rv-owner', revoked_at = now(), revocation_reason = 'Synthetic: designation withdrawn'
      WHERE tenant_id = $1 AND person_uid = 'rv-fa' AND function_code = 'RETURN_FINAL_AUTHORIZATION'`, [T]);
    const revoked = await decide('rv-fa', faToken, authorize(2));
    expect([revoked.status, revoked.body.code, revoked.body.detail]).toEqual([403, 'TAX_RETURN_FINAL_AUTHORITY_REQUIRED', 'NO_DESIGNATION']);
    as('rv-prep'); expect((await call('GET', `/returns/${version}/final-authorizations`)).body.items.map((x: any) => x.outcome)).toEqual(['AUTHORIZED', 'DECLINED', 'AUTHORIZED']);
  });

  it('independence is checked again at decision time, assignments are revoked with a reason, and history is immutable', async () => {
    // rv-fa becomes the live QC assignee: no longer independent.
    as('rv-mgr'); await call('POST', `/returns/${version}/qc-assignment/revoke`, { reason: 'Synthetic: rotating QC reviewers' });
    expect((await call('POST', `/returns/${version}/qc-assignment`, { qcUid: 'rv-fa' })).status).toBe(201);
    await db.pool.query(`INSERT INTO taxguard_tax_final_attestations(tenant_id, attestation_version, attestation_text, rationale, created_by, approved_by)
      VALUES ($1, 3, 'Synthetic attestation text version 3 for tests only, not legal wording.', 'Synthetic attestation v3 for tests only.', 'rv-author', 'rv-owner')`, [T]);
    expect((await decide('rv-fa', faToken, authorize(3))).body.code).toBe('TAX_RETURN_FINAL_NOT_INDEPENDENT');
    as('rv-mgr'); await call('POST', `/returns/${version}/qc-assignment/revoke`, { reason: 'Synthetic: QC returned to its reviewer' });
    expect((await call('POST', `/returns/${version}/qc-assignment`, { qcUid: 'rv-qc' })).status).toBe(201);
    as('rv-prep'); expect((await call('POST', `/returns/${version}/final-assignment/revoke`, { reason: 'Synthetic: rotating authorizers' })).body.code)
      .toBe('TAX_RETURN_FINAL_ASSIGNER_REQUIRED');
    as('rv-mgr2'); expect((await call('POST', `/returns/${version}/final-assignment/revoke`, { reason: 'short' })).body.code).toBe('TAX_RETURN_FINAL_INPUT_INVALID');
    expect((await call('POST', `/returns/${version}/final-assignment/revoke`, { reason: 'Synthetic: rotating authorizers' })).status).toBe(200);
    expect((await call('POST', `/returns/${version}/final-assignment/revoke`, { reason: 'Synthetic: rotating authorizers' })).body.code).toBe('TAX_RETURN_FINAL_NOT_ASSIGNED');
    expect((await decide('rv-fa', faToken, authorize(3))).body.code).toBe('TAX_RETURN_NOT_FOUND'); // a revoked assignee is an outsider again
    as('rv-fa'); expect((await call('GET', '/final/queue')).body.items).toEqual([]);
    as('rv-mgr2'); expect((await call('POST', `/returns/${version}/final-assignment`, { authorizerUid: 'rv-fa2' })).status).toBe(201);
    expect((await decide('rv-fa2', await session('rv-fa2'), authorize(3))).body.detail).toBe('NO_DESIGNATION');
    for (const sql of [`UPDATE taxguard_tax_return_final_authorizations SET outcome = 'AUTHORIZED' WHERE tenant_id = '${T}'`,
      `DELETE FROM taxguard_tax_return_final_authorizations WHERE tenant_id = '${T}'`, 'TRUNCATE taxguard_tax_return_final_authorizations',
      `UPDATE taxguard_tax_final_attestations SET attestation_text = 'Synthetic tampering attempt with the attestation wording' WHERE tenant_id = '${T}'`,
      `DELETE FROM taxguard_tax_final_attestations WHERE tenant_id = '${T}'`,
      `UPDATE taxguard_tax_return_final_assignments SET authorizer_uid = 'rv-prep' WHERE tenant_id = '${T}' AND revoked_at IS NULL`,
      `UPDATE taxguard_tax_return_final_assignments SET revoke_reason = 'Synthetic: rewriting history' WHERE tenant_id = '${T}' AND revoked_at IS NOT NULL`,
      `DELETE FROM taxguard_tax_return_final_assignments WHERE tenant_id = '${T}'`])
      await expect(db.pool.query(sql), sql).rejects.toThrow('TAX_RETURN_FINAL_HISTORY_IMMUTABLE');
    for (const table of ['taxguard_tax_final_attestations', 'taxguard_tax_return_final_assignments', 'taxguard_tax_return_final_authorizations'])
      for (const role of ['anon', 'authenticated', 'service_role'])
        expect((await db.pool.query(`SELECT has_table_privilege($1, $2, 'SELECT') OR has_table_privilege($1, $2, 'INSERT') AS ok`, [role, 'public.' + table])).rows[0].ok,
          role + ' ' + table).toBe(false);
    for (const fn of ['taxguard_tax_return_readiness_eval(text,uuid)', 'taxguard_tax_return_final_scope(text,text,uuid)', 'taxguard_tax_return_final_status(text,uuid)'])
      expect((await db.pool.query(`SELECT has_function_privilege('service_role', 'public.${fn}', 'EXECUTE') AS ok`)).rows[0].ok, fn).toBe(false);
    const audit = (await db.pool.query(`SELECT action, count(*)::int AS n FROM taxguard_audit_log WHERE tenant_id = $1 AND action LIKE 'TAX_RETURN_FINAL_%'
      GROUP BY action ORDER BY action`, [T])).rows;
    expect(audit).toEqual([{ action: 'TAX_RETURN_FINAL_AUTHORIZED', n: 2 }, { action: 'TAX_RETURN_FINAL_AUTHORIZER_ASSIGNED', n: 2 },
      { action: 'TAX_RETURN_FINAL_AUTHORIZER_UNASSIGNED', n: 1 }, { action: 'TAX_RETURN_FINAL_DECLINED', n: 1 }]);
    as('rv-foreign', T2); expect((await call('GET', `/returns/${version}/final-authorizations`)).body.code).toBe('TAX_RETURN_NOT_FOUND');
    as('rv-client'); expect((await call('GET', `/returns/${version}/final-context`)).status).toBe(403);
  });

  it('a stale version is not assigned and cannot be authorized', async () => {
    as('rv-prep'); const k = (await call('GET', `/cases/${caseId}/conclusions`)).body.items.find((x: any) => x.status === 'APPROVED');
    const revised = (await call('POST', `/conclusions/${k.conclusionId}/revise`, { amount: '5000.00', statement: 'Synthetic wages for the year, restated.',
      links: k.links.map((l: any) => ({ type: l.type, ref: l.ref })) })).body.conclusionId;
    await call('POST', `/conclusions/${revised}/submit`); as('rv-rev'); expect((await call('POST', `/conclusions/${revised}/approve`, {})).body.status).toBe('APPROVED');
    expect(await readiness()).toMatchObject({ stage10: 'FINAL_AUTHORIZATION_REQUIRED', finalAuthorization: { current: false } });
    expect((await readiness()).finalAuthorization.reasons).toContain('NOT_READY');
    const refused = await decide('rv-fa2', tokenOf('rv-fa2'), authorize(3));
    expect(refused.body.code).toBe('TAX_RETURN_NOT_READY');
    expect(JSON.parse(refused.body.detail)).toContain('STALE');
    as('rv-mgr2'); await call('POST', `/returns/${version}/final-assignment/revoke`, { reason: 'Synthetic: the version went stale' });
    expect((await call('POST', `/returns/${version}/final-assignment`, { authorizerUid: 'rv-fa' })).body.code).toBe('TAX_RETURN_STALE');
  });
});
