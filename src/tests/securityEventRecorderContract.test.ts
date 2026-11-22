import { describe, expect, it } from 'vitest';
import { SecurityEventRecorder } from '../server/securityEventRecorder';

// Regression for the defect confirmed on 2026-11-22 (Google AI Studio 84e7d6a, 712eacb and 6eb15ab): a stand-in recorder
// kept events in a memory buffer and its dispatch() discarded them while counting them as delivered. The durable
// recorder may count an event only after the database acknowledges it, and delivery only from the dispatch RPC.
// The PostgreSQL behaviour (restart recovery, concurrent dispatchers, tenant isolation, retained failures) is covered by
// src/tests-db/securityOutbox.db.test.ts and src/tests/securityEventOutbox.test.ts. Synthetic values only.
type Call = { name: string; args: Record<string, any> };
function client(answer: (call: Call) => { data?: any; error?: any }) {
  const calls: Call[] = [];
  return { calls, rpc: async (name: string, args: Record<string, any>) => { const call = { name, args }; calls.push(call); return answer(call) as any; } };
}
const ack = (c: Call) => ({ data: { eventId: c.args.p_event, acknowledged: true } });
const event = { eventType: 'CROSS_TENANT_ACCESS_ATTEMPT', userId: 'user-synthetic', severity: 'HIGH' } as any;

describe('security event recorder durability contract', () => {
  it('counts an event only after the database acknowledges the same event id', async () => {
    const db = client(ack);
    const recorder = new SecurityEventRecorder(db as any, 'ar-tax-services', 100, 'outbox');
    const result = await recorder.recordDurably(event);
    expect(result.acknowledged).toBe(true);
    expect(db.calls).toEqual([{ name: 'taxguard_security_enqueue', args: { p_tenant: 'ar-tax-services', p_actor: 'user-synthetic', p_event: result.eventId, p_code: 'AUTHORIZATION_DENIAL', p_severity: 'HIGH' } }]);
    expect(recorder.status()).toMatchObject({ acknowledged: 1, failed: 0, persisted: 0 });
  });

  it('never acknowledges on a database error, a mismatched id or a missing acknowledgement', async () => {
    for (const answer of [() => ({ error: { message: 'outage' } }), () => ({ data: { eventId: '00000000-0000-4000-8000-000000000000', acknowledged: true } }), (c: Call) => ({ data: { eventId: c.args.p_event } })]) {
      const recorder = new SecurityEventRecorder(client(answer) as any, 'ar-tax-services', 100, 'outbox');
      await expect(recorder.recordDurably(event)).rejects.toThrow('SECURITY_HANDOFF_FAILED');
      expect(recorder.status()).toMatchObject({ acknowledged: 0, failed: 1, persisted: 0 });
    }
  });

  it('reports delivery only from the dispatch RPC, and nothing when dispatch fails', async () => {
    const ok = client(c => c.name === 'taxguard_security_dispatch' ? { data: { delivered: 3, failed: 1 } } : ack(c));
    const recorder = new SecurityEventRecorder(ok as any, 'ar-tax-services', 100, 'outbox');
    recorder.record(event); await recorder.drain();
    expect(recorder.status()).toMatchObject({ acknowledged: 1, persisted: 0 }); // queued in the database, not delivered
    await recorder.dispatch(25);
    expect(ok.calls.at(-1)).toEqual({ name: 'taxguard_security_dispatch', args: { p_tenant: 'ar-tax-services', p_limit: 25 } });
    expect(recorder.status()).toMatchObject({ persisted: 3, dispatchFailures: 1 });
    const down = client(c => c.name === 'taxguard_security_dispatch' ? { error: { message: 'outage' } } : ack(c));
    const r2 = new SecurityEventRecorder(down as any, 'ar-tax-services', 100, 'outbox');
    await expect(r2.dispatch()).rejects.toThrow('SECURITY_OUTBOX_DISPATCH_FAILED');
    expect(r2.status()).toMatchObject({ persisted: 0, dispatchFailures: 1 });
    for (const bad of [{ delivered: -1, failed: 0 }, { delivered: 1.5, failed: 0 }, { failed: 0 }]) {
      const r3 = new SecurityEventRecorder(client(() => ({ data: bad })) as any, 'ar-tax-services', 100, 'outbox');
      await expect(r3.dispatch()).rejects.toThrow('SECURITY_OUTBOX_DISPATCH_FAILED');
      expect(r3.status().persisted).toBe(0);
    }
  });

  it('reads outbox metrics from the database and fails rather than inventing them', async () => {
    const metrics = { pending: 2, blocked: 1, delivered: 9, oldestPendingAt: '2026-11-22T00:00:00Z' };
    const r = new SecurityEventRecorder(client(c => c.name === 'taxguard_security_outbox_metrics' ? { data: metrics } : ack(c)) as any, 'ar-tax-services', 100, 'outbox');
    expect(await r.durableStatus()).toEqual(metrics);
    const r2 = new SecurityEventRecorder(client(() => ({ error: { message: 'outage' } })) as any, 'ar-tax-services', 100, 'outbox');
    await expect(r2.durableStatus()).rejects.toThrow('SECURITY_METRICS_UNAVAILABLE');
  });

  it('sends only allowlisted server-generated events, validates the tenant and bounds the backlog', async () => {
    const db = client(ack);
    const r = new SecurityEventRecorder(db as any, 'ar-tax-services', 1, 'outbox');
    r.record({ eventType: 'ARBITRARY_BROWSER_EVENT', userId: 'x', severity: 'LOW' } as any);
    await r.drain();
    expect(db.calls).toEqual([]);
    expect(() => new SecurityEventRecorder(db as any, "tenant'; drop", 100, 'outbox')).toThrow('SECURITY_RECORDER_CONFIG_INVALID');
    const slow = { rpc: () => new Promise(() => undefined) };
    const bounded = new SecurityEventRecorder(slow as any, 'ar-tax-services', 1, 'outbox');
    void bounded.recordDurably(event).catch(() => undefined);
    await expect(bounded.recordDurably(event)).rejects.toThrow('SECURITY_HANDOFF_BACKPRESSURE');
    expect(bounded.status().dropped).toBe(1);
  });
});
