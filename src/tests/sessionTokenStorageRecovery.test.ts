import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const primary = 'artax_session_token';
function storage() {
  const values = new Map<string, string>();
  return { values, getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }) };
}
let local: ReturnType<typeof storage>, session: ReturnType<typeof storage>;
beforeEach(() => {
  vi.resetModules(); local = storage(); session = storage();
  vi.stubGlobal('localStorage', local); vi.stubGlobal('sessionStorage', session);
});
afterEach(() => vi.unstubAllGlobals());
it('recovers an existing session when local storage reads are restricted', async () => {
  local.getItem.mockImplementation(() => { throw new Error('restricted'); });
  session.values.set(primary, 'synthetic-session');
  expect((await import('../services/api')).getStoredToken()).toBe('synthetic-session');
});
it.each(['localStorage', 'sessionStorage'])('attempts cleanup independently when %s removals fail', async store => {
  const blocked = store === 'localStorage' ? local : session;
  const accessible = store === 'localStorage' ? session : local;
  for (const target of [local, session]) for (const key of [primary, 'token']) target.values.set(key, 'synthetic-old');
  blocked.removeItem.mockImplementation(() => { throw new Error('restricted'); });
  const api = await import('../services/api'); api.clearStoredToken();
  expect(api.getStoredToken()).toBeNull();
  expect(accessible.values.size).toBe(0);
  expect(blocked.removeItem).toHaveBeenCalledTimes(2);
  expect(accessible.removeItem).toHaveBeenCalledTimes(2);
});
it.each(['localStorage', 'sessionStorage'])('never reads the previous identity when %s writes fail', async store => {
  const blocked = store === 'localStorage' ? local : session;
  for (const target of [local, session]) for (const key of [primary, 'token']) target.values.set(key, 'synthetic-old');
  blocked.setItem.mockImplementation(() => { throw new Error('restricted'); });
  const api = await import('../services/api'); api.setStoredToken('synthetic-new');
  expect(api.getStoredToken()).toBe('synthetic-new');
  expect(local.setItem).toHaveBeenCalledTimes(2);
  expect(session.setItem).toHaveBeenCalledTimes(2);
  api.clearStoredToken(); expect(api.getStoredToken()).toBeNull();
});
it('continues observing stored token replacement after successful writes', async () => {
  const api = await import('../services/api'); api.setStoredToken('synthetic-first');
  local.values.set(primary, 'synthetic-replaced');
  expect(api.getStoredToken()).toBe('synthetic-replaced');
});
it('permits a fresh login after denied cleanup without restoring the old session', async () => {
  const api = await import('../services/api'); api.setStoredToken('synthetic-first');
  local.removeItem.mockImplementation(() => { throw new Error('restricted'); });
  api.clearStoredToken(); expect(api.getStoredToken()).toBeNull();
  api.setStoredToken('synthetic-new'); expect(api.getStoredToken()).toBe('synthetic-new');
});
