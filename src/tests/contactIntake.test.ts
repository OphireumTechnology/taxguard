import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPublicContactRouter } from '../server/routes/contact-intake.routes';
import { ContactStore } from '../server/taxguard/contact/contactStore';
import { StaffAccessRateLimit } from '../server/staffAccessRateLimit';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Contract C8: contact intake prepared but disabled (proposal 20261016050000). Without an approved
// intake policy every submission is refused; a SYNTHETIC policy is inserted only to exercise the
// gated path. No e-mail is sent and no response claims delivery. Synthetic visitors only.
const T = 'tenantA';
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin = ''; let n = 0;
const q = (sql: string, p: unknown[] = []) => fixture.pg.query<any>(sql, p).then(r => r.rows);
const form = (over: Record<string, unknown> = {}) => ({ fullName: 'Synthetic Visitor', email: 'visitor@example.test', topic: 'INDIVIDUAL_TAX',
  message: 'Synthetic question about a 2025 return.', consent: true, consentVersion: 'contact-test-1', ...over });
const submit = (body: unknown, key: string | null = `ct-key-${++n}-${Date.now()}`, path = '/contact') => fetch(origin + path, { method: 'POST',
  headers: { 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() as any }));

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(240000|250000|260000|270000)_|^20261016050000_/);
  await fixture.pg.exec(`INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('${T}','ct-mgr','practice_manager','active'),('${T}','ct-acct','accountant','active')`);
  const store = () => new ContactStore(pgliteRpc(() => fixture.pg));
  const app = express();
  app.use('/contact', createPublicContactRouter({ store, tenantId: () => T, limiter: new StaffAccessRateLimit(1000, 60_000) }));
  app.use('/default', createPublicContactRouter({ tenantId: () => T }));
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 120000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

