import { createClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { signOutProviderSession } from '../supabase/providerSignOut';

// The installed supabase-js client (not a stand-in) with in-memory storage and a stubbed fetch. Synthetic values
// only: a local origin, an unsigned synthetic token and a synthetic user; nothing leaves the process.
const ORIGIN = 'http://127.0.0.1:54321';
const STORAGE_KEY = 'sb-127-auth-token';
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const accessToken = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'synthetic-user', exp, aud: 'authenticated', role: 'authenticated', session_id: 'synthetic-session' })}.synthetic`;
const storedSession = { access_token: accessToken, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp,
  user: { id: 'synthetic-user', aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } };

type LogoutOutcome = 'network-failure' | 'server-error' | 'ok' | 'session-not-found';
function client(outcome: LogoutOutcome) {
  const store = new Map<string, string>([[STORAGE_KEY, JSON.stringify(storedSession)]]);
  const requests: Array<{ path: string; scope: string | null }> = [];
  const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    requests.push({ path: url.pathname, scope: url.searchParams.get('scope') });
    if (url.pathname.endsWith('/logout')) {
      if (outcome === 'network-failure') throw new TypeError('Failed to fetch');
      if (outcome === 'server-error') return new Response(JSON.stringify({ code: 500, msg: 'synthetic' }), { status: 500, headers: { 'content-type': 'application/json' } });
      if (outcome === 'session-not-found') return new Response(JSON.stringify({ code: 403, error_code: 'session_not_found', msg: 'synthetic' }), { status: 403, headers: { 'content-type': 'application/json' } });
      return new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify({}), { status: 404, headers: { 'content-type': 'application/json' } });
  });
  const supabase = createClient(ORIGIN, 'synthetic-anon-key', {
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storageKey: STORAGE_KEY,
      storage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); }, removeItem: k => { store.delete(k); } } },
    global: { fetch: fetchStub as unknown as typeof fetch },
  });
  return { supabase, store, requests };
}
afterEach(() => vi.restoreAllMocks());

describe('provider sign-out always ends this device\'s session', () => {
  it('reproduces the defect: a plain global sign-out that fails on the network keeps the stored session', async () => {
    const { supabase, store } = client('network-failure');
    const { error } = await supabase.auth.signOut();
    expect(error).toBeTruthy();
    expect(store.has(STORAGE_KEY)).toBe(true); // this session would restore on the next page load
  });

  it.each(['network-failure', 'server-error'] as const)('after a %s on global sign-out, the local session is removed and revocation is reported unconfirmed', async outcome => {
    const { supabase, store, requests } = client(outcome);
    expect(await signOutProviderSession(supabase)).toBe(false);
    expect(store.has(STORAGE_KEY)).toBe(false);
    expect((await supabase.auth.getSession()).data.session).toBeNull();
    // the global revocation was attempted first, then the local sign-out
    expect(requests.filter(r => r.path.endsWith('/logout')).map(r => r.scope)).toEqual(['global', 'local']);
  });

  it.each(['ok', 'session-not-found'] as const)('a confirmed global sign-out (%s) removes the session with one request', async outcome => {
    const { supabase, store, requests } = client(outcome);
    expect(await signOutProviderSession(supabase)).toBe(true);
    expect(store.has(STORAGE_KEY)).toBe(false);
    expect(requests.filter(r => r.path.endsWith('/logout')).map(r => r.scope)).toEqual(['global']);
  });

  it('a provider whose sign-out throws still gets a local sign-out', async () => {
    const calls: Array<string | undefined> = [];
    const provider = { auth: { signOut: async (o?: { scope?: 'global' | 'local' | 'others' }) => { calls.push(o?.scope); if (!o) throw new Error('synthetic'); return { error: null }; } } };
    expect(await signOutProviderSession(provider)).toBe(false);
    expect(calls).toEqual([undefined, 'local']);
  });
});
