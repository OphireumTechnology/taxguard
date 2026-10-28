import { randomUUID } from 'node:crypto';
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';
import { SecurityEventRecorder, securityDenialObserver } from '../server/securityEventRecorder';

let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^202610144[16]0000_/);
  await fixture.pg.exec("INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','security-admin','admin','active'),('tenantB','foreign-security','admin','active');");
}, 30000);
afterAll(async () => { await fixture?.pg.close(); });
describe('durable security event recording', () => {
  const event = { eventType: 'RBAC_ACCESS_DENIED', userId: 'security-admin', severity: 'warning' as const };
  it('persists sanitized events through the existing audit architecture across recorder instances', async () => {
    const rpc = pgliteRpc(() => fixture.pg), recorder = new SecurityEventRecorder(rpc, 'tenantA');
    recorder.record({ ...event, details: 'password=secret taxpayer content', ipAddress: 'private address' } as any);
    recorder.record({ eventType: 'AUTH_FAILURE_TELEMETRY', severity: 'critical',details:'password=secret taxpayer content',ipAddress:'private address' } as any); // recognized server-generated category, redacted
    recorder.record({eventType:'UNREGISTERED_BROWSER_TELEMETRY',severity:'critical'}); // unregistered codes remain ignored
    await recorder.drain();
    expect(recorder.status()).toEqual({ pending: 0, persisted: 2, failed: 0, dropped: 0 });
    const restarted = new SecurityEventRecorder(rpc, 'tenantA');
    expect(restarted.status().persisted).toBe(0);
    const rows = (await fixture.pg.query<any>("SELECT * FROM taxguard_audit_log WHERE action='SECURITY_AUTHORIZATION_DENIAL'")).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].metadata).toEqual({ category: 'SECURITY', severity: 'warning' });
    expect(rows[0].ip_address).toBeNull();
    expect(JSON.stringify(rows)).not.toMatch(/password|taxpayer|private address/);
    const authRows=(await fixture.pg.query<any>("SELECT * FROM taxguard_audit_log WHERE action='SECURITY_AUTH_FAILURE'")).rows;
    expect(authRows).toHaveLength(1);expect(authRows[0].metadata).toEqual({category:'SECURITY',severity:'critical'});expect(authRows[0].ip_address).toBeNull();expect(JSON.stringify(authRows)).not.toMatch(/password|taxpayer|private address/);
    await expect(fixture.pg.query('DELETE FROM taxguard_audit_log WHERE id=$1', [rows[0].id])).rejects.toThrow('SECURITY_EVENT_IMMUTABLE');
    await expect(fixture.pg.query("UPDATE taxguard_audit_log SET action='OTHER' WHERE id=$1", [rows[0].id])).rejects.toThrow('SECURITY_EVENT_IMMUTABLE');
    await expect(fixture.pg.exec('TRUNCATE taxguard_audit_log CASCADE')).rejects.toThrow('SECURITY_EVENT_IMMUTABLE');
  });
  it('verifies tenant and actor scope and refuses browser execution', async () => {
    const rpc = pgliteRpc(() => fixture.pg), recorder = new SecurityEventRecorder(rpc, 'tenantA');
    recorder.record({ ...event, userId: 'foreign-security' }); await recorder.drain();
    expect(recorder.status().failed).toBe(1);
    for (const role of ['anon', 'authenticated']) {
      const r = await fixture.pg.query<{ ok: boolean }>("SELECT has_function_privilege($1,'taxguard_security_record(text,text,uuid,text,text)','EXECUTE') AS ok", [role]);
      expect(r.rows[0].ok).toBe(false);
    }
    const bad = await rpc.rpc('taxguard_security_record', { p_tenant: 'missing', p_actor: null, p_event: randomUUID(), p_code: 'AUTH_FAILURE', p_severity: 'warning' });
    expect(bad.error?.message).toBe('SECURITY_TENANT_DENIED');
  });
  it('accepts anonymous auth failures and rejects changed payloads on replay', async () => {
    const rpc = pgliteRpc(() => fixture.pg);
    const args = { p_tenant: 'tenantA', p_actor: null, p_event: randomUUID(), p_code: 'AUTH_FAILURE', p_severity: 'warning' };
    expect((await rpc.rpc('taxguard_security_record', args)).data).toMatchObject({ replayed: false });
    expect((await rpc.rpc('taxguard_security_record', args)).data).toMatchObject({ replayed: true });
    expect((await rpc.rpc('taxguard_security_record', { ...args, p_severity: 'critical' })).error?.message).toBe('SECURITY_EVENT_CONFLICT');
    expect((await rpc.rpc('taxguard_security_record', { ...args, p_event: randomUUID(), p_code: 'password=secret' })).error?.message).toBe('SECURITY_EVENT_INVALID');
  });
  it('bounds queued writes and reports failures without a false durable-success claim', async () => {
    let resolve!: (r: any) => void;
    const recorder = new SecurityEventRecorder({ rpc: () => new Promise(r => { resolve = r; }) }, 'tenantA', 1);
    recorder.record(event); recorder.record(event);
    expect(recorder.status()).toMatchObject({ pending: 1, dropped: 1, persisted: 0 });
    await Promise.resolve(); resolve({ error: { message: 'secret' } }); await recorder.drain();
    expect(recorder.status()).toEqual({ pending: 0, dropped: 1, persisted: 0, failed: 1 });
  });
  it('records anonymous HTTP refusals without accepting client-supplied identity or secret material', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const recorder = new SecurityEventRecorder(pgliteRpc(() => fixture.pg, calls), 'tenantA');
    const app = express(); app.use(securityDenialObserver(recorder)); app.use((_req, res) => res.status(401).json({ code: 'AUTH_REQUIRED' }));
    const server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    try {
      const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/?userId=foreign-security&token=secret`, { headers: { authorization: 'Bearer private' } });
      expect(response.status).toBe(401); await response.json(); await recorder.drain();
      expect(calls).toHaveLength(1);
      expect(calls[0].args).toMatchObject({ p_actor: null, p_tenant: 'tenantA', p_code: 'AUTH_FAILURE' });
      expect(JSON.stringify(calls)).not.toMatch(/secret|private|foreign-security/);
      expect(recorder.status().persisted).toBe(1);
    } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
  });
});
