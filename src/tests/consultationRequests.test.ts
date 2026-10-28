import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createConsultationReviewRouter, createPublicConsultationRouter } from '../server/routes/consultations.routes';
import { CONSULTATION_CONSENT_VERSION, ConsultationStore } from '../server/taxguard/consultations/consultationStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { StaffAccessRateLimit } from '../server/staffAccessRateLimit';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Public consultation requests (proposal 043) composed with 024-027 and 040 on PGlite.
// Synthetic visitors (example.test addresses), staff and clients only.
const T = 'tenantA', C = 'csClient';
const people: Record<string, any> = { mgr: { id: 'cs-mgr', role: 'practice_manager' }, acct: { id: 'cs-acct', role: 'accountant' }, client: { id: 'cs-client', role: 'client', clientId: C },
  foreign: { id: 'cs-foreign', role: 'practice_manager' } };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let user: any; let n = 0;
const as = (who: string, tenantId = T) => { user = { ...people[who], tenantId, status: 'active' }; };
const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const request = (over: Record<string, unknown> = {}) => ({ fullName: 'Synthetic Visitor', email: 'visitor@example.test', preferredContact: 'EMAIL', topic: 'TAX_PLANNING',
  modePreference: 'REMOTE', preferredWindows: [{ date: day(5), partOfDay: 'MORNING' }], timezone: 'America/New_York', message: 'Synthetic question about estimates',
  consent: true, consentVersion: CONSULTATION_CONSENT_VERSION, ...over });
const post = (path: string, body: unknown, key: string | null = `cs-key-${++n}-${Date.now()}`, ip?: string) => fetch(origin + path, { method: 'POST',
  headers: { 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}), ...(ip ? { 'x-test-ip': ip } : {}) }, body: typeof body === 'string' ? body : JSON.stringify(body) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => null) as any }));
