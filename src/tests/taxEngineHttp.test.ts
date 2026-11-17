import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTaxEngineRouter } from '../server/routes/taxEngine.routes';
import { TaxEngineStore } from '../server/taxguard/taxEngine/taxEngineStore';
import { syntheticRuleSet, SYNTHETIC_SOURCE_ID } from '../server/taxguard/taxEngine/syntheticFixtures';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// HTTP -> /api/tax-engine -> TaxEngineStore + pure engine -> proposal 033 (PGlite) with 025/026.
// SYNTHETIC sources and rule sets only: nothing here is tax law.
const T = 'tenantA', C = 'teClient';
const roles: Record<string, string> = { 'te-prep': 'accountant', 'te-rev': 'senior_reviewer', 'te-rev2': 'reviewer', 'te-mgr': 'practice_manager', 'te-bk': 'bookkeeper', 'te-out': 'accountant' };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let user: any;
let caseId = '', v1 = '', v2 = '', runId = '';
const as = (uid: string, tenantId = T) => { user = { id: uid, role: roles[uid] ?? 'practice_manager', tenantId, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown) => fetch(origin + '/tax' + path, { method, headers: { 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).then(async r => ({ status: r.status, body: await r.json() as any }));
const sha = (c: string) => c.repeat(64);
const source = (id: string, authorityType = 'synthetic_test', years = [2025]) => ({ sourceId: id, jurisdiction: 'state', jurisdictionCode: 'ZZ', authorityType,
  title: 'Synthetic fixture source (not tax law)', issuer: 'Synthetic test issuer', citation: 'Synthetic fixture', taxYears: years });
const inputs = [{ factPath: 'synthetic.income_a', value: '12345.67', evidenceIds: ['doc:synthetic-1'] }, { factPath: 'synthetic.income_b', value: '0.10', evidenceIds: ['doc:synthetic-2'] }];

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(250000|260000|330000)_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','te-client','Synthetic Engine Client');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) SELECT '${T}', k, v, 'active' FROM (VALUES ${Object.entries(roles).map(([k, v]) => `('${k}','${v}')`).join(',')}) x(k, v);
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantB','te-foreign','practice_manager','active');`);
  const practice = new PracticeStore(pgliteRpc(() => fixture.pg));
  const eng = (await practice.createEngagement(T, C, 'te-mgr', 'te-engagement-1', { title: 'Synthetic 2025', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'te-mgr', eng, 'active', 1);
  await practice.assign(T, C, 'te-mgr', 'te-assign-prep', { engagementId: eng, taxYear: 2025, role: 'preparer', userId: 'te-prep', reason: 'Synthetic staffing' });
  await practice.assign(T, C, 'te-mgr', 'te-assign-rev', { engagementId: eng, taxYear: 2025, role: 'reviewer', userId: 'te-rev', reason: 'Synthetic staffing' });
  caseId = (await new CaseStore(pgliteRpc(() => fixture.pg)).create(T, C, 'te-mgr', 'te-case-key-1', { engagementId: eng, taxYear: 2025, returnFamily: '1040' })).caseId;
  const app = express();
  app.use('/tax', createTaxEngineRouter({ store: () => new TaxEngineStore(pgliteRpc(() => fixture.pg)), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 90000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

describe('source-of-law records', () => {
  it('are verified by a different reviewer against a document hash; synthetic sources are flagged', async () => {
    as('te-prep');
    expect((await call('POST', '/sources', source(SYNTHETIC_SOURCE_ID))).body).toMatchObject({ status: 'PROPOSED', synthetic: true });
    expect((await call('POST', '/sources', source('ZZ-GUIDANCE-1', 'state_guidance'))).body.synthetic).toBe(false);
    expect((await call('POST', '/sources', source(SYNTHETIC_SOURCE_ID))).body.code).toBe('TAX_SOURCE_EXISTS');
    expect((await call('POST', '/sources', { ...source('BAD-1'), url: 'http://insecure.invalid' })).body.code).toBe('TAX_SOURCE_INPUT_INVALID');
    expect((await call('POST', `/sources/${SYNTHETIC_SOURCE_ID}/verify`, { documentSha256: sha('a') })).body.code).toBe('TAX_CONTENT_REVIEWER_REQUIRED');
    as('te-rev');
    expect((await call('POST', `/sources/${SYNTHETIC_SOURCE_ID}/verify`, { documentSha256: 'not-a-hash' })).body.code).toBe('TAX_SOURCE_INPUT_INVALID');
    expect((await call('POST', `/sources/${SYNTHETIC_SOURCE_ID}/verify`, { documentSha256: sha('a') })).body).toMatchObject({ status: 'VERIFIED', verified_by: 'te-rev' });
    expect((await call('POST', `/sources/${SYNTHETIC_SOURCE_ID}/verify`, { documentSha256: sha('a') })).body.code).toBe('TAX_SOURCE_NOT_PROPOSED');
    as('te-bk'); expect((await call('GET', '/sources')).status).toBe(403);
  });
});

describe('versioned rule sets', () => {
  it('validates, hashes and versions drafts; only verified sources may be submitted', async () => {
    as('te-prep');
    const bad = await call('POST', '/rule-sets', { definition: { ...syntheticRuleSet(), steps: [] } });
    expect(bad.status).toBe(422); expect(bad.body.code).toBe('TAX_ENGINE_DEFINITION_INVALID');
    const unverified = await call('POST', '/rule-sets', { definition: syntheticRuleSet(2025, { returnFamily: 'SYN-2', parameters: syntheticRuleSet().parameters.map(p => ({ ...p, sourceId: 'ZZ-GUIDANCE-1' })) }) });
    expect(unverified.body).toMatchObject({ version: 1, synthetic: false, sourceIds: ['ZZ-GUIDANCE-1'] });
    const refused = await call('POST', `/rule-sets/${unverified.body.ruleSetId}/submit`);
    expect(refused.body).toMatchObject({ code: 'TAX_SOURCE_NOT_VERIFIED', detail: 'ZZ-GUIDANCE-1' });
    const draft = await call('POST', '/rule-sets', { definition: syntheticRuleSet() });
    expect(draft.status).toBe(201); expect(draft.body).toMatchObject({ version: 1, status: 'DRAFT', synthetic: true, taxYear: 2025, contentSha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    v1 = draft.body.ruleSetId;
    expect((await call('POST', '/rule-sets', { definition: syntheticRuleSet() })).body.code).toBe('TAX_RULE_SET_DUPLICATE');
    expect((await call('POST', `/rule-sets/${v1}/submit`)).body.status).toBe('PENDING_REVIEW');
    await expect(fixture.pg.query(`UPDATE taxguard_tax_rule_sets SET definition = '{}'::jsonb WHERE rule_set_id = $1`, [v1])).rejects.toThrow('TAX_RULE_SET_IMMUTABLE');
  });
  it('requires an independent reviewer to approve; a newer approved version supersedes the older', async () => {
    as('te-prep'); expect((await call('POST', `/rule-sets/${v1}/approve`)).body.code).toBe('TAX_CONTENT_REVIEWER_REQUIRED');
    as('te-rev');
    expect((await call('POST', `/rule-sets/${v1}/reject`, { note: 'short' })).body.code).toBe('TAX_RULE_SET_INPUT_INVALID');
    expect((await call('POST', `/rule-sets/${v1}/approve`)).body).toMatchObject({ status: 'APPROVED', reviewedBy: 'te-rev' });
    // te-rev drafts version 2 (a different synthetic rate) and cannot approve their own draft.
    const changed = syntheticRuleSet(2025, { parameters: syntheticRuleSet().parameters.map(p => p.key === 'synthetic_rate' ? { ...p, value: '0.0800' } : p) });
    const d2 = await call('POST', '/rule-sets', { definition: changed });
    expect(d2.body.version).toBe(2); v2 = d2.body.ruleSetId;
    await call('POST', `/rule-sets/${v2}/submit`);
    expect((await call('POST', `/rule-sets/${v2}/approve`)).body.code).toBe('MAKER_CHECKER_VIOLATION');
    as('te-rev2'); expect((await call('POST', `/rule-sets/${v2}/approve`)).body.status).toBe('APPROVED');
    const list = (await call('GET', '/rule-sets?taxYear=2025')).body.items.filter((r: any) => r.returnFamily === 'SYN-1');
    expect(list.map((r: any) => [r.version, r.status])).toEqual([[2, 'APPROVED'], [1, 'SUPERSEDED']]);
    expect((await call('GET', `/rule-sets/${v2}`)).body.definition.parameters.find((p: any) => p.key === 'synthetic_rate').value).toBe('0.0800');
  });
});

describe('deterministic, pinned, reviewed calculations', () => {
  it('runs only an approved rule set for the case\'s tax year and records outputs with full provenance', async () => {
    as('te-prep');
    expect((await call('POST', `/cases/${caseId}/runs`, { ruleSetId: v1, inputs })).body.code).toBe('TAX_RULE_SET_NOT_APPROVED');
    const r = await call('POST', `/cases/${caseId}/runs`, { ruleSetId: v2, inputs });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ status: 'COMPUTED', synthetic: true, returnUse: 'BLOCKED', replayed: false, outputs: { synthetic_base: '11345.77', synthetic_amount: '907.66' } });
    expect(r.body.trace.find((s: any) => s.stepId === 'synthetic_amount').args[1]).toEqual({ ref: 'param:synthetic_rate', value: '0.0800', sourceId: SYNTHETIC_SOURCE_ID, citation: 'Synthetic fixture section 2' });
    runId = r.body.run_id;
    const replay = await call('POST', `/cases/${caseId}/runs`, { ruleSetId: v2, inputs: [...inputs].reverse() });
    expect(replay.body).toMatchObject({ run_id: runId, replayed: true, output_sha256: r.body.output_sha256 });
    as('te-out'); expect((await call('POST', `/cases/${caseId}/runs`, { ruleSetId: v2, inputs })).body.code).toBe('TAX_CALC_CASE_NOT_FOUND');
    expect((await audits('TAX_CALC_RECORDED')).map(a => [a.metadata.clientId, a.metadata.ruleSetVersion])).toEqual([[C, 2]]);
  });
  it('refuses a different output for the same pinned inputs, a tampered rule set and a tax-year mismatch', async () => {
    const recorded = (await fixture.pg.query<any>(`SELECT * FROM taxguard_tax_calc_runs WHERE run_id = $1`, [runId])).rows[0];
    const rpc = pgliteRpc(() => fixture.pg);
    const forged = await rpc.rpc('taxguard_tax_run_record', { p_tenant: T, p_actor: 'te-prep', p_case: caseId, p_run: { ruleSetId: v2, ruleSetSha256: recorded.rule_set_sha256,
      engineVersion: recorded.engine_version, inputSha256: recorded.input_sha256, outputSha256: sha('f'), inputs: [], outputs: {}, trace: [] } });
    expect(forged.data).toMatchObject({ refused: 'TAX_ENGINE_NONDETERMINISM', runId });
    expect((await audits('TAX_CALC_NONDETERMINISM_REFUSED')).length).toBe(1);
    // Someone with direct database access bypasses the guard and edits an approved parameter.
    await fixture.pg.exec(`ALTER TABLE taxguard_tax_rule_sets DISABLE TRIGGER trg_taxguard_tax_rule_sets_guard;
      UPDATE taxguard_tax_rule_sets SET definition = jsonb_set(definition, '{parameters,2,value}', '"0.5000"') WHERE rule_set_id = '${v2}';
      ALTER TABLE taxguard_tax_rule_sets ENABLE TRIGGER trg_taxguard_tax_rule_sets_guard;`);
    as('te-prep');
    expect((await call('POST', `/cases/${caseId}/runs`, { ruleSetId: v2, inputs: [inputs[0]] })).body.code).toBe('TAX_RULE_SET_INTEGRITY');
    await fixture.pg.exec(`ALTER TABLE taxguard_tax_rule_sets DISABLE TRIGGER trg_taxguard_tax_rule_sets_guard;
      UPDATE taxguard_tax_rule_sets SET definition = jsonb_set(definition, '{parameters,2,value}', '"0.0800"') WHERE rule_set_id = '${v2}';
      ALTER TABLE taxguard_tax_rule_sets ENABLE TRIGGER trg_taxguard_tax_rule_sets_guard;`);
    as('te-prep');
    await call('POST', '/sources', source('SYNTHETIC-SOURCE-2024', 'synthetic_test', [2024]));
    as('te-rev'); await call('POST', '/sources/SYNTHETIC-SOURCE-2024/verify', { documentSha256: sha('b') });
    as('te-prep');
    const y2024 = (await call('POST', '/rule-sets', { definition: syntheticRuleSet(2024, { parameters: syntheticRuleSet().parameters.map(p => ({ ...p, sourceId: 'SYNTHETIC-SOURCE-2024' })) }) })).body;
    await call('POST', `/rule-sets/${y2024.ruleSetId}/submit`); as('te-rev'); await call('POST', `/rule-sets/${y2024.ruleSetId}/approve`);
    as('te-prep'); expect((await call('POST', `/cases/${caseId}/runs`, { ruleSetId: y2024.ruleSetId, inputs })).body.code).toBe('TAX_CALC_TAX_YEAR_MISMATCH');
  });
  it('is reviewed by the case reviewer only, never by its requester, once; results stay blocked from returns', async () => {
    as('te-prep'); expect((await call('POST', `/runs/${runId}/approve`, { note: 'Synthetic review note' })).body.code).toBe('TAX_CALC_REVIEWER_REQUIRED');
    as('te-rev');
    expect((await call('POST', `/runs/${runId}/approve`, { note: 'short' })).body.code).toBe('TAX_CALC_INPUT_INVALID');
    expect((await call('POST', `/runs/${runId}/approve`, { note: 'Synthetic inputs traced to evidence' })).body).toMatchObject({ status: 'REVIEW_APPROVED', reviewed_by: 'te-rev', returnUse: 'BLOCKED' });
    expect((await call('POST', `/runs/${runId}/reject`, { note: 'Changing my mind later' })).body.code).toBe('TAX_CALC_ALREADY_REVIEWED');
    await expect(fixture.pg.query(`UPDATE taxguard_tax_calc_runs SET outputs = '{}'::jsonb WHERE run_id = $1`, [runId])).rejects.toThrow('TAX_CALC_RUN_IMMUTABLE');
    const own = await call('POST', `/cases/${caseId}/runs`, { ruleSetId: v2, inputs: [inputs[0]] });
    expect((await call('POST', `/runs/${own.body.run_id}/approve`, { note: 'Reviewing my own synthetic run' })).body.code).toBe('MAKER_CHECKER_VIOLATION');
    expect((await fixture.pg.query<{ p: any }>(`SELECT taxguard_case_stage_policy(9) p`)).rows[0].p).toMatchObject({ evidence: 'BLOCKED', dependency: 'VERIFIED_TAX_ENGINE_REQUIRED' });
    as('te-mgr'); expect((await call('GET', `/cases/${caseId}/runs`)).body).toMatchObject({ returnUse: 'BLOCKED', items: expect.arrayContaining([expect.objectContaining({ run_id: runId })]) });
  });
});

describe('isolation and grants', () => {
  it('keeps tenants apart and exposes only service RPCs', async () => {
    as('te-foreign', 'tenantB');
    expect((await call('GET', '/rule-sets')).body.items).toEqual([]);
    expect((await call('GET', `/rule-sets/${v2}`)).status).toBe(404);
    expect((await call('GET', `/cases/${caseId}/runs`)).status).toBe(404);
    const rows = (await fixture.pg.query<{ proname: string; svc: boolean; pub: boolean }>(`SELECT proname, has_function_privilege('service_role', oid, 'EXECUTE') svc,
      has_function_privilege('authenticated', oid, 'EXECUTE') OR has_function_privilege('anon', oid, 'EXECUTE') pub FROM pg_proc WHERE proname LIKE 'taxguard\\_tax\\_%'`)).rows;
    expect(rows.filter(r => r.pub)).toEqual([]);
    expect(rows.filter(r => r.svc).map(r => r.proname).sort()).toEqual(['taxguard_tax_rule_set_draft', 'taxguard_tax_rule_set_get', 'taxguard_tax_rule_set_list',
      'taxguard_tax_rule_set_transition', 'taxguard_tax_run_list', 'taxguard_tax_run_record', 'taxguard_tax_run_review', 'taxguard_tax_source_list', 'taxguard_tax_source_register',
      'taxguard_tax_source_verify']);
  });
});
async function audits(action: string) { return (await fixture.pg.query<{ metadata: any }>(`SELECT metadata FROM taxguard_audit_log WHERE action = $1`, [action])).rows; }
