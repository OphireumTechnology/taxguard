import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSchedulingRouter } from '../server/routes/appointments-durable.routes';
import { AppointmentStore } from '../server/taxguard/appointments/appointmentStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Contract C5: durable consultation rooms derived from appointments (proposal 20261016030000).
// No video transport exists or is implied. Synthetic records only.
const T = 'tenantA', C = 'roClient', OTHER = 'roOther';
const people: Record<string, any> = { mgr: { id: 'ro-mgr', role: 'practice_manager' }, host: { id: 'ro-host', role: 'accountant' }, peer: { id: 'ro-peer', role: 'reviewer' },
  client: { id: 'ro-client', role: 'client', clientId: C }, other: { id: 'ro-other', role: 'client', clientId: OTHER } };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin = ''; let user: any;
const ids: Record<string, string> = {};
const as = (who: string, tenantId = T) => { user = { ...people[who], tenantId, status: 'active' }; };
const room = (id: string, client = C) => fetch(`${origin}/s/clients/${client}/appointments/${id}/room`).then(async r => ({ status: r.status, body: await r.json() as any }));
const act = (id: string, ev: 'join' | 'leave', client = C) => fetch(`${origin}/s/clients/${client}/appointments/${id}/room/${ev}`, { method: 'POST' }).then(async r => ({ status: r.status, body: await r.json() as any }));
const q = (sql: string, p: unknown[] = []) => fixture.pg.query<any>(sql, p).then(r => r.rows);

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^2026101(2(240000|250000|260000|270000)|4400000|6030000)_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','ro-client','Synthetic Room Client'),('${T}','${OTHER}','ro-other','Other Synthetic');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) SELECT '${T}', v->>'id', v->>'role', 'active', v->>'clientId' FROM jsonb_array_elements('${JSON.stringify(Object.values(people))}'::jsonb) v;
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantB','ro-foreign','practice_manager','active');
    INSERT INTO taxguard_identities(tenant_id,uid,user_data) VALUES('${T}','ro-host','{"name":"Synthetic Host Advisor"}');`);
  const rpc = () => pgliteRpc(() => fixture.pg);
  const practice = new PracticeStore(rpc()), apts = new AppointmentStore(rpc());
  const eng = (await practice.createEngagement(T, C, 'ro-mgr', 'ro-eng-0001', { title: 'Synthetic 2025', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'ro-mgr', eng, 'active', 1);
  for (const [staff, k] of [['ro-host', '1'], ['ro-peer', '2']]) await practice.assign(T, C, 'ro-mgr', 'ro-asg-000' + k, { engagementId: eng, taxYear: 2025, role: k === '1' ? 'preparer' : 'reviewer', userId: staff, reason: 'Synthetic staffing' });
  const make = async (name: string, mode: string, offsetDays: number, meetingUrl?: string) => {
    const start = new Date(Date.now() + offsetDays * 86_400_000); start.setUTCMinutes(0, 0, 0);
    const r: any = await apts.create(T, C, 'ro-mgr', 'ro-apt-key-' + name, { title: 'Synthetic ' + name, category: 'CONSULTATION', mode, startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 3_600_000).toISOString(), timezone: 'America/New_York', staffUid: 'ro-host', confirm: true, ...(meetingUrl ? { meetingUrl } : {}) });
    ids[name] = r.appointmentId;
  };
  await make('open', 'REMOTE', 3, 'https://meet.example.test/synthetic-room'); await make('future', 'REMOTE', 4, 'https://meet.example.test/later');
  await make('inperson', 'IN_PERSON', 5); await make('cancelled', 'REMOTE', 6);
  // Move the "open" appointment so that it starts in five minutes (synthetic setup only).
  await q(`UPDATE taxguard_appointments SET starts_at = now() + interval '5 minutes', ends_at = now() + interval '65 minutes', version = version + 1 WHERE appointment_id = $1`, [ids.open]);
  const c: any = await apts.get(T, C, 'ro-mgr', ids.cancelled);
  await apts.transition(T, C, 'ro-mgr', ids.cancelled, c.version, 'ro-cancel-key-1', 'cancel', 'Synthetic cancellation');
  const app = express();
  app.use('/s', createSchedulingRouter({ store: () => new AppointmentStore(rpc()), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 120000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

describe('consultation rooms (C5)', () => {
  it('derives an OPEN room for a confirmed remote appointment inside its window, with the real host and no video provider', async () => {
    as('client');
    const r = await room(ids.open);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ roomState: 'OPEN', participant: 'CLIENT', appointmentStatus: 'CONFIRMED', mode: 'REMOTE', videoProvider: 'NOT_COMMISSIONED',
      meetingUrl: 'https://meet.example.test/synthetic-room', host: { assigned: true, displayName: 'Synthetic Host Advisor' }, clientName: 'Synthetic Room Client', joined: false });
    expect(JSON.stringify(r.body)).not.toMatch(/ro-host|internalNote|staffUid|createdBy/);
  });
  it.each([['future', 'NOT_YET_OPEN'], ['inperson', 'NOT_REMOTE'], ['cancelled', 'CANCELLED']])('reports %s as %s without a meeting link', async (name, state) => {
    as('client');
    const r = await room(ids[name]);
    expect(r.body.roomState).toBe(state);
    expect(r.body.meetingUrl).toBeNull();
  });
  it('records durable, idempotent join and leave events with identifier-only audit rows', async () => {
    as('client');
    expect((await act(ids.open, 'leave')).body.recorded).toBe(false);
    const joined = await act(ids.open, 'join');
    expect(joined.body).toMatchObject({ recorded: true, joined: true, clientPresent: true, hostPresent: false });
    expect((await act(ids.open, 'join')).body.recorded).toBe(false);
    as('host');
    expect((await act(ids.open, 'join')).body).toMatchObject({ recorded: true, participant: 'HOST', hostPresent: true, clientPresent: true });
    as('client');
    expect((await act(ids.open, 'leave')).body).toMatchObject({ recorded: true, joined: false, clientPresent: false, hostPresent: true });
    const events = await q(`SELECT participant, event FROM taxguard_appointment_room_events WHERE appointment_id = $1 ORDER BY at, event_id`, [ids.open]);
    expect(events.map((e: any) => e.participant + ':' + e.event)).toEqual(['CLIENT:JOINED', 'HOST:JOINED', 'CLIENT:LEFT']);
    const audit = await q(`SELECT action, metadata FROM taxguard_audit_log WHERE action LIKE 'APPOINTMENT_ROOM_%' ORDER BY timestamp`);
    expect(audit.map((a: any) => a.action)).toEqual(['APPOINTMENT_ROOM_JOINED', 'APPOINTMENT_ROOM_JOINED', 'APPOINTMENT_ROOM_LEFT']);
    expect(JSON.stringify(audit)).not.toMatch(/Synthetic Room Client|Synthetic Host Advisor|meet\.example/);
    await expect(q(`UPDATE taxguard_appointment_room_events SET event = 'LEFT'`)).rejects.toThrow('ROOM_HISTORY_IMMUTABLE');
    await expect(q(`DELETE FROM taxguard_appointment_room_events`)).rejects.toThrow('ROOM_HISTORY_IMMUTABLE');
  });
  it('refuses to join a room that is not open', async () => {
    as('client');
    for (const name of ['future', 'inperson', 'cancelled']) expect((await act(ids[name], 'join')).body.code, name).toBe('ROOM_NOT_OPEN');
  });
  it('lets managers in and refuses other staff, other clients, other tenants and guessed ids', async () => {
    as('mgr');
    expect((await room(ids.open)).body.participant).toBe('MANAGER');
    for (const [who, tenant, client] of [['peer', T, C], ['other', T, C], ['client', T, OTHER], ['client', 'tenantB', C]] as const) {
      as(who, tenant);
      const r = await room(ids.open, client);
      expect([403, 404], `${who} ${tenant} ${client}`).toContain(r.status);
      expect(JSON.stringify(r.body)).not.toMatch(/meet\.example|Synthetic Host/);
      expect([403, 404]).toContain((await act(ids.open, 'join', client)).status);
    }
    as('client');
    expect((await room('apt_' + '0'.repeat(32))).status).toBe(404);
    expect((await room('not-an-id')).status).toBe(404);
  });
  it('bounds events per participant', async () => {
    await q(`INSERT INTO taxguard_appointment_room_events(tenant_id, appointment_id, actor_uid, participant, event)
      SELECT $1, $2, 'ro-mgr', 'MANAGER', CASE WHEN g % 2 = 0 THEN 'JOINED' ELSE 'LEFT' END FROM generate_series(1, 50) g`, [T, ids.open]);
    as('mgr');
    const last = (await q(`SELECT event FROM taxguard_appointment_room_events WHERE actor_uid = 'ro-mgr' ORDER BY at DESC, event_id DESC LIMIT 1`))[0].event;
    expect((await act(ids.open, last === 'JOINED' ? 'leave' : 'join')).body.code).toBe('ROOM_EVENT_LIMIT');
  });
  it('keeps the room functions service-role only', async () => {
    for (const role of ['anon', 'authenticated']) for (const fn of ['taxguard_apt_room(text,text,text,text)', 'taxguard_apt_room_event(text,text,text,text,text)'])
      expect((await q(`SELECT has_function_privilege('${role}', 'public.${fn}', 'EXECUTE') AS ok`))[0].ok, fn).toBe(false);
  });
});
