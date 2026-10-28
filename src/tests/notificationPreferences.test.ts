import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createVaultRouter } from '../server/routes/vault.routes';
import { DocumentRequestStore } from '../server/taxguard/documents/documentRequestStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Contract C6: durable in-app notification preferences (proposal 20261016040000) composed with
// 024-027 and 031. Only the in-app channel exists; e-mail and SMS cannot be enabled. Synthetic data.
const T = 'tenantA', C = 'npClient', OTHER = 'npOther';
const people: Record<string, any> = { mgr: { id: 'np-mgr', role: 'practice_manager' }, acct: { id: 'np-acct', role: 'accountant' }, outsider: { id: 'np-out', role: 'accountant' },
  client: { id: 'np-client', role: 'client', clientId: C }, other: { id: 'np-other', role: 'client', clientId: OTHER } };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin = ''; let user: any;
const as = (who: string, tenantId = T) => { user = { ...people[who], tenantId, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown) => fetch(origin + '/vault' + path, { method, headers: { 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) as any }));
const prefs = (client = C) => call('GET', `/clients/${client}/notification-preferences`);
const set = (body: unknown, client = C) => call('POST', `/clients/${client}/notification-preferences`, body);
const list = () => call('GET', `/clients/${C}/notifications`);
const q = (sql: string, p: unknown[] = []) => fixture.pg.query<any>(sql, p).then(r => r.rows);

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(240000|250000|260000|270000|310000)_|^20261016040000_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','np-client','Synthetic Pref Client'),('${T}','${OTHER}','np-other','Other Synthetic');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) SELECT '${T}', v->>'id', v->>'role', 'active', v->>'clientId' FROM jsonb_array_elements('${JSON.stringify(Object.values(people))}'::jsonb) v;
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantB','np-foreign','practice_manager','active');
    SELECT taxguard_docreq_notify('${T}','${C}','REQUEST_CREATED',NULL,'Synthetic W-2 requested','np-acct');
    SELECT taxguard_docreq_notify('${T}','${C}','REQUEST_REMINDER',NULL,'Reminder: synthetic W-2','np-acct');
    SELECT taxguard_docreq_notify('${T}','${C}','REQUEST_REMINDER',NULL,'Second reminder: synthetic W-2','np-acct');`);
  const practice = new PracticeStore(pgliteRpc(() => fixture.pg));
  const eng = (await practice.createEngagement(T, C, 'np-mgr', 'np-eng-0001', { title: 'Synthetic 2025', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'np-mgr', eng, 'active', 1);
  await practice.assign(T, C, 'np-mgr', 'np-asg-0001', { engagementId: eng, taxYear: 2025, role: 'preparer', userId: 'np-acct', reason: 'Synthetic staffing' });
  const app = express();
  app.use('/vault', createVaultRouter({ store: () => { throw new Error('vault not used'); }, requests: () => new DocumentRequestStore(pgliteRpc(() => fixture.pg)), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 120000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

describe('notification preferences (C6)', () => {
  it('reports in-app as the only channel and mandatory categories as locked on', async () => {
    as('client');
    const r = await prefs();
    expect(r.status).toBe(200);
    expect(r.body.channels).toEqual({ IN_APP: 'AVAILABLE', EMAIL: 'NOT_COMMISSIONED', SMS: 'NOT_COMMISSIONED' });
    expect(r.body.categories).toEqual([{ category: 'DOCUMENT_REQUESTS', mandatory: true, inApp: true, version: 0 },
      { category: 'DOCUMENT_REMINDERS', mandatory: false, inApp: true, version: 0 }, { category: 'ACCOUNT_SECURITY_LEGAL', mandatory: true, inApp: true, version: 0 }]);
  });
  it('refuses to disable mandatory notices or to enable e-mail or SMS', async () => {
    as('client');
    for (const category of ['DOCUMENT_REQUESTS', 'ACCOUNT_SECURITY_LEGAL']) expect((await set({ category, enabled: false, version: 0 })).body.code).toBe('NOTIFICATION_CATEGORY_MANDATORY');
    for (const channel of ['EMAIL', 'SMS']) expect((await set({ category: 'DOCUMENT_REMINDERS', channel, enabled: true, version: 0 })).body.code).toBe('NOTIFICATION_CHANNEL_UNAVAILABLE');
    expect(await q(`SELECT * FROM taxguard_client_notification_prefs`)).toEqual([]);
  });
  it('turns reminders off for this user only, hides them with a count and keeps the request notice', async () => {
    as('client');
    expect((await list()).body).toMatchObject({ unread: 3, hidden: 0 });
    const r = await set({ category: 'DOCUMENT_REMINDERS', enabled: false, version: 0 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ changed: true });
    expect(r.body.categories[1]).toEqual({ category: 'DOCUMENT_REMINDERS', mandatory: false, inApp: false, version: 1 });
    const after = (await list()).body;
    expect(after).toMatchObject({ unread: 1, hidden: 2 });
    expect(after.items.map((n: any) => n.kind)).toEqual(['REQUEST_CREATED']);
    as('acct');
    expect((await list()).body).toMatchObject({ unread: 3, hidden: 0 });
    const audit = await q(`SELECT actor_role, metadata FROM taxguard_audit_log WHERE action = 'NOTIFICATION_PREFERENCE_CHANGED'`);
    expect(audit).toEqual([{ actor_role: 'client', metadata: { clientId: C, category: 'DOCUMENT_REMINDERS', channel: 'IN_APP', enabled: false } }]);
  });
  it('is idempotent for the current value and rejects stale versions', async () => {
    as('client');
    expect((await set({ category: 'DOCUMENT_REMINDERS', enabled: false, version: 1 })).body).toMatchObject({ changed: false });
    expect((await set({ category: 'DOCUMENT_REMINDERS', enabled: true, version: 0 })).body.code).toBe('NOTIFICATION_PREF_VERSION_CONFLICT');
    const back = await set({ category: 'DOCUMENT_REMINDERS', enabled: true, version: 1 });
    expect(back.body.categories[1]).toMatchObject({ inApp: true, version: 2 });
    expect((await list()).body).toMatchObject({ unread: 3, hidden: 0 });
    // Concurrent changes from the same version: exactly one succeeds.
    const both = await Promise.all([set({ category: 'DOCUMENT_REMINDERS', enabled: false, version: 2 }), set({ category: 'DOCUMENT_REMINDERS', enabled: false, version: 2 })]);
    expect(both.map(b => String(b.body.changed ?? b.body.code)).sort()).toEqual(['NOTIFICATION_PREF_VERSION_CONFLICT', 'true']);
    expect((await prefs()).body.categories[1]).toMatchObject({ inApp: false, version: 3 });
  });
  it('rejects forged and malformed input', async () => {
    as('client');
    for (const body of [{}, { category: 'DOCUMENT_REMINDERS', enabled: 'no', version: 3 }, { category: 'DOCUMENT_REMINDERS', enabled: true, version: -1 },
      { category: 'DOCUMENT_REMINDERS', enabled: true, version: 1.5 }, { category: "x' OR 1=1", enabled: true, version: 3 }, { category: 'MARKETING', enabled: true, version: 3 }])
      expect((await set(body)).status, JSON.stringify(body)).toBe(400);
  });
  it('lets only the client user read or change preferences', async () => {
    for (const [who, tenant, client] of [['mgr', T, C], ['acct', T, C], ['outsider', T, C], ['other', T, C], ['client', T, OTHER], ['client', 'tenantB', C]] as const) {
      as(who, tenant);
      expect([403, 404], `${who} read`).toContain((await prefs(client)).status);
      expect([403, 404], `${who} write`).toContain((await set({ category: 'DOCUMENT_REMINDERS', enabled: true, version: 3 }, client)).status);
    }
    expect((await q(`SELECT uid FROM taxguard_client_notification_prefs`)).map((r: any) => r.uid)).toEqual(['np-client']);
  });
  it('bounds changes per preference and keeps functions service-role only', async () => {
    await q(`UPDATE taxguard_client_notification_prefs SET version = 200`);
    as('client');
    expect((await set({ category: 'DOCUMENT_REMINDERS', enabled: true, version: 200 })).body.code).toBe('NOTIFICATION_PREF_LIMIT');
    for (const role of ['anon', 'authenticated']) for (const fn of ['taxguard_notification_prefs(text,text,text)', 'taxguard_notification_pref_set(text,text,text,text,text,boolean,integer)',
      'taxguard_client_notifications_list(text,text,text,boolean)'])
      expect((await q(`SELECT has_function_privilege('${role}', 'public.${fn}', 'EXECUTE') AS ok`))[0].ok, fn).toBe(false);
  });
});
