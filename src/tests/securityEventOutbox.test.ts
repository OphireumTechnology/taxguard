import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';
import { SecurityEventRecorder } from '../server/securityEventRecorder';

let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
beforeAll(async () => { fixture = await capabilityFixture(); await applyProposals(fixture.pg, /^202610144[16]0000_|^20261015000000_/);
  await fixture.pg.exec("INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','outbox-admin','admin','active');"); }, 30000);
afterAll(async () => { await fixture?.pg.close(); });
describe('durable security handoff', () => {
  const event = { eventType: 'RBAC_ACCESS_DENIED', userId: 'outbox-admin', severity: 'warning' as const };
  it('recovers acknowledged pending events after producer restart and delivers only one audit identity', async () => {
    const rpc = pgliteRpc(() => fixture.pg), id = randomUUID();
    const producer = new SecurityEventRecorder(rpc, 'tenantA', 100, 'outbox');
    expect(await producer.recordDurably({ ...event, details: 'secret taxpayer payload' } as any, id)).toEqual({ eventId: id, acknowledged: true });
    expect((await fixture.pg.query("SELECT count(*)::int n FROM taxguard_audit_log WHERE id=$1", [id])).rows[0]).toEqual({ n: 0 });
    const restarted = new SecurityEventRecorder(rpc, 'tenantA', 100, 'outbox');
    await restarted.dispatch(); await restarted.dispatch();
    expect((await fixture.pg.query("SELECT count(*)::int n FROM taxguard_audit_log WHERE id=$1", [id])).rows[0]).toEqual({ n: 1 });
    const record = (await fixture.pg.query<any>('SELECT * FROM taxguard_security_outbox WHERE event_id=$1', [id])).rows[0];
    expect(record.status).toBe('DELIVERED'); expect(JSON.stringify(record)).not.toMatch(/secret|taxpayer/);
    expect(await restarted.recordDurably(event, id)).toMatchObject({ acknowledged: true });
    await expect(fixture.pg.query('DELETE FROM taxguard_security_outbox WHERE event_id=$1', [id])).rejects.toThrow('SECURITY_OUTBOX_IMMUTABLE');
    await expect(fixture.pg.query("UPDATE taxguard_security_outbox SET severity='critical' WHERE event_id=$1", [id])).rejects.toThrow('SECURITY_OUTBOX_IMMUTABLE');
  });
  it('retains acknowledged delivery failures, retries with the same identity and never deletes envelopes', async () => {
    const rpc = pgliteRpc(() => fixture.pg), recorder = new SecurityEventRecorder(rpc, 'tenantA', 100, 'outbox'), id = randomUUID();
    await recorder.recordDurably({ eventType: 'INVALID_CREDENTIALS', severity: 'warning' }, id);
    await fixture.pg.exec(`CREATE FUNCTION fail_outbox_delivery() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic outage'; END $$;
      CREATE TRIGGER fail_outbox_delivery BEFORE INSERT ON taxguard_audit_log FOR EACH ROW EXECUTE FUNCTION fail_outbox_delivery();`);
    try { await recorder.dispatch(); } finally { await fixture.pg.exec('DROP TRIGGER fail_outbox_delivery ON taxguard_audit_log; DROP FUNCTION fail_outbox_delivery();'); }
    let row = (await fixture.pg.query<any>('SELECT status,attempts FROM taxguard_security_outbox WHERE event_id=$1', [id])).rows[0];
    expect(row).toEqual({ status: 'PENDING', attempts: 1 });
    await fixture.pg.query('UPDATE taxguard_security_outbox SET next_attempt_at=now() WHERE event_id=$1', [id]);
    await new SecurityEventRecorder(rpc, 'tenantA', 100, 'outbox').dispatch();
    row = (await fixture.pg.query<any>('SELECT status,attempts FROM taxguard_security_outbox WHERE event_id=$1', [id])).rows[0];
    expect(row).toEqual({ status: 'DELIVERED', attempts: 1 });
  });
  it('does not acknowledge database outages and rejects identity/scope conflicts', async () => {
    const broken = new SecurityEventRecorder({ async rpc() { throw new Error('private provider details'); } }, 'tenantA', 1, 'outbox');
    await expect(broken.recordDurably(event)).rejects.toThrow('SECURITY_HANDOFF_FAILED');
    expect(broken.status()).toMatchObject({ failed: 1, acknowledged: 0 });
    const recorder = new SecurityEventRecorder(pgliteRpc(() => fixture.pg), 'tenantA', 100, 'outbox'), id = randomUUID();
    await recorder.recordDurably(event, id);
    await expect(recorder.recordDurably({ ...event, severity: 'critical' }, id)).rejects.toThrow('SECURITY_HANDOFF_FAILED');
    await expect(recorder.recordDurably({ ...event, userId: 'foreign-user' })).rejects.toThrow('SECURITY_HANDOFF_FAILED');
  });
  it('denies browser/table bypass and bounds dispatcher input', async () => {
    for (const role of ['anon','authenticated','service_role']) expect((await fixture.pg.query<{ ok: boolean }>("SELECT has_table_privilege($1,'taxguard_security_outbox','SELECT') ok", [role])).rows[0].ok).toBe(false);
    for (const role of ['anon','authenticated']) expect((await fixture.pg.query<{ ok: boolean }>("SELECT has_function_privilege($1,'taxguard_security_enqueue(text,text,uuid,text,text)','EXECUTE') ok", [role])).rows[0].ok).toBe(false);
    const invalid = await pgliteRpc(() => fixture.pg).rpc('taxguard_security_dispatch', { p_tenant: 'tenantA', p_limit: 101 });
    expect(invalid.error?.message).toBe('SECURITY_EVENT_INVALID');
  });
});
