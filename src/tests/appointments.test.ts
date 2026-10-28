import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSchedulingRouter } from '../server/routes/appointments-durable.routes';
import { AppointmentStore } from '../server/taxguard/appointments/appointmentStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// HTTP -> /api/scheduling -> AppointmentStore -> proposal 040 (PGlite) composed with 024-027.
// Synthetic clients, staff and appointments only.
const T = 'tenantA', C = 'apClient', OTHER = 'apOther';
const people: Record<string, any> = { mgr: { id: 'ap-mgr', role: 'practice_manager' }, acct: { id: 'ap-acct', role: 'accountant' }, acct2: { id: 'ap-acct2', role: 'senior_reviewer' },
  outsider: { id: 'ap-outsider', role: 'accountant' }, bk: { id: 'ap-bk', role: 'bookkeeper' }, client: { id: 'ap-client', role: 'client', clientId: C },
  other: { id: 'ap-other', role: 'client', clientId: OTHER }, foreign: { id: 'ap-foreign', role: 'practice_manager' } };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let user: any; let n = 0; let engagementId = '';
const as = (who: string, tenantId = T) => { user = { ...people[who], tenantId, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown, key: string | null = `ap-key-${++n}-${Date.now()}`) => fetch(origin + '/sched' + path, { method,
  headers: { 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => null) as any }));
