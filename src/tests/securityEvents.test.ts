import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AuditCenterStore } from '../server/taxguard/audit/auditCenterStore';
import { configureDurableSecurityEvents, installSecurityEventSink, MAX_QUEUE, SecurityEventSink, securityEventSink } from '../server/taxguard/audit/securityEventSink';
import { db, MAX_MEMORY_SECURITY_EVENTS } from '../server/db';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Proposal 048 (durable, bounded security events) and the server sink. PGlite with the core schema
// and proposals 041, 046, 048. Synthetic data only.
const SECRET = 'synthetic-fingerprint-secret-0123456789abcdef';
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
const rpc = () => pgliteRpc(() => fixture.pg);
const record = (args: Partial<Record<string, unknown>>) => rpc().rpc('taxguard_security_event_record', { p_tenant: 'tenantA', p_category: 'AUTH', p_event: 'AUTH_FAILURE_TELEMETRY',
  p_severity: 'warning', p_actor: null, p_fingerprint: 'ab'.repeat(16), p_detail: {}, ...args }).then(r => r.data?.result ?? r.error?.code);
const rows = (action = 'SECURITY_%') => fixture.pg.query<{ action: string; actor_uid: string; tenant_id: string; metadata: any }>(
  `SELECT action, actor_uid, tenant_id, metadata FROM taxguard_audit_log WHERE action LIKE $1 ORDER BY timestamp, id`, [action]).then(r => r.rows);
const range = () => ({ from: new Date(Date.now() - 3_600_000).toISOString(), to: new Date(Date.now() + 3_600_000).toISOString() });

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261014(410000|460000|480000)_/);
  await fixture.pg.exec(`INSERT INTO taxguard_tenants(id,name,status) VALUES('tenantS','Suspended synthetic','suspended');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','se-admin','admin','active'),('tenantB','se-admin-b','admin','active'),
      ('tenantA','se-acct','accountant','active'),('tenantA','se-client','client','active'),('tenantA','se-mgr','practice_manager','active');`);
}, 90000);
afterAll(async () => { await fixture?.pg.close(); });
afterEach(() => installSecurityEventSink(null));

describe('proposal 048: recording', () => {
  it('records a redacted row for an unauthenticated event; free text, secrets and addresses never stored', async () => {
    expect(await record({ p_detail: { route: '/api/auth/login', method: 'POST', status: 401, reason: 'INVALID_CREDENTIALS', password: 'hunter2-synthetic',
      token: 'eyJhbGciOi.synthetic', email: 'person@example.test', details: 'Failed login for person@example.test from 203.0.113.9', ipAddress: '203.0.113.9',
      requestId: 'has spaces not allowed', clientId: 'x'.repeat(200) } })).toBe('RECORDED');
    const [row] = await rows();
    expect(row).toMatchObject({ action: 'SECURITY_AUTH_FAILURE_TELEMETRY', actor_uid: 'anonymous', tenant_id: 'tenantA' });
    expect(row.metadata).toEqual({ category: 'AUTH', event: 'AUTH_FAILURE_TELEMETRY', severity: 'warning', fingerprint: 'ab'.repeat(8),
      route: '/api/auth/login', method: 'POST', status: 401, reason: 'INVALID_CREDENTIALS', droppedFields: 7 });
    expect(JSON.stringify(row)).not.toMatch(/hunter2|eyJ|example\.test|203\.0\.113|spaces/);
  });

  it.each([
    ['unknown category', { p_category: 'PAYMENT' }], ['free-text event', { p_event: 'login failed for bob' }], ['lower-case event', { p_event: 'auth_failure' }],
    ['malformed actor', { p_actor: 'bob@example.test' }], ['raw address as fingerprint', { p_fingerprint: '203.0.113.9' }], ['bad severity', { p_severity: 'panic' }],
    ['unknown tenant', { p_tenant: 'tenantZ' }], ['suspended tenant', { p_tenant: 'tenantS' }], ['malformed tenant', { p_tenant: "tenantA' OR 1=1" }],
  ])('rejects %s without writing', async (_label, args) => {
    const before = (await rows()).length;
    expect(await record(args)).toBe('REJECTED');
    expect((await rows()).length).toBe(before);
  });

  it('bounds each source per minute and writes one repeated-requests marker; other sources are unaffected', async () => {
    const fp = 'cd'.repeat(16), results: string[] = [];
    for (let i = 0; i < 26; i++) results.push(await record({ p_fingerprint: fp, p_category: 'ACCESS', p_event: 'RBAC_ACCESS_DENIED' }));
    expect(results.filter(r => r === 'RECORDED')).toHaveLength(20);
    expect(results.filter(r => r === 'SUPPRESSED')).toHaveLength(6);
    expect(await rows('SECURITY_REPEATED_REQUESTS')).toEqual([expect.objectContaining({ metadata: expect.objectContaining({ category: 'ABUSE', sourceCategory: 'ACCESS', fingerprint: 'cd'.repeat(8) }) })]);
    expect(await record({ p_fingerprint: 'ef'.repeat(16), p_category: 'ACCESS', p_event: 'RBAC_ACCESS_DENIED' })).toBe('RECORDED');
    const w = (await fixture.pg.query<{ recorded: number; suppressed: number }>(`SELECT recorded, suppressed FROM taxguard_security_event_windows WHERE scope_key = 'ACCESS:' || $1`, [fp])).rows[0];
    expect(w).toEqual({ recorded: 20, suppressed: 6 });
  });

  it('bounds the tenant as a whole, so rotating sources cannot grow the log without limit', async () => {
    await fixture.pg.exec(`DELETE FROM taxguard_security_event_windows WHERE tenant_id = 'tenantB'`);
    const before = (await rows()).length; let recorded = 0;
    for (let i = 0; i < 640; i++) if (await record({ p_fingerprint: i.toString(16).padStart(32, '0'), p_tenant: 'tenantB', p_category: 'AUTH' }) === 'RECORDED') recorded++;
    expect(recorded).toBe(600);
    expect((await rows()).length - before).toBe(600);
    // Another tenant still records.
    expect(await record({ p_fingerprint: '12'.repeat(16) })).toBe('RECORDED');
  }, 60000);
});

