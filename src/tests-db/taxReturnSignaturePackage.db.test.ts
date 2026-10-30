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

// Block 74: Stage 11 signature packages (proposal 20261019190000, review only) over HTTP on real PostgreSQL with every
// proposal applied. The setup is Block 73's (a ready version, then an AUTHORIZED Stage 10 decision) in its own tenant. The
// policies, designations, eligibility, attestation and consent texts are synthetic stand-ins for the owner's reviewed
// configuration; sessions are synthetic AAL2 session rows. Nothing renders, sends, signs, files or transmits. SYNTHETIC data only.
const T = 'tenantReturnSignature', T2 = 'tenantReturnSignatureOther', C = 'rvClient';
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

// Stage 10 (synthetic configuration) and an AUTHORIZED decision by rv-fa, then the Block 74 actors: a second client-portal
// member of the client, a member of another client, an inactive member, and named identities for the signer list.
Object.assign(roles, { 'rv-client2': 'client', 'rv-other': 'client' });
const authorizeFinal = async () => {
  as('rv-fa', T, faToken);
  const r = await call('POST', `/returns/${version}/final-authorization`, { outcome: 'AUTHORIZED', attestationVersion: 1, acknowledged: true });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.authorizationId as string;
};
let authorizationId = '';
beforeAll(async () => {
  await db.pool.query(`INSERT INTO taxguard_tax_approval_policies(tenant_id, function_code, policy_version, requires_eligibility, requires_designation,
    requires_case_assignment, accepted_credentials, eligibility_text, approved_by) VALUES ($1, 'RETURN_FINAL_AUTHORIZATION', 1, true, true, true, ARRAY['EA'],
    'Synthetic final authorization policy for tests: verified EA, designation and the assignment.', 'rv-owner')`, [T]);
  await db.pool.query(`INSERT INTO taxguard_tax_function_designations(tenant_id, person_uid, function_code, policy_version, designation_reference, designated_by)
    VALUES ($1, 'rv-fa', 'RETURN_FINAL_AUTHORIZATION', 1, 'synthetic-final-designation', 'rv-owner')`, [T]);
  await db.pool.query(`INSERT INTO taxguard_tax_professional_eligibility(tenant_id, person_uid, credential_type, credential_reference, issuing_jurisdiction,
    scope_jurisdictions, valid_from, expires_on, verified_by, verification_reference) VALUES ($1, 'rv-fa', 'EA', 'synthetic-enrolment', 'US', ARRAY['US'],
    '2025-01-01', '2099-12-31', 'rv-owner', 'synthetic-registry-lookup')`, [T]);
  await db.pool.query(`INSERT INTO taxguard_tax_final_attestations(tenant_id, attestation_version, attestation_text, rationale, created_by, approved_by)
    VALUES ($1, 1, 'Synthetic attestation text for tests only, not legal wording.', 'Synthetic attestation for tests only.', 'rv-author', 'rv-owner')`, [T]);
  as('rv-mgr2'); expect((await call('POST', `/returns/${version}/final-assignment`, { authorizerUid: 'rv-fa' })).status).toBe(201);
  authorizationId = await authorizeFinal();
  await db.pool.query(`INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ($1, 'rvClient2', 'rv-other', 'Synthetic Second Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ($1, 'rv-client2', 'client', 'active', '${C}'), ($1, 'rv-other', 'client', 'active', 'rvClient2'),
      ($1, 'rv-gone', 'client', 'suspended', '${C}');
    INSERT INTO taxguard_identities(tenant_id, uid, user_data) VALUES ($1, 'rv-client', '{"id":"rv-client","name":"Synthetic Taxpayer"}'),
      ($1, 'rv-client2', '{"id":"rv-client2","name":"Synthetic Spouse"}') ON CONFLICT DO NOTHING;`.replaceAll('$1', `'${T}'`));
}, 120_000);

const release = (uid: string, sessionToken: string | undefined, body: unknown) => { as(uid, T, sessionToken); return call('POST', `/returns/${version}/signature-package`, body); };
const releaseBody = (consentVersion = 1, signers: unknown = ['rv-client']) => ({ consentVersion, acknowledged: true, signers });
const withdraw = (uid: string, reason: string) => { as(uid); return call('POST', `/returns/${version}/signature-package/withdraw`, { reason }); };
const portal = async (uid: string, client = C, tenantId = T) => {
  const r = await pgRpc(db.pool).rpc('taxguard_portal_signature_packages', { p_tenant: tenantId, p_client: client, p_actor: uid });
  return r.error ? { error: r.error.message } : r.data as any[];
};