const at = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();
const slot = (h: number, minutes = 60) => ({ startsAt: at(h), endsAt: new Date(Date.now() + h * 3_600_000 + minutes * 60_000).toISOString(), timezone: 'America/New_York' });

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^2026101(2(240000|250000|260000|270000)|4400000)_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','ap-client','Synthetic Appointment Client'),('${T}','${OTHER}','ap-other','Other Synthetic');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) SELECT '${T}', v->>'id', v->>'role', 'active', v->>'clientId' FROM jsonb_array_elements('${JSON.stringify(Object.values(people).filter(p => p.id !== 'ap-foreign'))}'::jsonb) v;
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantB','ap-foreign','practice_manager','active');`);
  const practice = new PracticeStore(pgliteRpc(() => fixture.pg));
  engagementId = (await practice.createEngagement(T, C, 'ap-mgr', 'ap-eng-1', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'ap-mgr', engagementId, 'active', 1);
  for (const [k, uid] of [['ap-asg-1', 'ap-acct'], ['ap-asg-2', 'ap-acct2']] as const)
    await practice.assign(T, C, 'ap-mgr', k, { engagementId, taxYear: 2025, role: uid === 'ap-acct' ? 'preparer' : 'reviewer', userId: uid, reason: 'Synthetic staffing' });
  await practice.assign(T, C, 'ap-mgr', 'ap-asg-3', { engagementId, taxYear: 2025, role: 'bookkeeper', userId: 'ap-bk', reason: 'Synthetic staffing' });
  const app = express(); app.use(express.json());
  app.use('/sched', createSchedulingRouter({ store: () => new AppointmentStore(pgliteRpc(() => fixture.pg)), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 120000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

let requested: any; let confirmed: any;
describe('appointments', () => {
  it('lets a client request an appointment for their own client only, without staff-only fields', async () => {
    as('client');
    const r = await call('POST', `/clients/${C}/appointments`, { title: 'Synthetic planning call', category: 'TAX_PLANNING', mode: 'REMOTE', ...slot(48), agenda: 'Discuss synthetic estimates', engagementId });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ status: 'REQUESTED', hasStaff: false, clientId: C, engagementId, version: 1, replayed: false });
    expect(r.body.staffUid).toBeUndefined(); expect(r.body.internalNote).toBeUndefined();
    requested = r.body;
    for (const extra of [{ staffUid: 'ap-acct' }, { internalNote: 'x' }, { meetingUrl: 'https://meet.example.test/x' }, { confirm: true }])
      expect((await call('POST', `/clients/${C}/appointments`, { title: 'Synthetic', mode: 'REMOTE', ...slot(72), ...extra })).body.code, JSON.stringify(extra)).toBe('APPOINTMENT_STAFF_REQUIRED');
    expect((await call('POST', `/clients/${C}/appointments`, { title: 'Too soon', mode: 'REMOTE', ...slot(0.1) })).body.code).toBe('APPOINTMENT_TIME_INVALID');
    expect((await call('POST', `/clients/${OTHER}/appointments`, { title: 'Not mine', mode: 'REMOTE', ...slot(80) })).status).toBe(404);
    expect((await call('POST', `/clients/${C}/appointments`, { title: 'Bad zone', mode: 'REMOTE', ...slot(90), timezone: 'Mars/Olympus' })).body.code).toBe('APPOINTMENT_TIMEZONE_INVALID');
    expect((await call('POST', `/clients/${C}/appointments`, { title: 'Wrong engagement', mode: 'REMOTE', ...slot(90), engagementId: 'nope' })).body.code).toBe('APPOINTMENT_SCOPE_MISMATCH');
  });

  it('is idempotent on create: a replay returns the recorded appointment', async () => {
    as('client');
    const body = { title: 'Synthetic replay', mode: 'PHONE', ...slot(100) };
    const a = await call('POST', `/clients/${C}/appointments`, body, 'ap-replay-key-1');
    const b = await call('POST', `/clients/${C}/appointments`, body, 'ap-replay-key-1');
    expect(b.body).toMatchObject({ appointmentId: a.body.appointmentId, replayed: true });
    const rows = (await fixture.pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM taxguard_appointments WHERE appointment_id = $1`, [a.body.appointmentId])).rows[0].n;
    expect(rows).toBe(1);
  });

  it('lets assigned staff book a confirmed appointment, and refuses staff and client double bookings', async () => {
    as('acct');
    const r = await call('POST', `/clients/${C}/appointments`, { title: 'Synthetic document review', category: 'DOCUMENT_REVIEW', mode: 'REMOTE', ...slot(24), staffUid: 'ap-acct',
      confirm: true, meetingUrl: 'https://meet.example.test/synthetic-room', internalNote: 'Synthetic staff-only note' });
    expect(r.body).toMatchObject({ status: 'CONFIRMED', staffUid: 'ap-acct', internalNote: 'Synthetic staff-only note' });
    confirmed = r.body;
    // Same staff, overlapping time (different client is impossible here, so the client conflict fires first for this client).
    expect((await call('POST', `/clients/${C}/appointments`, { title: 'Overlap', mode: 'REMOTE', startsAt: at(24.5), endsAt: at(25.5), timezone: 'UTC', staffUid: 'ap-acct' })).body.code)
      .toBe('APPOINTMENT_STAFF_CONFLICT');
    expect((await call('POST', `/clients/${C}/appointments`, { title: 'Overlap client', mode: 'REMOTE', startsAt: at(24.5), endsAt: at(25.5), timezone: 'UTC', staffUid: 'ap-acct2' })).body.code)
      .toBe('APPOINTMENT_CLIENT_CONFLICT');
    // Back-to-back is not a conflict (half-open intervals).
    expect((await call('POST', `/clients/${C}/appointments`, { title: 'Back to back', mode: 'PHONE', startsAt: confirmed.endsAt, endsAt: at(26), timezone: 'UTC', staffUid: 'ap-acct' })).status).toBe(201);
    expect((await call('POST', `/clients/${C}/appointments`, { title: 'Ineligible staff', mode: 'REMOTE', ...slot(200), staffUid: 'ap-outsider' })).body.code).toBe('APPOINTMENT_STAFF_INVALID');
    expect((await call('POST', `/clients/${C}/appointments`, { title: 'In person link', mode: 'IN_PERSON', ...slot(210), meetingUrl: 'https://meet.example.test/x' })).body.code).toBe('APPOINTMENT_INPUT_INVALID');
    expect((await call('POST', `/clients/${C}/appointments`, { title: 'Unsafe link', mode: 'REMOTE', ...slot(220), meetingUrl: 'javascript:alert(1)' })).body.code).toBe('APPOINTMENT_INPUT_INVALID');
    expect((await call('POST', `/clients/${C}/appointments`, { title: 'Credential link', mode: 'REMOTE', ...slot(230), meetingUrl: 'https://user:pw@meet.example.test/x' })).body.code).toBe('APPOINTMENT_INPUT_INVALID');
  });

  it('shows clients the meeting link only once confirmed, and never internal notes or staff identities', async () => {
    as('client');
    const list = (await call('GET', `/clients/${C}/appointments`)).body;
    const mine = list.find((a: any) => a.appointmentId === confirmed.appointmentId);
    expect(mine).toMatchObject({ status: 'CONFIRMED', meetingUrl: 'https://meet.example.test/synthetic-room', hasStaff: true });
    expect(JSON.stringify(list)).not.toMatch(/Synthetic staff-only note|ap-acct|internalNote|staffUid|history/);
    as('other'); expect((await call('GET', `/clients/${C}/appointments`)).status).toBe(404);
    as('outsider'); expect((await call('GET', `/clients/${C}/appointments/${confirmed.appointmentId}`)).status).toBe(404);
    as('bk'); expect((await call('POST', `/clients/${C}/appointments`, { title: 'Bookkeeper', mode: 'PHONE', ...slot(300) })).body.code).toBe('APPOINTMENT_STAFF_REQUIRED');
    as('foreign', 'tenantB'); expect((await call('GET', `/clients/${C}/appointments`)).status).toBeGreaterThanOrEqual(403);
  });

  it('enforces versions, idempotent changes and the status machine', async () => {
    as('acct');
    const confirmReq = await call('POST', `/clients/${C}/appointments/${requested.appointmentId}/status`, { version: 1, action: 'confirm' });
    expect(confirmReq.body.code).toBe('APPOINTMENT_STAFF_REQUIRED'); // no staff yet
    const moved = await call('POST', `/clients/${C}/appointments/${requested.appointmentId}/reschedule`, { version: 1, ...slot(50), staffUid: 'ap-acct' }, 'ap-resched-1');
    expect(moved.body).toMatchObject({ version: 2, staffUid: 'ap-acct', replayed: false });
    expect((await call('POST', `/clients/${C}/appointments/${requested.appointmentId}/reschedule`, { version: 1, ...slot(50), staffUid: 'ap-acct' }, 'ap-resched-1')).body.replayed).toBe(true);
    expect((await call('POST', `/clients/${C}/appointments/${requested.appointmentId}/reschedule`, { version: 1, ...slot(52) })).body.code).toBe('APPOINTMENT_VERSION_CONFLICT');
    const ok = await call('POST', `/clients/${C}/appointments/${requested.appointmentId}/status`, { version: 2, action: 'confirm' });
    expect(ok.body).toMatchObject({ status: 'CONFIRMED', version: 3 });
    expect((await call('POST', `/clients/${C}/appointments/${requested.appointmentId}/status`, { version: 3, action: 'complete' })).body.code).toBe('APPOINTMENT_NOT_STARTED');
    expect((await call('POST', `/clients/${C}/appointments/${requested.appointmentId}/status`, { version: 3, action: 'cancel', reason: 'no' })).body.code).toBe('APPOINTMENT_REASON_REQUIRED');
    expect((await call('POST', `/clients/${C}/appointments/${requested.appointmentId}/update`, { version: 3, fields: { status: 'COMPLETED' } })).body.code).toBe('APPOINTMENT_FIELD_NOT_EDITABLE');
    expect((await call('POST', `/clients/${C}/appointments/${requested.appointmentId}/update`, { version: 3, fields: { agenda: 'Synthetic updated agenda', location: null } })).body)
      .toMatchObject({ agenda: 'Synthetic updated agenda', version: 4 });
    as('client');
    expect((await call('POST', `/clients/${C}/appointments/${requested.appointmentId}/status`, { version: 4, action: 'confirm' })).body.code).toBe('APPOINTMENT_STAFF_REQUIRED');
    expect((await call('POST', `/clients/${C}/appointments/${requested.appointmentId}/reschedule`, { version: 4, ...slot(60) })).body.code).toBe('APPOINTMENT_STAFF_REQUIRED');
    const cancelled = await call('POST', `/clients/${C}/appointments/${requested.appointmentId}/status`, { version: 4, action: 'cancel', reason: 'Synthetic conflict at work' });
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', cancelReason: 'Synthetic conflict at work' });
    as('acct');
    expect((await call('POST', `/clients/${C}/appointments/${requested.appointmentId}/status`, { version: 5, action: 'confirm' })).body.code).toBe('APPOINTMENT_TRANSITION_INVALID');
    expect((await call('POST', `/clients/${C}/appointments/${requested.appointmentId}/update`, { version: 5, fields: { agenda: 'late' } })).body.code).toBe('APPOINTMENT_CLOSED');
    // A cancelled slot is free again.
    expect((await call('POST', `/clients/${C}/appointments`, { title: 'Reuse slot', mode: 'REMOTE', startsAt: moved.body.startsAt, endsAt: moved.body.endsAt, timezone: 'UTC', staffUid: 'ap-acct' })).status).toBe(201);
  });

  it('completes and marks no-shows only after the start, and keeps an immutable history', async () => {
    // A past confirmed appointment, inserted directly (the API never books in the past).
    await fixture.pg.exec(`INSERT INTO taxguard_appointments(tenant_id,appointment_id,client_id,staff_uid,category,mode,status,title,starts_at,ends_at,timezone,created_by,created_by_role,updated_by)
      VALUES('${T}','apt_${'a'.repeat(32)}','${C}','ap-acct','GENERAL','PHONE','CONFIRMED','Synthetic past call',now() - interval '2 hours',now() - interval '1 hour','UTC','ap-acct','accountant','ap-acct')`);
    as('acct');
    expect((await call('POST', `/clients/${C}/appointments/apt_${'a'.repeat(32)}/status`, { version: 1, action: 'no_show' })).body.status).toBe('NO_SHOW');
    const detail = (await call('GET', `/clients/${C}/appointments/${requested.appointmentId}`)).body;
    expect(detail.history.map((e: any) => e.action)).toEqual(['REQUESTED', 'RESCHEDULED', 'CONFIRMED', 'UPDATED', 'CANCELLED']);
    expect(JSON.stringify(detail.history)).not.toMatch(/Synthetic updated agenda|Discuss synthetic/);
    await expect(fixture.pg.query(`UPDATE taxguard_appointment_events SET action = 'X'`)).rejects.toThrow('APPOINTMENT_HISTORY_IMMUTABLE');
    await expect(fixture.pg.query(`DELETE FROM taxguard_appointments WHERE client_id = $1`, [C])).rejects.toThrow(/APPOINTMENT_IMMUTABLE|violates foreign key/);
    await expect(fixture.pg.query(`UPDATE taxguard_appointments SET status = 'CONFIRMED', version = version + 1 WHERE status = 'CANCELLED'`)).rejects.toThrow('APPOINTMENT_IMMUTABLE');
    const audit = (await fixture.pg.query<{ action: string; metadata: any }>(`SELECT action, metadata FROM taxguard_audit_log WHERE action LIKE 'APPOINTMENT_%'`)).rows;
    expect(audit.map(a => a.action)).toEqual(expect.arrayContaining(['APPOINTMENT_REQUESTED', 'APPOINTMENT_CREATED_CONFIRMED', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_NO_SHOW']));
    expect(JSON.stringify(audit)).not.toMatch(/meet\.example|staff-only note|Synthetic conflict at work/);
  });

  it('serves the staff schedule and, for managers only, the practice calendar', async () => {
    const range = `from=${encodeURIComponent(at(-48))}&to=${encodeURIComponent(at(24 * 30))}`;
    as('acct');
    const mine = (await call('GET', `/schedule?${range}`)).body;
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((a: any) => a.staffUid === 'ap-acct')).toBe(true);
    expect((await call('GET', `/schedule?${range}&staffUid=ap-acct2`)).body.code).toBe('APPOINTMENT_MANAGER_REQUIRED');
    as('mgr');
    const all = (await call('GET', `/schedule?${range}`)).body;
    expect(all.length).toBeGreaterThanOrEqual(mine.length);
    expect(all[0].clientName).toBe('Synthetic Appointment Client');
    expect((await call('GET', `/schedule?from=${encodeURIComponent(at(0))}&to=${encodeURIComponent(at(24 * 90))}`)).body.code).toBe('APPOINTMENT_RANGE_INVALID');
    as('client'); expect((await call('GET', `/schedule?${range}`)).status).toBe(403);
    as('bk'); expect((await call('GET', `/schedule?${range}`)).status).toBe(403);
  });

  it('exposes only the service RPCs, to service_role only', async () => {
    const rows = (await fixture.pg.query<{ proname: string; anon: boolean; auth: boolean; svc: boolean }>(`SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth, has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc FROM pg_proc p
      WHERE p.proname LIKE 'taxguard\\_apt\\_%' ORDER BY 1`)).rows;
    expect(rows.filter(r => r.anon || r.auth)).toEqual([]);
    expect(rows.filter(r => r.svc).map(r => r.proname)).toEqual(['taxguard_apt_create', 'taxguard_apt_get', 'taxguard_apt_list_client', 'taxguard_apt_reschedule',
      'taxguard_apt_schedule', 'taxguard_apt_transition', 'taxguard_apt_update']);
  });
});
