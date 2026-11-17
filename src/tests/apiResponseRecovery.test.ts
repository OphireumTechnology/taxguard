import { afterEach, beforeEach, expect, it, vi } from 'vitest';
beforeEach(() => {
  vi.resetModules();
  const values = new Map<string, string>();
  const store = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  vi.stubGlobal('localStorage', store); vi.stubGlobal('sessionStorage', store);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it.each([null, undefined, 'unexpected', 42, true])('rejects malformed successful response %j without reporting success', async body => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }));
  const { api } = await import('../services/api');
  await expect(api.auth.getMe()).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE', status: 200 });
});
it('rejects non-JSON success without swallowing it as an empty object or retrying', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('private upstream HTML'); } });
  vi.stubGlobal('fetch', fetch);
  const { api } = await import('../services/api');
  await expect(api.auth.getMe()).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it.each([null, undefined, [], 'unavailable'])('preserves service failure status for malformed error body %j', async body => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => body }));
  const { api } = await import('../services/api');
  await expect(api.auth.getMe()).rejects.toMatchObject({ status: 503, data: {} });
});
it('clears expired sessions even when the unauthorized response body is null', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => null }));
  const module = await import('../services/api'); module.setStoredToken('synthetic-session');
  await expect(module.api.auth.getMe()).rejects.toMatchObject({ status: 401 });
  expect(module.getStoredToken()).toBeNull();
});
it('keeps explicit no-content success compatible', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => { throw new Error('no content'); } }));
  const { api } = await import('../services/api');
  await expect(api.auth.logout()).resolves.toBeUndefined();
});
