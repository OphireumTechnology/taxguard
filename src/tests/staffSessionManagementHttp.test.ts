import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStaffAccessRouter } from '../server/routes/staff-access.routes';
import { attachSessionAssuranceLevel } from '../server/staffMfa';
import { StaffAccessRateLimit } from '../server/staffAccessRateLimit';
import { revokeMemberSessions, listOwnSessions } from '../server/staffSessionManagement';
import { capabilityFixture } from './aiCapabilities.fixture';

// HTTP -> router -> service -> proposed SQL (PGlite, synthetic). The rpc adapter stands in for
// the Supabase service client; it forwards named arguments and Postgres error codes unchanged.
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string;
let user: any; let bearer: string | undefined;
let clock = 0;
const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
const tokenOf = (c: string) => 'tg_live_' + c.repeat(64);
const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');
const rpc = async (name: string, args: Record<string, unknown>) => {
  rpcCalls.push({ name, args });
  if (!/^taxguard_[a-z_]+$/.test(name)) throw new Error('unexpected rpc');
  const keys = Object.keys(args);
  try {
    const result = await fixture.pg.query<{ r: unknown }>(`SELECT public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(',')}) AS r`, keys.map(k => args[k]));
    return { data: JSON.parse(JSON.stringify(result.rows[0].r)), error: null };
  } catch (error: any) { return { data: null, error: { code: error.code, message: error.message } }; }
};
const as = (id: string, role: string, token: string, aal: 'aal1' | 'aal2' = 'aal2', tenantId = 'tenantA') => {
  user = { id, role, tenantId, status: 'active' }; attachSessionAssuranceLevel(user, aal); bearer = token;
};
const send = (method: 'GET' | 'POST', path: string, body?: unknown) => fetch(origin + '/staff' + path, {
  method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const revokedOf = async (uid: string) => (await fixture.pg.query<{ n: number }>("SELECT count(*)::int AS n FROM taxguard_sessions WHERE uid=$1 AND revoked", [uid])).rows[0].n;

beforeAll(async () => {
  fixture = await capabilityFixture();
  for (const name of readdirSync('docs/proposed-migrations').filter(n => /^20261012(?:(?:0[0-9]|1[01])0000|230000)_/.test(n)).sort())
    await fixture.pg.exec(readFileSync('docs/proposed-migrations/' + name, 'utf8'));
  const app = express(); app.use(express.json({ limit: '32kb' }));
  app.use('/staff', createStaffAccessRouter({ client: () => ({ rpc } as any), tenantId: () => 'tenantA',
    limiter: new StaffAccessRateLimit(1000, 60_000, 10_000, () => clock),
    authenticate: (req: any, res, next) => { if (!user) return res.status(401).json({ code: 'AUTH_REQUIRED' }); req.user = user; req.token = bearer; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as any).port;
}, 30000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve()); await fixture?.pg.close(); });
beforeEach(async () => {
  clock += 120_000; rpcCalls.length = 0;
  const live = "(floor(extract(epoch FROM now())*1000)::bigint+3600000)", fresh = 'floor(extract(epoch FROM now()))::bigint';
  const rows: Array<[string, string, string, string]> = [['tenantA', 'http-staff', 'a', 'aal2'], ['tenantA', 'http-staff', 'b', 'aal2'],
    ['tenantA', 'http-admin', 'd', 'aal2'], ['tenantB', 'http-foreign', 'f', 'aal2']];
  await fixture.pg.exec(
    "DELETE FROM taxguard_sessions WHERE uid LIKE 'http-%'; DELETE FROM taxguard_identities WHERE uid LIKE 'http-%'; DELETE FROM taxguard_members WHERE uid LIKE 'http-%';" +
    "DELETE FROM taxguard_audit_log WHERE action LIKE '%SESSION%';" +
    "INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','http-staff','accountant','active'),('tenantA','http-admin','admin','active'),('tenantB','http-foreign','accountant','active');" +
    "INSERT INTO taxguard_identities(tenant_id,uid,user_data) SELECT tenant_id,uid,jsonb_build_object('id',uid,'tenantId',tenant_id,'role',role,'status',status) FROM taxguard_members WHERE uid LIKE 'http-%';" +
    'INSERT INTO taxguard_sessions(tenant_id,uid,session_token_hash,auth_time,expires_at,aal) VALUES ' +
    rows.map(([t, u, c, a]) => `('${t}','${u}','${hashOf(tokenOf(c))}',${fresh},${live},'${a}')`).join(',') + ';');
  as('http-staff', 'accountant', tokenOf('a'));
});

describe('staff session management over HTTP with the proposed SQL', () => {
  it('lists the caller\'s sessions with no-store and no token material', async () => {
    const response = await send('GET', '/sessions');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body.source).toBe('durable');
    expect(body.items).toHaveLength(2);
    expect(body.items.filter((s: any) => s.current)).toHaveLength(1);
    const text = JSON.stringify(body);
    expect(text).not.toContain(hashOf(tokenOf('a')));
    expect(text).not.toContain('tg_live_');
    expect(JSON.stringify(rpcCalls)).not.toContain('tg_live_');
  });

  it('revokes another own session; the revoked bearer can no longer act, and the current one must use logout', async () => {
    const items = (await (await send('GET', '/sessions')).json()).items;
    const other = items.find((s: any) => !s.current).sessionId, current = items.find((s: any) => s.current).sessionId;
    expect(await (await send('POST', `/sessions/${other}/revoke`)).json()).toEqual({ revoked: true });
    const self = await send('POST', `/sessions/${current}/revoke`);
    expect(self.status).toBe(400); expect(await self.json()).toEqual({ code: 'SESSION_CURRENT_USE_LOGOUT' });
    as('http-staff', 'accountant', tokenOf('b'));
    expect((await send('GET', '/sessions')).status).toBe(403);
  });

  it('signs out other sessions and keeps the current one', async () => {
    expect(await (await send('POST', '/sessions/revoke-others')).json()).toEqual({ revokedSessions: 1 });
    expect((await send('GET', '/sessions')).status).toBe(200);
    expect(await revokedOf('http-staff')).toBe(1);
  });

  it('rejects bodies on self-service revocation and malformed session identifiers before storage', async () => {
    expect((await send('POST', '/sessions/revoke-others', { uid: 'http-admin' })).status).toBe(400);
    expect((await send('POST', '/sessions/not-a-uuid/revoke')).status).toBe(400);
    expect(rpcCalls).toEqual([]);
  });

  it('cannot revoke a session that belongs to another member, even when its identifier is known', async () => {
    const adminSession = (await fixture.pg.query<{ id: string }>("SELECT id FROM taxguard_sessions WHERE uid='http-admin'")).rows[0].id;
    expect(await (await send('POST', `/sessions/${adminSession}/revoke`)).json()).toEqual({ revoked: false });
    expect(await revokedOf('http-admin')).toBe(0);
  });

  it('refuses AAL1 staff, missing durable bearer and unauthenticated callers', async () => {
    as('http-staff', 'accountant', tokenOf('a'), 'aal1');
    expect((await send('GET', '/sessions')).status).toBe(403);
    as('http-staff', 'accountant', 'legacy-local-token');
    expect((await send('GET', '/sessions')).status).toBe(401);
    user = null;
    expect((await send('GET', '/sessions')).status).toBe(401);
    expect(rpcCalls).toEqual([]);
  });

  it('administrator revokes all sessions of a staff member with a reason category; target is locked out immediately', async () => {
    as('http-admin', 'admin', tokenOf('d'));
    const response = await send('POST', '/members/http-staff/sessions/revoke', { reasonCategory: 'security_incident' });
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ revokedSessions: 2 });
    const audit = (await fixture.pg.query<{ metadata: any }>("SELECT metadata FROM taxguard_audit_log WHERE action='STAFF_SESSIONS_REVOKED_BY_ADMIN'")).rows;
    expect(audit).toEqual([{ metadata: { targetUid: 'http-staff', targetRole: 'accountant', reasonCategory: 'security_incident', revokedSessions: 2 } }]);
    as('http-staff', 'accountant', tokenOf('a'));
    expect((await send('GET', '/sessions')).status).toBe(403);
  });

  it('requires a fresh administrator sign-in (step-up) and reports it distinctly', async () => {
    await fixture.pg.exec("UPDATE taxguard_sessions SET auth_time=floor(extract(epoch FROM now()))::bigint-1000 WHERE uid='http-admin'");
    as('http-admin', 'admin', tokenOf('d'));
    const response = await send('POST', '/members/http-staff/sessions/revoke', { reasonCategory: 'offboarding' });
    expect(response.status).toBe(403); expect(await response.json()).toEqual({ code: 'STAFF_REAUTHENTICATION_REQUIRED' });
    expect(await revokedOf('http-staff')).toBe(0);
  });

  it.each([
    ['non-administrator', () => as('http-staff', 'accountant', tokenOf('a')), '/members/http-admin/sessions/revoke', { reasonCategory: 'offboarding' }, 403, 'STAFF_ADMIN_REQUIRED'],
    ['cross-tenant target', () => as('http-admin', 'admin', tokenOf('d')), '/members/http-foreign/sessions/revoke', { reasonCategory: 'offboarding' }, 404, 'SESSION_TARGET_NOT_FOUND'],
    ['self target', () => as('http-admin', 'admin', tokenOf('d')), '/members/http-admin/sessions/revoke', { reasonCategory: 'offboarding' }, 400, 'SESSION_TARGET_SELF'],
    ['free-text reason', () => as('http-admin', 'admin', tokenOf('d')), '/members/http-staff/sessions/revoke', { reasonCategory: 'offboarding', reason: 'Private note' }, 400, 'SESSION_INPUT_INVALID'],
    ['administrator of another tenant', () => as('http-admin', 'admin', tokenOf('d'), 'aal2', 'tenantB'), '/members/http-staff/sessions/revoke', { reasonCategory: 'offboarding' }, 403, 'STAFF_ADMIN_REQUIRED'],
  ])('denies %s', async (_label, setup, path, body, status, code) => {
    setup();
    const response = await send('POST', path, body);
    expect(response.status).toBe(status); expect(await response.json()).toEqual({ code });
    expect(await revokedOf('http-staff') + await revokedOf('http-admin') + await revokedOf('http-foreign')).toBe(0);
  });

  it('maps storage failures to a generic 503 and lock contention to a retryable 409', async () => {
    const failing = { rpc: vi.fn().mockRejectedValue(new Error('private database detail')) } as any;
    await expect(listOwnSessions(failing, 'tenantA', user, tokenOf('a'))).rejects.toMatchObject({ code: 'SESSION_STORE_UNAVAILABLE', status: 503 });
    const busy = { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '55P03', message: 'lock' } }) } as any;
    as('http-admin', 'admin', tokenOf('d'));
    await expect(revokeMemberSessions(busy, 'tenantA', user, tokenOf('d'), { targetUid: 'http-staff', reasonCategory: 'offboarding' })).rejects.toMatchObject({ code: 'SESSION_STORE_BUSY', status: 409 });
    const odd = { rpc: vi.fn().mockResolvedValue({ data: [{ sessionId: 'x' }], error: null }) } as any;
    await expect(listOwnSessions(odd, 'tenantA', user, tokenOf('d'))).rejects.toMatchObject({ code: 'SESSION_STORE_UNAVAILABLE' });
  });

  it('serves the caller\'s security history over HTTP and refuses it after an administrator revokes the session', async () => {
    const own = await send('GET', '/sessions/events?limit=10');
    expect(own.status).toBe(200);
    expect((await own.json()).items).toEqual([]);
    expect((await send('GET', '/sessions/events?limit=500')).status).toBe(400);
    as('http-admin', 'admin', tokenOf('d'));
    await send('POST', '/members/http-staff/sessions/revoke', { reasonCategory: 'lost_or_stolen_device' });
    as('http-staff', 'accountant', tokenOf('a'));
    expect((await send('GET', '/sessions/events')).status).toBe(403);
  });
});
