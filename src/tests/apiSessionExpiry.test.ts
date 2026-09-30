import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'https://api.example.com' + path }));
import { api, clearStoredToken, getStoredToken, setStoredToken } from '../services/api';
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });
it('clears persisted authorization and notifies the UI after a 401', async () => {
  const dispatchEvent = vi.fn(); vi.stubGlobal('window', { dispatchEvent });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'expired' }), { status: 401 })));
  setStoredToken('test-session');
  await expect(api.auth.getMe()).rejects.toThrow('expired');
  expect(getStoredToken()).toBe(null);
  expect(dispatchEvent.mock.calls[0][0].type).toBe('taxguard:session-expired');
});
it('does not destroy an authenticated session on temporary service failure', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
  setStoredToken('test-session');
  await expect(api.auth.getMe()).rejects.toThrow('The TaxGuard service is temporarily unavailable. Please try again shortly or contact support.');
  expect(getStoredToken()).toBe('test-session');
});
it('translates HTTP 405 errors into controlled secure user-facing message', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>405 Not Allowed</html>', { status: 405 })));
  await expect(api.auth.supabaseSession({ accessToken: 'token123' })).rejects.toThrow(
    'We could not securely connect to the TaxGuard authentication service. Please try again or contact support.'
  );
});
it('establishes session and stores token on successful supabaseSession call', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    message: 'Authorized',
    token: 'jwt-token-456',
    user: { id: 'u1', role: 'client' }
  }), { status: 200 })));
  const result = await api.auth.supabaseSession({ accessToken: 'valid-token' });
  expect(result.token).toBe('jwt-token-456');
  expect(getStoredToken()).toBe('jwt-token-456');
});