describe('Stage 11 signature package (no signing)', () => {
  it('fails closed: only an independent holder of the release authority, in a recent AAL2 session, under the owner consent text', async () => {
    expect(await readiness()).toMatchObject({ stage10: 'AUTHORIZED', stage11: 'CLIENT_SIGNATURE_REQUIRED', signature: 'NOT_AVAILABLE', returnUse: 'BLOCKED',
      signaturePackage: { package: null, current: false } });
    as('rv-fa');
    const context = await call('GET', `/returns/${version}/signature-context`);
    expect(context.status, JSON.stringify(context.body)).toBe(200);
    expect(context.body).toMatchObject({ consent: null, releasable: { releasable: true, authorizationId }, signature: 'NOT_AVAILABLE', returnUse: 'BLOCKED',
      candidates: [{ uid: 'rv-client', name: 'Synthetic Taxpayer' }, { uid: 'rv-client2', name: 'Synthetic Spouse' }] });
    // The preparer of the version may not release it, whatever their session.
    expect((await release('rv-prep', await session('rv-prep'), releaseBody())).body.code).toBe('TAX_RETURN_SIGNATURE_NOT_INDEPENDENT');
    for (const sessionToken of [undefined, 'tg_service_' + 'a'.repeat(64), 'synthetic-process-local-session']) {
      const r = await release('rv-fa', sessionToken, releaseBody());
      expect([r.status, r.body.code], String(sessionToken)).toEqual([403, 'TAX_RETURN_SIGNATURE_SESSION_REQUIRED']);
    }
    expect((await release('rv-fa', tokenOf('rv-fa', 98), releaseBody())).body.code).toBe('TAX_RETURN_SIGNATURE_SESSION_REQUIRED');
    expect((await release('rv-fa', await session('rv-fa', 11, 3600), releaseBody())).body.code).toBe('STAFF_RECENT_SIGN_IN_REQUIRED');
    for (const bad of [{ ...releaseBody(), acknowledged: false }, { consentVersion: 1, acknowledged: true }, releaseBody(1, []), releaseBody(1, ['rv-client', 'rv-client']),
      releaseBody(1, ['a', 'b', 'c', 'd', 'e']), releaseBody(1, [7]), releaseBody(1, 'rv-client'), { ...releaseBody(), consentVersion: '1' },
      { ...releaseBody(), stage11: 'SIGNED' }, ['rv-client']])
      expect((await release('rv-fa', faToken, bad)).body.code, JSON.stringify(bad)).toBe('TAX_RETURN_SIGNATURE_INPUT_INVALID');
    const refused = await release('rv-fa', faToken, releaseBody());
    expect([refused.status, refused.body.code, refused.body.detail]).toEqual([403, 'TAX_RETURN_SIGNATURE_AUTHORITY_REQUIRED', 'NO_POLICY']);
    await expect(db.pool.query(`INSERT INTO taxguard_tax_approval_policies(tenant_id, function_code, policy_version, requires_eligibility, requires_designation,
      requires_case_assignment, accepted_credentials, eligibility_text, approved_by) VALUES ($1, 'RETURN_SIGNATURE_RELEASE', 1, false, false, true, '{}',
      'Synthetic release policy without a designation, which must be refused.', 'rv-owner')`, [T])).rejects.toThrow('taxguard_tax_approval_policies_signature_release');
    await db.pool.query(`INSERT INTO taxguard_tax_approval_policies(tenant_id, function_code, policy_version, requires_eligibility, requires_designation,
      requires_case_assignment, accepted_credentials, eligibility_text, approved_by) VALUES ($1, 'RETURN_SIGNATURE_RELEASE', 1, false, true, true, '{}',
      'Synthetic release policy for tests: a designation and a role on the case.', 'rv-owner')`, [T]);
    expect((await release('rv-fa', faToken, releaseBody())).body.detail).toBe('NO_DESIGNATION');
    await db.pool.query(`INSERT INTO taxguard_tax_function_designations(tenant_id, person_uid, function_code, policy_version, designation_reference, designated_by)
      VALUES ($1, 'rv-fa', 'RETURN_SIGNATURE_RELEASE', 1, 'synthetic-release-designation', 'rv-owner'),
        ($1, 'rv-mgr2', 'RETURN_SIGNATURE_RELEASE', 1, 'synthetic-release-designation-mgr', 'rv-owner')`, [T]);
    // A designated manager without a role on the case: the policy's case requirement refuses it.
    expect((await release('rv-mgr2', await session('rv-mgr2'), releaseBody())).body.detail).toBe('NOT_CASE_REVIEWER');
    expect((await release('rv-fa', faToken, releaseBody())).body.code).toBe('TAX_RETURN_SIGNATURE_CONSENT_REQUIRED');
    await expect(db.pool.query(`INSERT INTO taxguard_tax_signature_consents(tenant_id, consent_version, consent_text, rationale, created_by, approved_by)
      VALUES ($1, 1, 'Synthetic consent text for tests only, not legal wording.', 'Synthetic consent for tests only.', 'rv-owner', 'rv-owner')`, [T])).rejects.toThrow();
    await db.pool.query(`INSERT INTO taxguard_tax_signature_consents(tenant_id, consent_version, consent_text, rationale, created_by, approved_by)
      VALUES ($1, 1, 'Synthetic consent text for tests only, not legal wording.', 'Synthetic consent for tests only.', 'rv-author', 'rv-owner')`, [T]);
    as('rv-fa'); expect((await call('GET', `/returns/${version}/signature-context`)).body.consent)
      .toEqual({ consentVersion: 1, text: 'Synthetic consent text for tests only, not legal wording.' });
    expect((await release('rv-fa', faToken, releaseBody(2))).body.code).toBe('TAX_RETURN_SIGNATURE_CONSENT_CHANGED');
    for (const signers of [['rv-mgr'], ['rv-other'], ['rv-gone'], ['rv-nobody'], ['rv-client', 'rv-foreign']])
      expect((await release('rv-fa', faToken, releaseBody(1, signers))).body.code, signers.join()).toBe('TAX_RETURN_SIGNATURE_SIGNER_INVALID');
    const done = await release('rv-fa', faToken, releaseBody());
    expect(done.status, JSON.stringify(done.body)).toBe(201);
    expect(done.body).toMatchObject({ authorizationId, consentVersion: 1, signerUids: ['rv-client'], releasedBy: 'rv-fa', withdrawnAt: null,
      stage11: 'SIGNATURE_PACKAGE_RELEASED', signature: 'NOT_AVAILABLE', returnUse: 'BLOCKED' });
    expect((await release('rv-fa', faToken, releaseBody())).body.code).toBe('TAX_RETURN_SIGNATURE_ALREADY_RELEASED');
    expect(await readiness()).toMatchObject({ stage10: 'AUTHORIZED', stage11: 'SIGNATURE_PACKAGE_RELEASED', signature: 'NOT_AVAILABLE', returnUse: 'BLOCKED',
      signaturePackage: { current: true, reasons: [], package: { packageId: done.body.packageId } } });
    as('rv-rev'); expect((await call('GET', `/returns/${version}/signature-packages`)).body.items).toHaveLength(1);
    const audit = await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_audit_log WHERE tenant_id = $1 AND action = 'TAX_RETURN_SIGNATURE_PACKAGE_RELEASED'`, [T]);
    expect(audit.rows[0].n).toBe(1);
  });

  it('the client portal shows status only, to the named signer; other clients and tenants see nothing', async () => {
    const mine = await portal('rv-client');
    expect(Array.isArray(mine) && mine.length).toBe(1);
    expect(Object.keys((mine as any[])[0]).sort()).toEqual(['packageId', 'releasedAt', 'signature', 'status', 'taxYear']);
    expect((mine as any[])[0]).toMatchObject({ taxYear: 2025, status: 'AWAITING_SIGNATURE', signature: 'NOT_AVAILABLE' });
    expect(await portal('rv-client2')).toEqual([]); // not named as a signer
    expect(await portal('rv-other')).toEqual({ error: 'DOCUMENT_NOT_FOUND' }); // another client's member
    expect(await portal('rv-foreign', C, T2)).toEqual({ error: 'DOCUMENT_NOT_FOUND' });
    expect(await portal('rv-mgr')).toHaveLength(1); // staff in scope of the client
    as('rv-client'); expect((await call('GET', `/returns/${version}/signature-context`)).status).toBeGreaterThanOrEqual(400);
  });

  it('a package lapses with its Stage 10 decision or the consent text, is withdrawn once, and is released again only after a new decision', async () => {
    await diagnoseCase(); // a newer diagnostics run: the decision is no longer current, so neither is the package
    const lapsed = await readiness();
    expect(lapsed).toMatchObject({ stage10: 'FINAL_AUTHORIZATION_REQUIRED', stage11: 'NOT_STARTED',
      signaturePackage: { current: false, reasons: ['FINAL_AUTHORIZATION_NOT_CURRENT'] } });
    expect(await portal('rv-client')).toEqual([]);
    expect((await release('rv-fa', faToken, releaseBody())).body.code).toBe('TAX_RETURN_SIGNATURE_NOT_AUTHORIZED'); // checked before the live package
    expect((await withdraw('rv-prep', 'Synthetic withdrawal attempt.')).body.code).toBe('TAX_RETURN_SIGNATURE_WITHDRAWER_REQUIRED');
    expect((await withdraw('rv-mgr', 'short')).body.code).toBe('TAX_RETURN_SIGNATURE_INPUT_INVALID');
    const withdrawn = await withdraw('rv-mgr', 'Synthetic: the Stage 10 decision lapsed.');
    expect(withdrawn.status, JSON.stringify(withdrawn.body)).toBe(200);
    expect(withdrawn.body).toMatchObject({ withdrawnBy: 'rv-mgr', withdrawReason: 'Synthetic: the Stage 10 decision lapsed.' });
    expect((await withdraw('rv-mgr', 'Synthetic: withdrawn twice.')).body.code).toBe('TAX_RETURN_SIGNATURE_NOT_RELEASED');
    const notAuthorized = await release('rv-fa', faToken, releaseBody());
    expect(notAuthorized.body.code).toBe('TAX_RETURN_SIGNATURE_NOT_AUTHORIZED');
    expect(JSON.parse(notAuthorized.body.detail)).toEqual(expect.arrayContaining(['NOT_READY', 'DIAGNOSTICS_RERUN']));
    // A new Stage 10 decision on fresh inputs, then a new package for both members of the client.
    await assessRisk(); await passQc();
    const second = await authorizeFinal();
    expect(second).not.toBe(authorizationId);
    const again = await release('rv-fa', faToken, releaseBody(1, ['rv-client', 'rv-client2']));
    expect(again.status, JSON.stringify(again.body)).toBe(201);
    expect(again.body).toMatchObject({ authorizationId: second, signerUids: ['rv-client', 'rv-client2'] });
    expect(await portal('rv-client2')).toHaveLength(1);
    // A newer consent text makes the package lapse too.
    await db.pool.query(`INSERT INTO taxguard_tax_signature_consents(tenant_id, consent_version, consent_text, rationale, created_by, approved_by)
      VALUES ($1, 2, 'Second synthetic consent text for tests only, not legal wording.', 'Synthetic consent for tests only.', 'rv-author', 'rv-owner')`, [T]);
    expect((await readiness()).signaturePackage).toMatchObject({ current: false, reasons: ['CONSENT_CHANGED'] });
    expect((await readiness()).stage11).toBe('CLIENT_SIGNATURE_REQUIRED');
    expect(await portal('rv-client')).toEqual([]);
    as('rv-rev'); expect((await call('GET', `/returns/${version}/signature-packages`)).body.items).toHaveLength(2);
  });

  it('history is immutable, the tables are closed to API roles, and another tenant sees nothing', async () => {
    for (const sql of [`UPDATE taxguard_tax_return_signature_packages SET signer_uids = ARRAY['rv-client2'] WHERE tenant_id = '${T}'`,
      `UPDATE taxguard_tax_return_signature_packages SET withdrawn_at = NULL, withdrawn_by = NULL, withdraw_reason = NULL WHERE tenant_id = '${T}' AND withdrawn_at IS NOT NULL`,
      `DELETE FROM taxguard_tax_return_signature_packages WHERE tenant_id = '${T}'`, `TRUNCATE taxguard_tax_return_signature_packages`,
      `UPDATE taxguard_tax_signature_consents SET consent_text = consent_text || ' changed' WHERE tenant_id = '${T}'`,
      `DELETE FROM taxguard_tax_signature_consents WHERE tenant_id = '${T}' AND consent_version = 2`])
      await expect(db.pool.query(sql), sql).rejects.toThrow('TAX_RETURN_SIGNATURE_HISTORY_IMMUTABLE');
    // No foreign key to the Stage 10 decisions, so their own guard still reports a truncate.
    await expect(db.pool.query('TRUNCATE taxguard_tax_return_final_authorizations')).rejects.toThrow('TAX_RETURN_FINAL_HISTORY_IMMUTABLE');
    const privileges = await db.pool.query(`SELECT r.rolname, t.tbl, has_table_privilege(r.rolname, 'public.' || t.tbl, 'SELECT,INSERT,UPDATE,DELETE') AS any
      FROM pg_roles r CROSS JOIN unnest(ARRAY['taxguard_tax_signature_consents','taxguard_tax_return_signature_packages']) AS t(tbl)
      WHERE r.rolname IN ('anon','authenticated','service_role')`);
    expect(privileges.rows.filter((r: any) => r.any)).toEqual([]);
    as('rv-foreign', T2);
    expect((await call('GET', `/returns/${version}/signature-context`)).body.code).toBe('TAX_RETURN_NOT_FOUND');
    expect((await call('POST', `/returns/${version}/signature-package/withdraw`, { reason: 'Synthetic foreign withdrawal.' })).body.code).toBe('TAX_RETURN_NOT_FOUND');
  });
});
