import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { createPracticeRouter } from '../server/routes/practice.routes';

// Block 85: deadline escalation derived when read (proposal 20261019260000, review only) over HTTP through the durable
// practice router on real PostgreSQL with every proposal applied. The thresholds are the in-memory service's defaults.
// Engagement-year scope follows the owner decision of 2026-10-19. SYNTHETIC data only.
const T = 'tenantDeadlineEscalation', C = 'deClient', C2 = 'deClientOther';
const roles: Record<string, string> = { 'de-mgr': 'practice_manager', 'de-prep25': 'accountant', 'de-prep24': 'accountant', 'de-client': 'client' };
const HOUR = 3_600_000;
let db: TestDatabase; let server: Server; let origin = ''; let user: any = null;
const ids: Record<string, string> = {};
const call = (uid: string, query = '') => { user = { id: uid, role: roles[uid], tenantId: T, status: 'active' };
  return fetch(origin + '/practice/deadline-escalations' + query).then(async r => ({ status: r.status, body: await r.json() as any })); };
const titles = (body: any) => (body.deadlines as any[]).map(d => [d.title, d.levelName]);
const snapshot = async () => (await db.pool.query(`SELECT id, status, escalation_level, last_escalated_at, updated_at FROM taxguard_deadlines WHERE tenant_id = $1 ORDER BY id`, [T])).rows;

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic deadline practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'de-client', 'Synthetic Deadline Client'), ('${T}', '${C2}', 'de-client2', 'Other Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ('${T}', 'de-mgr', 'practice_manager', 'active', NULL), ('${T}', 'de-prep25', 'accountant', 'active', NULL),
      ('${T}', 'de-prep24', 'accountant', 'active', NULL), ('${T}', 'de-client', 'client', 'active', '${C}');`);
  const practice = new PracticeStore(pgRpc(db.pool));
  const e1 = (await practice.createEngagement(T, C, 'de-mgr', 'de-engagement-1', { title: 'Synthetic engagement', type: 'tax_preparation', taxYears: [2025, 2024] })).engagementId;
  await practice.setEngagementStatus(T, C, 'de-mgr', e1, 'active', 1);
  await practice.assign(T, C, 'de-mgr', 'de-assign-25', { engagementId: e1, taxYear: 2025, role: 'preparer', userId: 'de-prep25', reason: 'Synthetic staffing' });
  await practice.assign(T, C, 'de-mgr', 'de-assign-24', { engagementId: e1, taxYear: 2024, role: 'preparer', userId: 'de-prep24', reason: 'Synthetic staffing' });
  const e2 = (await practice.createEngagement(T, C2, 'de-mgr', 'de-engagement-2', { title: 'Synthetic other', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C2, 'de-mgr', e2, 'active', 1);
  const add = async (client: string, title: string, hours: number, body: Record<string, unknown> = {}) =>
    (ids[title] = (await practice.addDeadline(T, client, 'de-mgr', 'de-ddl-' + title, { title, category: 'internal_prep', taxYear: 2025,
      dueDate: new Date(Date.now() + hours * HOUR).toISOString(), ...body }) as any).deadlineId);
  await add(C, 'FAR', 240); await add(C, 'APPROACHING', 120); await add(C, 'SOON', 24); await add(C, 'LATE', -48);
  await add(C, 'LONG-LATE', -240); await add(C, 'STATUTORY', -1, { authorityType: 'STATUTORY', sourceCitation: 'Synthetic citation for testing' });
  await add(C, 'LATE-2024', -48, { taxYear: 2024 }); await add(C2, 'OTHER-CLIENT', 24);
  await add(C, 'MET', -48); await add(C, 'WAIVED', -48);
  await practice.resolveDeadline(T, C, 'de-mgr', ids.MET, 'MET');
  await practice.resolveDeadline(T, C, 'de-mgr', ids.WAIVED, 'WAIVED', 'Synthetic waiver reason');
  // A row the in-memory-style sweep would have written before this proposal.
  await db.pool.query(`INSERT INTO taxguard_deadlines(id, tenant_id, client_id, tax_year, category, title, due_date, status, escalation_level)
    VALUES ('de-legacy-overdue', '${T}', '${C}', 2025, 'internal_prep', 'LEGACY', now() - interval '72 hours', 'OVERDUE', 3)`);
  const app = express(); app.use(express.json());
  app.use('/practice', createPracticeRouter({ store: () => practice, authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 240_000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await db?.stop(); });

describe('deadline escalation, derived when read', () => {
  it('a manager sees every open deadline, most urgent first, with counts and the thresholds used', async () => {
    const r = await call('de-mgr', `?clientId=${C}`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(titles(r.body)).toEqual([['LONG-LATE', 'CRITICAL'], ['STATUTORY', 'CRITICAL'], ['LEGACY', 'OVERDUE'], ['LATE', 'OVERDUE'], ['LATE-2024', 'OVERDUE'],
      ['SOON', 'DUE_SOON'], ['APPROACHING', 'APPROACHING'], ['FAR', 'NORMAL']]);
    expect(r.body.counts).toEqual({ NORMAL: 1, APPROACHING: 1, DUE_SOON: 1, OVERDUE: 3, CRITICAL: 2 });
    expect(r.body.thresholds).toMatchObject({ approachingHours: 168, dueSoonHours: 48, criticalOverdueHours: 168, statutoryOverdueIsCritical: true });
    expect(r.body.deadlines.find((d: any) => d.title === 'SOON').hoursUntilDue).toBe(24);
    expect(titles((await call('de-mgr')).body).map(t => t[0])).toContain('OTHER-CLIENT');
  });

  it('staff see only the deadlines of their own tax year', async () => {
    const r25 = await call('de-prep25', `?clientId=${C}`);
    expect(titles(r25.body).map(t => t[0])).toEqual(['LONG-LATE', 'STATUTORY', 'LEGACY', 'LATE', 'SOON', 'APPROACHING', 'FAR']);
    expect(r25.body.counts.OVERDUE).toBe(2);
    expect(titles((await call('de-prep24')).body)).toEqual([['LATE-2024', 'OVERDUE']]);
  });

  it('filters by level without changing the counts, and refuses bad input and clients', async () => {
    const r = await call('de-mgr', `?clientId=${C}&minLevel=4`);
    expect(titles(r.body).map(t => t[0])).toEqual(['LONG-LATE', 'STATUTORY']);
    expect(r.body.counts).toEqual({ NORMAL: 1, APPROACHING: 1, DUE_SOON: 1, OVERDUE: 3, CRITICAL: 2 });
    expect(await call('de-mgr', '?minLevel=5')).toEqual({ status: 400, body: { code: 'PRACTICE_INPUT_INVALID' } });
    expect(await call('de-mgr', '?minLevel=x')).toEqual({ status: 400, body: { code: 'PRACTICE_INPUT_INVALID' } });
    expect((await call('de-client')).body).toEqual({ code: 'PRACTICE_ACCESS_DENIED' });
  });

  it('writes nothing', async () => {
    const before = await snapshot();
    await call('de-mgr'); await call('de-prep25'); await call('de-mgr', '?minLevel=3');
    expect(await snapshot()).toEqual(before);
    expect(before.filter(d => d.id !== 'de-legacy-overdue').every(d => d.escalation_level === 0 && d.last_escalated_at === null)).toBe(true);
  });

  it('applies the thresholds at their exact boundaries', async () => {
    const level = async (offset: string, authority = 'INTERNAL') => (await db.pool.query(
      `SELECT public.taxguard_deadline_level(t + $1::interval, $2, t) AS l FROM (SELECT now() AS t) x`, [offset, authority])).rows[0].l;
    expect(await level('169 hours')).toBe(0);
    expect(await level('168 hours')).toBe(1);
    expect(await level('49 hours')).toBe(1);
    expect(await level('48 hours')).toBe(2);
    expect(await level('0 seconds')).toBe(2);
    expect(await level('-1 second')).toBe(3);
    expect(await level('-168 hours')).toBe(3);
    expect(await level('-168 hours -1 second')).toBe(4);
    expect(await level('-1 second', 'STATUTORY')).toBe(4);
    expect(await level('1 hour', 'STATUTORY')).toBe(2);
  });
});
