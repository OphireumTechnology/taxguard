import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { createPracticeRouter } from '../server/routes/practice.routes';

// Block 86: staff in-app notifications for task assignment (proposal 20261019270000, review only) over HTTP through the
// durable practice router on real PostgreSQL with every proposal applied. Notifications are written by the database
// when a task is assigned and resolved against current access when read. SYNTHETIC data only.
const T = 'tenantStaffNotify', C = 'snClient';
const roles: Record<string, string> = { 'sn-mgr': 'practice_manager', 'sn-prep1': 'accountant', 'sn-prep2': 'accountant', 'sn-wide': 'reviewer', 'sn-client': 'client' };
let db: TestDatabase; let server: Server; let origin = ''; let user: any = null; let practice: PracticeStore;
let E1 = '';
const call = (uid: string, method: 'GET' | 'POST', path: string) => { user = { id: uid, role: roles[uid], tenantId: T, status: 'active' };
  return fetch(origin + '/practice' + path, { method, headers: { 'content-type': 'application/json' } }).then(async r => ({ status: r.status, body: await r.json() as any })); };
const inbox = (uid: string, query = '') => call(uid, 'GET', '/notifications' + query);
const createTask = async (actor: string, key: string, body: Record<string, unknown>) => (await practice.createTask(T, C, actor, key, { title: 'Synthetic ' + key, ...body })).taskId;
const version = async (task: string) => (await db.pool.query(`SELECT version FROM taxguard_practice_tasks WHERE id = $1`, [task])).rows[0].version as number;

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic notification practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'sn-client', 'Synthetic Notification Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ('${T}', 'sn-mgr', 'practice_manager', 'active', NULL), ('${T}', 'sn-prep1', 'accountant', 'active', NULL),
      ('${T}', 'sn-prep2', 'accountant', 'active', NULL), ('${T}', 'sn-wide', 'reviewer', 'active', NULL), ('${T}', 'sn-client', 'client', 'active', '${C}');`);
  practice = new PracticeStore(pgRpc(db.pool));
  const engagement = async (key: string) => {
    const id = (await practice.createEngagement(T, C, 'sn-mgr', key, { title: 'Synthetic ' + key, type: 'tax_preparation', taxYears: [2025] })).engagementId;
    await practice.setEngagementStatus(T, C, 'sn-mgr', id, 'active', 1);
    return id;
  };
  E1 = await engagement('sn-engagement-1'); const E2 = await engagement('sn-engagement-2');
  await practice.assign(T, C, 'sn-mgr', 'sn-assign-prep1', { engagementId: E1, taxYear: 2025, role: 'preparer', userId: 'sn-prep1', reason: 'Synthetic staffing' });
  await practice.assign(T, C, 'sn-mgr', 'sn-assign-prep2', { engagementId: E2, taxYear: 2025, role: 'preparer', userId: 'sn-prep2', reason: 'Synthetic staffing' });
  await db.pool.query(`INSERT INTO taxguard_staff_assignments(id, tenant_id, client_id, engagement_id, tax_year, role, user_id, assigned_by, status, effective_from)
    VALUES ('sn-wide-1', '${T}', '${C}', NULL, NULL, 'reviewer', 'sn-wide', 'sn-mgr', 'ACTIVE', now() - interval '1 day')`);
  const app = express(); app.use(express.json());
  app.use('/practice', createPracticeRouter({ store: () => practice, authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 240_000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await db?.stop(); });

describe('staff notifications', () => {
  let assigned = '';
  it('assigning a task notifies the assignee, not the actor', async () => {
    assigned = await createTask('sn-mgr', 'sn-task-assigned', { engagementId: E1, taxYear: 2025, assignedUserId: 'sn-prep1' });
    await createTask('sn-prep1', 'sn-task-self', { engagementId: E1, taxYear: 2025, assignedUserId: 'sn-prep1' });
    const r = await inbox('sn-prep1');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.unread).toBe(1);
    expect(r.body.notifications).toHaveLength(1);
    expect(r.body.notifications[0]).toMatchObject({ kind: 'TASK_ASSIGNED', clientId: C, taskId: assigned, channel: 'IN_APP', deliveryStatus: 'NOT_CONFIGURED',
      createdBy: 'sn-mgr', readAt: null, available: true, task: { title: 'Synthetic sn-task-assigned', status: 'OPEN', assignedToMe: true } });
    expect((await inbox('sn-mgr')).body).toEqual({ unread: 0, notifications: [] });
  });

  it('a reassignment notifies the new assignee', async () => {
    await practice.reassignTask(T, C, 'sn-prep1', assigned, 'sn-wide', await version(assigned), 'Synthetic hand-off');
    const r = await inbox('sn-wide');
    expect(r.body.notifications.map((n: any) => [n.taskId, n.createdBy, n.task.assignedToMe])).toEqual([[assigned, 'sn-prep1', true]]);
    // The previous assignee keeps the notification and, being in scope of the task's engagement, still sees the task.
    expect((await inbox('sn-prep1')).body.notifications[0]).toMatchObject({ available: true, task: { assignedToMe: false } });
  });

  it('a notification stops showing the task once its recipient may no longer see it', async () => {
    // Assignment at creation is checked per client, so an assignee of another engagement may hold the task.
    const task = await createTask('sn-mgr', 'sn-task-cross', { engagementId: E1, taxYear: 2025, assignedUserId: 'sn-prep2' });
    expect((await inbox('sn-prep2')).body.notifications[0]).toMatchObject({ taskId: task, available: true });
    await practice.reassignTask(T, C, 'sn-mgr', task, 'sn-prep1', await version(task));
    const after = (await inbox('sn-prep2')).body.notifications[0];
    expect(after).toMatchObject({ taskId: task, available: false, task: null });
    expect(JSON.stringify(after)).not.toContain('sn-task-cross');
  });

  it('marks only the actor\'s own notifications read, once', async () => {
    const mine = (await inbox('sn-prep1', '?unreadOnly=true')).body.notifications;
    expect(mine.length).toBe(2);
    const first = await call('sn-prep1', 'POST', `/notifications/${mine[0].notificationId}/read`);
    expect(first.status).toBe(200);
    const again = await call('sn-prep1', 'POST', `/notifications/${mine[0].notificationId}/read`);
    expect(again.body.readAt).toBe(first.body.readAt);
    expect((await inbox('sn-prep1')).body.unread).toBe(1);
    expect((await inbox('sn-prep1', '?unreadOnly=true')).body.notifications.map((n: any) => n.notificationId)).toEqual([mine[1].notificationId]);
    expect(await call('sn-wide', 'POST', `/notifications/${mine[1].notificationId}/read`)).toEqual({ status: 404, body: { code: 'STAFF_NOTIFICATION_NOT_FOUND' } });
    expect(await call('sn-prep1', 'POST', '/notifications/not-a-uuid/read')).toEqual({ status: 404, body: { code: 'STAFF_NOTIFICATION_NOT_FOUND' } });
    expect((await inbox('sn-prep1')).body.unread).toBe(1);
  });

  it('refuses clients and bad limits, and keeps the table and helper off client roles and the service role', async () => {
    expect((await inbox('sn-client')).body).toEqual({ code: 'PRACTICE_ACCESS_DENIED' });
    expect(await inbox('sn-prep1', '?limit=0')).toEqual({ status: 400, body: { code: 'PRACTICE_INPUT_INVALID' } });
    expect(await inbox('sn-prep1', '?limit=x')).toEqual({ status: 400, body: { code: 'PRACTICE_INPUT_INVALID' } });
    const rows = (await db.pool.query(`SELECT has_table_privilege('anon', 'public.taxguard_staff_notifications', 'SELECT') AS anon,
        has_table_privilege('authenticated', 'public.taxguard_staff_notifications', 'SELECT') AS auth,
        has_function_privilege('service_role', 'public.taxguard_staff_notify_task(text,text,text,text,text)', 'EXECUTE') AS notify`)).rows[0];
    expect(rows).toEqual({ anon: false, auth: false, notify: false });
  });
});
