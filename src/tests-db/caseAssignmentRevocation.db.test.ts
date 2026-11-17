import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';
import { createCasesRouter } from '../server/routes/cases.routes';

// A case records its preparer and reviewer when it is created. Access must still follow the live assignment: a
// recorded name grants nothing unless that person holds, now, an ACTIVE, unexpired assignment of that role for the
// case's own client, engagement and tax year. This covers case detail and notes, stage actions, the case queue,
// status counts, the staff dashboard and tax calculation runs, over the database and over the case API. Managers
// and administrators are unaffected. Synthetic data only.
const T = 'tenantCaseRevoke', T2 = 'tenantCaseRevokeOther', C = 'crClient', C2 = 'crClient2';
let db: TestDatabase; let caseId = ''; let E = '', E2 = '', E3 = ''; let runId = '';
let practice: PracticeStore; let cases: CaseStore;
let server: Server; let origin = ''; let httpUser: any = null;
const code = (p: Promise<unknown>) => p.then(() => 'OK', (e: any) => e?.code ?? String(e));
const rpc = async (fn: string, args: Record<string, unknown>) => {
  const r = await pgRpc(db.pool).rpc(fn, args);
  if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.message });
  return r.data as any;
};
const assignmentId = async (user: string, role: string, engagement = E, year = 2025) => (await db.pool.query(`SELECT id FROM taxguard_staff_assignments
  WHERE tenant_id = $1 AND user_id = $2 AND role = $3 AND engagement_id = $4 AND tax_year = $5 AND status = 'ACTIVE'`, [T, user, role, engagement, year])).rows[0]?.id as string;
const queueIds = async (actor: string) => (await cases.queue(T, actor)).items.map((c: any) => c.caseId);
const counted = async (actor: string) => Object.values((await cases.statusReport(T, actor) as any).byStatus as Record<string, number>).reduce((n, v) => n + Number(v), 0);
const runs = (actor: string) => rpc('taxguard_tax_run_list', { p_tenant: T, p_actor: actor, p_case: caseId });
const reach = async (actor: string) => ({ detail: await code(cases.detail(T, caseId, actor)), note: await code(cases.addNote(T, caseId, actor, 'Synthetic case note text')),
  runs: await code(runs(actor)), queued: (await queueIds(actor)).includes(caseId), counted: (await counted(actor)) > 0,
  dashboard: JSON.stringify(await practice.myWork(T, actor)).includes(caseId) });