describe('contact intake (C8)', () => {
  it('is disabled by default, without any configuration', async () => {
    const r = await submit(form(), 'ct-key-default-1', '/default');
    expect(r).toEqual({ status: 503, body: { code: 'CONTACT_INTAKE_DISABLED' } });
  });
  it('refuses every submission until an approved intake policy exists, storing nothing', async () => {
    const r = await submit(form());
    expect(r).toEqual({ status: 503, body: { code: 'CONTACT_INTAKE_NOT_APPROVED' } });
    expect(await q(`SELECT * FROM taxguard_contact_messages`)).toEqual([]);
    expect(await q(`SELECT * FROM taxguard_contact_intake_policies`)).toEqual([]);
  });
  it('stays closed when only another tenant has an approved policy', async () => {
    await q(`INSERT INTO taxguard_tenants(id,name) VALUES('tenantPolicyOnly','Synthetic Other Practice') ON CONFLICT DO NOTHING`);
    await q(`INSERT INTO taxguard_contact_intake_policies(tenant_id,retention_days,consent_version,per_email_per_day,per_fingerprint_per_hour,tenant_per_hour,approved_by,approved_at,decision_reference)
      VALUES('tenantPolicyOnly',90,'contact-test-1',2,10,100,'synthetic-owner',now(),'Synthetic other-tenant decision')`);
    expect((await submit(form())).body.code).toBe('CONTACT_INTAKE_NOT_APPROVED');
    expect(await q(`SELECT * FROM taxguard_contact_messages`)).toEqual([]);
  });
  it('with a synthetic approved policy: accepts consented messages, never echoes data or claims delivery', async () => {
    await q(`INSERT INTO taxguard_contact_intake_policies(tenant_id,retention_days,consent_version,per_email_per_day,per_fingerprint_per_hour,tenant_per_hour,approved_by,approved_at,decision_reference)
      VALUES($1,90,'contact-test-1',2,10,100,'synthetic-owner',now(),'Synthetic test decision')`, [T]);
    const r = await submit(form(), 'ct-key-accept-1');
    expect(r.status).toBe(202);
    expect(Object.keys(r.body).sort()).toEqual(['received', 'reference', 'replayed']);
    expect(JSON.stringify(r.body)).not.toMatch(/visitor|Synthetic|deliver|sent|email/i);
    const [row] = await q(`SELECT email, consent_version, (expires_at - created_at) > interval '89 days' AS retained FROM taxguard_contact_messages`);
    expect(row).toEqual({ email: 'visitor@example.test', consent_version: 'contact-test-1', retained: true });
    expect((await submit(form(), 'ct-key-accept-1')).body).toMatchObject({ replayed: true, reference: r.body.reference });
    const audit = await q(`SELECT metadata FROM taxguard_audit_log WHERE action = 'CONTACT_MESSAGE_RECEIVED'`);
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toMatch(/visitor|Synthetic Visitor|2025 return/);
  });
  it('requires consent to the current policy version and rejects forged input', async () => {
    expect((await submit(form({ consent: false }))).body.code).toBe('CONTACT_CONSENT_REQUIRED');
    expect((await submit(form({ consentVersion: 'old-version' }))).body.code).toBe('CONTACT_CONSENT_REQUIRED');
    for (const bad of [form({ email: 'not-an-email' }), form({ topic: 'MARKETING' }), form({ message: 'short' }), form({ fullName: 'x'.repeat(200) }), [form()]])
      expect((await submit(bad)).status, JSON.stringify(bad).slice(0, 60)).toBe(400);
    expect((await submit(form(), null)).body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect((await submit(form({ email: 'other@example.test' }), 'ct-key-accept-1')).body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });
  it('applies the policy abuse limits and the honeypot stores nothing', async () => {
    expect((await submit(form())).status).toBe(202);
    expect((await submit(form())).body.code).toBe('CONTACT_RATE_LIMITED');
    const before = (await q(`SELECT count(*)::int AS c FROM taxguard_contact_messages`))[0].c;
    expect((await submit(form({ email: 'bot@example.test', website: 'http://spam.example.test' }))).status).toBe(202);
    expect((await q(`SELECT count(*)::int AS c FROM taxguard_contact_messages`))[0].c).toBe(before);
  });
  it('lists unexpired messages to managers only and purges expired ones', async () => {
    const store = new ContactStore(pgliteRpc(() => fixture.pg));
    expect(await store.list(T, 'ct-mgr')).toHaveLength(2);
    await expect(store.list(T, 'ct-acct')).rejects.toMatchObject({ code: 'CONTACT_MANAGER_REQUIRED' });
    await expect(store.list('tenantB', 'ct-mgr')).rejects.toMatchObject({ code: 'CONTACT_MANAGER_REQUIRED' });
    await q(`UPDATE taxguard_contact_messages SET created_at = now() - interval '100 days', expires_at = now() - interval '10 days' WHERE email = 'visitor@example.test' AND message_id IN (SELECT message_id FROM taxguard_contact_messages ORDER BY created_at LIMIT 1)`);
    expect(await store.list(T, 'ct-mgr')).toHaveLength(1);
    expect(await store.purgeExpired(T)).toBe(1);
    expect((await q(`SELECT count(*)::int AS c FROM taxguard_contact_messages`))[0].c).toBe(1);
  });
  it('closes again as soon as the policy is withdrawn', async () => {
    await q(`DELETE FROM taxguard_contact_intake_policies WHERE tenant_id = $1`, [T]);
    expect((await submit(form({ email: 'after-withdrawal@example.test' }))).body.code).toBe('CONTACT_INTAKE_NOT_APPROVED');
    expect((await q(`SELECT count(*)::int AS c FROM taxguard_contact_messages WHERE email = 'after-withdrawal@example.test'`))[0].c).toBe(0);
  });
  it('keeps the tables and functions service-role only', async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const fn of ['taxguard_contact_submit(text,text,text,text,jsonb)', 'taxguard_contact_list(text,text,integer)', 'taxguard_contact_purge_expired(text)'])
        expect((await q(`SELECT has_function_privilege('${role}', 'public.${fn}', 'EXECUTE') AS ok`))[0].ok, fn).toBe(false);
      for (const t of ['taxguard_contact_messages', 'taxguard_contact_intake_policies'])
        expect((await q(`SELECT has_table_privilege('${role}', 'public.${t}', 'SELECT') AS ok`))[0].ok, t).toBe(false);
    }
  });
});
