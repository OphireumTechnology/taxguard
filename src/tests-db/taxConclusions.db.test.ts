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

// Block 66: durable evidence-to-conclusion traceability (proposal 20261019100000, review only) over HTTP on real
// PostgreSQL with every proposal applied. A conclusion links to verified evidence, an approved calculation run (with its
// rule set) and approved research (with its authorities); replacing the source document makes it stale, which blocks
// submission, approval and readiness until the preparer revises it on revalidated sources and the reviewer approves
// again. SYNTHETIC data only: nothing here is tax law.
const T = 'tenantConclusions', T2 = 'tenantConclusionsOther', C = 'tcClient', C2 = 'tcOther';
const roles: Record<string, string> = { 'tc-mgr': 'practice_manager', 'tc-prep': 'accountant', 'tc-rev': 'reviewer', 'tc-out': 'accountant', 'tc-client': 'client' };
let db: TestDatabase; let caseId = '', otherCaseId = '', engagementId = '', ruleSetId = '';
let field1 = '', undecided = '', run1 = '', memo = '', conclusion1 = '';
let server: Server; let origin = ''; let user: any = null;
const as = (uid: string, tenantId = T) => { user = { id: uid, role: roles[uid] ?? 'practice_manager', tenantId, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown) => fetch(origin + '/tax' + path, { method, headers: { 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).then(async r => ({ status: r.status, body: await r.json() as any }));
const rpc = async (fn: string, args: Record<string, unknown>) => { const r = await pgRpc(db.pool).rpc(fn, args); if (r.error) throw new Error(r.error.message); return r.data as any; };
const doc = (id: string, version: number, status: string, client = C) => db.pool.query(`INSERT INTO taxguard_documents(document_id, tenant_id, client_id, engagement_id,
    tax_year, case_id, version, hash, mime_type, status, quarantine_status, created_by) VALUES ($1, $2, $3, $4, 2025, $5, $6, repeat($7, 64), 'application/pdf', $8, 'CLEAN', 'tc-client')`,
  [id, T, client, client === C ? engagementId : 'tc-other-engagement', client === C ? caseId : null, version, String(version), status]);
async function decidedField(documentId: string, version: number, value: string) {
  await rpc('taxguard_doc_propose_extraction', { p_tenant: T, p_client: C, p_document_id: documentId, p_version: version, p_provider: 'synthetic-ocr',
    p_fields: [{ fieldKey: 'w2.box1_wages', value, confidence: 0.9 }] });
  const id = (await db.pool.query(`SELECT id FROM taxguard_extracted_data WHERE tenant_id = $1 AND document_id = $2 AND document_version = $3`, [T, documentId, version])).rows[0].id;
  await rpc('taxguard_doc_verify_extraction', { p_tenant: T, p_client: C, p_actor: 'tc-rev', p_field: id, p_decision: 'ACCEPTED', p_value: null });
  return id as string;
}
async function approvedRun(value: string, evidence: string) {
  as('tc-prep');
  const run = await call('POST', `/cases/${caseId}/runs`, { ruleSetId, inputs: [{ factPath: 'synthetic.income_a', value, evidenceIds: [evidence] }] });
  expect(run.status, run.body?.code).toBe(201);
  as('tc-rev'); expect((await call('POST', `/runs/${run.body.run_id}/approve`, { note: 'Synthetic inputs traced to evidence' })).body.status).toBe('REVIEW_APPROVED');
  return run.body.run_id as string;
}
const links = (field: string, run: string) => [{ type: 'EVIDENCE', ref: `extraction:${field}` }, { type: 'EVIDENCE', ref: 'document:tc-w2' },
  { type: 'CALCULATION', ref: run }, { type: 'RESEARCH', ref: memo }];
const propose = (body: unknown) => { as('tc-prep'); return call('POST', `/cases/${caseId}/conclusions`, body); };
const BODY = { type: 'INCOME_INCLUSION', statement: 'Synthetic wages are included in income for the year.', amount: '5000.00' };

beforeAll(async () => {
  db = await startDatabase();  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic conclusions practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'tc-client', 'Synthetic Conclusion Client'), ('${T}', '${C2}', 'tc-client-2', 'Other Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ('${T}', 'tc-mgr', 'practice_manager', 'active', NULL), ('${T}', 'tc-prep', 'accountant', 'active', NULL),
      ('${T}', 'tc-rev', 'reviewer', 'active', NULL), ('${T}', 'tc-out', 'accountant', 'active', NULL), ('${T}', 'tc-client', 'client', 'active', '${C}'),
      ('${T2}', 'tc-foreign', 'practice_manager', 'active', NULL);`);
  const practice = new PracticeStore(pgRpc(db.pool));
  engagementId = (await practice.createEngagement(T, C, 'tc-mgr', 'tc-engagement-1', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'tc-mgr', engagementId, 'active', 1);
  for (const [role, userId] of [['preparer', 'tc-prep'], ['reviewer', 'tc-rev']])
    await practice.assign(T, C, 'tc-mgr', `tc-assign-${role}`, { engagementId, taxYear: 2025, role, userId, reason: 'Synthetic staffing' });
  caseId = (await new CaseStore(pgRpc(db.pool)).create(T, C, 'tc-mgr', 'tc-case-key-1', { engagementId, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  const otherEngagement = (await practice.createEngagement(T, C2, 'tc-mgr', 'tc-engagement-2', { title: 'Other 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C2, 'tc-mgr', otherEngagement, 'active', 1);
  for (const [role, userId] of [['preparer', 'tc-prep'], ['reviewer', 'tc-rev']])
    await practice.assign(T, C2, 'tc-mgr', `tc-assign-other-${role}`, { engagementId: otherEngagement, taxYear: 2025, role, userId, reason: 'Synthetic staffing' });
  otherCaseId = (await new CaseStore(pgRpc(db.pool)).create(T, C2, 'tc-mgr', 'tc-case-key-2', { engagementId: otherEngagement, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  const app = express();
  app.use('/tax', createTaxEngineRouter({ store: () => new TaxEngineStore(pgRpc(db.pool)), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  // Approved synthetic rule set and source, through the maker-checker path.
  as('tc-prep');
  expect((await call('POST', '/sources', { sourceId: SYNTHETIC_SOURCE_ID, jurisdiction: 'state', jurisdictionCode: 'ZZ', authorityType: 'synthetic_test',
    title: 'Synthetic fixture source (not tax law)', issuer: 'Synthetic test issuer', citation: 'Synthetic fixture', taxYears: [2025] })).status).toBe(201);
  as('tc-rev'); await call('POST', `/sources/${SYNTHETIC_SOURCE_ID}/verify`, { documentSha256: 'a'.repeat(64) });
  as('tc-prep'); ruleSetId = (await call('POST', '/rule-sets', { definition: syntheticRuleSet() })).body.ruleSetId;
  for (const [filingStatus, expected] of [[undefined, { synthetic_base: '4000.00', synthetic_amount: '290.00' }], ['synthetic_joint', { synthetic_base: '3000.00', synthetic_amount: '217.50' }]] as const)
    await call('POST', `/rule-sets/${ruleSetId}/tests`, { name: 'Synthetic example ' + (filingStatus ?? 'single'), sourceId: SYNTHETIC_SOURCE_ID, citation: 'Synthetic fixture example',
      ...(filingStatus ? { filingStatus } : {}), inputs: [{ factPath: 'synthetic.income_a', value: '5000.00', evidenceIds: ['doc:rule-test-fixture'] }], expected });
  await call('POST', `/rule-sets/${ruleSetId}/run-tests`); await call('POST', `/rule-sets/${ruleSetId}/submit`);
  as('tc-rev'); expect((await call('POST', `/rule-sets/${ruleSetId}/approve`)).body.status).toBe('APPROVED');
  // Evidence: a reviewed W-2 with one decided and one undecided extraction; an approved run; approved research.
  await doc('tc-w2', 1, 'VERIFIED');
  field1 = await decidedField('tc-w2', 1, '5000.00');
  await rpc('taxguard_doc_propose_extraction', { p_tenant: T, p_client: C, p_document_id: 'tc-w2', p_version: 1, p_provider: 'synthetic-ocr',
    p_fields: [{ fieldKey: 'w2.box2_withheld', value: '400.00', confidence: 0.5 }] });
  undecided = (await db.pool.query(`SELECT id FROM taxguard_extracted_data WHERE tenant_id = $1 AND field_key = 'w2.box2_withheld'`, [T])).rows[0].id;
  run1 = await approvedRun('5000.00', `extraction:${field1}`);
  as('tc-prep'); memo = (await call('POST', `/cases/${caseId}/research`, { question: 'Are the synthetic wages includible in income?' })).body.memo_id;
  expect((await call('POST', `/research/${memo}/citations`, { authorityLevel: 'AUTHORITATIVE', sourceId: SYNTHETIC_SOURCE_ID, note: 'Synthetic section relied on' })).status).toBe(201);
  const submitted = await call('POST', `/research/${memo}/submit`, { conclusion: 'Synthetic wages are includible under the synthetic source.', version: 1 });
  as('tc-rev'); expect((await call('POST', `/research/${memo}/approve`, { note: 'Synthetic research reviewed', version: submitted.body.version })).body.status).toBe('APPROVED');
}, 240_000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await db?.stop(); });

describe('tax conclusions are built only on verified, scoped sources', () => {
  it('refuses a conclusion without evidence, on an undecided proposal, on another case\'s run, or by anyone but the preparer', async () => {
    expect((await propose({ ...BODY, links: [{ type: 'CALCULATION', ref: run1 }] })).body.code).toBe('TAX_CONCLUSION_EVIDENCE_REQUIRED');
    expect((await propose({ ...BODY, links: [{ type: 'EVIDENCE', ref: `extraction:${undecided}` }] })).body)
      .toEqual({ code: 'TAX_CONCLUSION_SOURCE_UNRESOLVED', detail: `EVIDENCE|extraction:${undecided}|NOT_DECIDED` });
    as('tc-prep'); const foreignRun = (await call('POST', `/cases/${otherCaseId}/runs`, { ruleSetId, inputs: [{ factPath: 'synthetic.income_a', value: '1.00', evidenceIds: ['document:none-here'] }] }));
    expect(foreignRun.body.code).toBe('TAX_CALC_EVIDENCE_UNRESOLVED');
    expect((await propose({ ...BODY, links: [{ type: 'EVIDENCE', ref: 'document:tc-w2' }, { type: 'CALCULATION', ref: '00000000-0000-4000-8000-000000000000' }] })).body.detail)
      .toBe('CALCULATION|00000000-0000-4000-8000-000000000000|NOT_FOUND');
    expect((await propose({ ...BODY, type: 'GUESS', links: links(field1, run1) })).body.code).toBe('TAX_CONCLUSION_INPUT_INVALID');
    as('tc-rev'); expect((await call('POST', `/cases/${caseId}/conclusions`, { ...BODY, links: links(field1, run1) })).body.code).toBe('TAX_CONCLUSION_PREPARER_REQUIRED');
    expect((await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_tax_conclusions WHERE tenant_id = $1`, [T])).rows[0].n).toBe(0);
  });

  it('the preparer proposes and submits; only the independent reviewer approves; every step is audited', async () => {
    const proposed = await propose({ ...BODY, links: links(field1, run1) });
    expect(proposed.status, proposed.body?.code).toBe(201);
    expect(proposed.body).toMatchObject({ version: 1, status: 'DRAFT', type: 'INCOME_INCLUSION', amount: '5000.00', stale: [], returnUse: 'BLOCKED' });
    conclusion1 = proposed.body.conclusionId;
    expect(proposed.body.links.map((l: any) => l.type)).toEqual(['CALCULATION', 'EVIDENCE', 'EVIDENCE', 'RESEARCH']);
    as('tc-rev'); expect((await call('POST', `/conclusions/${conclusion1}/approve`, {})).body.code).toBe('TAX_CONCLUSION_NOT_SUBMITTED');
    as('tc-prep'); expect((await call('POST', `/conclusions/${conclusion1}/submit`)).body.status).toBe('READY_FOR_REVIEW');
    expect((await call('POST', `/conclusions/${conclusion1}/approve`, {})).body.code).toBe('TAX_CONCLUSION_REVIEWER_REQUIRED');
    as('tc-rev'); expect((await call('POST', `/conclusions/${conclusion1}/return`, { note: 'short' })).body.code).toBe('TAX_CONCLUSION_INPUT_INVALID');
    expect((await call('POST', `/conclusions/${conclusion1}/approve`, {})).body).toMatchObject({ status: 'APPROVED', reviewedBy: 'tc-rev' });
    as('tc-mgr'); expect((await call('GET', `/cases/${caseId}/conclusions/readiness`)).body).toMatchObject({ ready: true, conclusions: 1, blockers: [] });
    const audit = (await db.pool.query(`SELECT action, actor_uid FROM taxguard_audit_log WHERE tenant_id = $1 AND action LIKE 'TAX_CONCLUSION_%' ORDER BY "timestamp"`, [T])).rows;
    expect(audit).toEqual([{ action: 'TAX_CONCLUSION_PROPOSED', actor_uid: 'tc-prep' }, { action: 'TAX_CONCLUSION_SUBMITTED', actor_uid: 'tc-prep' },
      { action: 'TAX_CONCLUSION_APPROVED', actor_uid: 'tc-rev' }]);
  });

  it('traces a conclusion back to its rule, authority, verified evidence and documents, and evidence forward to the conclusion', async () => {
    as('tc-rev');
    const trace = (await call('GET', `/conclusions/${conclusion1}/trace`)).body;
    const by = (type: string) => trace.sources.filter((s: any) => s.type === type);
    expect(by('CALCULATION')[0]).toMatchObject({ ref: run1, current: { status: 'REVIEW_APPROVED', ruleSetId }, detail: { outputs: { synthetic_amount: '290.00' } } });
    expect(by('CALCULATION')[0].detail.inputs[0]).toMatchObject({ ref: `extraction:${field1}`, resolution: { kind: 'EXTRACTION', documentId: 'tc-w2', documentVersion: 1 } });
    expect(by('RESEARCH')[0].detail.citations).toEqual([{ authorityLevel: 'AUTHORITATIVE', sourceId: SYNTHETIC_SOURCE_ID, reference: null }]);
    expect(by('EVIDENCE').map((s: any) => [s.ref, s.current.documentVersion, s.current.documentSha256])).toEqual([
      ['document:tc-w2', 1, '1'.repeat(64)], [`extraction:${field1}`, 1, '1'.repeat(64)]]);
    expect(trace.versions).toEqual([expect.objectContaining({ version: 1, status: 'APPROVED', reviewedBy: 'tc-rev' })]);
    expect(trace.audit.map((a: any) => a.action)).toEqual(['TAX_CONCLUSION_PROPOSED', 'TAX_CONCLUSION_SUBMITTED', 'TAX_CONCLUSION_APPROVED']);
    expect(trace.formLines).toEqual([]);
    const forward = (await call('GET', `/cases/${caseId}/evidence-trace?ref=extraction:${field1}`)).body;
    expect(forward).toMatchObject({ calculationRuns: [run1], conclusions: [{ conclusionId: conclusion1, version: 1, status: 'APPROVED', via: 'EVIDENCE', stale: [] }] });
    expect((await call('GET', `/cases/${caseId}/evidence-trace?ref=not-evidence`)).body.code).toBe('TAX_CONCLUSION_INPUT_INVALID');
  });

  it('is isolated by tenant, client, case assignment and role', async () => {
    as('tc-out'); expect((await call('GET', `/conclusions/${conclusion1}/trace`)).body).toEqual({ code: 'TAX_CONCLUSION_NOT_FOUND' });
    expect((await call('GET', `/cases/${caseId}/conclusions`)).status).toBe(404);
    as('tc-foreign', T2); expect((await call('GET', `/conclusions/${conclusion1}/trace`)).body).toEqual({ code: 'TAX_CONCLUSION_NOT_FOUND' });
    as('tc-client'); expect((await call('GET', `/conclusions/${conclusion1}/trace`)).status).toBe(403);
    as('tc-mgr'); expect((await call('GET', `/conclusions/${conclusion1}/trace`)).body.conclusion.conclusionId).toBe(conclusion1);
    expect((await call('GET', '/conclusions/not-a-uuid/trace')).status).toBe(404);
    // Another client's evidence never links to this case, and this case's conclusions never list on the other case.
    await doc('tc-other-doc', 1, 'VERIFIED', C2);
    expect((await propose({ ...BODY, links: [{ type: 'EVIDENCE', ref: 'document:tc-other-doc' }] })).body.detail).toBe('EVIDENCE|document:tc-other-doc|NOT_FOUND');
    as('tc-prep'); expect((await call('GET', `/cases/${otherCaseId}/conclusions`)).body.items).toEqual([]);
  });

  it('a replaced source document makes the conclusion stale: approval and readiness are refused until it is revised and re-approved', async () => {
    await doc('tc-w2', 2, 'PENDING_REVIEW');
    as('tc-rev');
    const stale = (await call('GET', `/conclusions/${conclusion1}/trace`)).body.conclusion;
    expect(stale.status).toBe('APPROVED'); // nothing is changed silently
    expect(stale.stale.map((s: any) => [s.type, s.reason])).toEqual([['CALCULATION', 'CALCULATION_EVIDENCE_STALE'], ['EVIDENCE', 'DOCUMENT_NOT_REVIEWED'], ['EVIDENCE', 'DOCUMENT_SUPERSEDED']]);
    // document: resolves to the latest version (awaiting review); extraction: stays pinned to the replaced version 1.
    expect((await call('GET', `/cases/${caseId}/conclusions/readiness`)).body).toMatchObject({ ready: false, blockers: [{ conclusionId: conclusion1, reasons: ['STALE'] }] });
    expect((await call('GET', `/cases/${caseId}/evidence-trace?ref=document:tc-w2`)).body.conclusions[0].stale).toHaveLength(3);
    // Revising on the replaced sources is refused; the new version must cite revalidated evidence.
    as('tc-prep'); expect((await call('POST', `/conclusions/${conclusion1}/revise`, { links: links(field1, run1) })).body.code).toBe('TAX_CONCLUSION_SOURCE_UNRESOLVED');
    await db.pool.query(`UPDATE taxguard_documents SET status = 'VERIFIED' WHERE tenant_id = $1 AND document_id = 'tc-w2' AND version = 2`, [T]);
    const field2 = await decidedField('tc-w2', 2, '5200.00');
    const run2 = await approvedRun('5200.00', `extraction:${field2}`);
    as('tc-prep');
    const revised = await call('POST', `/conclusions/${conclusion1}/revise`, { amount: '5200.00', links: links(field2, run2) });
    expect(revised.status, revised.body?.code).toBe(201);
    expect(revised.body).toMatchObject({ version: 2, supersedesId: conclusion1, status: 'DRAFT', amount: '5200.00', stale: [] });
    expect((await call('POST', `/conclusions/${conclusion1}/revise`, { links: links(field2, run2) })).body.code).toBe('TAX_CONCLUSION_NOT_REVISABLE');
    expect((await call('POST', `/conclusions/${revised.body.conclusionId}/submit`)).body.status).toBe('READY_FOR_REVIEW');
    as('tc-rev'); expect((await call('POST', `/conclusions/${revised.body.conclusionId}/approve`, {})).body.status).toBe('APPROVED');
    expect((await call('GET', `/cases/${caseId}/conclusions/readiness`)).body).toMatchObject({ ready: true, conclusions: 1 });
    const history = (await call('GET', `/conclusions/${revised.body.conclusionId}/trace`)).body;
    expect(history.versions.map((v: any) => [v.version, v.status])).toEqual([[1, 'SUPERSEDED'], [2, 'APPROVED']]);
    expect(history.audit.map((a: any) => a.action)).toEqual(['TAX_CONCLUSION_PROPOSED', 'TAX_CONCLUSION_SUBMITTED', 'TAX_CONCLUSION_APPROVED',
      'TAX_CONCLUSION_REVISED', 'TAX_CONCLUSION_SUBMITTED', 'TAX_CONCLUSION_APPROVED']);
    // The superseded version keeps the links it was approved on.
    expect((await call('GET', `/conclusions/${conclusion1}/trace`)).body.conclusion.links.find((l: any) => l.ref === `extraction:${field1}`).snapshot.documentVersion).toBe(1);
  });

  it('a stale draft cannot be submitted; history, links and form lines are immutable and private', async () => {
    await doc('tc-1099', 1, 'VERIFIED');
    const draft = (await propose({ type: 'OTHER', statement: 'Synthetic interest is reported for the year.', links: [{ type: 'EVIDENCE', ref: 'document:tc-1099' }] })).body;
    await doc('tc-1099', 2, 'VERIFIED');
    as('tc-prep'); const refused = await call('POST', `/conclusions/${draft.conclusionId}/submit`);
    expect(refused.body.code).toBe('TAX_CONCLUSION_STALE');
    expect(JSON.parse(refused.body.detail)).toEqual([{ type: 'EVIDENCE', ref: 'document:tc-1099', reason: 'SOURCE_CHANGED' }]);
    for (const sql of [`UPDATE taxguard_tax_conclusions SET statement = 'Edited synthetic statement' WHERE tenant_id = '${T}'`, `DELETE FROM taxguard_tax_conclusions WHERE tenant_id = '${T}'`,
      `UPDATE taxguard_tax_conclusion_links SET ref = 'x' WHERE tenant_id = '${T}'`, `DELETE FROM taxguard_tax_conclusion_links WHERE tenant_id = '${T}'`,
      'TRUNCATE taxguard_tax_conclusions CASCADE', 'TRUNCATE taxguard_tax_conclusion_links'])
      await expect(db.pool.query(sql), sql).rejects.toThrow('TAX_CONCLUSION_HISTORY_IMMUTABLE');
    for (const table of ['taxguard_tax_conclusions', 'taxguard_tax_conclusion_links', 'taxguard_tax_form_line_sources'])
      for (const role of ['anon', 'authenticated', 'service_role'])
        expect((await db.pool.query(`SELECT has_table_privilege($1, $2, 'SELECT') OR has_table_privilege($1, $2, 'INSERT') AS ok`, [role, 'public.' + table])).rows[0].ok, `${role} ${table}`).toBe(false);
    for (const fn of ['taxguard_tax_conclusion_stale(text,uuid)', 'taxguard_tax_conclusion_source(taxguard_cases,text,text)', 'taxguard_tax_conclusion_link_all(taxguard_cases,uuid,jsonb)'])
      expect((await db.pool.query(`SELECT has_function_privilege('service_role', $1, 'EXECUTE') AS ok`, ['public.' + fn])).rows[0].ok, fn).toBe(false);
  });
});

