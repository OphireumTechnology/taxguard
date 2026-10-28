import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';
import { createCasesRouter } from '../server/routes/cases.routes';

// Case-team restaffing (reviewed operation). Since proposal 20261018090000 a case's recorded preparer and reviewer
// count only while they hold the live assignment, so a replacement assignee could not act on an existing case.
// taxguard_case_restaff lets a practice manager or administrator move the case's preparer or reviewer to a person who
// holds the live assignment for that role, engagement and year, keeping segregation of duties, the case history and
// the audit trail. Synthetic data only.
const T = 'tenantCaseRestaff', T2 = 'tenantCaseRestaffOther', C = 'csClient';
let db: TestDatabase; let practice: PracticeStore; let cases: CaseStore; let E = ''; let caseId = '';
let server: Server; let origin = ''; let httpUser: any = null;
const code = (p: Promise<unknown>) => p.then(() => 'OK', (e: any) => e?.code ?? String(e));
const rpc = async (fn: string, args: Record<string, unknown>) => {
  const r = await pgRpc(db.pool).rpc(fn, args);
  if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.message });
  return r.data as any;
};
const caseRow = async () => (await db.pool.query(`SELECT preparer_uid, reviewer_uid, version FROM taxguard_cases WHERE tenant_id = $1 AND case_id = $2`, [T, caseId])).rows[0];
const restaff = async (actor: string, role: string, user: string, reason = 'Synthetic restaffing after reassignment', version?: number, tenant = T) =>
  rpc('taxguard_case_restaff', { p_tenant: tenant, p_case: caseId, p_actor: actor, p_role: role, p_user: user, p_version: version ?? (await caseRow()).version, p_reason: reason });
const assignmentId = async (user: string, role: string) => (await db.pool.query(`SELECT id FROM taxguard_staff_assignments
  WHERE tenant_id = $1 AND user_id = $2 AND role = $3 AND status = 'ACTIVE'`, [T, user, role])).rows[0]?.id as string;
