import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSessionApi } from '../src/services/sessionApi';
vi.mock('../src/config/apiEndpoint', () => ({ apiEndpoint: (path: string) => `http://127.0.0.1${path}` }));
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  let token: string | null = null;
  const store = vi.fn((value: string) => { token = value; });
  const clear = vi.fn(() => { token = null; });
  return { api: createSessionApi(() => token, store, clear), store, clear, replace: (value: string) => { token = value; }, current: () => token };
}
describe('authoritative server session bridge', () => {
  it('does not establish a session when the API is unavailable or returns generic success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ success: false, code: 'API_NOT_IMPLEMENTED' }, { status: 501 })).mockResolvedValueOnce(Response.json({ success: true })));
    const { api, store } = fixture();
    await expect(api.supabaseSession({ accessToken: 'synthetic-provider' })).rejects.toMatchObject({ status: 501 });
    await expect(api.supabaseSession({ accessToken: 'synthetic-provider' })).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
    expect(store).not.toHaveBeenCalled();
  });
  it('keeps MFA challenges pending without inventing an authenticated user', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ mfaRequired: true })));
    const { api, store } = fixture();
    await expect(api.login('synthetic@example.test', 'SyntheticPassword1!')).resolves.toEqual({ mfaRequired: true });
    expect(store).not.toHaveBeenCalled();
  });
  it('uses server membership and a confirmed session token', async () => {
    const confirmed = { token: 'synthetic-server-session', user: { id: 'synthetic-user', role: 'client' }, clientId: 'synthetic-client' };
    const fetch = vi.fn().mockResolvedValue(Response.json(confirmed)); vi.stubGlobal('fetch', fetch);
    const { api, store } = fixture();
    await expect(api.supabaseSession({ accessToken: 'synthetic-provider', portal: 'staff' })).resolves.toEqual(confirmed);
    expect(store).toHaveBeenCalledWith('synthetic-server-session');
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1/api/auth/supabase-session', expect.objectContaining({ body: JSON.stringify({ accessToken: 'synthetic-provider', portal: 'staff' }) }));
  });
  it('rejects malformed token-bearing responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ token: 'synthetic', success: true })));
    const { api, store } = fixture();
    await expect(api.supabaseSession({ accessToken: 'synthetic-provider' })).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
    expect(store).not.toHaveBeenCalled();
  });
  it('invalidates refused sessions without exposing internal server errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ code: 'STAFF_MFA_REQUIRED', error: 'internal database details' }, { status: 403 })));
    const { api, replace, clear } = fixture(); replace('synthetic-session');
    await expect(api.getMe()).rejects.toMatchObject({ code: 'STAFF_MFA_REQUIRED', message: 'A secure TaxGuard server session could not be confirmed.' });
    expect(clear).toHaveBeenCalledOnce();
  });
  it('does not overwrite an identity that changed during authentication', async () => {
    const f = fixture();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => { f.replace('newer-session'); return Response.json({ token: 'stale', user: { id: 'stale', role: 'client' } }); }));
    await expect(f.api.login('synthetic@example.test', 'SyntheticPassword1!')).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(f.store).not.toHaveBeenCalled(); expect(f.current()).toBe('newer-session');
  });
  it('does not clear a newer identity when logout completes late', async () => {
    const f = fixture(); f.replace('original');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => { f.replace('newer'); return Response.json({ success: true }); }));
    await expect(f.api.logout()).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(f.clear).not.toHaveBeenCalled(); expect(f.current()).toBe('newer');
  });
});