// Book-to-tax workpapers through their own maker-checker workflow (20261012290000, 20261018070000): approving a newer
// workpaper for the same client, year and return family supersedes the approved one.
const b2t = (fn: string, actor: string, extra: Record<string, unknown>) => rpc(fn, { p_tenant: T, p_client: C, p_actor: actor, ...extra });
async function approvedWorkpaper() {
  const id = (await b2t('taxguard_b2t_generate_workpaper', 'tc-prep', { p_year: 2025, p_family: '1040', p_case: caseId })).workpaperId as string;
  expect((await b2t('taxguard_b2t_review_workpaper', 'tc-rev', { p_workpaper: id, p_approve: true, p_note: null })).status).toBe('APPROVED');
  return id;
}
let currentWorkpaper = '';
const workpaperStatus = async (id: string) => (await db.pool.query(`SELECT status FROM taxguard_b2t_workpapers WHERE tenant_id = $1 AND workpaper_id = $2`, [T, id])).rows[0].status;

describe('a superseded workpaper makes the conclusions built on it stale', () => {
  it('approved on a workpaper, stale once a newer workpaper is approved; revised on the new one and re-approved; history kept', async () => {
    const set = (await b2t('taxguard_b2t_open_set', 'tc-prep', { p_year: 2025, p_family: '1040' })).setId;
    await b2t('taxguard_b2t_review_set', 'tc-prep', { p_set: set, p_action: 'submit', p_note: null });
    await b2t('taxguard_b2t_review_set', 'tc-rev', { p_set: set, p_action: 'approve', p_note: null });
    const wp1 = await approvedWorkpaper();
    await doc('tc-wp-doc', 1, 'VERIFIED');
    const wpLinks = (wp: string) => [{ type: 'EVIDENCE', ref: 'document:tc-wp-doc' }, { type: 'WORKPAPER', ref: wp }];
    const make = async () => { const k = (await propose({ type: 'OTHER', statement: 'Synthetic book-to-tax groupings are carried to the return.', links: wpLinks(wp1) })).body;
      expect(k, k.code).toMatchObject({ status: 'DRAFT', stale: [] }); return k.conclusionId as string; };
    // One approved, one awaiting review and one draft, all on workpaper 1.
    const approved = await make(), pending = await make(), draft = await make();
    as('tc-prep'); for (const id of [approved, pending]) expect((await call('POST', `/conclusions/${id}/submit`)).body.status).toBe('READY_FOR_REVIEW');
    as('tc-rev'); expect((await call('POST', `/conclusions/${approved}/approve`, {})).body).toMatchObject({ status: 'APPROVED', stale: [] });
    const snapshot = (await call('GET', `/conclusions/${approved}/trace`)).body.sources.find((s: any) => s.type === 'WORKPAPER');
    expect(snapshot).toMatchObject({ ref: wp1, snapshot: { workpaperId: wp1, status: 'APPROVED', returnFamily: '1040' }, current: { workpaperId: wp1, status: 'APPROVED' } });

    // The normal workflow replaces workpaper 1: a newer workpaper is generated and approved by the independent reviewer.
    const wp2 = await approvedWorkpaper(); currentWorkpaper = wp2;
    expect(await workpaperStatus(wp1)).toBe('SUPERSEDED');
    as('tc-rev');
    const reloaded = (await call('GET', `/conclusions/${approved}/trace`)).body;
    expect(reloaded.conclusion.status).toBe('APPROVED'); // nothing is changed silently
    expect(reloaded.conclusion.stale).toEqual([{ type: 'WORKPAPER', ref: wp1, reason: 'WORKPAPER_SUPERSEDED' }]);
    expect((await call('GET', `/cases/${caseId}/conclusions/readiness`)).body.blockers).toEqual(expect.arrayContaining([
      { conclusionId: approved, version: 1, status: 'APPROVED', reasons: ['STALE'] }]));
    // Approval, submission and a new conclusion on the superseded workpaper are all refused.
    const approval = await call('POST', `/conclusions/${pending}/approve`, {});
    expect(approval.body.code).toBe('TAX_CONCLUSION_STALE');
    expect(JSON.parse(approval.body.detail)).toEqual([{ type: 'WORKPAPER', ref: wp1, reason: 'WORKPAPER_SUPERSEDED' }]);
    as('tc-prep'); expect((await call('POST', `/conclusions/${draft}/submit`)).body.code).toBe('TAX_CONCLUSION_STALE');
    expect((await propose({ type: 'OTHER', statement: 'Synthetic book-to-tax groupings are carried to the return.', links: wpLinks(wp1) })).body)
      .toEqual({ code: 'TAX_CONCLUSION_SOURCE_UNRESOLVED', detail: `WORKPAPER|${wp1}|WORKPAPER_SUPERSEDED` });
    expect((await call('POST', `/conclusions/${approved}/revise`, { links: wpLinks(wp1) })).body.code).toBe('TAX_CONCLUSION_SOURCE_UNRESOLVED');
    expect((await db.pool.query(`SELECT status FROM taxguard_tax_conclusions WHERE tenant_id = $1 AND conclusion_id = ANY($2::uuid[]) ORDER BY created_at`,
      [T, [approved, pending, draft]])).rows.map(r => r.status)).toEqual(['APPROVED', 'READY_FOR_REVIEW', 'DRAFT']);

    // Controlled revision on the current workpaper, then independent review.
    const revised = await call('POST', `/conclusions/${approved}/revise`, { links: wpLinks(wp2) });
    expect(revised.status, revised.body?.code).toBe(201);
    expect(revised.body).toMatchObject({ version: 2, supersedesId: approved, status: 'DRAFT', stale: [] });
    expect((await call('POST', `/conclusions/${revised.body.conclusionId}/submit`)).body.status).toBe('READY_FOR_REVIEW');
    expect((await call('POST', `/conclusions/${revised.body.conclusionId}/approve`, {})).body.code).toBe('TAX_CONCLUSION_REVIEWER_REQUIRED');
    as('tc-rev'); expect((await call('POST', `/conclusions/${revised.body.conclusionId}/approve`, {})).body).toMatchObject({ status: 'APPROVED', stale: [] });
    const history = (await call('GET', `/conclusions/${revised.body.conclusionId}/trace`)).body;
    expect(history.versions.map((v: any) => [v.version, v.status])).toEqual([[1, 'SUPERSEDED'], [2, 'APPROVED']]);
    expect(history.sources.find((s: any) => s.type === 'WORKPAPER')).toMatchObject({ ref: wp2, current: { workpaperId: wp2, status: 'APPROVED' } });
    // Version 1 keeps the workpaper it was approved on, and that workpaper is kept as SUPERSEDED.
    const v1 = (await call('GET', `/conclusions/${approved}/trace`)).body;
    expect(v1.conclusion.links.find((l: any) => l.type === 'WORKPAPER')).toMatchObject({ ref: wp1, snapshot: { workpaperId: wp1, status: 'APPROVED' } });
    expect(v1.sources.find((s: any) => s.type === 'WORKPAPER').current).toEqual({ unresolved: 'WORKPAPER_SUPERSEDED' });
    expect(await workpaperStatus(wp1)).toBe('SUPERSEDED');
    expect(v1.audit.map((a: any) => a.action)).toEqual(['TAX_CONCLUSION_PROPOSED', 'TAX_CONCLUSION_SUBMITTED', 'TAX_CONCLUSION_APPROVED',
      'TAX_CONCLUSION_REVISED', 'TAX_CONCLUSION_SUBMITTED', 'TAX_CONCLUSION_APPROVED']);
  });
});

