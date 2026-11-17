import { afterEach, describe, expect, it, vi } from 'vitest';
import { DurableIdempotencyService } from '../server/taxguard/operations/durableIdempotency.service';
afterEach(() => vi.useRealTimers());
const acquire = (s: DurableIdempotencyService, fingerprint = 'synthetic_fingerprint', provider = 'synthetic_provider') =>
  s.acquire('synthetic_tenant', 'synthetic_operation', provider, 'synthetic_key', fingerprint, 1);
describe('legacy simulation idempotency integrity (not production durability)', () => {
  it.each(['PROCESSING', 'COMPLETED', 'FAILED'])('binds %s reservations to the original request and provider', async status => {
    const s = new DurableIdempotencyService(); await acquire(s);
    if (status === 'COMPLETED') await s.complete('synthetic_tenant', 'synthetic_operation', 'synthetic_key', { synthetic: 'result' });
    if (status === 'FAILED') await s.fail('synthetic_tenant', 'synthetic_operation', 'synthetic_key', 'SYNTHETIC_FAILURE');
    await expect(acquire(s, 'different')).rejects.toThrow('IDEMPOTENCY_REQUEST_MISMATCH');
    await expect(acquire(s, 'synthetic_fingerprint', 'different')).rejects.toThrow('IDEMPOTENCY_REQUEST_MISMATCH');
  });
  it.each(['PROCESSING', 'COMPLETED'])('does not re-execute ambiguous or completed %s work after expiry', async status => {
    vi.useFakeTimers(); const s = new DurableIdempotencyService(); await acquire(s);
    if (status === 'COMPLETED') await s.complete('synthetic_tenant', 'synthetic_operation', 'synthetic_key', { synthetic: 'result' });
    vi.advanceTimersByTime(2000); expect((await acquire(s)).status).toBe(status);
  });
  it('permits retry only after explicit failure with the same fingerprint', async () => {
    const s = new DurableIdempotencyService(); await acquire(s);
    await s.fail('synthetic_tenant', 'synthetic_operation', 'synthetic_key', 'SYNTHETIC_FAILURE');
    expect((await acquire(s)).status).toBe('ACQUIRED');
  });
  it('detaches completed input, replay output and diagnostic record from internal state', async () => {
    const s = new DurableIdempotencyService(); await acquire(s); const result = { nested: { value: 'synthetic' } };
    await s.complete('synthetic_tenant', 'synthetic_operation', 'synthetic_key', result); result.nested.value = 'changed';
    const replay = await acquire(s); if (replay.status !== 'COMPLETED') throw new Error('expected replay');
    (replay.resultReference.nested as any).value = 'changed';
    const record = s.getRecord('synthetic_tenant', 'synthetic_operation', 'synthetic_key')!; record.status = 'FAILED';
    expect(await acquire(s)).toMatchObject({ status: 'COMPLETED', resultReference: { nested: { value: 'synthetic' } } });
  });
  it('refuses terminal-history rewrites', async () => {
    const s = new DurableIdempotencyService(); await acquire(s);
    await s.complete('synthetic_tenant', 'synthetic_operation', 'synthetic_key', {});
    await expect(s.fail('synthetic_tenant', 'synthetic_operation', 'synthetic_key', 'FAIL')).rejects.toThrow('INVALID_IDEMPOTENCY_STATE');
    await expect(s.complete('synthetic_tenant', 'synthetic_operation', 'synthetic_key', {})).rejects.toThrow('INVALID_IDEMPOTENCY_STATE');
  });
  it('keeps tenant reservations isolated', async () => {
    const s = new DurableIdempotencyService(); await acquire(s);
    expect((await s.acquire('other_tenant', 'synthetic_operation', 'synthetic_provider', 'synthetic_key', 'different')).status).toBe('ACQUIRED');
  });
  it.each([0, -1, NaN, Infinity, 0.5])('rejects invalid expiry %s', async ttl => {
    await expect(new DurableIdempotencyService().acquire('t', 'op', 'p', 'k', 'f', ttl)).rejects.toThrow('INVALID_IDEMPOTENCY_REQUEST');
  });
  it('rejects delimiter collisions in scoped reservation keys', async () => {
    await expect(new DurableIdempotencyService().acquire('t::op', 'op', 'p', 'k', 'f')).rejects.toThrow('INVALID_IDEMPOTENCY_REQUEST');
  });
});
