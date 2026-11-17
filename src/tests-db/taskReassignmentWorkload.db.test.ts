import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { createPracticeRouter } from '../server/routes/practice.routes';

// Block 84: task reassignment and the staff workload view (proposal 20261019250000, review only) over HTTP through the
// durable practice router on real PostgreSQL with every proposal applied. Engagement scope follows the owner decision
// of 2026-10-19. SYNTHETIC data only.
const T = 'tenantTaskReassign', T2 = 'tenantTaskReassignOther', C = 'trClient', C2 = 'trClientOther';
const roles: Record<string, string> = { 'tr-mgr': 'practice_manager', 'tr-prep1': 'accountant', 'tr-rev1': 'reviewer', 'tr-prep2': 'accountant', 'tr-wide': 'reviewer',
  'tr-outsider': 'accountant', 'tr-client': 'client', 'tr-foreign': 'practice_manager' };
let db: TestDatabase; let server: Server; let origin = ''; let user: any = null; let practice: PracticeStore;
let E1 = '', E2 = ''; const tasks: Record<string, string> = {};
const as = (uid: string) => { user = { id: uid, role: roles[uid], tenantId: uid === 'tr-foreign' ? T2 : T, status: 'active' }; };
const call = (uid: string, method: 'GET' | 'POST', path: string, body?: unknown) => { as(uid); return fetch(origin + '/practice' + path, { method,
  headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).then(async r => ({ status: r.status, body: await r.json() as any })); };
const reassign = (uid: string, task: string, body: Record<string, unknown>) => call(uid, 'POST', `/clients/${C}/tasks/${task}/reassign`, body);
const task = async (key: string) => (await db.pool.query(`SELECT assigned_user_id, version, status FROM taxguard_practice_tasks WHERE id = $1`, [key])).rows[0];
const audits = async (taskId: string) => (await db.pool.query(`SELECT actor_uid, metadata FROM taxguard_audit_log WHERE action = 'PRACTICE_TASK_REASSIGNED' AND metadata->>'taskId' = $1 ORDER BY timestamp, id`, [taskId])).rows;
const workload = (uid: string, query = '') => call(uid, 'GET', '/workload' + query);

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic task practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'tr-client', 'Synthetic Task Client'), ('${T}', '${C2}', 'tr-client2', 'Other Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ('${T}', 'tr-mgr', 'practice_manager', 'active', NULL), ('${T}', 'tr-prep1', 'accountant', 'active', NULL),
      ('${T}', 'tr-rev1', 'reviewer', 'active', NULL), ('${T}', 'tr-prep2', 'accountant', 'active', NULL), ('${T}', 'tr-wide', 'reviewer', 'active', NULL),
      ('${T}', 'tr-outsider', 'accountant', 'active', NULL), ('${T}', 'tr-client', 'client', 'active', '${C}'), ('${T2}', 'tr-foreign', 'practice_manager', 'active', NULL);`);
  practice = new PracticeStore(pgRpc(db.pool));
  const engagement = async (client: string, key: string) => {
    const id = (await practice.createEngagement(T, client, 'tr-mgr', key, { title: 'Synthetic ' + key, type: 'tax_preparation', taxYears: [2025] })).engagementId;
    await practice.setEngagementStatus(T, client, 'tr-mgr', id, 'active', 1);
    return id;
  };
  E1 = await engagement(C, 'tr-engagement-1'); E2 = await engagement(C, 'tr-engagement-2'); const e3 = await engagement(C2, 'tr-engagement-c2');
  const staff: Array<[string, string, string, string]> = [[C, E1, 'preparer', 'tr-prep1'], [C, E1, 'reviewer', 'tr-rev1'], [C, E2, 'preparer', 'tr-prep2'], [C2, e3, 'preparer', 'tr-outsider']];
  for (const [client, engagementId, role, userId] of staff)
    await practice.assign(T, client, 'tr-mgr', `tr-assign-${userId}`, { engagementId, taxYear: 2025, role, userId, reason: 'Synthetic staffing' });
  await db.pool.query(`INSERT INTO taxguard_staff_assignments(id, tenant_id, client_id, engagement_id, tax_year, role, user_id, assigned_by, status, effective_from)
    VALUES ('tr-wide-1', '${T}', '${C}', NULL, NULL, 'reviewer', 'tr-wide', 'tr-mgr', 'ACTIVE', now() - interval '1 day')`);
  const create = async (name: string, body: Record<string, unknown>) =>
    (tasks[name] = (await practice.createTask(T, C, 'tr-mgr', 'tr-task-' + name, { title: 'Synthetic task ' + name, ...body })).taskId);
  await create('e1', { engagementId: E1, taxYear: 2025, assignedUserId: 'tr-prep1' });
  await create('e1Overdue', { engagementId: E1, taxYear: 2025, assignedUserId: 'tr-prep1', dueDate: '2020-01-01T00:00:00Z' });
  await create('e1Done', { engagementId: E1, taxYear: 2025, assignedUserId: 'tr-prep1' });
  await create('e2', { engagementId: E2, taxYear: 2025, assignedUserId: 'tr-prep2' });
  await practice.setTaskStatus(T, C, 'tr-prep1', tasks.e1Overdue, 'WAITING_ON_CLIENT', 1);
  await practice.setTaskStatus(T, C, 'tr-prep1', tasks.e1Done, 'COMPLETED', 1);
  const app = express(); app.use(express.json());
  app.use('/practice', createPracticeRouter({ store: () => practice, authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 240_000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await db?.stop(); });

describe('task reassignment', () => {
  it('the current assignee hands a task to a colleague who can see the client, and the change is audited', async () => {
    const r = await reassign('tr-prep1', tasks.e1, { assignedUserId: 'tr-wide', version: 1, reason: 'Synthetic hand-off' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toEqual({ taskId: tasks.e1, assignedUserId: 'tr-wide', version: 2, changed: true });
    expect(await task(tasks.e1)).toMatchObject({ assigned_user_id: 'tr-wide', version: 2, status: 'OPEN' });
    expect(await audits(tasks.e1)).toEqual([{ actor_uid: 'tr-prep1', metadata: { clientId: C, taskId: tasks.e1, from: 'tr-prep1', to: 'tr-wide', reason: 'Synthetic hand-off' } }]);
  });

  it('refuses out-of-scope actors as not found, and in-scope staff who are neither manager, creator nor assignee', async () => {
    expect((await reassign('tr-prep2', tasks.e1, { assignedUserId: 'tr-prep2', version: 2 })).body).toEqual({ code: 'TASK_NOT_FOUND' });
    expect((await reassign('tr-outsider', tasks.e1, { assignedUserId: 'tr-outsider', version: 2 })).body).toEqual({ code: 'CLIENT_NOT_FOUND' });
    const r = await reassign('tr-rev1', tasks.e1, { assignedUserId: 'tr-rev1', version: 2 });
    expect(r).toEqual({ status: 403, body: { code: 'TASK_ACTION_NOT_AUTHORIZED' } });
    expect(await task(tasks.e1)).toMatchObject({ assigned_user_id: 'tr-wide', version: 2 });
  });

  it('checks the version, the new assignee and the task status', async () => {
    expect(await reassign('tr-mgr', tasks.e1, { assignedUserId: 'tr-rev1', version: 1 })).toEqual({ status: 409, body: { code: 'PRACTICE_VERSION_CONFLICT' } });
    for (const assignee of ['tr-outsider', 'tr-client', 'tr-nobody'])
      expect((await reassign('tr-mgr', tasks.e1, { assignedUserId: assignee, version: 2 })).body, assignee).toEqual({ code: 'TASK_ASSIGNEE_NOT_AUTHORIZED' });
    expect((await reassign('tr-prep1', tasks.e1Done, { assignedUserId: 'tr-rev1', version: 2 })).body).toEqual({ code: 'TASK_STATUS_TRANSITION_INVALID' });
    expect((await reassign('tr-mgr', tasks.e1, { version: 2 })).body).toEqual({ code: 'PRACTICE_INPUT_INVALID' });
    expect((await reassign('tr-mgr', tasks.e1, { assignedUserId: 'tr-rev1', version: 2, reason: 'x'.repeat(501) })).body).toEqual({ code: 'PRACTICE_INPUT_INVALID' });
    expect(await task(tasks.e1)).toMatchObject({ assigned_user_id: 'tr-wide', version: 2 });
  });

  it('an unchanged assignee changes nothing; null clears the assignee', async () => {
    expect((await reassign('tr-mgr', tasks.e1, { assignedUserId: 'tr-wide', version: 2 })).body).toEqual({ taskId: tasks.e1, assignedUserId: 'tr-wide', version: 2, changed: false });
    expect((await reassign('tr-mgr', tasks.e1, { assignedUserId: null, version: 2 })).body).toEqual({ taskId: tasks.e1, assignedUserId: null, version: 3, changed: true });
    expect((await audits(tasks.e1)).map(a => [a.actor_uid, a.metadata.to])).toEqual([['tr-prep1', 'tr-wide'], ['tr-mgr', null]]);
  });
});

describe('staff workload', () => {
  it('counts the actor\'s own open tasks by status, overdue tasks and current assignments', async () => {
    const r = await workload('tr-prep1');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ userId: 'tr-prep1', role: 'accountant', assignedClients: 1, assignedEngagements: 1, clientWideAssignments: 0,
      openTasks: 1, overdueTasks: 1, byStatus: { OPEN: 0, IN_PROGRESS: 0, WAITING_ON_CLIENT: 1, WAITING_ON_PROVIDER: 0, READY_FOR_REVIEW: 0, BLOCKED: 0 } });
    expect(Object.keys(r.body.definitions).sort()).toEqual(['assignedClients', 'assignedEngagements', 'byStatus', 'clientWideAssignments', 'openTasks', 'overdueTasks']);
    expect((await workload('tr-wide')).body).toMatchObject({ assignedClients: 1, assignedEngagements: 0, clientWideAssignments: 1, openTasks: 0 });
  });

  it('another staff member\'s workload is for managers only', async () => {
    expect(await workload('tr-prep1', '?userId=tr-prep2')).toEqual({ status: 403, body: { code: 'WORKLOAD_NOT_AUTHORIZED' } });
    expect((await workload('tr-prep1', '?userId=tr-prep1')).status).toBe(200);
    expect((await workload('tr-mgr', '?userId=tr-prep2')).body).toMatchObject({ userId: 'tr-prep2', openTasks: 1, assignedEngagements: 1 });
    for (const target of ['tr-client', 'tr-nobody', 'tr-foreign'])
      expect(await workload('tr-mgr', '?userId=' + target), target).toEqual({ status: 404, body: { code: 'WORKLOAD_USER_NOT_FOUND' } });
    // A manager of another tenant asks within their own tenant, where the staff member does not exist.
    expect(await workload('tr-foreign', '?userId=tr-prep1')).toEqual({ status: 404, body: { code: 'WORKLOAD_USER_NOT_FOUND' } });
    expect((await workload('tr-client')).body).toEqual({ code: 'PRACTICE_ACCESS_DENIED' });
  });

  it('a revoked assignment leaves the workload at once', async () => {
    const id = (await db.pool.query(`SELECT id FROM taxguard_staff_assignments WHERE tenant_id = $1 AND user_id = 'tr-prep2' AND status = 'ACTIVE'`, [T])).rows[0].id;
    await practice.unassign(T, C, 'tr-mgr', id, 'Synthetic rotation');
    expect((await workload('tr-mgr', '?userId=tr-prep2')).body).toMatchObject({ assignedClients: 0, assignedEngagements: 0, openTasks: 1 });
  });
});