const reassign = async (role: string, from: string, to: string) => {
  await practice.unassign(T, C, 'cs-mgr', await assignmentId(from, role), 'Synthetic reassignment');
  await practice.assign(T, C, 'cs-mgr', `cs-assign-${to}-${role}`, { engagementId: E, taxYear: 2025, role, userId: to, reason: 'Synthetic restaffing' });
};
const counts = async () => (await db.pool.query(`SELECT
    (SELECT count(*) FROM taxguard_case_stage_events WHERE tenant_id = $1 AND case_id = $2)::int AS events,
    (SELECT count(*) FROM taxguard_audit_log WHERE tenant_id = $1 AND action = 'CASE_TEAM_CHANGED')::int AS audits`, [T, caseId])).rows[0];

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic restaff practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'cs-client', 'Synthetic Restaff Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status) VALUES ('${T}', 'cs-mgr', 'practice_manager', 'active'), ('${T}', 'cs-admin', 'admin', 'active'),
      ('${T}', 'cs-prep', 'accountant', 'active'), ('${T}', 'cs-prep2', 'accountant', 'active'), ('${T}', 'cs-rev', 'reviewer', 'active'),
      ('${T}', 'cs-rev2', 'reviewer', 'active'), ('${T}', 'cs-rev3', 'senior_reviewer', 'active'), ('${T}', 'cs-rev4', 'reviewer', 'active'), ('${T2}', 'cs-foreign', 'practice_manager', 'active');`);
  practice = new PracticeStore(pgRpc(db.pool)); cases = new CaseStore(pgRpc(db.pool));
  E = (await practice.createEngagement(T, C, 'cs-mgr', 'cs-engagement', { title: 'Synthetic return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'cs-mgr', E, 'active', 1);
  await practice.assign(T, C, 'cs-mgr', 'cs-assign-preparer', { engagementId: E, taxYear: 2025, role: 'preparer', userId: 'cs-prep', reason: 'Initial staffing' });
  await practice.assign(T, C, 'cs-mgr', 'cs-assign-reviewer', { engagementId: E, taxYear: 2025, role: 'reviewer', userId: 'cs-rev', reason: 'Initial staffing' });
  caseId = (await cases.create(T, C, 'cs-mgr', 'cs-case-key-1', { engagementId: E, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  await cases.addNote(T, caseId, 'cs-rev', 'Synthetic note by the original reviewer');
  const app = express(); app.use(express.json());
  app.use('/cases', createCasesRouter({ store: () => cases, authenticate: (req: any, _res, next) => { req.user = httpUser; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 240_000);
afterAll(async () => {
  server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r());
  await db?.stop();
});

describe('restaffing a case: authority and preconditions', () => {
  it('only a practice manager or administrator of the tenant may restaff', async () => {
    await reassign('reviewer', 'cs-rev', 'cs-rev2');
    for (const who of ['cs-prep', 'cs-rev2']) expect(await code(restaff(who, 'reviewer', 'cs-rev2')), who).toBe('PRACTICE_MANAGER_REQUIRED');
    expect(await code(restaff('cs-foreign', 'reviewer', 'cs-rev2', undefined, undefined, T2))).toBe('CASE_NOT_FOUND');
    expect(await code(restaff('cs-foreign', 'reviewer', 'cs-rev2'))).not.toBe('OK');
    expect((await caseRow()).reviewer_uid).toBe('cs-rev');
  });

  it('the new person must hold the live assignment for that role, engagement and year', async () => {
    expect(await code(restaff('cs-mgr', 'reviewer', 'cs-rev3'))).toBe('CASE_ASSIGNEE_NOT_ASSIGNED');
    expect(await code(restaff('cs-mgr', 'preparer', 'cs-prep2'))).toBe('CASE_ASSIGNEE_NOT_ASSIGNED');
  });

  it('refuses a stale version, an unchanged slot, an unknown role and a missing reason, changing nothing', async () => {
    const before = await counts(); const row = await caseRow();
    expect(await code(restaff('cs-mgr', 'reviewer', 'cs-rev2', undefined, row.version - 1))).toBe('CASE_VERSION_CONFLICT');
    expect(await code(restaff('cs-mgr', 'preparer', 'cs-prep'))).toBe('CASE_INPUT_INVALID');
    expect(await code(restaff('cs-mgr', 'owner', 'cs-rev2'))).toBe('CASE_INPUT_INVALID');
    expect(await code(restaff('cs-mgr', 'reviewer', 'cs-rev2', 'short'))).toBe('CASE_INPUT_INVALID');
    expect(await caseRow()).toEqual(row);
    expect(await counts()).toEqual(before);
  });
});

describe('restaffing a case: segregation of duties', () => {
  it('a current or former preparer, or the requester of a run awaiting review, cannot become the reviewer', async () => {
    // Assignments inserted directly (defence in depth: the database refuses even if assignment rules were bypassed).
    await db.pool.query(`UPDATE taxguard_staff_assignments SET status = 'REVOKED', effective_to = now() WHERE tenant_id = $1 AND user_id = 'cs-rev2'`, [T]);
    await db.pool.query(`INSERT INTO taxguard_staff_assignments(id, tenant_id, client_id, engagement_id, tax_year, role, user_id, assigned_by, status, effective_from)
      VALUES ('cs-direct-1', $1, $2, $3, 2025, 'reviewer', 'cs-prep', 'cs-mgr', 'ACTIVE', now() - interval '1 hour')`, [T, C, E]);
    expect(await code(restaff('cs-mgr', 'reviewer', 'cs-prep'))).toBe('ASSIGNMENT_SEGREGATION_OF_DUTIES');
    await db.pool.query(`UPDATE taxguard_staff_assignments SET status = 'REVOKED', effective_to = now() WHERE id = 'cs-direct-1'`);
    const ruleSet = (await db.pool.query(`INSERT INTO taxguard_tax_rule_sets(tenant_id, jurisdiction, jurisdiction_code, return_family, tax_year, version, definition, content_sha256,
        source_ids, synthetic, prepared_by) VALUES ($1, 'federal', 'US', '1040', 2025, 1, '{}'::jsonb, repeat('a', 64), '{}', true, 'cs-mgr') RETURNING rule_set_id`, [T])).rows[0].rule_set_id;
    await db.pool.query(`INSERT INTO taxguard_tax_calc_runs(tenant_id, client_id, case_id, tax_year, rule_set_id, rule_set_sha256, engine_version, input_sha256, output_sha256,
        inputs, outputs, trace, synthetic, requested_by) VALUES ($1, $2, $3, 2025, $4, repeat('a', 64), 'synthetic-1', repeat('b', 64), repeat('c', 64), '{}', '{}', '{}', true, 'cs-rev3')`,
      [T, C, caseId, ruleSet]);
    await db.pool.query(`INSERT INTO taxguard_staff_assignments(id, tenant_id, client_id, engagement_id, tax_year, role, user_id, assigned_by, status, effective_from)
      VALUES ('cs-direct-2', $1, $2, $3, 2025, 'reviewer', 'cs-rev3', 'cs-mgr', 'ACTIVE', now() - interval '1 hour')`, [T, C, E]);
    expect(await code(restaff('cs-mgr', 'reviewer', 'cs-rev3'))).toBe('ASSIGNMENT_SEGREGATION_OF_DUTIES');
    await db.pool.query(`UPDATE taxguard_staff_assignments SET status = 'REVOKED', effective_to = now() WHERE id = 'cs-direct-2'`);
    expect((await caseRow()).reviewer_uid).toBe('cs-rev');
  });
});

describe('restaffing a case: the replacement takes over and history is kept', () => {
  it('moves the reviewer: the new reviewer reaches the case, the former does not, and the history is unchanged', async () => {
    await practice.assign(T, C, 'cs-mgr', 'cs-assign-rev2-again', { engagementId: E, taxYear: 2025, role: 'reviewer', userId: 'cs-rev2', reason: 'Synthetic restaffing' });
    expect(await code(cases.detail(T, caseId, 'cs-rev2'))).toBe('CASE_NOT_FOUND');
    const before = await counts(); const row = await caseRow();
    const out = await restaff('cs-mgr', 'reviewer', 'cs-rev2');
    expect(out).toMatchObject({ caseId, role: 'reviewer', previousUid: 'cs-rev', newUid: 'cs-rev2', version: row.version + 1 });
    expect(await caseRow()).toEqual({ preparer_uid: 'cs-prep', reviewer_uid: 'cs-rev2', version: row.version + 1 });
    const detail = JSON.stringify(await cases.detail(T, caseId, 'cs-rev2'));
    expect(detail).toContain('Synthetic note by the original reviewer');
    expect(await code(cases.detail(T, caseId, 'cs-rev'))).toBe('CASE_NOT_FOUND');
    const after = await counts();
    expect(after).toEqual({ events: before.events, audits: before.audits + 1 });
    const audit = (await db.pool.query(`SELECT actor_uid, metadata FROM taxguard_audit_log WHERE tenant_id = $1 AND action = 'CASE_TEAM_CHANGED' ORDER BY timestamp DESC LIMIT 1`, [T])).rows[0];
    expect(audit).toMatchObject({ actor_uid: 'cs-mgr', metadata: { role: 'reviewer', previousUid: 'cs-rev', newUid: 'cs-rev2', reason: 'Synthetic restaffing after reassignment' } });
    const slots = (await db.pool.query(`SELECT uid, role, active FROM taxguard_case_assignments WHERE tenant_id = $1 AND case_id = $2 ORDER BY uid`, [T, caseId])).rows;
    expect(slots).toEqual([{ uid: 'cs-prep', role: 'preparer', active: true }, { uid: 'cs-rev', role: 'reviewer', active: false }, { uid: 'cs-rev2', role: 'reviewer', active: true }]);
  });

  it('moves the preparer the same way; an administrator may restaff', async () => {
    await reassign('preparer', 'cs-prep', 'cs-prep2');
    expect((await restaff('cs-admin', 'preparer', 'cs-prep2')).newUid).toBe('cs-prep2');
    expect(await code(cases.detail(T, caseId, 'cs-prep2'))).toBe('OK');
    expect(await code(cases.detail(T, caseId, 'cs-prep'))).toBe('CASE_NOT_FOUND');
    // The former preparer can never become this case's reviewer.
    // One ACTIVE assignment per engagement, year and role: free the reviewer slot first.
    await db.pool.query(`UPDATE taxguard_staff_assignments SET status = 'REVOKED', effective_to = now() WHERE tenant_id = $1 AND user_id = 'cs-rev2'`, [T]);
    await db.pool.query(`INSERT INTO taxguard_staff_assignments(id, tenant_id, client_id, engagement_id, tax_year, role, user_id, assigned_by, status, effective_from)
      VALUES ('cs-direct-3', $1, $2, $3, 2025, 'reviewer', 'cs-prep', 'cs-mgr', 'ACTIVE', now() - interval '1 hour')`, [T, C, E]);
    expect(await code(restaff('cs-mgr', 'reviewer', 'cs-prep'))).toBe('ASSIGNMENT_SEGREGATION_OF_DUTIES');
  });
});

describe('restaffing over the case API', () => {
  const post = async (uid: string, role: string, body: unknown) => {
    httpUser = { id: uid, role, tenantId: T, status: 'active' };
    const r = await fetch(origin + '/cases/' + caseId + '/team', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => null) as any };
  };
  it('refuses non-managers and unassigned people with stable codes, and restaffs for a manager', async () => {
    await db.pool.query(`UPDATE taxguard_staff_assignments SET status = 'REVOKED', effective_to = now() WHERE id = 'cs-direct-3'`);
    const body = async (userId: string) => ({ role: 'reviewer', userId, version: (await caseRow()).version, reason: 'Synthetic restaffing over the API' });
    expect(await post('cs-prep2', 'accountant', await body('cs-rev4'))).toMatchObject({ status: 403, body: { code: 'PRACTICE_MANAGER_REQUIRED' } });
    expect(await post('cs-mgr', 'practice_manager', await body('cs-rev4'))).toMatchObject({ status: 409, body: { code: 'CASE_ASSIGNEE_NOT_ASSIGNED' } });
    await practice.assign(T, C, 'cs-mgr', 'cs-assign-rev4', { engagementId: E, taxYear: 2025, role: 'reviewer', userId: 'cs-rev4', reason: 'Synthetic restaffing' });
    expect(await post('cs-mgr', 'practice_manager', { ...(await body('cs-rev4')), version: 1 })).toMatchObject({ status: 409, body: { code: 'CASE_VERSION_CONFLICT' } });
    expect(await post('cs-mgr', 'practice_manager', await body('cs-rev4'))).toMatchObject({ status: 200, body: { role: 'reviewer', newUid: 'cs-rev4' } });
    expect(await code(cases.detail(T, caseId, 'cs-rev4'))).toBe('OK');
  });
});