describe('proposal 048: reading (administrators only)', () => {
  const store = () => new AuditCenterStore(rpc());
  it('shows security events in the audit center to an administrator of the tenant only', async () => {
    const page = await store().list('tenantA', 'se-admin', { ...range(), categories: ['SECURITY'], limit: 100 });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((e: any) => e.category === 'SECURITY')).toBe(true);
    const ev = page.items.find((e: any) => e.action === 'SECURITY_AUTH_FAILURE_TELEMETRY' && e.fields.route);
    expect(ev.fields).toMatchObject({ event: 'AUTH_FAILURE_TELEMETRY', route: '/api/auth/login', fingerprint: expect.stringMatching(/^[0-9a-f]{16}$/) });
    for (const actor of ['se-acct', 'se-client', 'se-mgr', 'se-nobody'])
      await expect(store().list('tenantA', actor, { ...range(), categories: ['SECURITY'] })).rejects.toMatchObject({ code: 'AUDIT_ADMIN_REQUIRED' });
    expect((await store().list('tenantB', 'se-admin-b', { ...range(), categories: ['SECURITY'], limit: 100 })).items.every((e: any) => e.action.startsWith('SECURITY_'))).toBe(true);
    await expect(store().list('tenantB', 'se-admin', { ...range(), categories: ['SECURITY'] })).rejects.toMatchObject({ code: 'AUDIT_ADMIN_REQUIRED' });
  });
  it('summarises recorded and suppressed counts for administrators only', async () => {
    const r = range();
    const summary = await store().securitySummary('tenantA', 'se-admin', r.from, r.to);
    expect(summary.categories.find(c => c.category === 'ACCESS')).toMatchObject({ suppressed: 6 });
    await expect(store().securitySummary('tenantA', 'se-acct', r.from, r.to)).rejects.toMatchObject({ code: 'AUDIT_ADMIN_REQUIRED' });
    await expect(store().securitySummary('tenantA', 'se-admin', r.from, new Date(Date.now() + 40 * 86_400_000).toISOString())).rejects.toMatchObject({ code: 'AUDIT_RANGE_INVALID' });
  });
  it('exposes nothing to client-facing roles', async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const fn of ['taxguard_security_event_record(text,text,text,text,text,text,jsonb)', 'taxguard_security_event_summary(text,text,timestamptz,timestamptz)'])
        expect((await fixture.pg.query<{ ok: boolean }>(`SELECT has_function_privilege('${role}', 'public.${fn}', 'EXECUTE') AS ok`)).rows[0].ok, `${role} ${fn}`).toBe(false);
      expect((await fixture.pg.query<{ ok: boolean }>(`SELECT has_table_privilege('${role}', 'public.taxguard_security_event_windows', 'SELECT') AS ok`)).rows[0].ok).toBe(false);
    }
  });
});

