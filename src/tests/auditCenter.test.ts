import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAuditCenterRouter } from '../server/routes/audit-center.routes';
import { AuditCenterStore } from '../server/taxguard/audit/auditCenterStore';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// HTTP -> /api/audit-center -> AuditCenterStore -> proposal 041 (PGlite). Synthetic audit rows only,
// including deliberately sensitive synthetic payloads that must never be returned.
const T = 'tenantA';
const people: Record<string, any> = { admin: { id: 'au-admin', role: 'admin' }, mgr: { id: 'au-mgr', role: 'practice_manager' }, acct: { id: 'au-acct', role: 'accountant' },
  client: { id: 'au-client', role: 'client', clientId: 'auClient' }, suspended: { id: 'au-suspended', role: 'admin' }, foreign: { id: 'au-foreign', role: 'admin' } };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let user: any;
const as = (who: string, tenantId = T) => { user = { ...people[who], tenantId, status: 'active' }; };
const get = (path: string, params: Record<string, string> = {}) => fetch(origin + '/audit' + path + '?' + new URLSearchParams(params)).then(async r => ({ status: r.status, body: await r.json().catch(() => null) as any }));
const range = { from: new Date(Date.now() - 3 * 86_400_000).toISOString(), to: new Date(Date.now() + 86_400_000).toISOString() };
const SENSITIVE = { clientId: 'auClient', appointmentId: 'apt_' + 'b'.repeat(32), status: 'CONFIRMED', password: 'Synthetic-Password-1!', factorSecret: 'JBSWY3DPEHPK3PXP',
  sessionToken: 'tg_live_' + 'c'.repeat(64), body: 'Synthetic private message body', reason: 'Synthetic private reason', amount: '1234.56', email: 'synthetic@example.test',
  note: 'x', uid: 'au-acct', nested: { secret: 'y' }, version: 3 };

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^2026101441|^2026101446/);
  await fixture.pg.exec(`INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES('${T}','au-admin','admin','active',NULL),('${T}','au-mgr','practice_manager','active',NULL),
      ('${T}','au-acct','accountant','active',NULL),('${T}','au-client','client','active','auClient'),('${T}','au-suspended','admin','suspended',NULL),('tenantB','au-foreign','admin','active',NULL);`);
  await fixture.pg.query(`INSERT INTO taxguard_audit_log(tenant_id,action,actor_uid,actor_role,metadata,ip_address) VALUES ($1,'APPOINTMENT_CONFIRMED','au-acct','accountant',$2,'203.0.113.7')`, [T, JSON.stringify(SENSITIVE)]);
  for (let i = 0; i < 7; i++) await fixture.pg.query(`INSERT INTO taxguard_audit_log(tenant_id,action,actor_uid,actor_role,metadata,timestamp) VALUES ($1,$2,'au-mgr','practice_manager',$3, now() - ($4 || ' minutes')::interval)`,
    [T, i % 2 ? 'COMM_MESSAGE_POSTED' : 'PRACTICE_TASK_CREATED', JSON.stringify({ clientId: i < 4 ? 'auClient' : 'auOther', threadId: 'thr_' + String(i).repeat(32).slice(0, 32) }), String(i + 1)]);
  await fixture.pg.query(`INSERT INTO taxguard_audit_log(tenant_id,action,actor_uid,metadata) VALUES ('tenantB','FOREIGN_SECRET_EVENT','au-foreign','{"clientId":"foreignClient"}')`);
  const app = express();
  app.use('/audit', createAuditCenterRouter({ store: () => new AuditCenterStore(pgliteRpc(() => fixture.pg)), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 120000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

describe('administrative audit center', () => {
  it('is for active administrators of the tenant only', async () => {
    for (const who of ['mgr', 'acct', 'suspended']) { as(who); expect((await get('/events', range)).body.code, who).toBe('AUDIT_ADMIN_REQUIRED'); }
    as('client'); expect((await get('/events', range)).status).toBe(403);
    as('foreign', 'tenantB'); const foreign = (await get('/events', range)).body;
    expect(foreign.items.map((e: any) => e.action)).toEqual(['FOREIGN_SECRET_EVENT']); // only its own tenant
    as('admin'); expect((await get('/events', range)).body.items.some((e: any) => e.action === 'FOREIGN_SECRET_EVENT')).toBe(false);
  });

  it('returns only allow-listed identifiers and codes, and counts what it withheld', async () => {
    as('admin');
    const page = (await get('/events', { ...range, category: 'APPOINTMENT' })).body;
    expect(page.items).toHaveLength(1);
    const e = page.items[0];
    expect(e).toMatchObject({ action: 'APPOINTMENT_CONFIRMED', category: 'APPOINTMENT', actorUid: 'au-acct', clientId: 'auClient',
      fields: { clientId: 'auClient', appointmentId: SENSITIVE.appointmentId, status: 'CONFIRMED', uid: 'au-acct', version: 3 } });
    expect(e.redactedFields).toBe(9); // 14 keys, 5 allow-listed
    const text = JSON.stringify(page);
    for (const secret of [SENSITIVE.password, SENSITIVE.factorSecret, SENSITIVE.sessionToken, SENSITIVE.body, SENSITIVE.reason, SENSITIVE.amount, SENSITIVE.email, '203.0.113.7', '"y"'])
      expect(text, secret).not.toContain(secret);
    const detail = (await get('/events/' + e.eventId)).body;
    expect(detail).toEqual(e);
    expect((await get('/events/00000000-0000-4000-8000-000000000000')).status).toBe(404);
    as('foreign', 'tenantB'); expect((await get('/events/' + e.eventId)).status).toBe(404);
  });

  it('filters, paginates by keyset without duplicates, and bounds range and page size', async () => {
    as('admin');
    expect((await get('/events', { ...range, clientId: 'auClient', category: 'COMM' })).body.items.map((x: any) => x.action)).toEqual(['COMM_MESSAGE_POSTED', 'COMM_MESSAGE_POSTED']);
    expect((await get('/events', { ...range, actorUid: 'au-mgr' })).body.items).toHaveLength(7);
    const first = (await get('/events', { ...range, limit: '3' })).body;
    expect(first.items).toHaveLength(3); expect(first.nextCursor).toBeTruthy();
    const seen = [...first.items]; let cursor = first.nextCursor;
    while (cursor) { const p = (await get('/events', { ...range, limit: '3', cursor })).body; seen.push(...p.items); cursor = p.nextCursor; }
    expect(seen).toHaveLength(8);
    expect(new Set(seen.map((x: any) => x.eventId)).size).toBe(8);
    expect(seen.map((x: any) => x.at)).toEqual([...seen.map((x: any) => x.at)].sort().reverse());
    expect((await get('/events', { from: range.from, to: new Date(Date.now() + 100 * 86_400_000).toISOString() })).body.code).toBe('AUDIT_RANGE_INVALID');
    expect((await get('/events', { ...range, limit: '500' })).body.code).toBe('AUDIT_INPUT_INVALID');
    expect((await get('/events', { ...range, cursor: 'not-a-cursor' })).body.code).toBe('AUDIT_INPUT_INVALID');
    expect((await get('/events', { ...range, category: "x' OR 1=1" })).body.code).toBe('AUDIT_INPUT_INVALID');
    expect((await get('/categories', range)).body).toEqual([{ category: 'APPOINTMENT', count: 1 }, { category: 'COMM', count: 3 }, { category: 'PRACTICE', count: 4 }]);
  });

  it('filters to the recorded security categories (proposal 046) and validates them', async () => {
    await fixture.pg.query("INSERT INTO taxguard_audit_log(tenant_id,action,actor_uid,actor_role,metadata) VALUES ('tenantA','STAFF_MEMBER_SUSPENDED','au-admin','admin','{\"targetUid\":\"au-acct\",\"reason\":\"Synthetic private reason\"}'),('tenantA','SESSION_REVOKED','au-admin','admin','{}')");
    as('admin');
    const sec = (await get('/events', { ...range, categories: 'SESSION,STAFF,AUTH,AI,KILL' })).body.items;
    expect(sec.map((e: any) => e.action).sort()).toEqual(['SESSION_REVOKED', 'STAFF_MEMBER_SUSPENDED']);
    expect(JSON.stringify(sec)).not.toContain('Synthetic private reason');
    expect((await get('/events', { ...range, categories: 'staff' })).body.code).toBe('AUDIT_INPUT_INVALID');
    expect((await get('/events', { ...range, categories: Array.from({ length: 11 }, (_, i) => 'CAT' + i).join(',') })).body.code).toBe('AUDIT_INPUT_INVALID');
  });

  it('is read-only and exposes only the service RPCs to service_role', async () => {
    as('admin');
    expect((await fetch(origin + '/audit/events', { method: 'POST' })).status).toBe(405);
    const rows = (await fixture.pg.query<{ proname: string; anon: boolean; auth: boolean; svc: boolean }>(`SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth, has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc FROM pg_proc p
      WHERE p.proname LIKE 'taxguard\\_audit\\_center\\_%' ORDER BY 1`)).rows;
    expect(rows.filter(r => r.anon || r.auth)).toEqual([]);
    expect(rows.filter(r => r.svc).map(r => r.proname)).toEqual(['taxguard_audit_center_categories', 'taxguard_audit_center_event', 'taxguard_audit_center_list']);
  });
});