const full = { detail: 'OK', note: 'OK', runs: 'OK', queued: true, counted: true, dashboard: true };
const none = { detail: 'CASE_NOT_FOUND', note: 'CASE_NOT_FOUND', runs: 'TAX_CALC_CASE_NOT_FOUND', queued: false, counted: false, dashboard: false };
const http = async (uid: string, role: string, method: 'GET' | 'POST', path: string, body?: unknown) => {
  httpUser = { id: uid, role, tenantId: T, status: 'active' };
  const r = await fetch(origin + '/cases' + path, { method, headers: { 'content-type': 'application/json', 'idempotency-key': `cr-http-${Date.now()}-${Math.random()}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: r.status, body: await r.json().catch(() => null) };
};

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic case revocation practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'cr-client', 'Synthetic Case Client'), ('${T}', '${C2}', 'cr-client2', 'Other Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status) VALUES ('${T}', 'cr-mgr', 'practice_manager', 'active'), ('${T}', 'cr-admin', 'admin', 'active'),
      ('${T}', 'cr-prep', 'accountant', 'active'), ('${T}', 'cr-rev', 'reviewer', 'active'), ('${T}', 'cr-rev2', 'reviewer', 'active'), ('${T}', 'cr-other', 'accountant', 'active'),
      ('${T2}', 'cr-foreign', 'practice_manager', 'active');`);
  practice = new PracticeStore(pgRpc(db.pool)); cases = new CaseStore(pgRpc(db.pool));
  const engagement = async (client: string, key: string, years: number[]) => {
    const id = (await practice.createEngagement(T, client, 'cr-mgr', key, { title: 'Synthetic ' + key, type: 'tax_preparation', taxYears: years })).engagementId;
    await practice.setEngagementStatus(T, client, 'cr-mgr', id, 'active', 1);
    return id;
  };
  E = await engagement(C, 'cr-engagement', [2025, 2024]); E2 = await engagement(C, 'cr-engagement-2', [2025]); E3 = await engagement(C2, 'cr-engagement-c2', [2025]);
  await practice.assign(T, C, 'cr-mgr', 'cr-assign-preparer', { engagementId: E, taxYear: 2025, role: 'preparer', userId: 'cr-prep', reason: 'Initial staffing' });
  await practice.assign(T, C, 'cr-mgr', 'cr-assign-reviewer', { engagementId: E, taxYear: 2025, role: 'reviewer', userId: 'cr-rev', reason: 'Initial staffing' });
  await practice.assign(T, C2, 'cr-mgr', 'cr-assign-other', { engagementId: E3, taxYear: 2025, role: 'preparer', userId: 'cr-other', reason: 'Synthetic staffing' });
  caseId = (await cases.create(T, C, 'cr-mgr', 'cr-case-key-1', { engagementId: E, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  await cases.addNote(T, caseId, 'cr-rev', 'Synthetic reviewer note recorded before revocation');
  // A synthetic computed tax run awaiting the reviewer, and a case document (attachment).
  const ruleSet = (await db.pool.query(`INSERT INTO taxguard_tax_rule_sets(tenant_id, jurisdiction, jurisdiction_code, return_family, tax_year, version, definition, content_sha256,
      source_ids, synthetic, prepared_by) VALUES ($1, 'federal', 'US', '1040', 2025, 1, '{}'::jsonb, repeat('a', 64), '{}', true, 'cr-mgr') RETURNING rule_set_id`, [T])).rows[0].rule_set_id;
  runId = (await db.pool.query(`INSERT INTO taxguard_tax_calc_runs(tenant_id, client_id, case_id, tax_year, rule_set_id, rule_set_sha256, engine_version, input_sha256, output_sha256,
      inputs, outputs, trace, synthetic, requested_by) VALUES ($1, $2, $3, 2025, $4, repeat('a', 64), 'synthetic-1', repeat('b', 64), repeat('c', 64), '{}', '{}', '{}', true, 'cr-prep')
      RETURNING run_id`, [T, C, caseId, ruleSet])).rows[0].run_id;
  await db.pool.query(`INSERT INTO taxguard_documents(document_id, tenant_id, client_id, engagement_id, tax_year, case_id, version, hash, mime_type, status, quarantine_status, category,
      created_by, storage_path, file_name) VALUES ('cr-case-doc', $1, $2, $3, 2025, $4, 1, repeat('d', 64), 'application/pdf', 'VERIFIED', 'CLEAN', 'income', 'cr-prep',
      'vault/cr-case-doc', 'cr-case-doc.pdf')`, [T, C, E, caseId]);
  const app = express(); app.use(express.json());
  app.use('/cases', createCasesRouter({ store: () => cases, authenticate: (req: any, _res, next) => { req.user = httpUser; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 240_000);
afterAll(async () => {
  server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r());
  await db?.stop();
});

const docs = (actor: string) => rpc('taxguard_doc_list', { p_tenant: T, p_client: C, p_actor: actor, p_tax_year: null });

describe('case access follows the live preparer and reviewer assignments', () => {
  it('the assigned preparer and reviewer reach the case, its notes, runs and attachments', async () => {
    expect(await reach('cr-prep')).toEqual(full);
    expect(await reach('cr-rev')).toEqual(full);
    expect(JSON.stringify(await cases.detail(T, caseId, 'cr-prep'))).toContain('Synthetic reviewer note recorded before revocation');
    expect((await docs('cr-rev')).map((d: any) => d.documentId)).toContain('cr-case-doc');
    expect((await http('cr-rev', 'reviewer', 'GET', `/${caseId}`)).status).toBe(200);
  });

  it('other-client and other-tenant staff never reach the case', async () => {
    expect(await reach('cr-other')).toEqual(none);
    expect(await code(cases.detail(T2, caseId, 'cr-foreign'))).not.toBe('OK');
    expect(await code(cases.detail(T, caseId, 'cr-foreign'))).not.toBe('OK');
    expect(await code(rpc('taxguard_tax_run_list', { p_tenant: T2, p_actor: 'cr-foreign', p_case: caseId }))).not.toBe('OK');
  });

  it('revoking the reviewer assignment ends access at once, over the database and the case API', async () => {
    await practice.unassign(T, C, 'cr-mgr', await assignmentId('cr-rev', 'reviewer'), 'Synthetic reassignment');
    expect(await reach('cr-rev')).toEqual(none);
    expect(await code(rpc('taxguard_tax_run_review', { p_tenant: T, p_actor: 'cr-rev', p_run: runId, p_decision: 'approve', p_note: 'Synthetic inputs traced to evidence' })))
      .toBe('TAX_CALC_REVIEWER_REQUIRED');
    expect((await db.pool.query(`SELECT status FROM taxguard_tax_calc_runs WHERE run_id = $1`, [runId])).rows[0].status).toBe('COMPUTED');
    // Block 79: recording a run and reading a run's evidence lineage follow the live assignment too (the access check
    // comes first, so the refusal is the not-found code whatever the run body says).
    const runCount = async () => (await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_tax_calc_runs WHERE tenant_id = $1 AND case_id = $2`, [T, caseId])).rows[0].n;
    const before = await runCount();
    expect(await code(rpc('taxguard_tax_run_record', { p_tenant: T, p_actor: 'cr-rev', p_case: caseId,
      p_run: { ruleSetId: '0123abcd-0000-4000-8000-000000000001', ruleSetSha256: 'a'.repeat(64) } }))).toBe('TAX_CALC_CASE_NOT_FOUND');
    expect(await runCount()).toBe(before);
    expect(await code(rpc('taxguard_tax_run_lineage', { p_tenant: T, p_actor: 'cr-rev', p_run: runId }))).toBe('TAX_CALC_RUN_NOT_FOUND');
    expect(await code(cases.setHold(T, caseId, 'cr-rev', true, 1, 'Synthetic hold attempt'))).toBe('CASE_NOT_FOUND');
    expect(await code(cases.returnTo(T, caseId, 'cr-rev', 1, 1, 'Synthetic return attempt'))).toBe('CASE_NOT_FOUND');
    expect(await code(docs('cr-rev'))).toBe('DOCUMENT_NOT_FOUND');
    const api = await http('cr-rev', 'reviewer', 'GET', `/${caseId}`);
    expect(api.status).toBe(404);
    expect(JSON.stringify(api.body)).not.toContain('Synthetic reviewer note');
    expect((await http('cr-rev', 'reviewer', 'POST', `/${caseId}/notes`, { body: 'Synthetic note after revocation' })).status).toBe(404);
    expect((await http('cr-rev', 'reviewer', 'GET', '/')).body.items.map((c: any) => c.caseId)).not.toContain(caseId);
    // The preparer, the manager and an administrator are unaffected, and still see the earlier notes.
    expect(await reach('cr-prep')).toEqual(full);
    for (const who of ['cr-mgr', 'cr-admin']) {
      expect(JSON.stringify(await cases.detail(T, caseId, who)), who).toContain('Synthetic reviewer note recorded before revocation');
      expect(await queueIds(who), who).toContain(caseId);
      expect(await code(runs(who)), who).toBe('OK');
      expect(await code(rpc('taxguard_tax_run_lineage', { p_tenant: T, p_actor: who, p_run: runId })), who).toBe('OK');
    }
  });

  it('assignments for another tax year or another engagement do not restore access', async () => {
    await practice.assign(T, C, 'cr-mgr', 'cr-assign-reviewer-2024', { engagementId: E, taxYear: 2024, role: 'reviewer', userId: 'cr-rev', reason: 'Synthetic staffing' });
    await practice.assign(T, C, 'cr-mgr', 'cr-assign-reviewer-e2', { engagementId: E2, taxYear: 2025, role: 'reviewer', userId: 'cr-rev', reason: 'Synthetic staffing' });
    expect(await reach('cr-rev')).toEqual(none);
  });

  it('reassigning the role to another person gives neither the former nor the recorded name access through the case fields', async () => {
    await practice.assign(T, C, 'cr-mgr', 'cr-assign-reviewer-new', { engagementId: E, taxYear: 2025, role: 'reviewer', userId: 'cr-rev2', reason: 'Synthetic restaffing' });
    expect(await reach('cr-rev')).toEqual(none);
    // The replacement is not the case's recorded reviewer; restaffing the case itself is a separate, reviewed operation.
    expect(await reach('cr-rev2')).toEqual(none);
    expect(await code(cases.detail(T, caseId, 'cr-mgr'))).toBe('OK');
  });

  it('an expired preparer assignment ends access; restoring the assignment restores it', async () => {
    await db.pool.query(`UPDATE taxguard_staff_assignments SET effective_to = now() - interval '1 second' WHERE tenant_id = $1 AND user_id = 'cr-prep'`, [T]);
    expect(await reach('cr-prep')).toEqual(none);
    expect((await http('cr-prep', 'accountant', 'GET', `/${caseId}`)).status).toBe(404);
    await db.pool.query(`UPDATE taxguard_staff_assignments SET status = 'REVOKED' WHERE tenant_id = $1 AND user_id = 'cr-prep'`, [T]);
    await practice.assign(T, C, 'cr-mgr', 'cr-assign-preparer-again', { engagementId: E, taxYear: 2025, role: 'preparer', userId: 'cr-prep', reason: 'Synthetic restaffing' });
    expect(await reach('cr-prep')).toEqual(full);
  });
});
