import { describe, expect, it, vi } from 'vitest';
import { configuredMfaResetProvider, factorHash, MfaProviderError, SupabaseAdminMfaProvider } from '../server/mfaResetProvider';

// Provider adapter for MFA reset: guarded enablement, strict response validation, error
// classification. A mocked SDK client only; no provider is contacted.
const env = (over: Record<string, string | undefined> = {}) => ({ NODE_ENV: 'development', TAXGUARD_MFA_RESET_PROVIDER: 'supabase-admin', SUPABASE_URL: 'https://nonproduction-example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-key', ...over }) as NodeJS.ProcessEnv;
const sdk = (mfa: Record<string, unknown>) => ({ auth: { admin: { mfa } } }) as any;
const U = '11111111-1111-4111-8111-111111111111', F = '22222222-2222-4222-8222-222222222222';

describe('enablement', () => {
  it('is off unless explicitly enabled outside production for a non-protected project', () => {
    const client = sdk({});
    expect(configuredMfaResetProvider(env(), client)).toBeInstanceOf(SupabaseAdminMfaProvider);
    expect(configuredMfaResetProvider(env({ TAXGUARD_MFA_RESET_PROVIDER: undefined }), client)).toBeNull();
    expect(configuredMfaResetProvider(env({ NODE_ENV: 'production' }), client)).toBeNull();
    expect(configuredMfaResetProvider(env({ SUPABASE_URL: 'https://cvrlhixxczerytiocxid.supabase.co' }), client)).toBeNull();
    expect(configuredMfaResetProvider(env({ SUPABASE_SERVICE_ROLE_KEY: '' }), client)).toBeNull();
  });
});

describe('SDK adapter', () => {
  it('maps the typed admin MFA inventory and refuses malformed responses', async () => {
    const listFactors = vi.fn().mockResolvedValue({ data: { factors: [{ id: F, status: 'verified', factor_type: 'totp', created_at: '2026-01-01T00:00:00Z', friendly_name: 'secret-ish' }] }, error: null });
    const p = new SupabaseAdminMfaProvider(sdk({ listFactors }));
    expect(await p.listFactors(U)).toEqual([{ id: F, status: 'verified', factorType: 'totp', createdAt: '2026-01-01T00:00:00Z' }]);
    expect(listFactors).toHaveBeenCalledWith({ userId: U });
    listFactors.mockResolvedValueOnce({ data: { factors: [{ id: 'bad id!', status: 'verified', created_at: '2026-01-01T00:00:00Z' }] }, error: null });
    await expect(p.listFactors(U)).rejects.toMatchObject({ code: 'PROVIDER_RESPONSE_INVALID' });
    listFactors.mockResolvedValueOnce({ data: null, error: null });
    await expect(p.listFactors(U)).rejects.toMatchObject({ code: 'PROVIDER_RESPONSE_INVALID', retryable: true });
  });
  it.each([[0, 'PROVIDER_UNAVAILABLE', true], [429, 'PROVIDER_RATE_LIMITED', true], [503, 'PROVIDER_UNAVAILABLE', true], [401, 'PROVIDER_NOT_AUTHORIZED', false], [404, 'PROVIDER_USER_NOT_FOUND', false], [422, 'PROVIDER_REQUEST_REJECTED', false]])(
    'classifies provider status %s', async (status, code, retryable) => {
      const p = new SupabaseAdminMfaProvider(sdk({ listFactors: vi.fn().mockResolvedValue({ data: null, error: { status, message: 'synthetic' } }) }));
      const e = await p.listFactors(U).catch(x => x);
      expect(e).toBeInstanceOf(MfaProviderError); expect(e).toMatchObject({ code, retryable });
    });
  it('tolerates a 404 on delete only because the worker re-lists; other errors surface', async () => {
    const deleteFactor = vi.fn().mockResolvedValueOnce({ data: null, error: { status: 404 } }).mockResolvedValueOnce({ data: null, error: { status: 500 } });
    const p = new SupabaseAdminMfaProvider(sdk({ deleteFactor }));
    await expect(p.deleteFactor(U, F)).resolves.toBeUndefined();
    await expect(p.deleteFactor(U, F)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(deleteFactor).toHaveBeenCalledWith({ id: F, userId: U });
    await expect(p.deleteFactor(U, '../f1')).rejects.toMatchObject({ code: 'PROVIDER_RESPONSE_INVALID' });
  });
  it('rejects non-UUID identifiers permanently and treats status-less SDK errors as not retryable', async () => {
    const p = new SupabaseAdminMfaProvider(sdk({ listFactors: vi.fn().mockRejectedValue(new Error('@supabase/auth-js: Expected parameter to be UUID but is not')) }));
    await expect(p.listFactors('d-staff')).rejects.toMatchObject({ code: 'PROVIDER_ID_NOT_UUID', retryable: false });
    await expect(p.listFactors(U)).rejects.toMatchObject({ code: 'PROVIDER_REQUEST_INVALID', retryable: false });
    await expect(p.deleteFactor(U, 'factor-1')).rejects.toMatchObject({ code: 'PROVIDER_ID_NOT_UUID' });
  });
  it('hashes factor IDs per tenant and member', () => {
    expect(factorHash('t', 'u', 'f')).toMatch(/^[a-f0-9]{64}$/);
    expect(factorHash('t', 'u', 'f')).not.toBe(factorHash('t', 'u2', 'f'));
  });
});
