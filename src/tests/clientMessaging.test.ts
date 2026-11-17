import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCommunicationsRouter } from '../server/routes/communications.routes';
import { CommunicationStore } from '../server/taxguard/communications/communicationStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// HTTP -> /api/communications -> CommunicationStore -> proposal 039 (PGlite) composed with 024-027.
// Synthetic clients, staff and messages only.
const T = 'tenantA', C = 'cmClient', OTHER = 'cmOther';
const people: Record<string, any> = { mgr: { id: 'cm-mgr', role: 'practice_manager' }, acct: { id: 'cm-acct', role: 'accountant' }, outsider: { id: 'cm-outsider', role: 'accountant' },
  recruiter: { id: 'cm-recruiter', role: 'recruiter' }, client: { id: 'cm-client', role: 'client', clientId: C }, other: { id: 'cm-other', role: 'client', clientId: OTHER },
  foreign: { id: 'cm-foreign', role: 'practice_manager' } };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let user: any; let n = 0; let engagementId = '';
const as = (who: string, tenantId = T) => { user = { ...people[who], tenantId, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown, key: string | null = `cm-key-${++n}-${Date.now()}`, base = origin) => fetch(base + '/comm' + path, { method,
  headers: { 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => null) as any }));
const listen = async () => {
  const app = express(); app.use(express.json());
  app.use('/comm', createCommunicationsRouter({ store: () => new CommunicationStore(pgliteRpc(() => fixture.pg)), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  const s = createServer(app); await new Promise<void>(resolve => s.listen(0, '127.0.0.1', resolve));
  return { s, origin: 'http://127.0.0.1:' + (s.address() as AddressInfo).port };
};

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^2026101(2(240000|250000|260000|270000)|3390000)_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','cm-client','Synthetic Messaging Client'),('${T}','${OTHER}','cm-other','Other Synthetic');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) SELECT '${T}', v->>'id', v->>'role', 'active', v->>'clientId' FROM jsonb_array_elements('${JSON.stringify(Object.values(people).filter(p => p.id !== 'cm-foreign'))}'::jsonb) v;
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantB','cm-foreign','practice_manager','active');`);
  const practice = new PracticeStore(pgliteRpc(() => fixture.pg));
  engagementId = (await practice.createEngagement(T, C, 'cm-mgr', 'cm-eng-1', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'cm-mgr', engagementId, 'active', 1);
  await practice.assign(T, C, 'cm-mgr', 'cm-asg-1', { engagementId, taxYear: 2025, role: 'preparer', userId: 'cm-acct', reason: 'Initial staffing' });
  ({ s: server, origin } = await listen());
}, 120000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

let thread = '';
describe('client and staff messaging', () => {
  it('lets a client open a thread on their own client only, client-visible only', async () => {
    as('client');
    const created = await call('POST', `/clients/${C}/threads`, { subject: 'Synthetic question', body: 'Is my synthetic form complete?', category: 'TAX_QUESTION', engagementId });
    expect(created.status).toBe(201);
    expect(created.body.thread).toMatchObject({ clientId: C, subject: 'Synthetic question', status: 'ACTIVE', messageCount: 1, unread: 0, awaitingStaffReply: true });
    expect(created.body.thread.createdBy).toBeUndefined();
    expect(created.body.message).toMatchObject({ senderKind: 'client', own: true, visibility: 'CLIENT_VISIBLE', replayed: false });
    expect(created.body.message.senderUid).toBeUndefined();
    thread = created.body.thread.threadId;
    expect(thread).toMatch(/^thr_[a-f0-9]{32}$/);
    expect((await call('POST', `/clients/${C}/threads`, { subject: 'Internal attempt', body: 'x', visibility: 'INTERNAL_ONLY' })).body.code).toBe('COMM_INTERNAL_STAFF_ONLY');
    expect((await call('POST', `/clients/${OTHER}/threads`, { subject: 'Other client', body: 'x' })).status).toBe(404);
    expect((await call('GET', `/clients/${OTHER}/threads`)).status).toBe(404);
    expect((await call('POST', `/clients/${C}/threads`, { subject: 'Wrong engagement', body: 'x', engagementId: 'not-mine' })).body.code).toBe('COMM_SCOPE_MISMATCH');
  });

  it('refuses staff without an assignment, recruiters, other clients and other tenants', async () => {
    as('outsider'); expect((await call('GET', `/clients/${C}/threads`)).status).toBe(404);
    expect((await call('GET', `/clients/${C}/threads/${thread}`)).status).toBe(404);
    as('recruiter'); expect((await call('GET', `/clients/${C}/threads`)).status).toBe(403);
    as('other'); expect((await call('GET', `/clients/${C}/threads/${thread}`)).status).toBe(404);
    expect((await call('POST', `/clients/${C}/threads/${thread}/messages`, { body: 'intrusion' })).status).toBe(404);
    as('foreign', 'tenantB'); expect((await call('GET', `/clients/${C}/threads`)).status).toBeGreaterThanOrEqual(403);
    as('acct'); expect((await call('GET', `/clients/${C}/threads/thr_${'0'.repeat(32)}`)).status).toBe(404);
  });

  it('shows the assigned accountant the thread in the inbox; internal notes never reach the client', async () => {
    as('acct');
    const inbox = (await call('GET', '/inbox')).body;
    expect(inbox.map((x: any) => x.threadId)).toEqual([thread]);
    expect(inbox[0]).toMatchObject({ unread: 1, awaitingStaffReply: true, createdBy: 'cm-client' });
    expect((await call('POST', `/clients/${C}/threads/${thread}/messages`, { body: 'Synthetic internal note: check worksheet', visibility: 'INTERNAL_ONLY' })).status).toBe(201);
    // An internal note is not a reply: still awaiting the client-visible answer.
    expect((await call('GET', '/inbox')).body.map((x: any) => x.threadId)).toEqual([thread]);
    const reply = await call('POST', `/clients/${C}/threads/${thread}/messages`, { body: 'Yes, it is complete (synthetic).' });
    expect(reply.body).toMatchObject({ senderKind: 'staff', senderUid: 'cm-acct', visibility: 'CLIENT_VISIBLE' });
    expect((await call('GET', '/inbox')).body).toEqual([]);
    const staffView = (await call('GET', `/clients/${C}/threads/${thread}`)).body;
    expect(staffView.messages.map((m: any) => m.visibility)).toEqual(['CLIENT_VISIBLE', 'INTERNAL_ONLY', 'CLIENT_VISIBLE']);
    // A staff-only thread is invisible to the client.
    expect((await call('POST', `/clients/${C}/threads`, { subject: 'Staff only', body: 'Synthetic internal discussion', visibility: 'INTERNAL_ONLY' })).status).toBe(201);
    as('client');
    const mine = (await call('GET', `/clients/${C}/threads`)).body;
    expect(mine.map((x: any) => x.threadId)).toEqual([thread]);
    expect(mine[0]).toMatchObject({ unread: 1, messageCount: 2, awaitingStaffReply: false });
    const clientView = (await call('GET', `/clients/${C}/threads/${thread}`)).body;
    expect(clientView.messages.map((m: any) => m.body)).toEqual(['Is my synthetic form complete?', 'Yes, it is complete (synthetic).']);
    expect(JSON.stringify(clientView)).not.toMatch(/internal note|cm-acct|senderUid/);
    expect((await call('POST', `/clients/${C}/threads/${thread}/read`)).body).toMatchObject({ unread: 0 });
    expect((await call('GET', `/clients/${C}/threads`)).body[0].unread).toBe(0);
  });

  it('is idempotent: a replay returns the recorded message, a reused key with other content is refused', async () => {
    as('client');
    const first = await call('POST', `/clients/${C}/threads/${thread}/messages`, { body: 'Thank you (synthetic).' }, 'cm-replay-key-1');
    const again = await call('POST', `/clients/${C}/threads/${thread}/messages`, { body: 'Thank you (synthetic).' }, 'cm-replay-key-1');
    expect(again.body).toMatchObject({ messageId: first.body.messageId, replayed: true });
    expect((await call('POST', `/clients/${C}/threads/${thread}/messages`, { body: 'Different text' }, 'cm-replay-key-1')).body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect((await call('POST', `/clients/${C}/threads/${thread}/messages`, { body: 'No key' }, null)).body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    const rows = (await fixture.pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM taxguard_communication_messages WHERE id = $1`, [first.body.messageId])).rows[0].n;
    expect(rows).toBe(1);
  });

  it('keeps messages immutable and audits without content', async () => {
    await expect(fixture.pg.query(`UPDATE taxguard_communication_messages SET content = 'tampered' WHERE thread_id = $1`, [thread])).rejects.toThrow('COMM_MESSAGE_IMMUTABLE');
    await expect(fixture.pg.query(`DELETE FROM taxguard_communication_messages WHERE thread_id = $1`, [thread])).rejects.toThrow('COMM_MESSAGE_IMMUTABLE');
    await expect(fixture.pg.query(`DELETE FROM taxguard_communication_threads WHERE id = $1`, [thread])).rejects.toThrow('COMM_THREAD_IMMUTABLE');
    const audit = (await fixture.pg.query<{ action: string; metadata: any }>(`SELECT action, metadata FROM taxguard_audit_log WHERE action LIKE 'COMM_%' ORDER BY id`)).rows;
    expect(audit.map(a => a.action)).toEqual(expect.arrayContaining(['COMM_THREAD_CREATED', 'COMM_MESSAGE_POSTED', 'COMM_INTERNAL_NOTE_POSTED']));
    expect(audit.every(a => a.metadata.clientId === C)).toBe(true);
    expect(JSON.stringify(audit)).not.toMatch(/synthetic form|internal note|Thank you/i);
  });

  it('applies thread status rules: staff resolve and reopen, managers archive, no posts to a closed thread', async () => {
    as('client'); expect((await call('POST', `/clients/${C}/threads/${thread}/status`, { status: 'RESOLVED' })).body.code).toBe('COMM_STAFF_REQUIRED');
    as('acct');
    expect((await call('POST', `/clients/${C}/threads/${thread}/status`, { status: 'RESOLVED' })).body).toMatchObject({ status: 'RESOLVED', changed: true });
    as('client'); expect((await call('POST', `/clients/${C}/threads/${thread}/messages`, { body: 'One more thing' })).body.code).toBe('COMM_THREAD_CLOSED');
    // A replay of an earlier post is still answered after resolution.
    expect((await call('POST', `/clients/${C}/threads/${thread}/messages`, { body: 'Thank you (synthetic).' }, 'cm-replay-key-1')).body.replayed).toBe(true);
    as('acct');
    expect((await call('POST', `/clients/${C}/threads/${thread}/status`, { status: 'ACTIVE' })).body.status).toBe('ACTIVE');
    expect((await call('POST', `/clients/${C}/threads/${thread}/status`, { status: 'ARCHIVED' })).body.code).toBe('COMM_MANAGER_REQUIRED');
    as('mgr'); expect((await call('POST', `/clients/${C}/threads/${thread}/status`, { status: 'ARCHIVED' })).body.status).toBe('ARCHIVED');
    as('client'); expect((await call('GET', `/clients/${C}/threads`)).body).toEqual([]);
    expect((await call('GET', `/clients/${C}/threads/${thread}`)).status).toBe(404);
  });

  it('survives a restart: a new server and store read the same records', async () => {
    const second = await listen();
    try {
      as('mgr');
      const threads = (await call('GET', `/clients/${C}/threads`, undefined, null, second.origin)).body;
      expect(threads.map((x: any) => x.threadId)).toContain(thread);
      expect((await call('GET', `/clients/${C}/threads/${thread}`, undefined, null, second.origin)).body.messages.length).toBe(4);
    } finally { second.s.closeAllConnections(); await new Promise<void>(r => second.s.close(() => r())); }
  });

  it('exposes only the service RPCs, to service_role only', async () => {
    const rows = (await fixture.pg.query<{ proname: string; anon: boolean; auth: boolean; svc: boolean }>(`SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth, has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc FROM pg_proc p
      WHERE p.proname LIKE 'taxguard\\_comm\\_%' AND p.proname NOT LIKE '%guard' ORDER BY 1`)).rows;
    expect(rows.filter(r => r.anon || r.auth)).toEqual([]);
    expect(rows.filter(r => r.svc).map(r => r.proname)).toEqual(['taxguard_comm_mark_read', 'taxguard_comm_messages', 'taxguard_comm_post', 'taxguard_comm_set_status',
      'taxguard_comm_staff_inbox', 'taxguard_comm_thread_create', 'taxguard_comm_threads']);
  });
});
