import { afterEach, expect, it, vi } from 'vitest';
import { ProviderReadinessRegistry as Registry } from '../server/taxguard/providerReadiness.service';
afterEach(() => { Registry.setTestingOverrides(undefined); vi.unstubAllEnvs(); vi.useRealTimers(); });
it.each(['production', 'development'])('ignores synthetic provider and schema overrides in %s', async runtime => {
  vi.stubEnv('NODE_ENV', runtime); vi.stubEnv('SUPABASE_URL', ''); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', ''); vi.stubEnv('SUPABASE_ANON_KEY', '');
  Registry.setTestingOverrides({ DATABASE: 'CONFIGURED' }, { state: 'DATABASE_READY', verifiedTablesCount: 6, totalRequiredTables: 6, description: 'synthetic', checkedAt: 'synthetic' });
  expect(Registry.getProviderStatus('DATABASE')).toMatchObject({ status: 'NOT_CONFIGURED', isOperational: false });
  expect(await Registry.checkDatabaseSchemaReadiness()).toMatchObject({ state: 'DATABASE_UNAVAILABLE' });
});
it('detaches test schema overrides so callers cannot change later results', async () => {
  vi.stubEnv('NODE_ENV', 'test'); Registry.setTestingOverrides(undefined, { state: 'DATABASE_READY', verifiedTablesCount: 6, totalRequiredTables: 6, description: 'synthetic', checkedAt: 'synthetic' });
  const result = await Registry.checkDatabaseSchemaReadiness(); result.state = 'DATABASE_UNAVAILABLE';
  expect((await Registry.checkDatabaseSchemaReadiness()).state).toBe('DATABASE_READY');
});
it('bounds a hanging probe, cancels transport and clears the timer', async () => {
  vi.useFakeTimers(); const signals: AbortSignal[] = [];
  const select = vi.fn().mockReturnValue({ abortSignal: (signal: AbortSignal) => { signals.push(signal); return new Promise(() => {}); } });
  const pending = Registry.checkDatabaseSchemaReadiness({ from: () => ({ select }) });
  await vi.advanceTimersByTimeAsync(5000);
  expect(await pending).toMatchObject({ state: 'DATABASE_UNAVAILABLE', verifiedTablesCount: 0 });
  expect(signals[0].aborted).toBe(true); expect(select).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
});
it('uses metadata-only HEAD queries without expensive exact row counts', async () => {
  vi.useFakeTimers(); const select = vi.fn().mockResolvedValue({ error: null });
  expect(await Registry.checkDatabaseSchemaReadiness({ from: () => ({ select }) })).toMatchObject({ state: 'DATABASE_READY', verifiedTablesCount: 6 });
  expect(select).toHaveBeenCalledWith('*', { head: true }); expect(vi.getTimerCount()).toBe(0);
});
it('sanitizes thrown dependency failures', async () => {
  const result = await Registry.checkDatabaseSchemaReadiness({ from: () => { throw new Error('secret database URL'); } });
  expect(result.state).not.toBe('DATABASE_READY'); expect(JSON.stringify(result)).not.toContain('secret');
});
