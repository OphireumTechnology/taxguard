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

// Block 71: risk and materiality of a draft return version (proposal 20261019160000, review only) over HTTP on real
// PostgreSQL with every proposal applied. Every signal but the amount at stake comes from the database; materiality only
// from an approved practice policy (a synthetic one here, inserted like a reviewed database change); the outcome is never
// better than human review. The setup is Block 70's (a prepared return version) in its own tenant. SYNTHETIC data only.
const T = 'tenantReturnRisk', T2 = 'tenantReturnRiskOther', C = 'rvClient';
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

const assess = async (amountCents: unknown, uid = 'rv-prep') => { as(uid); return call('POST', `/returns/${version}/risk`, { amountCents }); };
const ok = async (amountCents: number, uid = 'rv-prep') => { const r = await assess(amountCents, uid); expect(r.status, JSON.stringify(r.body)).toBe(201); return r.body; };
const diagnoseCase = async () => { as('rv-rev'); expect((await call('POST', `/cases/${caseId}/diagnostics/run`)).status).toBeLessThan(300); };

describe('return risk assessment', () => {
  it('without a policy every signal is read from the database and the outcome is human review; only the amount is accepted', async () => {
    as('rv-prep'); expect((await call('POST', `/returns/${version}/submit`)).body.status).toBe('SUBMITTED');
    const a = await ok(500_000);
    expect(a).toMatchObject({ returnVersionId: version, versionStatus: 'SUBMITTED', policyVersion: null, amountCents: 500_000, materiality: 'UNKNOWN',
      riskLevel: 'UNKNOWN', outcome: 'HUMAN_REVIEW_REQUIRED', assessedBy: 'rv-prep', returnUse: 'BLOCKED' });
    expect(a.reasonCodes).toEqual(['RETURN_HUMAN_REVIEW_REQUIRED', 'RETURN_NOT_VERIFIED', 'DIAGNOSTICS_NOT_CURRENT', 'NO_APPROVED_MATERIALITY_POLICY']);
    expect(a.signals).toMatchObject({ stale: [], verification: null, diagnostics: { lastRunAt: null }, research: { unresolved: 0, unsupported: 0, aiInferenceOnly: 0 } });
    for (const bad of [-1, 1.5, '100', null]) expect((await assess(bad)).body.code, String(bad)).toBe('RISK_INPUT_INVALID');
    // Nothing else can be supplied: not an AI confidence, not a position flag, not an outcome.
    for (const extra of [{ aiConfidence: 0.99 }, { unsupportedPosition: false }, { outcome: 'CONTINUE' }])
      expect((await rpc('taxguard_tax_return_risk_assess', { p_tenant: T, p_actor: 'rv-prep', p_version: version, p_signals: { amountCents: 1, ...extra } }))
        .error?.message).toBe('RISK_INPUT_INVALID');
    // After the governed diagnostics run, the open warning on this version (awaiting verification) is a reason.
    await diagnoseCase();
    const b = await ok(500_000, 'rv-rev');
    expect(b.reasonCodes).toEqual(expect.arrayContaining(['RETURN_HUMAN_REVIEW_REQUIRED', 'RETURN_NOT_VERIFIED', 'DIAGNOSTIC_WARNINGS_OPEN']));
    expect(b.reasonCodes).not.toContain('DIAGNOSTICS_NOT_CURRENT');
    expect(b.outcome).toBe('HUMAN_REVIEW_REQUIRED');
  });

  it('a verification discrepancy blocks; a verified, approved version still needs human review', async () => {
    expect((await verify('rv-rev')).body.result).toBe('VERIFIED');
    expect((await ok(500_000)).reasonCodes).not.toContain('RETURN_NOT_VERIFIED');
    const runId = (await db.pool.query(`SELECT run_id FROM taxguard_tax_calc_runs WHERE tenant_id = $1`, [T])).rows[0].run_id;
    await rpc('taxguard_tax_return_verify', { p_tenant: T, p_actor: 'rv-rev', p_version: version, p_runs: [{ runId, recomputedOutputSha256: 'f'.repeat(64) }],
      p_engine_version: TAX_ENGINE_VERSION });
    const blocked = await ok(500_000);
    expect(blocked.outcome).toBe('BLOCKED');
    expect(blocked.reasonCodes).toContain('RETURN_VERIFICATION_DISCREPANCY');
    // Once diagnosed, the discrepancy is also an open blocking finding of this version.
    await diagnoseCase();
    expect((await ok(500_000)).reasonCodes).toEqual(expect.arrayContaining(['RETURN_VERIFICATION_DISCREPANCY', 'DIAGNOSTIC_BLOCKING']));
    expect((await verify('rv-rev')).body.result).toBe('VERIFIED');
    expect((await approve()).body.status).toBe('APPROVED');
    await diagnoseCase();
    const approved = await ok(500_000);
    expect(approved).toMatchObject({ versionStatus: 'APPROVED', outcome: 'HUMAN_REVIEW_REQUIRED' });
    // The synthetic case has no approved book-to-tax workpaper: a case-level ERROR finding the assessment reads itself.
    expect((await db.pool.query(`SELECT rule_code FROM taxguard_case_diagnostics WHERE tenant_id = $1 AND severity = 'ERROR' AND status <> 'CLEARED'`, [T])).rows)
      .toEqual([{ rule_code: 'B2T_NO_APPROVED_WORKPAPER' }]);
    expect(approved.reasonCodes).toEqual(['RETURN_HUMAN_REVIEW_REQUIRED', 'DIAGNOSTIC_ERRORS', 'NO_APPROVED_MATERIALITY_POLICY']);
  });

  it('materiality comes only from an approved policy, and even a policy allowing automated continuation cannot lower the outcome', async () => {
    await db.pool.query(`INSERT INTO taxguard_materiality_policies(tenant_id, policy_version, material_amount_cents, high_risk_amount_cents, minimum_ai_confidence,
      allow_automated_continuation, rationale, status, created_by) VALUES ($1, 1, 1, 2, 0.5, true, 'Synthetic draft policy for tests only.', 'DRAFT', 'rv-author')`, [T]);
    expect((await ok(500_000)).reasonCodes).toContain('NO_APPROVED_MATERIALITY_POLICY'); // a draft decides nothing
    await db.pool.query(`INSERT INTO taxguard_materiality_policies(tenant_id, policy_version, material_amount_cents, high_risk_amount_cents, minimum_ai_confidence,
      allow_automated_continuation, rationale, status, created_by, approved_by, approved_at) VALUES ($1, 2, 100000, 1000000, 0.5, true,
      'Synthetic approved policy for tests only (not a practice threshold).', 'APPROVED', 'rv-author', 'rv-owner', now())`, [T]);
    expect(await ok(50_000)).toMatchObject({ policyVersion: 2, materiality: 'IMMATERIAL', riskLevel: 'LOW', outcome: 'HUMAN_REVIEW_REQUIRED',
      reasonCodes: ['RETURN_HUMAN_REVIEW_REQUIRED', 'DIAGNOSTIC_ERRORS'] });
    expect(await ok(100_000)).toMatchObject({ materiality: 'MATERIAL', riskLevel: 'MEDIUM', reasonCodes: ['RETURN_HUMAN_REVIEW_REQUIRED', 'DIAGNOSTIC_ERRORS', 'AMOUNT_MATERIAL'] });
    expect(await ok(1_000_000)).toMatchObject({ materiality: 'MATERIAL', riskLevel: 'HIGH', outcome: 'HUMAN_REVIEW_REQUIRED' });
  });

  it('unresolved, unsupported and AI-inference-only research positions are reasons and raise the risk level', async () => {
    as('rv-prep'); const memo = await call('POST', `/cases/${caseId}/research`, { question: 'Synthetic question: is the synthetic wage item includible?' });
    expect(memo.status, JSON.stringify(memo.body)).toBe(201);
    const memoId = memo.body.memoId ?? memo.body.memo_id;
    const a = await ok(50_000);
    expect(a.reasonCodes).toEqual(['RETURN_HUMAN_REVIEW_REQUIRED', 'DIAGNOSTIC_ERRORS', 'RESEARCH_UNRESOLVED', 'RESEARCH_POSITION_UNSUPPORTED']);
    expect(a.riskLevel).toBe('HIGH');
    expect((await call('POST', `/research/${memoId}/citations`, { authorityLevel: 'AI_INFERENCE', note: 'Synthetic model suggestion' })).status).toBe(201);
    const b = await ok(50_000);
    expect(b.reasonCodes).toEqual(['RETURN_HUMAN_REVIEW_REQUIRED', 'DIAGNOSTIC_ERRORS', 'RESEARCH_UNRESOLVED', 'RESEARCH_POSITION_UNSUPPORTED', 'RESEARCH_AI_INFERENCE_ONLY']);
    expect(b.signals.research).toEqual({ unresolved: 1, unsupported: 1, aiInferenceOnly: 1 });
    expect((await call('POST', `/research/${memoId}/citations`, { authorityLevel: 'SECONDARY', reference: 'Synthetic treatise', note: 'Synthetic secondary support' })).status).toBe(201);
    expect((await ok(50_000)).reasonCodes).not.toContain('RESEARCH_AI_INFERENCE_ONLY');
  });

  it('assessments are immutable, scoped to the case, listed newest first and change nothing about the return', async () => {
    const before = (await db.pool.query(`SELECT status, forms_sha256, reviewed_by FROM taxguard_tax_return_versions WHERE tenant_id = $1 AND return_version_id = $2`, [T, version])).rows[0];
    as('rv-rev'); const list = await call('GET', `/returns/${version}/risk`);
    expect(list.body.returnUse).toBe('BLOCKED');
    const times = list.body.items.map((x: any) => x.assessedAt);
    expect(times).toEqual([...times].sort().reverse());
    const count = Number((await db.pool.query(`SELECT count(*) FROM taxguard_tax_return_risk_assessments WHERE tenant_id = $1`, [T])).rows[0].count);
    expect(list.body.items).toHaveLength(count);
    expect(list.body.items.every((x: any) => x.outcome !== 'CONTINUE')).toBe(true);
    for (const sql of [`UPDATE taxguard_tax_return_risk_assessments SET outcome = 'HUMAN_REVIEW_REQUIRED' WHERE tenant_id = '${T}'`,
      `DELETE FROM taxguard_tax_return_risk_assessments WHERE tenant_id = '${T}'`, 'TRUNCATE taxguard_tax_return_risk_assessments'])
      await expect(db.pool.query(sql), sql).rejects.toThrow('TAX_RETURN_RISK_ASSESSMENT_IMMUTABLE');
    // The table itself refuses an outcome better than human review, or one without the human review reason.
    await expect(db.pool.query(`INSERT INTO taxguard_tax_return_risk_assessments(tenant_id, return_version_id, case_id, client_id, tax_year, version_status, forms_sha256,
      amount_cents, signals, materiality, risk_level, outcome, reason_codes, assessed_by) VALUES ($1, $2, $3, $4, 2025, 'APPROVED', repeat('a', 64), 0, '{}',
      'UNKNOWN', 'UNKNOWN', 'CONTINUE', '{}', 'rv-prep')`, [T, version, caseId, C])).rejects.toThrow(/check constraint/);
    for (const role of ['anon', 'authenticated', 'service_role'])
      expect((await db.pool.query(`SELECT has_table_privilege($1, 'public.taxguard_tax_return_risk_assessments', 'SELECT')
        OR has_table_privilege($1, 'public.taxguard_tax_return_risk_assessments', 'INSERT') AS ok`, [role])).rows[0].ok, role).toBe(false);
    as('rv-out'); expect((await call('GET', `/returns/${version}/risk`)).body.code).toBe('TAX_RETURN_NOT_FOUND');
    expect((await assess(1, 'rv-out')).body.code).toBe('TAX_RETURN_NOT_FOUND');
    as('rv-foreign', T2); expect((await call('POST', `/returns/${version}/risk`, { amountCents: 1 })).body.code).toBe('TAX_RETURN_NOT_FOUND');
    as('rv-client'); expect((await call('POST', `/returns/${version}/risk`, { amountCents: 1 })).status).toBe(403);
    const after = (await db.pool.query(`SELECT status, forms_sha256, reviewed_by FROM taxguard_tax_return_versions WHERE tenant_id = $1 AND return_version_id = $2`, [T, version])).rows[0];
    expect(after).toEqual(before);
    const audits = Number((await db.pool.query(`SELECT count(*) FROM taxguard_audit_log WHERE tenant_id = $1 AND action = 'TAX_RETURN_RISK_ASSESSED'`, [T])).rows[0].count);
    expect(audits).toBe(count);
  });

  it('a stale version is blocked, and a superseded version is not assessed', async () => {
    as('rv-prep'); const k = (await call('GET', `/cases/${caseId}/conclusions`)).body.items.find((x: any) => x.status === 'APPROVED');
    const revised = (await call('POST', `/conclusions/${k.conclusionId}/revise`, { amount: '5000.00', statement: 'Synthetic wages for the year, restated.',
      links: k.links.map((l: any) => ({ type: l.type, ref: l.ref })) })).body.conclusionId;
    await call('POST', `/conclusions/${revised}/submit`); as('rv-rev'); expect((await call('POST', `/conclusions/${revised}/approve`, {})).body.status).toBe('APPROVED');
    const stale = await ok(50_000);
    expect(stale.outcome).toBe('BLOCKED');
    expect(stale.reasonCodes).toContain('RETURN_VERSION_STALE');
    const ruleId = (await call('GET', `/cases/${caseId}/form-mappings`)).body.items.find((m: any) => m.status === 'CURRENT').ruleId;
    as('rv-prep'); expect((await call('POST', `/cases/${caseId}/form-mappings`, { ruleId })).status).toBe(201);
    const tpl = (await call('GET', '/return-templates?taxYear=2025')).body.items[0].templateRuleId;
    const next = await call('POST', `/cases/${caseId}/returns`, { templateRuleId: tpl });
    expect(next.status, JSON.stringify(next.body)).toBe(201);
    const superseded = await assess(50_000);
    expect(superseded.status).toBe(409);
    expect(superseded.body.code).toBe('TAX_RETURN_SUPERSEDED');
    version = next.body.returnVersionId;
    expect((await ok(50_000)).reasonCodes).toEqual(expect.arrayContaining(['RETURN_NOT_VERIFIED', 'DIAGNOSTICS_NOT_CURRENT']));
  });
});
