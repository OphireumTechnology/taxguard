import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';
import { createJobsRouter } from '../server/routes/jobs-durable.routes';
import { DurableJobWorker } from '../server/taxguard/operations/durableJobWorker';

// Block 82: durable background job queue (proposal 20261019240000, review only) on real PostgreSQL with every proposal
// applied. Staff operations over HTTP through the durable router; worker operations through the service RPCs on
// separate connections. Engagement scope follows the owner decision of 2026-10-19. No job is run. SYNTHETIC data only.
const T = 'tenantJobQueue', T2 = 'tenantJobQueueOther', TW = 'tenantJobWorker', C = 'jqClient';
const roles: Record<string, string> = { 'jq-mgr': 'practice_manager', 'jq-admin': 'admin', 'jq-prep1': 'accountant', 'jq-prep2': 'accountant',
  'jq-wide': 'reviewer', 'jq-client': 'client', 'jq-foreign': 'admin', 'jw-admin': 'admin' };
const tenantOf: Record<string, string> = { 'jq-foreign': T2, 'jw-admin': TW };
let db: TestDatabase; let server: Server; let origin = ''; let user: any = null;
let E1 = '', E2 = ''; const caseIds: Record<string, string> = {};
const as = (uid: string, tenantId = tenantOf[uid] ?? T) => { user = { id: uid, role: roles[uid], tenantId, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown, key?: string) => fetch(origin + '/jobs' + path, { method,
  headers: { 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  .then(async r => ({ status: r.status, body: await r.json() as any }));
const enqueue = (uid: string, key: string, body: Record<string, unknown>) => { as(uid); return call('POST', '', { jobType: 'REPORT_GENERATION', payload: { report: key }, ...body }, key); };
const list = (uid: string, query = '') => { as(uid); return call('GET', query); };
const ids = (r: { body: any }) => (r.body.jobs as any[]).map(j => j.id).sort();
const sql = async (text: string, values: unknown[] = []) => (await db.pool.query(text, values)).rows;
const events = async (job: string) => (await sql(`SELECT action, actor, worker, status_after FROM taxguard_durable_job_events WHERE job_id = $1 ORDER BY event_id`, [job]));
const expireLease = (job: string) => sql(`UPDATE taxguard_durable_jobs SET lease_expires_at = now() - interval '1 second' WHERE id = $1`, [job]);
const code = (p: Promise<unknown>) => p.then(() => 'OK', (e: any) => e?.code ?? String(e));
const jobs: Record<string, string> = {};

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic job queue practice'), ('${T2}', 'Other synthetic practice'), ('${TW}', 'Synthetic worker practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'jq-client', 'Synthetic Job Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ('${T}', 'jq-mgr', 'practice_manager', 'active', NULL), ('${T}', 'jq-admin', 'admin', 'active', NULL),
      ('${T}', 'jq-prep1', 'accountant', 'active', NULL), ('${T}', 'jq-prep2', 'accountant', 'active', NULL), ('${T}', 'jq-wide', 'reviewer', 'active', NULL),
      ('${T}', 'jq-client', 'client', 'active', '${C}'), ('${T2}', 'jq-foreign', 'admin', 'active', NULL), ('${TW}', 'jw-admin', 'admin', 'active', NULL);`);
  const practice = new PracticeStore(pgRpc(db.pool)), cases = new CaseStore(pgRpc(db.pool));
  const engagement = async (key: string) => {
    const id = (await practice.createEngagement(T, C, 'jq-mgr', key, { title: 'Synthetic ' + key, type: 'tax_preparation', taxYears: [2025] })).engagementId;
    await practice.setEngagementStatus(T, C, 'jq-mgr', id, 'active', 1);
    return id;
  };
  E1 = await engagement('jq-engagement-1'); E2 = await engagement('jq-engagement-2');
  await practice.assign(T, C, 'jq-mgr', 'jq-assign-prep1', { engagementId: E1, taxYear: 2025, role: 'preparer', userId: 'jq-prep1', reason: 'Synthetic staffing' });
  await practice.assign(T, C, 'jq-mgr', 'jq-assign-prep2', { engagementId: E2, taxYear: 2025, role: 'preparer', userId: 'jq-prep2', reason: 'Synthetic staffing' });
  for (const [engagementId, n] of [[E1, 1], [E2, 2]] as const)
    await practice.assign(T, C, 'jq-mgr', `jq-assign-rev${n}`, { engagementId, taxYear: 2025, role: 'reviewer', userId: 'jq-wide', reason: 'Synthetic staffing' });
  await sql(`INSERT INTO taxguard_staff_assignments(id, tenant_id, client_id, engagement_id, tax_year, role, user_id, assigned_by, status, effective_from)
    VALUES ('jq-wide-1', '${T}', '${C}', NULL, NULL, 'reviewer', 'jq-wide', 'jq-mgr', 'ACTIVE', now() - interval '1 day')`);
  caseIds.E1 = (await cases.create(T, C, 'jq-mgr', 'jq-case-e1', { engagementId: E1, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  caseIds.E2 = (await cases.create(T, C, 'jq-mgr', 'jq-case-e2', { engagementId: E2, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  const app = express(); app.use(express.json());
  app.use('/jobs', createJobsRouter({ client: () => pgRpc(db.pool), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 240_000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await db?.stop(); });

describe('durable job queue: enqueue, scope and idempotency', () => {
  it('an engagement-year assignee enqueues for its own case only, and a replay returns the same job', async () => {
    const first = await enqueue('jq-prep1', 'jq-key-e1-0001', { clientId: C, caseId: caseIds.E1 });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body).toMatchObject({ status: 'PENDING', clientId: C, caseId: caseIds.E1, priority: 5, maxAttempts: 5, attemptCount: 0, createdBy: 'jq-prep1', replayed: false });
    jobs.e1 = first.body.id;
    const replay = await enqueue('jq-prep1', 'jq-key-e1-0001', { clientId: C, caseId: caseIds.E1 });
    expect(replay.body).toMatchObject({ id: jobs.e1, replayed: true });
    as('jq-prep1');
    expect((await call('POST', '', { jobType: 'REPORT_GENERATION', payload: { report: 'different' }, clientId: C, caseId: caseIds.E1 }, 'jq-key-e1-0001')).body)
      .toEqual({ code: 'JOB_IDEMPOTENCY_CONFLICT' });
    expect((await enqueue('jq-prep1', 'jq-key-e2-by-prep1', { clientId: C, caseId: caseIds.E2 })).body).toEqual({ code: 'JOB_CLIENT_NOT_FOUND' });
    expect((await enqueue('jq-prep1', 'jq-key-client-by-prep1', { clientId: C })).body).toEqual({ code: 'JOB_CLIENT_NOT_FOUND' });
    expect((await sql(`SELECT count(*)::int AS n FROM taxguard_durable_jobs WHERE tenant_id = $1`, [T]))[0].n).toBe(1);
    expect(await events(jobs.e1)).toEqual([{ action: 'ENQUEUED', actor: 'jq-prep1', worker: null, status_after: 'PENDING' }]);
  });

  it('client-level jobs need client-wide scope; tenant-wide jobs need an administrator', async () => {
    jobs.e2 = (await enqueue('jq-prep2', 'jq-key-e2-0001', { clientId: C, caseId: caseIds.E2 })).body.id;
    const clientLevel = await enqueue('jq-wide', 'jq-key-client-0001', { clientId: C });
    expect(clientLevel.status).toBe(201); jobs.client = clientLevel.body.id;
    expect((await enqueue('jq-mgr', 'jq-key-tenant-mgr', {})).body).toEqual({ code: 'JOB_SCOPE_REQUIRED' });
    const tenantWide = await enqueue('jq-admin', 'jq-key-tenant-0001', {});
    expect(tenantWide.status).toBe(201); jobs.tenant = tenantWide.body.id;
    expect(tenantWide.body.clientId).toBeNull();
  });

  it('refuses clients, foreign tenants, unknown cases and invalid input', async () => {
    expect((await enqueue('jq-client', 'jq-key-client-self', { clientId: C })).body).toEqual({ code: 'JOB_ACCESS_DENIED' });
    // The database refuses a client actor even without the router's check.
    expect((await pgRpc(db.pool).rpc('taxguard_job_list', { p_tenant: T, p_actor: 'jq-client', p_client: C, p_status: null, p_job_type: null, p_limit: 10, p_offset: 0 })).error)
      .toMatchObject({ message: 'PRACTICE_ACCESS_DENIED' });
    as('jq-foreign', T);
    expect((await call('GET', '?clientId=' + C)).body).toEqual({ code: 'JOB_ACCESS_DENIED' });
    expect((await enqueue('jq-admin', 'jq-key-bad-case', { clientId: C, caseId: 'case-does-not-exist' })).body).toEqual({ code: 'JOB_CLIENT_NOT_FOUND' });
    expect((await enqueue('jq-admin', 'jq-key-bad-type', { jobType: 'RUN_ANYTHING' })).body).toEqual({ code: 'JOB_INPUT_INVALID' });
    expect((await enqueue('jq-admin', 'jq-key-bad-prio', { priority: 11 })).body).toEqual({ code: 'JOB_INPUT_INVALID' });
    expect((await enqueue('jq-admin', 'jq-key-big-load', { payload: { blob: 'x'.repeat(70_000) } })).body).toEqual({ code: 'JOB_INPUT_INVALID' });
    as('jq-admin');
    expect((await call('POST', '', { jobType: 'REPORT_GENERATION', payload: {} })).body).toEqual({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  });

  it('lists only the jobs in the actor\'s scope', async () => {
    expect(ids(await list('jq-prep1', '?clientId=' + C))).toEqual([jobs.e1]);
    expect(ids(await list('jq-prep2', '?clientId=' + C))).toEqual([jobs.e2]);
    expect(ids(await list('jq-wide', '?clientId=' + C))).toEqual([jobs.e1, jobs.e2, jobs.client].sort());
    expect((await list('jq-prep1')).body).toEqual({ code: 'JOB_SCOPE_REQUIRED' });
    const all = await list('jq-admin');
    expect(ids(all)).toEqual([jobs.e1, jobs.e2, jobs.client, jobs.tenant].sort());
    expect(all.body.total).toBe(4);
    expect((await list('jq-admin', '?limit=1&offset=1')).body.jobs).toHaveLength(1);
    expect((await list('jq-admin', '?limit=0')).body).toEqual({ code: 'JOB_QUERY_INVALID' });
    expect(ids(await list('jq-foreign'))).toEqual([]);
  });
});

describe('durable job queue: retry and cancel', () => {
  it('only administrators re-queue a dead-lettered job, and only from DEAD_LETTER or FAILED', async () => {
    await sql(`UPDATE taxguard_durable_jobs SET status = 'DEAD_LETTER' WHERE id = $1`, [jobs.e1]);
    as('jq-prep1'); expect((await call('POST', `/${jobs.e1}/retry`)).body).toEqual({ code: 'JOB_ADMIN_REQUIRED' });
    as('jq-prep2'); expect((await call('POST', `/${jobs.e1}/retry`)).body).toEqual({ code: 'JOB_NOT_FOUND' });
    as('jq-admin');
    const retried = await call('POST', `/${jobs.e1}/retry`);
    expect(retried.body).toMatchObject({ id: jobs.e1, status: 'PENDING', maxAttempts: 8 });
    expect((await call('POST', `/${jobs.e1}/retry`)).body).toEqual({ code: 'JOB_STATE_INVALID' });
    expect((await events(jobs.e1)).map(e => e.action)).toEqual(['ENQUEUED', 'RETRIED']);
  });

  it('accountants and administrators in scope cancel; a reviewer cannot; a completed job cannot be cancelled', async () => {
    as('jq-wide'); expect((await call('POST', `/${jobs.client}/cancel`)).body).toEqual({ code: 'JOB_CANCEL_NOT_AUTHORIZED' });
    as('jq-prep1'); expect((await call('POST', `/${jobs.e2}/cancel`)).body).toEqual({ code: 'JOB_NOT_FOUND' });
    as('jq-prep2');
    expect((await call('POST', `/${jobs.e2}/cancel`)).body).toMatchObject({ id: jobs.e2, status: 'CANCELLED', cancelledBy: 'jq-prep2' });
    expect((await call('POST', `/${jobs.e2}/cancel`)).body).toMatchObject({ status: 'CANCELLED' });
    expect((await events(jobs.e2)).map(e => e.action)).toEqual(['ENQUEUED', 'CANCELLED']);
    // A cancelled job keeps its key: the replay returns it, and it is not re-created.
    expect((await enqueue('jq-prep2', 'jq-key-e2-0001', { clientId: C, caseId: caseIds.E2 })).body).toMatchObject({ id: jobs.e2, status: 'CANCELLED', replayed: true });
    await sql(`UPDATE taxguard_durable_jobs SET status = 'COMPLETED' WHERE id = $1`, [jobs.tenant]);
    as('jq-admin'); expect((await call('POST', `/${jobs.tenant}/cancel`)).body).toEqual({ code: 'JOB_STATE_INVALID' });
  });
});

describe('durable job queue: workers', () => {
  const worker = (id: string, conn = db.pool) => new DurableJobWorker(pgRpc(conn), TW, id);
  const seed = async (key: string, body: Record<string, unknown> = {}) => (await enqueue('jw-admin', key, body)).body.id as string;

  it('concurrent workers never claim the same job', async () => {
    const seeded = await Promise.all(['jw-c-0001', 'jw-c-0002', 'jw-c-0003', 'jw-c-0004'].map(k => seed(k)));
    const conns = await Promise.all([1, 2, 3, 4, 5, 6].map(() => db.connect()));
    try {
      const claims = await Promise.all(conns.map((c, i) => worker('worker-' + i, c as any).claim(60)));
      const claimed = claims.filter(Boolean).map(j => j!.id);
      expect(claimed.sort()).toEqual([...seeded].sort());
      expect(claims.filter(j => j === null)).toHaveLength(2);
      for (const j of claims.filter(Boolean)) await worker(j!.lockedBy as string).complete(j!);
    } finally { await Promise.all(conns.map(c => c.end())); }
    expect((await sql(`SELECT count(*)::int AS n FROM taxguard_durable_jobs WHERE tenant_id = $1 AND status = 'COMPLETED'`, [TW]))[0].n).toBe(4);
  });

  it('a claim skips a job another transaction holds, instead of waiting for it', async () => {
    const held = await seed('jw-s-0001', { priority: 1 }), next = await seed('jw-s-0002', { priority: 2 });
    const holder = await db.connect(), claimer = await db.connect();
    try {
      await holder.query('BEGIN');
      await holder.query(`SELECT 1 FROM taxguard_durable_jobs WHERE id = $1 FOR UPDATE`, [held]);
      await claimer.query(`SET statement_timeout = '3s'`);
      const claimed = (await worker('worker-s', claimer as any).claim(60))!;
      expect(claimed.id).toBe(next);
      await holder.query('ROLLBACK');
      await worker('worker-s').complete(claimed);
      const after = (await worker('worker-s').claim(60))!;
      expect(after.id).toBe(held);
      await worker('worker-s').complete(after);
    } finally { await holder.end(); await claimer.end(); }
  });

  it('claims by priority, then due time', async () => {
    const low = await seed('jw-p-0001', { priority: 9 }), high = await seed('jw-p-0002', { priority: 1 });
    const later = await seed('jw-p-0003', { priority: 1, availableAt: new Date(Date.now() + 3_600_000).toISOString() });
    const a = await worker('worker-p').claim(60), b = await worker('worker-p').claim(60);
    expect([a?.id, b?.id]).toEqual([high, low]);
    expect(await worker('worker-p').claim(60)).toBeNull();
    for (const j of [a!, b!]) await worker('worker-p').complete(j);
    await sql(`UPDATE taxguard_durable_jobs SET status = 'CANCELLED' WHERE id = $1`, [later]);
  });

  it('fences complete and fail by worker, lease token and lease expiry', async () => {
    const id = await seed('jw-f-0001');
    const first = (await worker('worker-a').claim(60))!;
    expect(first).toMatchObject({ id, status: 'CLAIMED', attemptCount: 1, lockedBy: 'worker-a' });
    expect(await code(worker('worker-b').complete(first))).toBe('JOB_WORKER_CLAIM_REQUIRED');
    expect(await code(worker('worker-a').complete({ id, leaseToken: '00000000-0000-4000-8000-000000000000' }))).toBe('JOB_WORKER_CLAIM_REQUIRED');
    await expireLease(id);
    expect(await code(worker('worker-a').complete(first))).toBe('JOB_WORKER_CLAIM_REQUIRED');
    const second = (await worker('worker-b').claim(60))!;
    expect(second).toMatchObject({ id, attemptCount: 2, lockedBy: 'worker-b' });
    expect(second.leaseToken).not.toBe(first.leaseToken);
    expect(await code(worker('worker-a').fail(first, { code: 'PROVIDER_TIMEOUT', message: 'late' }))).toBe('JOB_WORKER_CLAIM_REQUIRED');
    expect(await worker('worker-b').complete(second)).toMatchObject({ status: 'COMPLETED', lockedBy: null });
    expect((await events(id)).map(e => [e.action, e.worker])).toEqual([['ENQUEUED', null], ['CLAIMED', 'worker-a'], ['CLAIMED', 'worker-b'], ['COMPLETED', 'worker-b']]);
  });

  it('schedules a transient failure with backoff and dead-letters a permanent one', async () => {
    const id = await seed('jw-r-0001');
    const claimed = (await worker('worker-r').claim(60))!;
    const failed = await worker('worker-r').fail(claimed, { code: 'PROVIDER_TIMEOUT', message: 'Synthetic timeout' }) as any;
    expect(failed).toMatchObject({ status: 'RETRY_SCHEDULED', lastErrorCode: 'PROVIDER_TIMEOUT', lockedBy: null });
    const delay = (Date.parse(failed.availableAt) - Date.parse(failed.updatedAt)) / 1000;
    expect(delay).toBeGreaterThanOrEqual(29); expect(delay).toBeLessThanOrEqual(31);
    expect(failed.retryHistory).toHaveLength(1);
    expect(await worker('worker-r').claim(60)).toBeNull();
    await sql(`UPDATE taxguard_durable_jobs SET available_at = now() WHERE id = $1`, [id]);
    const again = (await worker('worker-r').claim(60))!;
    expect(again.attemptCount).toBe(2);
    expect(await worker('worker-r').fail(again, { code: 'VALIDATION_SCHEMA', message: 'Synthetic invalid payload' })).toMatchObject({ status: 'DEAD_LETTER' });
    expect(await code(worker('worker-r').fail(again, { code: 'bad code', message: '' }))).toBe('JOB_INPUT_INVALID');
  });

  it('dead-letters a job whose lease expired after its last attempt instead of claiming it again', async () => {
    const id = await seed('jw-l-0001', { maxAttempts: 1 });
    await worker('worker-l').claim(60); await expireLease(id);
    expect(await worker('worker-m').claim(60)).toBeNull();
    expect((await sql(`SELECT status, last_error_code FROM taxguard_durable_jobs WHERE id = $1`, [id]))[0]).toEqual({ status: 'DEAD_LETTER', last_error_code: 'LEASE_EXPIRED' });
    expect((await events(id)).map(e => e.action)).toEqual(['ENQUEUED', 'CLAIMED', 'LEASE_EXPIRED']);
    expect(await code(worker('worker-l').claim(0))).toBe('JOB_INVALID_CLAIM');
  });

  it('keeps the event log append-only and the queue internals off the service role', async () => {
    await expect(sql(`UPDATE taxguard_durable_job_events SET actor = 'x' WHERE job_id = $1`, [jobs.e1])).rejects.toThrow(/JOB_EVENTS_APPEND_ONLY/);
    await expect(sql(`DELETE FROM taxguard_durable_job_events WHERE job_id = $1`, [jobs.e1])).rejects.toThrow(/JOB_EVENTS_APPEND_ONLY/);
    const privileges = await sql(`SELECT p.proname, has_function_privilege('service_role', p.oid, 'EXECUTE') AS service,
        has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE') AS client
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard\\_job\\_%' ORDER BY 1`);
    expect(privileges.filter(p => p.client)).toEqual([]);
    expect(privileges.filter(p => p.service).map(p => p.proname)).toEqual(['taxguard_job_cancel', 'taxguard_job_claim', 'taxguard_job_complete',
      'taxguard_job_enqueue', 'taxguard_job_fail', 'taxguard_job_list', 'taxguard_job_retry']);
    for (const role of ['anon', 'authenticated'])
      expect((await sql(`SELECT has_table_privilege($1, 'public.taxguard_durable_job_events', 'SELECT') AS ok`, [role]))[0].ok).toBe(false);
  });
});
