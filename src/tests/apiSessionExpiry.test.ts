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
  await expect(api.auth.getMe()).rejects.toThrow();
  expect(getStoredToken()).toBe('test-session');
});