const get = (path: string) => fetch(origin + path).then(async r => ({ status: r.status, body: await r.json().catch(() => null) as any }));
let limiter = new StaffAccessRateLimit(1000, 60_000);

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^2026101(2(240000|250000|260000|270000)|4(400000|430000))_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','cs-client','Synthetic Consultation Client');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES('${T}','cs-mgr','practice_manager','active',NULL),('${T}','cs-acct','accountant','active',NULL),
      ('${T}','cs-client','client','active','${C}'),('tenantB','cs-foreign','practice_manager','active',NULL);`);
  const practice = new PracticeStore(pgliteRpc(() => fixture.pg));
  const eng = (await practice.createEngagement(T, C, 'cs-mgr', 'cs-eng-0001', { title: 'Synthetic 2025', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'cs-mgr', eng, 'active', 1);
  await practice.assign(T, C, 'cs-mgr', 'cs-asg-0001', { engagementId: eng, taxYear: 2025, role: 'preparer', userId: 'cs-acct', reason: 'Synthetic staffing' });
  const store = () => new ConsultationStore(pgliteRpc(() => fixture.pg));
  const app = express();
  app.use((req: any, _res, next) => { Object.defineProperty(req, 'ip', { value: req.get('x-test-ip') || '198.51.100.1' }); next(); });
  app.use('/public', createPublicConsultationRouter({ store, tenantId: () => T, limiter: { allow: (k: string) => limiter.allow(k) } as any }));
  app.use(express.json());
  app.use('/review', createConsultationReviewRouter({ store, authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 120000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

let requestId = '';
describe('public consultation requests', () => {
  it('accepts a request with consent, never echoes stored data, and answers a replay the same way', async () => {
    expect((await get('/public/consent')).body.version).toBe(CONSULTATION_CONSENT_VERSION);
    const r = await post('/public', request(), 'cs-submit-key-1');
    expect(r.status).toBe(202);
    expect(Object.keys(r.body).sort()).toEqual(['received', 'reference', 'replayed']);
    expect(r.body).toMatchObject({ received: true, replayed: false });
    expect(r.body.reference).toMatch(/^[A-F0-9]{8}$/);
    expect((await post('/public', request(), 'cs-submit-key-1')).body).toMatchObject({ reference: r.body.reference, replayed: true });
    expect((await post('/public', request({ email: 'someone-else@example.test' }), 'cs-submit-key-1')).body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    const stored = (await fixture.pg.query<{ client_fingerprint: string; email: string }>(`SELECT client_fingerprint, email FROM taxguard_consultation_requests`)).rows;
    expect(stored).toHaveLength(1);
    expect(stored[0].client_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stored)).not.toContain('198.51.100.1');
  });

  it('refuses missing consent, invalid input, oversized bodies and silently drops honeypot submissions', async () => {
    expect((await post('/public', request({ consent: false }))).body.code).toBe('CONSULTATION_CONSENT_REQUIRED');
    expect((await post('/public', request({ consentVersion: 'old' }))).body.code).toBe('CONSULTATION_CONSENT_REQUIRED');
    for (const bad of [{ email: 'not-an-email' }, { preferredWindows: [] }, { preferredWindows: [{ date: day(-1), partOfDay: 'MORNING' }] },
      { preferredWindows: [{ date: day(400), partOfDay: 'MORNING' }] }, { preferredWindows: [{ date: day(2), partOfDay: 'NIGHT' }] }, { timezone: 'Mars/Olympus' },
      { preferredContact: 'PHONE' }, { topic: 'DIVORCE' }, { fullName: 'x' }, { phone: 'call me' }])
      expect((await post('/public', request(bad))).body.code, JSON.stringify(bad)).toBe('CONSULTATION_INPUT_INVALID');
    expect((await post('/public', request({ message: 'x'.repeat(9000) }))).status).toBe(413);
    expect((await post('/public', '{not json')).body.code).toBe('CONSULTATION_INPUT_INVALID');
    expect((await post('/public', request(), null)).body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    const before = (await fixture.pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM taxguard_consultation_requests`)).rows[0].n;
    expect((await post('/public', { ...request({ email: 'bot@example.test' }), website: 'https://spam.example' })).status).toBe(202);
    expect((await fixture.pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM taxguard_consultation_requests`)).rows[0].n).toBe(before);
  });

  it('limits requests per e-mail, per client fingerprint, and per address in the server process', async () => {
    for (let i = 0; i < 2; i++) expect((await post('/public', request(), undefined, `203.0.113.${10 + i}`)).status).toBe(202);
    expect((await post('/public', request(), undefined, '203.0.113.20')).body.code).toBe('CONSULTATION_RATE_LIMITED'); // 3 a day per e-mail
    for (let i = 0; i < 5; i++) expect((await post('/public', request({ email: `burst${i}@example.test` }), undefined, '203.0.113.99')).status).toBe(202);
    expect((await post('/public', request({ email: 'burst9@example.test' }), undefined, '203.0.113.99')).body.code).toBe('CONSULTATION_RATE_LIMITED'); // 5 an hour per fingerprint
    limiter = new StaffAccessRateLimit(1, 60_000);
    expect((await post('/public', request({ email: 'proc1@example.test' }), undefined, '192.0.2.50')).status).toBe(202);
    expect((await post('/public', request({ email: 'proc2@example.test' }), undefined, '192.0.2.50')).status).toBe(429);
    limiter = new StaffAccessRateLimit(1000, 60_000);
  });
});

describe('staff review and conversion', () => {
  it('is for practice managers and administrators of the tenant only', async () => {
    for (const who of ['acct', 'client']) { as(who); expect((await get('/review/requests')).status, who).toBe(403); }
    as('foreign', 'tenantB'); expect((await get('/review/requests')).body).toEqual([]);
    as('mgr');
    const list = (await get('/review/requests?status=NEW')).body;
    const first = list.find((q: any) => q.email === 'visitor@example.test');
    expect(first).toMatchObject({ fullName: 'Synthetic Visitor', status: 'NEW', topic: 'TAX_PLANNING' });
    requestId = first.requestId;
  });

  it('enforces the lifecycle and converts an approved request into a real appointment for an existing client', async () => {
    as('mgr');
    expect((await post(`/review/requests/${requestId}/convert`, { version: 1, clientId: C, appointment: {} })).body.code).toBe('CONSULTATION_TRANSITION_INVALID');
    const reviewing = await post(`/review/requests/${requestId}/decision`, { version: 1, action: 'review' });
    expect(reviewing.body).toMatchObject({ status: 'IN_REVIEW', version: 2 });
    expect((await post(`/review/requests/${requestId}/decision`, { version: 2, action: 'decline', reason: 'no' })).body.code).toBe('CONSULTATION_REASON_REQUIRED');
    expect((await post(`/review/requests/${requestId}/convert`, { version: 2, clientId: 'not-a-client', appointment: {} })).body.code).toBe('CONSULTATION_CLIENT_NOT_FOUND');
    const start = new Date(Date.now() + 5 * 86_400_000); start.setUTCHours(14, 0, 0, 0);
    const appointment = { title: 'Synthetic consultation', category: 'CONSULTATION', mode: 'REMOTE', startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 3_600_000).toISOString(), timezone: 'America/New_York', staffUid: 'cs-acct', confirm: true };
    // Appointment rules apply: an ineligible staff member is refused and nothing changes.
    expect((await post(`/review/requests/${requestId}/convert`, { version: 2, clientId: C, appointment: { ...appointment, staffUid: 'cs-foreign' } })).body.code).toBe('APPOINTMENT_STAFF_INVALID');
    expect((await get('/review/requests?status=IN_REVIEW')).body.map((q: any) => q.requestId)).toContain(requestId);
    const converted = await post(`/review/requests/${requestId}/convert`, { version: 2, clientId: C, appointment }, 'cs-convert-key-1');
    expect(converted.body).toMatchObject({ status: 'CONVERTED', convertedClientId: C, version: 3 });
    expect(converted.body.appointment).toMatchObject({ status: 'CONFIRMED', clientId: C, staffUid: 'cs-acct' });
    expect((await post(`/review/requests/${requestId}/convert`, { version: 2, clientId: C, appointment }, 'cs-convert-key-1')).body.replayed).toBe(true);
    expect((await post(`/review/requests/${requestId}/decision`, { version: 3, action: 'spam', reason: 'Synthetic late spam' })).body.code).toBe('CONSULTATION_TRANSITION_INVALID');
    const apts = (await fixture.pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM taxguard_appointments WHERE client_id = $1`, [C])).rows[0].n;
    expect(apts).toBe(1);
  });

  it('keeps submitted details and history immutable and audits without personal data', async () => {
    await expect(fixture.pg.query(`UPDATE taxguard_consultation_requests SET email = 'x@example.test', version = version + 1 WHERE request_id = $1`, [requestId])).rejects.toThrow('CONSULTATION_IMMUTABLE');
    await expect(fixture.pg.query(`DELETE FROM taxguard_consultation_request_events`)).rejects.toThrow('CONSULTATION_HISTORY_IMMUTABLE');
    const audit = (await fixture.pg.query<{ action: string; actor_uid: string; metadata: any }>(`SELECT action, actor_uid, metadata FROM taxguard_audit_log WHERE action LIKE 'CONSULTATION_%'`)).rows;
    expect(audit.map(a => a.action)).toEqual(expect.arrayContaining(['CONSULTATION_RECEIVED', 'CONSULTATION_IN_REVIEW', 'CONSULTATION_CONVERTED']));
    expect(audit.find(a => a.action === 'CONSULTATION_RECEIVED')!.actor_uid).toBe('public-visitor');
    expect(JSON.stringify(audit)).not.toMatch(/visitor@example|Synthetic Visitor|Synthetic question|198\.51|203\.0/);
    const rows = (await fixture.pg.query<{ proname: string; anon: boolean; auth: boolean; svc: boolean }>(`SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth, has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc FROM pg_proc p
      WHERE p.proname LIKE 'taxguard\\_consult\\_%' ORDER BY 1`)).rows;
    expect(rows.filter(r => r.anon || r.auth)).toEqual([]);
    expect(rows.filter(r => r.svc).map(r => r.proname)).toEqual(['taxguard_consult_convert', 'taxguard_consult_decide', 'taxguard_consult_list', 'taxguard_consult_submit']);
  });
});
