import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClientPortalRouter } from '../server/routes/client-portal.routes';
import { CONSULTATION_CONSENT_VERSION, ConsultationStore } from '../server/taxguard/consultations/consultationStore';
import { AppointmentStore } from '../server/taxguard/appointments/appointmentStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Contract C1: client consultation history (proposal 20261016010000) over 040 and 043.
// Only requests CONVERTED for this client appear, with the real appointment's current status.
// Synthetic records only.
const T = 'tenantA', C = 'chClient', OTHER = 'chOther';
const people: Record<string, any> = { mgr: { id: 'ch-mgr', role: 'practice_manager' }, acct: { id: 'ch-acct', role: 'accountant' }, outsider: { id: 'ch-outsider', role: 'accountant' },
  client: { id: 'ch-client', role: 'client', clientId: C }, other: { id: 'ch-other', role: 'client', clientId: OTHER } };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin = ''; let user: any; const converted: string[] = []; let pending = ''; let foreignOwned = ''; let cancelledApt = '';
const as = (who: string, tenantId = T) => { user = { ...people[who], tenantId, status: 'active' }; };
const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const get = (path: string) => fetch(origin + path).then(async r => ({ status: r.status, body: await r.json().catch(() => null) as any }));
const PRIVATE = /Synthetic Visitor|visitor\d@example\.test|555|Synthetic private question|internal|decision|reviewedBy|ch-mgr|ch-acct|fingerprint|consent/i;

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^2026101(2(240000|250000|260000|270000)|4(400000|430000)|6010000)_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','ch-client','Synthetic History Client'),('${T}','${OTHER}','ch-other','Other Synthetic');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) SELECT '${T}', v->>'id', v->>'role', 'active', v->>'clientId' FROM jsonb_array_elements('${JSON.stringify(Object.values(people))}'::jsonb) v;
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantB','ch-foreign','practice_manager','active');`);
  const rpc = () => pgliteRpc(() => fixture.pg);
  const practice = new PracticeStore(rpc()), consult = new ConsultationStore(rpc());
  for (const [client, key] of [[C, '1'], [OTHER, '2']]) {
    const eng = (await practice.createEngagement(T, client, 'ch-mgr', 'ch-eng-000' + key, { title: 'Synthetic 2025', type: 'tax_preparation', taxYears: [2025] })).engagementId;
    await practice.setEngagementStatus(T, client, 'ch-mgr', eng, 'active', 1);
    await practice.assign(T, client, 'ch-mgr', 'ch-asg-000' + key, { engagementId: eng, taxYear: 2025, role: 'preparer', userId: 'ch-acct', reason: 'Synthetic staffing' });
  }
  const submit = async (i: number) => {
    await consult.submit(T, `ch-submit-${i}-key`, '198.51.100.' + i, { fullName: 'Synthetic Visitor', email: `visitor${i}@example.test`, phone: '555-0100', preferredContact: 'EMAIL',
      topic: i % 2 ? 'TAX_PLANNING' : 'INDIVIDUAL_TAX', modePreference: 'REMOTE', preferredWindows: [{ date: day(5), partOfDay: 'MORNING' }], timezone: 'America/New_York',
      message: 'Synthetic private question', consent: true, consentVersion: CONSULTATION_CONSENT_VERSION });
    const list: any = await consult.list(T, 'ch-mgr', 'NEW');
    return (list.items ?? list).map((q: any) => q.requestId).find((id: string) => ![...converted, pending, foreignOwned].includes(id)) as string;
  };
  const convert = async (id: string, client: string, hour: number) => {
    await consult.decide(T, 'ch-mgr', id, 1, `ch-decide-${id}`, 'review');
    const start = new Date(Date.now() + 6 * 86_400_000); start.setUTCHours(hour, 0, 0, 0);
    const r: any = await consult.convert(T, 'ch-mgr', id, 2, `ch-convert-${id}`, client, { title: 'Synthetic consultation', category: 'CONSULTATION', mode: 'REMOTE',
      startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3_600_000).toISOString(), timezone: 'America/New_York', staffUid: 'ch-acct', confirm: true,
      internalNote: 'internal staff note' });
    return r.appointment?.appointmentId ?? r.convertedAppointmentId;
  };
  const a = await submit(1); converted.push(a); await convert(a, C, 13);
  const b = await submit(2); converted.push(b); cancelledApt = await convert(b, C, 15);
  pending = await submit(3);
  foreignOwned = await submit(4); await convert(foreignOwned, OTHER, 17);
  // The second appointment is later cancelled: history must show the CURRENT status.
  const apts = new AppointmentStore(rpc());
  const detail: any = await apts.get(T, C, 'ch-mgr', cancelledApt);
  await apts.transition(T, C, 'ch-mgr', cancelledApt, detail.version, 'ch-cancel-key-1', 'cancel', 'Synthetic cancellation reason');
  const app = express();
  app.use('/portal', createClientPortalRouter({ client: rpc, authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 120000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

describe('client consultation history (C1)', () => {
  it('lists only requests converted for this client, with the current appointment status and no prospect or staff data', async () => {
    as('client');
    const r = await get(`/portal/clients/${C}/consultations`);
    expect(r.status).toBe(200);
    expect(r.body.items.map((i: any) => i.requestId).sort()).toEqual([...converted].sort());
    expect(r.body.items.every((i: any) => i.status === 'CONVERTED' && i.appointment?.appointmentId)).toBe(true);
    expect(r.body.items.find((i: any) => i.appointment.appointmentId === cancelledApt).appointment.status).toBe('CANCELLED');
    expect(r.body.items.map((i: any) => i.requestId)).not.toContain(pending);
    expect(r.body.items.map((i: any) => i.requestId)).not.toContain(foreignOwned);
    expect(r.body.nextCursor).toBeNull();
    for (const item of r.body.items) expect(Object.keys(item).sort()).toEqual(['appointment', 'convertedAt', 'createdAt', 'requestId', 'status', 'topic']);
    expect(Object.keys(r.body.items[0].appointment).sort()).toEqual(['appointmentId', 'endsAt', 'mode', 'startsAt', 'status', 'timezone', 'title']);
    expect(JSON.stringify(r.body)).not.toMatch(PRIVATE);
  });
  it('pages with a bounded keyset cursor', async () => {
    const first: any = (await fixture.pg.query<{ r: any }>(`SELECT public.taxguard_portal_consultations($1,$2,$3,1,NULL) AS r`, [T, C, 'ch-client'])).rows[0].r;
    expect(first.items).toHaveLength(1); expect(first.next).toEqual({ at: expect.any(String), id: first.items[0].requestId });
    const second: any = (await fixture.pg.query<{ r: any }>(`SELECT public.taxguard_portal_consultations($1,$2,$3,1,$4) AS r`, [T, C, 'ch-client', JSON.stringify(first.next)])).rows[0].r;
    expect(second.items).toHaveLength(1); expect(second.items[0].requestId).not.toBe(first.items[0].requestId); expect(second.next).toBeNull();
    await expect(fixture.pg.query(`SELECT public.taxguard_portal_consultations($1,$2,$3,21,NULL)`, [T, C, 'ch-client'])).rejects.toThrow('PORTAL_INPUT_INVALID');
    as('client');
    const cursor = Buffer.from(JSON.stringify(first.next)).toString('base64url');
    expect((await get(`/portal/clients/${C}/consultations?after=${cursor}`)).body.items).toHaveLength(2 - 1);
    expect((await get(`/portal/clients/${C}/consultations?after=not-json`)).status).toBe(400);
    expect((await get(`/portal/clients/${C}/consultations?after=${Buffer.from(JSON.stringify({ at: 'x', id: "csr_' OR 1=1" })).toString('base64url')}`)).status).toBe(400);
  });
  it.each([['another client', 'other', T, C], ['own credentials on another client id', 'client', T, OTHER], ['another tenant', 'client', 'tenantB', C], ['an unassigned accountant', 'outsider', T, C]])(
    'refuses %s', async (_l, who, tenant, client) => {
      as(who, tenant);
      const r = await get(`/portal/clients/${client}/consultations`);
      expect([403, 404]).toContain(r.status);
      expect(JSON.stringify(r.body)).not.toMatch(/csr_|apt_/);
    });
  it('lets assigned staff read the same history; the function is service-role only', async () => {
    as('acct');
    expect((await get(`/portal/clients/${C}/consultations`)).body.items).toHaveLength(2);
    for (const role of ['anon', 'authenticated'])
      expect((await fixture.pg.query<{ ok: boolean }>(`SELECT has_function_privilege('${role}', 'public.taxguard_portal_consultations(text,text,text,integer,jsonb)', 'EXECUTE') AS ok`)).rows[0].ok).toBe(false);
  });
});
