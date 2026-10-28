import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPracticeRouter } from '../server/routes/practice.routes';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// HTTP -> /api/practice -> PracticeStore -> proposal 025 on the actual core schema (PGlite, synthetic).
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let user: any;
let n = 0;
const roles: Record<string, string> = { 'pm-manager': 'practice_manager', 'pm-acct': 'accountant', 'pm-acct2': 'accountant', 'pm-rev': 'senior_reviewer', 'pm-book': 'bookkeeper', 'pm-client': 'client' };
const as = (uid: string, tenantId = 'tenantA') => { user = { id: uid, role: roles[uid] ?? 'accountant', tenantId, status: 'active' }; };
const call = async (method: 'GET' | 'POST', path: string, body?: unknown, key: string | null = `pm-key-${Date.now()}-${++n}`) => {
  const response = await fetch(origin + '/practice' + path, { method, headers: { 'content-type': 'application/json', ...(key && method === 'POST' ? { 'idempotency-key': key } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json().catch(() => null) };
};

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012250000_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name,email) VALUES('tenantA','pmClient1','o1','Synthetic Household One','one@example.test'),
      ('tenantA','pmClient2','o2','Synthetic Business Two','two@example.test'),('tenantB','pmForeign','o3','Foreign Synthetic','f@example.test');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) SELECT 'tenantA', k, v, 'active' FROM (VALUES ${Object.entries(roles).map(([k, v]) => `('${k}','${v}')`).join(',')}) x(k, v);
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantB','pm-manager','practice_manager','active');`);
  const store = new PracticeStore(pgliteRpc(() => fixture.pg));
  const app = express(); app.use(express.json());
  app.use('/practice', createPracticeRouter({ store: () => store, authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 60000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });
beforeEach(() => as('pm-manager'));

describe('client and engagement lifecycle', () => {
  let engagementId = '';
  it('creates an engagement idempotently, assigns a team, records notes, tasks and deadlines, and completes it', async () => {
    expect((await call('POST', '/clients/pmClient1/type', { clientType: 'individual' })).status).toBe(200);
    const created = await call('POST', '/clients/pmClient1/engagements', { title: '2025 individual return', type: 'tax_preparation', taxYears: [2025] }, 'engagement-key-1');
    expect(created.status).toBe(201); expect(created.body.created).toBe(true);
    engagementId = created.body.engagementId;
    const replay = await call('POST', '/clients/pmClient1/engagements', { title: '2025 individual return', type: 'tax_preparation', taxYears: [2025] }, 'engagement-key-1');
    expect(replay.body).toEqual({ engagementId, created: false });
    expect((await call('POST', '/clients/pmClient1/engagements', { title: 'Different', type: 'tax_preparation', taxYears: [2025] }, 'engagement-key-1')).body.code).toBe('PRACTICE_IDEMPOTENCY_CONFLICT');

    expect((await call('POST', `/clients/pmClient1/engagements/${engagementId}/status`, { status: 'active', version: 1 })).body).toMatchObject({ status: 'active', version: 2 });
    const prep = await call('POST', `/clients/pmClient1/engagements/${engagementId}/team`, { taxYear: 2025, role: 'preparer', userId: 'pm-acct', reason: 'Initial staffing' });
    expect(prep.status).toBe(201);
    expect((await call('POST', `/clients/pmClient1/engagements/${engagementId}/team`, { taxYear: 2025, role: 'reviewer', userId: 'pm-rev', reason: 'Initial staffing' })).status).toBe(201);
    const bad = await call('POST', `/clients/pmClient1/engagements/${engagementId}/team`, { taxYear: 2025, role: 'reviewer', userId: 'pm-book', reason: 'Wrong role' });
    expect(bad.body.code).toBe('ASSIGNEE_ROLE_INCOMPATIBLE');
    const reassigned = await call('POST', `/clients/pmClient1/engagements/${engagementId}/team`, { taxYear: 2025, role: 'preparer', userId: 'pm-acct2', reason: 'Workload balancing' });
    expect(reassigned.body.previousUserId).toBe('pm-acct');
    expect((await call('POST', `/clients/pmClient1/engagements/${engagementId}/team`, { taxYear: 2025, role: 'preparer', userId: 'pm-acct', reason: 'Back to original preparer' })).status).toBe(201);

    as('pm-acct');
    expect((await call('POST', '/clients/pmClient1/notes', { engagementId, body: 'Synthetic note: client prefers email.' })).status).toBe(201);
    const first = await call('POST', '/clients/pmClient1/tasks', { title: 'Collect synthetic W-2', assignedUserId: 'pm-acct', engagementId, taxYear: 2025, priority: 'HIGH', dueDate: '2026-02-15T00:00:00Z' });
    const second = await call('POST', '/clients/pmClient1/tasks', { title: 'Prepare draft workpapers', assignedUserId: 'pm-acct', engagementId, dependencies: [first.body.taskId] });
    expect(second.status).toBe(201);
    expect((await call('POST', `/clients/pmClient1/tasks/${second.body.taskId}/status`, { status: 'COMPLETED', version: 1 })).body.code).toBe('TASK_DEPENDENCIES_OPEN');
    expect((await call('POST', `/clients/pmClient1/tasks/${first.body.taskId}/status`, { status: 'COMPLETED', version: 1 })).status).toBe(200);
    expect((await call('POST', `/clients/pmClient1/tasks/${second.body.taskId}/status`, { status: 'COMPLETED', version: 2 })).body.code).toBe('PRACTICE_VERSION_CONFLICT');
    const statutory = await call('POST', '/clients/pmClient1/deadlines', { title: 'Federal filing deadline', category: 'filing', dueDate: '2026-04-15T23:59:00Z', authorityType: 'STATUTORY' });
    expect(statutory.body.code).toBe('PRACTICE_INPUT_INVALID');
    const internal = await call('POST', '/clients/pmClient1/deadlines', { title: 'Internal review target', category: 'review', dueDate: '2026-03-20T00:00:00Z', taxYear: 2025 });
    expect(internal.status).toBe(201);
    expect((await call('POST', `/clients/pmClient1/deadlines/${internal.body.deadlineId}/resolve`, { status: 'WAIVED', reason: 'Not needed this year' })).body.code).toBe('DEADLINE_WAIVER_NOT_AUTHORIZED');

    as('pm-manager');
    const blocked = await call('POST', `/clients/pmClient1/engagements/${engagementId}/status`, { status: 'completed', version: 2 });
    expect(blocked.body.code).toBe('ENGAGEMENT_HAS_OPEN_TASKS');
    as('pm-acct');
    await call('POST', `/clients/pmClient1/tasks/${second.body.taskId}/status`, { status: 'COMPLETED', version: 1 });
    as('pm-manager');
    expect((await call('POST', `/clients/pmClient1/engagements/${engagementId}/status`, { status: 'completed', version: 2 })).body.status).toBe('completed');
    expect((await call('POST', `/clients/pmClient1/engagements/${engagementId}/status`, { status: 'active', version: 3 })).body.code).toBe('ENGAGEMENT_STATUS_TRANSITION_INVALID');

    const detail = (await call('GET', '/clients/pmClient1')).body;
    expect(detail.client).toMatchObject({ clientId: 'pmClient1', clientType: 'individual' });
    expect(detail.engagements[0]).toMatchObject({ engagementId, status: 'completed', taxYears: [{ taxYear: 2025, status: 'active' }] });
    expect(detail.team.map((a: any) => [a.role, a.userId]).sort()).toEqual([['preparer', 'pm-acct'], ['reviewer', 'pm-rev']]);
    expect(detail.assignmentHistory.map((h: any) => [h.previousUserId, h.newUserId])).toEqual(expect.arrayContaining([['pm-acct', 'pm-acct2'], ['pm-acct2', 'pm-acct']]));
    expect(detail.notes[0].body).toContain('client prefers email');
    expect(detail.activity.map((a: any) => a.action)).toEqual(expect.arrayContaining(['PRACTICE_ENGAGEMENT_CREATED', 'PRACTICE_TEAM_ASSIGNED', 'PRACTICE_TASK_STATUS_CHANGED', 'PRACTICE_NOTE_ADDED']));
  });

  it('enforces segregation of duties between preparer and reviewer', async () => {
    const e = (await call('POST', '/clients/pmClient2/engagements', { title: 'Synthetic business books', type: 'bookkeeping', taxYears: [2025] })).body.engagementId;
    await fixture.pg.exec("UPDATE taxguard_members SET role='senior_reviewer' WHERE uid='pm-acct2'");
    try {
      await fixture.pg.exec(`INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,engagement_id,tax_year,role,user_id,assigned_by,status) VALUES('pm-sod','tenantA','pmClient2','${e}',2025,'preparer','pm-acct2','seed','ACTIVE')`);
      const conflict = await call('POST', `/clients/pmClient2/engagements/${e}/team`, { taxYear: 2025, role: 'reviewer', userId: 'pm-acct2', reason: 'Same person both roles' });
      expect(conflict.status).toBe(409); expect(conflict.body.code).toBe('ASSIGNMENT_SEGREGATION_OF_DUTIES');
    } finally { await fixture.pg.exec("UPDATE taxguard_members SET role='accountant' WHERE uid='pm-acct2'"); }
  });

  it('shows staff only assigned clients, hides other tenants, and limits management to managers', async () => {
    as('pm-acct');
    const visible = (await call('GET', '/clients')).body.items.map((c: any) => c.clientId);
    expect(visible).toEqual(['pmClient1']);
    expect((await call('GET', '/clients/pmClient2')).body.code).toBe('CLIENT_NOT_FOUND');
    expect((await call('POST', '/clients/pmClient1/engagements', { title: 'Unauthorized', type: 'tax_preparation', taxYears: [2025] })).body.code).toBe('PRACTICE_MANAGER_REQUIRED');
    as('pm-manager');
    const all = (await call('GET', '/clients?q=synthetic')).body.items.map((c: any) => c.clientId);
    expect(all).toEqual(['pmClient1', 'pmClient2']);
    const page = (await call('GET', '/clients?limit=1&q=pmclient')).body;
    expect(page.items).toHaveLength(1); expect(page.nextCursor).toBe('pmClient1');
    expect((await call('GET', `/clients?limit=1&q=pmclient&cursor=${page.nextCursor}`)).body.items[0].clientId).toBe('pmClient2');
    expect((await call('GET', '/clients/pmForeign')).body.code).toBe('CLIENT_NOT_FOUND');
    as('pm-manager', 'tenantB');
    expect((await call('GET', '/clients')).body.items.map((c: any) => c.clientId)).toEqual(['pmForeign']);
    as('pm-client');
    expect((await call('GET', '/clients')).status).toBe(403);
  });

  it('archives a client only without open engagements, blocks new work, and reactivates with a reason', async () => {
    const open = await call('POST', '/clients/pmClient2/status', { status: 'archived', reason: 'Client relationship ended' });
    expect(open.body.code).toBe('CLIENT_HAS_OPEN_ENGAGEMENTS');
    const fresh = await call('POST', '/clients/pmClient1/status', { status: 'archived', reason: 'no' });
    expect(fresh.body.code).toBe('STATUS_REASON_REQUIRED');
    expect((await call('POST', '/clients/pmClient1/status', { status: 'archived', reason: 'Engagement completed; client inactive' })).body.status).toBe('archived');
    expect((await call('POST', '/clients/pmClient1/engagements', { title: 'New work on archived', type: 'tax_preparation', taxYears: [2026] })).body.code).toBe('CLIENT_NOT_ACTIVE');
    expect((await call('GET', '/clients?status=archived')).body.items.map((c: any) => c.clientId)).toEqual(['pmClient1']);
    expect((await call('POST', '/clients/pmClient1/status', { status: 'active', reason: 'Client returned for 2026' })).body.status).toBe('active');
  });

  it('requires idempotency keys for created records and keeps notes append-only', async () => {
    expect((await call('POST', '/clients/pmClient1/tasks', { title: 'No key task' }, null)).body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    await expect(fixture.pg.query("UPDATE taxguard_engagement_notes SET body='edited'")).rejects.toThrow('NOTE_IMMUTABLE');
    await expect(fixture.pg.query("DELETE FROM taxguard_engagement_notes")).rejects.toThrow('NOTE_IMMUTABLE');
  });

  it('is executable by the service role only', async () => {
    for (const role of ['anon', 'authenticated']) {
      await fixture.pg.exec('SET ROLE ' + role);
      try { await expect(fixture.pg.query("SELECT taxguard_practice_list_clients('tenantA','pm-manager','{}'::jsonb)")).rejects.toThrow('permission denied'); }
      finally { await fixture.pg.exec('RESET ROLE'); }
    }
  });
});
