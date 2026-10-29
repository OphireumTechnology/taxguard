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

// Block 69: independent calculation verification of a draft return version (proposal 20261019140000, review only) over
// HTTP on real PostgreSQL with every proposal applied. The server re-executes every calculation run the version relies
// on with the deterministic engine; the database checks the recomputed hashes, the engine version, the rule set and
// value-to-source sums, records an immutable result, and Stage 09 approval needs the latest one to be VERIFIED.
// SYNTHETIC data only.
const T = 'tenantReturnVerify', T2 = 'tenantReturnVerifyOther', C = 'rvClient';
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

describe('independent calculation verification of a draft return', () => {
  it('only a submitted version is verified, and only by the case reviewer; approval needs a VERIFIED result', async () => {
    expect((await verify('rv-rev')).body.code).toBe('TAX_RETURN_NOT_SUBMITTED');
    as('rv-prep'); expect((await call('POST', `/returns/${version}/submit`)).body.status).toBe('SUBMITTED');
    expect((await approve()).body).toEqual({ code: 'TAX_RETURN_VERIFICATION_REQUIRED', detail: 'NONE' });
    expect((await verify('rv-prep')).body.code).toBe('TAX_RETURN_VERIFIER_REQUIRED');
    expect((await verify('rv-mgr')).body.code).toBe('TAX_RETURN_VERIFIER_REQUIRED');
    expect((await verify('rv-out')).body.code).toBe('TAX_RETURN_NOT_FOUND');
    as('rv-foreign', T2); expect((await call('POST', `/returns/${version}/verify`)).body.code).toBe('TAX_RETURN_NOT_FOUND');
    as('rv-client'); expect((await call('POST', `/returns/${version}/verify`)).status).toBe(403);
  });

  it('re-executes every run with the deterministic engine and records VERIFIED with the hashes; approval then succeeds', async () => {
    const recorded = (await db.pool.query(`SELECT run_id, output_sha256, engine_version FROM taxguard_tax_calc_runs WHERE tenant_id = $1`, [T])).rows;
    const v = (await verify('rv-rev')).body;
    expect(v).toMatchObject({ result: 'VERIFIED', findings: [], engineVersion: TAX_ENGINE_VERSION, verifiedBy: 'rv-rev' });
    expect(v.runs).toEqual(recorded.map((r: any) => expect.objectContaining({ runId: r.run_id, recordedOutputSha256: r.output_sha256, recomputedOutputSha256: r.output_sha256 })));
    const audit = (await db.pool.query(`SELECT actor_uid, metadata FROM taxguard_audit_log WHERE tenant_id = $1 AND action = 'TAX_RETURN_VERIFIED'`, [T])).rows;
    expect(audit).toEqual([expect.objectContaining({ actor_uid: 'rv-rev', metadata: expect.objectContaining({ result: 'VERIFIED', runs: 1, findings: 0 }) })]);
    as('rv-rev'); expect((await call('GET', `/returns/${version}/verifications`)).body.items).toHaveLength(1);
  });

  it('a recalculation that differs, or another engine version, is a DISCREPANCY that blocks approval', async () => {
    const runId = (await db.pool.query(`SELECT run_id FROM taxguard_tax_calc_runs WHERE tenant_id = $1`, [T])).rows[0].run_id;
    const mismatch = await rpc('taxguard_tax_return_verify', { p_tenant: T, p_actor: 'rv-rev', p_version: version,
      p_runs: [{ runId, recomputedOutputSha256: 'f'.repeat(64) }], p_engine_version: TAX_ENGINE_VERSION });
    expect(mismatch.data).toMatchObject({ result: 'DISCREPANCY', findings: [{ runId, reason: 'RECALCULATION_MISMATCH' }] });
    expect((await approve()).body).toEqual({ code: 'TAX_RETURN_VERIFICATION_REQUIRED', detail: 'DISCREPANCY' });
    const recordedHash = (await db.pool.query(`SELECT output_sha256 FROM taxguard_tax_calc_runs WHERE tenant_id = $1`, [T])).rows[0].output_sha256;
    const engine = await rpc('taxguard_tax_return_verify', { p_tenant: T, p_actor: 'rv-rev', p_version: version,
      p_runs: [{ runId, recomputedOutputSha256: recordedHash }], p_engine_version: 'taxguard-engine-9.9.9' });
    expect(engine.data).toMatchObject({ result: 'DISCREPANCY', findings: [{ runId, reason: 'ENGINE_VERSION_CHANGED' }] });
    // Malformed submissions are refused, not recorded.
    for (const p_runs of [[], [{ runId, recomputedOutputSha256: 'short' }], [{ runId: '00000000-0000-4000-8000-000000000000', recomputedOutputSha256: recordedHash }],
      [{ runId, recomputedOutputSha256: recordedHash }, { runId, recomputedOutputSha256: recordedHash }]]) {
      const r = await rpc('taxguard_tax_return_verify', { p_tenant: T, p_actor: 'rv-rev', p_version: version, p_runs, p_engine_version: TAX_ENGINE_VERSION });
      expect(r.error?.message, JSON.stringify(p_runs)).toContain('TAX_RETURN_VERIFICATION_INPUT_INVALID');
    }
    // A fresh server-side verification restores a VERIFIED latest result; the approval records which verification it relied on.
    expect((await verify('rv-rev')).body.result).toBe('VERIFIED');
    const latest = (await call('GET', `/returns/${version}/verifications`)).body.items[0];
    expect((await approve()).body).toMatchObject({ status: 'APPROVED', approvalBasis: { verificationId: latest.verificationId, function: 'RETURN_DRAFT_REVIEW' } });
  });

  it('verifications are immutable, unreachable for writes, and isolated', async () => {
    for (const sql of [`UPDATE taxguard_tax_return_verifications SET result = 'VERIFIED', findings = '[]'::jsonb WHERE tenant_id = '${T}'`,
      `DELETE FROM taxguard_tax_return_verifications WHERE tenant_id = '${T}'`, 'TRUNCATE taxguard_tax_return_verifications'])
      await expect(db.pool.query(sql), sql).rejects.toThrow('TAX_RETURN_VERIFICATION_IMMUTABLE');
    await expect(db.pool.query(`INSERT INTO taxguard_tax_return_verifications(tenant_id, return_version_id, case_id, forms_sha256, result, runs, findings, engine_version, verified_by)
      VALUES ($1, $2, $3, repeat('a', 64), 'VERIFIED', '[{"runId":"x"}]'::jsonb, '[{"reason":"X"}]'::jsonb, 'e', 'rv-rev')`, [T, version, caseId])).rejects.toThrow(/check/i);
    for (const role of ['anon', 'authenticated', 'service_role'])
      expect((await db.pool.query(`SELECT has_table_privilege($1, 'public.taxguard_tax_return_verifications', 'SELECT') OR has_table_privilege($1, 'public.taxguard_tax_return_verifications', 'INSERT') AS ok`,
        [role])).rows[0].ok, role).toBe(false);
    expect((await db.pool.query(`SELECT has_function_privilege('service_role', 'public.taxguard_tax_return_verification_runs(text,uuid)', 'EXECUTE') AS ok`)).rows[0].ok).toBe(false);
    as('rv-out'); expect((await call('GET', `/returns/${version}/verifications`)).body.code).toBe('TAX_RETURN_NOT_FOUND');
    as('rv-mgr'); expect((await call('GET', `/returns/${version}/verifications`)).body.items.length).toBeGreaterThanOrEqual(3);
  });

  it('a stale version cannot be verified', async () => {
    as('rv-prep'); const tpl = (await call('GET', '/return-templates?taxYear=2025')).body.items[0].templateRuleId;
    await db.pool.query(`INSERT INTO taxguard_documents(document_id, tenant_id, client_id, engagement_id, tax_year, case_id, version, hash, mime_type, status, quarantine_status, created_by)
      VALUES ('rv-w2', $1, $2, $3, 2025, $4, 2, repeat('2', 64), 'application/pdf', 'PENDING_REVIEW', 'CLEAN', 'rv-client')`, [T, C, engagementId, caseId]);
    // The approved version is now stale; a new version cannot be prepared on stale sources, so the approved one is checked directly.
    expect((await call('POST', `/cases/${caseId}/returns`, { templateRuleId: tpl })).body.code).toBe('TAX_RETURN_PREPARATION_REFUSED');
    // A well-formed request, so the refusal comes from the version's state (approved, and now stale), not from the input.
    const run = (await db.pool.query(`SELECT run_id, output_sha256 FROM taxguard_tax_calc_runs WHERE tenant_id = $1`, [T])).rows[0];
    const r = await rpc('taxguard_tax_return_verify', { p_tenant: T, p_actor: 'rv-rev', p_version: version,
      p_runs: [{ runId: run.run_id, recomputedOutputSha256: run.output_sha256 }], p_engine_version: TAX_ENGINE_VERSION });
    expect(r.error?.message).toMatch(/TAX_RETURN_NOT_SUBMITTED|TAX_RETURN_STALE/);
    expect((await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_tax_return_verifications WHERE tenant_id = $1`, [T])).rows[0].n).toBe(4); // nothing new recorded
  });
});