describe('the full chain, backward from a form line and forward from the evidence', () => {
  it('form line → conclusion → calculation → rule → research → workpaper → evidence → extraction → document version', async () => {
    await doc('tc-chain-doc', 1, 'VERIFIED');
    const field = await decidedField('tc-chain-doc', 1, '6100.00');
    const run = await approvedRun('6100.00', `extraction:${field}`);
    const chainLinks = [{ type: 'EVIDENCE', ref: `extraction:${field}` }, { type: 'CALCULATION', ref: run }, { type: 'RESEARCH', ref: memo }, { type: 'WORKPAPER', ref: currentWorkpaper }];
    const k = (await propose({ ...BODY, amount: '6100.00', links: chainLinks })).body;
    expect(k, k.code).toMatchObject({ status: 'DRAFT', stale: [] });
    as('tc-prep'); await call('POST', `/conclusions/${k.conclusionId}/submit`);
    as('tc-rev'); expect((await call('POST', `/conclusions/${k.conclusionId}/approve`, {})).body.status).toBe('APPROVED');
    // Block 67 will write form lines; this proposal only stores them. A synthetic mapping row stands in for that writer.
    await db.pool.query(`INSERT INTO taxguard_tax_form_line_sources(tenant_id, case_id, form_id, form_version, line, conclusion_id, mapped_by)
      VALUES ($1, $2, 'SYN-1040', '2025.0', '1a', $3, 'tc-prep')`, [T, caseId, k.conclusionId]);
    const fromLine = (await db.pool.query(`SELECT conclusion_id FROM taxguard_tax_form_line_sources WHERE tenant_id = $1 AND case_id = $2 AND form_id = 'SYN-1040' AND line = '1a'`,
      [T, caseId])).rows.map(r => r.conclusion_id);
    expect(fromLine).toEqual([k.conclusionId]);
    const t = (await call('GET', `/conclusions/${fromLine[0]}/trace`)).body;
    const by = (type: string) => t.sources.find((s: any) => s.type === type);
    expect(t.formLines).toEqual([{ formId: 'SYN-1040', formVersion: '2025.0', line: '1a' }]);
    expect(by('CALCULATION')).toMatchObject({ ref: run, current: { status: 'REVIEW_APPROVED', ruleSetId }, detail: { inputs: [{ ref: `extraction:${field}`,
      resolution: { kind: 'EXTRACTION', documentId: 'tc-chain-doc', documentVersion: 1, documentSha256: '1'.repeat(64) } }] } });
    expect(by('CALCULATION').current.ruleSetSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(by('RESEARCH')).toMatchObject({ ref: memo, current: { status: 'APPROVED', authorityLevels: ['AUTHORITATIVE'] },
      detail: { citations: [{ authorityLevel: 'AUTHORITATIVE', sourceId: SYNTHETIC_SOURCE_ID }] } });
    expect(by('WORKPAPER')).toMatchObject({ ref: currentWorkpaper, current: { workpaperId: currentWorkpaper, status: 'APPROVED' } });
    expect(by('EVIDENCE')).toMatchObject({ ref: `extraction:${field}`, current: { kind: 'EXTRACTION', documentId: 'tc-chain-doc', documentVersion: 1, documentSha256: '1'.repeat(64) } });
    expect(t.versions).toEqual([expect.objectContaining({ version: 1, status: 'APPROVED', reviewedBy: 'tc-rev' })]);
    expect(t.audit.map((a: any) => [a.action, a.actorUid])).toEqual([['TAX_CONCLUSION_PROPOSED', 'tc-prep'], ['TAX_CONCLUSION_SUBMITTED', 'tc-prep'], ['TAX_CONCLUSION_APPROVED', 'tc-rev']]);
    // Forward: the evidence and the document lead to the run and this conclusion; replacing the document makes it stale.
    const forward = (await call('GET', `/cases/${caseId}/evidence-trace?ref=extraction:${field}`)).body;
    expect(forward.calculationRuns).toEqual([run]);
    expect(forward.conclusions).toEqual([expect.objectContaining({ conclusionId: k.conclusionId, via: 'EVIDENCE', stale: [] })]);
    await doc('tc-chain-doc', 2, 'PENDING_REVIEW');
    const after = (await call('GET', `/cases/${caseId}/evidence-trace?ref=extraction:${field}`)).body.conclusions[0];
    expect(after.stale.map((s: any) => [s.type, s.reason])).toEqual([['CALCULATION', 'CALCULATION_EVIDENCE_STALE'], ['EVIDENCE', 'DOCUMENT_SUPERSEDED']]);
    expect((await call('GET', `/cases/${caseId}/conclusions/readiness`)).body.blockers).toEqual(expect.arrayContaining([
      { conclusionId: k.conclusionId, version: 1, status: 'APPROVED', reasons: ['STALE'] }]));
  });
});

describe('staff authorized for the client in another tax year are refused', () => {
  it('2025 staff cannot read, trace or act on a 2026 conclusion of the same client; a named member moved to another year loses it', async () => {
    // A 2026 engagement and case of the same client, staffed for 2026 only; tc-prep and tc-rev hold 2025 assignments.
    await db.pool.query(`INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ('${T}', 'tc-prep26', 'accountant', 'active', NULL), ('${T}', 'tc-rev26', 'reviewer', 'active', NULL)`);
    const practice = new PracticeStore(pgRpc(db.pool));
    const eng26 = (await practice.createEngagement(T, C, 'tc-mgr', 'tc-engagement-2026', { title: 'Synthetic 2026 return', type: 'tax_preparation', taxYears: [2026] })).engagementId;
    await practice.setEngagementStatus(T, C, 'tc-mgr', eng26, 'active', 1);
    for (const [role, userId] of [['preparer', 'tc-prep26'], ['reviewer', 'tc-rev26']])
      await practice.assign(T, C, 'tc-mgr', `tc-assign-2026-${role}`, { engagementId: eng26, taxYear: 2026, role, userId, reason: 'Synthetic staffing' });
    const case26 = (await new CaseStore(pgRpc(db.pool)).create(T, C, 'tc-mgr', 'tc-case-key-2026', { engagementId: eng26, taxYear: 2026, returnFamily: '1040' }) as any).caseId as string;
    await db.pool.query(`INSERT INTO taxguard_documents(document_id, tenant_id, client_id, engagement_id, tax_year, case_id, version, hash, mime_type, status, quarantine_status, created_by)
      VALUES ('tc-2026-doc', $1, $2, $3, 2026, $4, 1, repeat('6', 64), 'application/pdf', 'VERIFIED', 'CLEAN', 'tc-client')`, [T, C, eng26, case26]);
    const body = { type: 'OTHER', statement: 'Synthetic 2026 interest is reported for the year.', links: [{ type: 'EVIDENCE', ref: 'document:tc-2026-doc' }] };
    as('tc-prep26');
    const k26 = (await call('POST', `/cases/${case26}/conclusions`, body)).body;
    expect(k26, k26.code).toMatchObject({ status: 'DRAFT', taxYear: 2026 });
    const pending26 = (await call('POST', `/cases/${case26}/conclusions`, body)).body.conclusionId as string;
    for (const id of [k26.conclusionId, pending26]) expect((await call('POST', `/conclusions/${id}/submit`)).body.status).toBe('READY_FOR_REVIEW');
    as('tc-rev26'); expect((await call('POST', `/conclusions/${k26.conclusionId}/approve`, {})).body.status).toBe('APPROVED');

    const refusedEverywhere = async (uid: string) => {
      as(uid);
      expect((await call('GET', `/conclusions/${k26.conclusionId}/trace`)).body, uid).toEqual({ code: 'TAX_CONCLUSION_NOT_FOUND' });
      for (const path of [`/cases/${case26}/conclusions`, `/cases/${case26}/conclusions/readiness`, `/cases/${case26}/evidence-trace?ref=document:tc-2026-doc`])
        expect((await call('GET', path)).status, `${uid} ${path}`).toBe(404);
      expect((await call('POST', `/cases/${case26}/conclusions`, body)).status, uid).toBe(404);
      for (const [path, payload] of [[`/conclusions/${pending26}/approve`, {}], [`/conclusions/${pending26}/return`, { note: 'Synthetic return note for tests' }],
        [`/conclusions/${pending26}/reject`, { note: 'Synthetic reject note for tests' }], [`/conclusions/${k26.conclusionId}/revise`, { links: body.links }]] as const)
        expect((await call('POST', path, payload)).body, `${uid} ${path}`).toEqual({ code: 'TAX_CONCLUSION_NOT_FOUND' });
    };
    await refusedEverywhere('tc-prep'); // 2025 preparer of the same client
    await refusedEverywhere('tc-rev');  // 2025 reviewer of the same client
    // The 2025 staff still reach their own year.
    as('tc-rev'); expect((await call('GET', `/conclusions/${conclusion1}/trace`)).body.conclusion.taxYear).toBe(2025);

    // The named 2026 reviewer's assignment is moved to 2025: they no longer reach the 2026 conclusion, server-side.
    await db.pool.query(`UPDATE taxguard_staff_assignments SET tax_year = 2025 WHERE tenant_id = $1 AND user_id = 'tc-rev26'`, [T]);
    await refusedEverywhere('tc-rev26');
    expect((await db.pool.query(`SELECT status, reviewed_by FROM taxguard_tax_conclusions WHERE tenant_id = $1 AND conclusion_id = $2`, [T, pending26])).rows[0])
      .toEqual({ status: 'READY_FOR_REVIEW', reviewed_by: null });
    as('tc-mgr'); expect((await call('GET', `/conclusions/${k26.conclusionId}/trace`)).body.conclusion.conclusionId).toBe(k26.conclusionId);
  });
});
