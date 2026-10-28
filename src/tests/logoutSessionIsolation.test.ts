import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('sessionStorage', storage);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each([204, 401, 503])('preserves a newer login after delayed logout HTTP %s', async status => {
  let complete!: (response: unknown) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { complete = resolve; })));
  const { api, setStoredToken, getStoredToken } = await import('../services/api');
  setStoredToken('synthetic-old');
  const logout = api.auth.logout();
  const result = expect(logout).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  setStoredToken('synthetic-new');
  complete({ ok: status === 204, status, json: async () => ({}) });
  await result;
  expect(getStoredToken()).toBe('synthetic-new');
});

it('preserves a newer login after a delayed logout network failure', async () => {
  let fail!: (reason: Error) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise((_resolve, reject) => { fail = reject; })));
  const { api, setStoredToken, getStoredToken } = await import('../services/api');
  setStoredToken('synthetic-old');
  const logout = api.auth.logout();
  const result = expect(logout).rejects.toThrow('Synthetic network failure');
  setStoredToken('synthetic-new');
  fail(new Error('Synthetic network failure'));
  await result;
  expect(getStoredToken()).toBe('synthetic-new');
});

it('clears the initiating session when logout fails without a session change', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Synthetic network failure')));
  const { api, setStoredToken, getStoredToken } = await import('../services/api');
  setStoredToken('synthetic-current');
  await expect(api.auth.logout()).rejects.toThrow('Synthetic network failure');
  expect(getStoredToken()).toBeNull();
});
