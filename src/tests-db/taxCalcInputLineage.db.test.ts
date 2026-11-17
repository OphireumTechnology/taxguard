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

// HTTP -> /api/tax-engine runs -> TaxEngineStore -> proposal 20261018190000 (review only) on real PostgreSQL with every
// proposal applied: each calculation input must cite durable evidence of the case (a decided extracted value whose value
// matches, or a reviewed document); approval re-resolves the citations and records an immutable lineage snapshot.
// SYNTHETIC sources, rule sets and documents only: nothing here is tax law.
const T = 'tenantCalcLineage', C = 'clnClient', C2 = 'clnOther';
const roles: Record<string, string> = { 'cln-mgr': 'practice_manager', 'cln-prep': 'accountant', 'cln-rev': 'reviewer', 'cln-out': 'accountant' };
let db: TestDatabase; let caseId = '', engagementId = '', ruleSetId = '', fieldId = '', otherFieldId = '';
let server: Server; let origin = ''; let user: any = null;
const as = (uid: string) => { user = { id: uid, role: roles[uid], tenantId: T, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown) => fetch(origin + '/tax' + path, { method, headers: { 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).then(async r => ({ status: r.status, body: await r.json() as any }));
const rpc = async (fn: string, args: Record<string, unknown>) => { const r = await pgRpc(db.pool).rpc(fn, args); if (r.error) throw new Error(r.error.message); return r.data as any; };
// Documents of the case's engagement and year; another client's document belongs to that client's own engagement.
const doc = (id: string, version: number, status: string, client = C) => db.pool.query(`INSERT INTO taxguard_documents(document_id, tenant_id, client_id,
    engagement_id, tax_year, case_id, version, hash, mime_type, status, quarantine_status, created_by)
  VALUES ($1, $2, $3, $4, 2025, $5, $6, repeat($7, 64), 'application/pdf', $8, 'CLEAN', 'cln-client')`,
  [id, T, client, client === C ? engagementId : 'cln-foreign-engagement', client === C ? caseId : null, version, String(version), status]);
const inputs = (value: string, ...evidenceIds: string[]) => [{ factPath: 'synthetic.income_a', value, evidenceIds }];
const calculate = (value: string, ...evidenceIds: string[]) => { as('cln-prep'); return call('POST', `/cases/${caseId}/runs`, { ruleSetId, inputs: inputs(value, ...evidenceIds) }); };
const lineageRows = async (runId: string) => (await db.pool.query(`SELECT fact_path, evidence_ref, kind, resolution FROM taxguard_tax_calc_input_lineage WHERE run_id = $1`, [runId])).rows;

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic lineage practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'cln-client', 'Synthetic Lineage Client'),
      ('${T}', '${C2}', 'cln-other-client', 'Other Synthetic Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status) SELECT '${T}', k, v, 'active' FROM (VALUES ${Object.entries(roles).map(([k, v]) => `('${k}','${v}')`).join(',')}) x(k, v);`);
  const practice = new PracticeStore(pgRpc(db.pool));
  engagementId = (await practice.createEngagement(T, C, 'cln-mgr', 'cln-engagement-1', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'cln-mgr', engagementId, 'active', 1);
  await practice.assign(T, C, 'cln-mgr', 'cln-assign-preparer', { engagementId, taxYear: 2025, role: 'preparer', userId: 'cln-prep', reason: 'Synthetic staffing' });
  await practice.assign(T, C, 'cln-mgr', 'cln-assign-reviewer', { engagementId, taxYear: 2025, role: 'reviewer', userId: 'cln-rev', reason: 'Synthetic staffing' });
  caseId = (await new CaseStore(pgRpc(db.pool)).create(T, C, 'cln-mgr', 'cln-case-key-1', { engagementId, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  const app = express();
  app.use('/tax', createTaxEngineRouter({ store: () => new TaxEngineStore(pgRpc(db.pool)), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  // An approved synthetic rule set, through the same maker-checker path as production.
  as('cln-prep');
  expect((await call('POST', '/sources', { sourceId: SYNTHETIC_SOURCE_ID, jurisdiction: 'state', jurisdictionCode: 'ZZ', authorityType: 'synthetic_test',
    title: 'Synthetic fixture source (not tax law)', issuer: 'Synthetic test issuer', citation: 'Synthetic fixture', taxYears: [2025] })).status).toBe(201);
  as('cln-rev'); await call('POST', `/sources/${SYNTHETIC_SOURCE_ID}/verify`, { documentSha256: 'a'.repeat(64) });
  as('cln-prep');
  ruleSetId = (await call('POST', '/rule-sets', { definition: syntheticRuleSet() })).body.ruleSetId;
  for (const [filingStatus, expected] of [[undefined, { synthetic_base: '4000.00', synthetic_amount: '290.00' }], ['synthetic_joint', { synthetic_base: '3000.00', synthetic_amount: '217.50' }]] as const)
    expect((await call('POST', `/rule-sets/${ruleSetId}/tests`, { name: 'Synthetic worked example ' + (filingStatus ?? 'single'), sourceId: SYNTHETIC_SOURCE_ID,
      citation: 'Synthetic fixture example', ...(filingStatus ? { filingStatus } : {}), inputs: inputs('5000.00', 'doc:rule-test-fixture'), expected })).status).toBe(201);
  expect((await call('POST', `/rule-sets/${ruleSetId}/run-tests`)).body.allPassed).toBe(true);
  expect((await call('POST', `/rule-sets/${ruleSetId}/submit`)).body.status).toBe('PENDING_REVIEW');
  as('cln-rev'); expect((await call('POST', `/rule-sets/${ruleSetId}/approve`)).body.status).toBe('APPROVED');
  // Evidence: a reviewed W-2 with two OCR proposals, one accepted by staff and one still undecided.
  await doc('cln-w2', 1, 'VERIFIED');
  await rpc('taxguard_doc_propose_extraction', { p_tenant: T, p_client: C, p_document_id: 'cln-w2', p_version: 1, p_provider: 'synthetic-ocr',
    p_fields: [{ fieldKey: 'w2.box1_wages', value: '5000.00', confidence: 0.9 }, { fieldKey: 'w2.box2_withheld', value: '400.00', confidence: 0.5 }] });
  const fields = (await db.pool.query(`SELECT id, field_key FROM taxguard_extracted_data WHERE tenant_id = $1 AND document_id = 'cln-w2'`, [T])).rows;
  fieldId = fields.find(f => f.field_key === 'w2.box1_wages').id; otherFieldId = fields.find(f => f.field_key === 'w2.box2_withheld').id;
  await rpc('taxguard_doc_verify_extraction', { p_tenant: T, p_client: C, p_actor: 'cln-rev', p_field: fieldId, p_decision: 'ACCEPTED', p_value: null });
}, 240_000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await db?.stop(); });

describe('calculation inputs cite durable evidence', () => {
  it('refuses to record a run whose citations do not resolve, naming each input, citation and reason', async () => {
    await doc('cln-pending', 1, 'PENDING_REVIEW');
    await doc('cln-foreign', 1, 'VERIFIED', C2);
    const cases: Array<[string, string, string]> = [
      ['5000.00', 'doc:free-text', 'UNRECOGNISED_REFERENCE'],
      ['5000.00', 'extraction:00000000-0000-4000-8000-000000000000', 'NOT_FOUND'],
      ['400.00', `extraction:${otherFieldId}`, 'NOT_DECIDED'],
      ['5000.01', `extraction:${fieldId}`, 'VALUE_MISMATCH'],
      ['5000.00', 'document:cln-pending', 'DOCUMENT_NOT_REVIEWED'],
      ['5000.00', 'document:cln-foreign', 'NOT_FOUND'],
    ];
    for (const [value, ref, reason] of cases) {
      const r = await calculate(value, ref);
      expect(r, ref).toMatchObject({ status: 409, body: { code: 'TAX_CALC_EVIDENCE_UNRESOLVED', detail: `synthetic.income_a|${ref}|${reason}` } });
    }
    // One unresolved citation refuses the run even when another citation of the same input resolves.
    expect((await calculate('5000.00', `extraction:${fieldId}`, 'document:cln-pending')).body.detail).toBe('synthetic.income_a|document:cln-pending|DOCUMENT_NOT_REVIEWED');
    expect((await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_tax_calc_runs WHERE case_id = $1`, [caseId])).rows[0].n).toBe(0);
  });

  it('records a run citing a decided value (numerically equal), and shows its live lineage until approval', async () => {
    const run = await calculate('5000', `extraction:${fieldId}`);
    expect(run.status, run.body?.code).toBe(201);
    as('cln-prep');
    const live = (await call('GET', `/runs/${run.body.run_id}/lineage`)).body;
    expect(live).toMatchObject({ recorded: false, complete: true, status: 'COMPUTED', returnUse: 'BLOCKED' });
    expect(live.citations).toEqual([{ factPath: 'synthetic.income_a', value: '5000', ref: `extraction:${fieldId}`, resolution: { kind: 'EXTRACTION', fieldId,
      fieldKey: 'w2.box1_wages', decision: 'ACCEPTED', decidedValue: '5000.00', decidedBy: 'cln-rev', documentId: 'cln-w2', documentVersion: 1, documentSha256: '1'.repeat(64) } }]);
    // Managers read it; staff without the case do not, and a malformed id reads as not found.
    as('cln-mgr'); expect((await call('GET', `/runs/${run.body.run_id}/lineage`)).body.complete).toBe(true);
    as('cln-out'); expect((await call('GET', `/runs/${run.body.run_id}/lineage`)).body).toEqual({ code: 'TAX_CALC_RUN_NOT_FOUND' });
    expect((await call('GET', '/runs/not-a-run/lineage')).status).toBe(404);
  });

  it('approval re-resolves the citations: a superseded document refuses it and records nothing', async () => {
    const runId = (await calculate('5000', `extraction:${fieldId}`)).body.run_id; // replay of the recorded run
    await doc('cln-w2', 2, 'PENDING_REVIEW');
    as('cln-prep'); expect((await call('GET', `/runs/${runId}/lineage`)).body).toMatchObject({ complete: false,
      citations: [{ resolution: { unresolved: 'DOCUMENT_SUPERSEDED' } }] });
    as('cln-rev');
    expect((await call('POST', `/runs/${runId}/approve`, { note: 'Synthetic inputs traced to evidence' })).body)
      .toEqual({ code: 'TAX_CALC_EVIDENCE_UNRESOLVED', detail: `synthetic.income_a|extraction:${fieldId}|DOCUMENT_SUPERSEDED` });
    expect((await db.pool.query(`SELECT status FROM taxguard_tax_calc_runs WHERE run_id = $1`, [runId])).rows[0].status).toBe('COMPUTED');
    expect(await lineageRows(runId)).toEqual([]);
    // Rejection needs no evidence and records none.
    expect((await call('POST', `/runs/${runId}/reject`, { note: 'Source document was replaced' })).body).toMatchObject({ status: 'REVIEW_REJECTED', lineageRecorded: 0 });
    expect(await lineageRows(runId)).toEqual([]);
  });

  it('approval records an immutable snapshot that later document changes do not alter', async () => {
    await db.pool.query(`UPDATE taxguard_documents SET status = 'VERIFIED' WHERE tenant_id = $1 AND document_id = 'cln-w2' AND version = 2`, [T]);
    const run = await calculate('6000.00', 'document:cln-w2');
    expect(run.status, run.body?.code).toBe(201);
    as('cln-prep'); expect((await call('POST', `/runs/${run.body.run_id}/approve`, { note: 'Reviewing my own synthetic run' })).body.code).toBe('TAX_CALC_REVIEWER_REQUIRED');
    as('cln-rev');
    expect((await call('POST', `/runs/${run.body.run_id}/approve`, { note: 'Synthetic inputs traced to evidence' })).body)
      .toMatchObject({ status: 'REVIEW_APPROVED', lineageRecorded: 1, returnUse: 'BLOCKED' });
    const snapshot = { kind: 'DOCUMENT', documentId: 'cln-w2', documentVersion: 2, documentSha256: '2'.repeat(64) };
    expect(await lineageRows(run.body.run_id)).toEqual([{ fact_path: 'synthetic.income_a', evidence_ref: 'document:cln-w2', kind: 'DOCUMENT', resolution: snapshot }]);
    // A third version replaces the document; the approved run keeps what it was approved on.
    await doc('cln-w2', 3, 'PENDING_REVIEW');
    const recorded = (await call('GET', `/runs/${run.body.run_id}/lineage`)).body;
    expect(recorded).toMatchObject({ recorded: true, complete: true, status: 'REVIEW_APPROVED' });
    expect(recorded.citations).toEqual([expect.objectContaining({ factPath: 'synthetic.income_a', value: '6000.00', ref: 'document:cln-w2', resolution: snapshot, recordedBy: 'cln-rev' })]);
    await expect(db.pool.query(`UPDATE taxguard_tax_calc_input_lineage SET resolution = '{}' WHERE run_id = $1`, [run.body.run_id])).rejects.toThrow('TAX_CALC_LINEAGE_IMMUTABLE');
    await expect(db.pool.query(`DELETE FROM taxguard_tax_calc_input_lineage WHERE run_id = $1`, [run.body.run_id])).rejects.toThrow('TAX_CALC_LINEAGE_IMMUTABLE');
    const audit = (await db.pool.query(`SELECT metadata FROM taxguard_audit_log WHERE tenant_id = $1 AND action = 'TAX_CALC_APPROVED'`, [T])).rows;
    expect(audit.map(a => a.metadata.lineageRecorded)).toEqual([1]);
  });

  it('is not reachable by API roles directly', async () => {
    for (const fn of ['taxguard_tax_evidence_resolve(taxguard_cases,text,text)', 'taxguard_tax_run_citations(taxguard_cases,jsonb)', 'taxguard_tax_unresolved_citations(jsonb)'])
      for (const role of ['anon', 'authenticated', 'service_role'])
        expect((await db.pool.query(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS ok`, [role, 'public.' + fn])).rows[0].ok, `${role} ${fn}`).toBe(false);
    for (const role of ['anon', 'authenticated'])
      expect((await db.pool.query(`SELECT has_function_privilege($1, 'public.taxguard_tax_run_lineage(text,text,uuid)', 'EXECUTE') AS ok`, [role])).rows[0].ok).toBe(false);
    expect((await db.pool.query(`SELECT has_table_privilege('authenticated', 'public.taxguard_tax_calc_input_lineage', 'SELECT') AS ok`)).rows[0].ok).toBe(false);
  });
});