describe('server sink', () => {
  const sink = () => new SecurityEventSink(rpc, 'tenantA', SECRET);
  it('sends only the category, code, identifiers and an HMAC fingerprint, never the message or the address', () => {
    const args = sink().toRecord({ eventType: 'CROSS_TENANT_ACCESS_ATTEMPT', ipAddress: '203.0.113.7', userId: 'se-acct', resourceType: 'document', authorizationResult: 'denied',
      details: 'User se-acct (person@example.test) tried tenantB document doc_1', severity: 'critical' })!;
    expect(args).toEqual({ p_tenant: 'tenantA', p_category: 'ACCESS', p_event: 'CROSS_TENANT_ACCESS_ATTEMPT', p_severity: 'critical', p_actor: 'se-acct',
      p_fingerprint: expect.stringMatching(/^[0-9a-f]{32}$/), p_detail: { resourceType: 'document', authorizationResult: 'denied' } });
    expect(JSON.stringify(args)).not.toMatch(/203\.0\.113|example\.test|tried/);
    expect(sink().toRecord({ eventType: 'SCHEDULE_CONFLICT_PREVENTED', details: 'operational' })).toBeNull();
    expect(sink().toRecord({ eventType: 'RBAC_ACCESS_DENIED', userId: 'bad id with spaces', ipAddress: 'unknown' })).toMatchObject({ p_actor: null, p_fingerprint: null });
  });
  it('records through the database and keeps counts', async () => {
    const s = sink();
    s.record({ eventType: 'STAFF_MFA_REQUIRED', userId: 'se-acct', ipAddress: '198.51.100.1', severity: 'warning' });
    s.record({ eventType: 'CLIENT_RUNTIME_ERROR', details: 'not a security event' });
    await s.flush();
    expect(s.stats()).toMatchObject({ recorded: 1, skipped: 1, failed: 0, pending: 0 });
    expect((await rows('SECURITY_STAFF_MFA_REQUIRED'))[0]).toMatchObject({ actor_uid: 'se-acct', metadata: expect.objectContaining({ category: 'MFA' }) });
  });
  it('never throws or blocks when the database fails, and bounds its queue', async () => {
    const failing = new SecurityEventSink(() => ({ rpc: () => Promise.reject(new Error('connection lost')) }), 'tenantA', SECRET);
    const throwing = new SecurityEventSink(() => { throw new Error('no client'); }, 'tenantA', SECRET);
    for (let i = 0; i < MAX_QUEUE + 25; i++) expect(() => failing.record({ eventType: 'RBAC_ACCESS_DENIED' })).not.toThrow();
    expect(failing.stats().dropped).toBe(25);
    throwing.record({ eventType: 'RBAC_ACCESS_DENIED' });
    await failing.flush(); await throwing.flush();
    expect(failing.stats()).toMatchObject({ failed: MAX_QUEUE, recorded: 0, pending: 0 });
    expect(throwing.stats().failed).toBe(1);
    const unknownResult = new SecurityEventSink(() => ({ rpc: async () => ({ data: null, error: { code: '42501', message: 'permission denied' } }) }), 'tenantA', SECRET);
    unknownResult.record({ eventType: 'RBAC_ACCESS_DENIED' }); await unknownResult.flush();
    expect(unknownResult.stats().failed).toBe(1);
  });
  it('is installed only with a durable store, a long secret and a valid tenant (status codes only)', () => {
    const client = () => rpc();
    expect(configureDurableSecurityEvents({ TAXGUARD_SECURITY_EVENT_FINGERPRINT_SECRET: SECRET, TAXGUARD_TENANT_ID: 'tenantA' }, false, client)).toBe('MEMORY_ONLY_NOT_CONFIGURED');
    expect(configureDurableSecurityEvents({ TAXGUARD_SECURITY_EVENT_FINGERPRINT_SECRET: 'short', TAXGUARD_TENANT_ID: 'tenantA' }, true, client)).toBe('MEMORY_ONLY_SECRET_MISSING');
    expect(configureDurableSecurityEvents({ TAXGUARD_SECURITY_EVENT_FINGERPRINT_SECRET: SECRET, TAXGUARD_TENANT_ID: 'bad tenant' }, true, client)).toBe('MEMORY_ONLY_TENANT_INVALID');
    expect(securityEventSink()).toBeNull();
    expect(configureDurableSecurityEvents({ TAXGUARD_SECURITY_EVENT_FINGERPRINT_SECRET: SECRET, TAXGUARD_TENANT_ID: 'tenantA' }, true, client)).toBe('DURABLE');
    expect(securityEventSink()).toBeInstanceOf(SecurityEventSink);
  });
  it('db.logSecurityEvent forwards to the installed sink and keeps a bounded memory list', async () => {
    const s = sink(); installSecurityEventSink(s);
    for (let i = 0; i < MAX_MEMORY_SECURITY_EVENTS + 10; i++) db.logSecurityEvent({ eventType: 'SCHEDULE_CONFLICT_PREVENTED', ipAddress: '127.0.0.1', details: 'synthetic', severity: 'info' });
    expect(db.securityEvents.length).toBe(MAX_MEMORY_SECURITY_EVENTS);
    db.logSecurityEvent({ eventType: 'DISABLED_USER_LOGIN_ATTEMPT', ipAddress: '127.0.0.1', details: 'synthetic', severity: 'warning' });
    await s.flush();
    expect(s.stats()).toMatchObject({ recorded: 1, skipped: MAX_MEMORY_SECURITY_EVENTS + 10 });
  });
});
