import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createProviderIdentityBoundary } from '../services/providerIdentityBoundary';
import { signOutProviderSession } from '../supabase/providerSignOut';

// Token refresh, expired sessions and account switches on the installed supabase-js client, observed through the
// identity boundary the UI uses to discard work begun under another identity. In-memory storage and a stubbed
// fetch; synthetic users and unsigned synthetic tokens only.
const ORIGIN = 'http://127.0.0.1:54321';
const STORAGE_KEY = 'sb-127-auth-token';
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);
const user = (id: string) => ({ id, aud: 'authenticated', role: 'authenticated', email: `${id}@example.invalid`, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' });
const session = (id: string, expiresAt: number, refresh = 'refresh-' + id) => ({
  access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp: expiresAt, aud: 'authenticated', role: 'authenticated', session_id: 's-' + id })}.synthetic`,
  refresh_token: refresh, token_type: 'bearer', expires_in: Math.max(0, expiresAt - now()), expires_at: expiresAt, user: user(id) });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type TokenOutcome = 'refreshed' | 'rejected' | 'network-failure';
function setup(stored: object, tokenOutcome: TokenOutcome) {
  const store = new Map<string, string>([[STORAGE_KEY, JSON.stringify(stored)]]);
  const paths: string[] = [];
  const fetchStub = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input)); paths.push(url.pathname + (url.searchParams.get('grant_type') ? '?' + url.searchParams.get('grant_type') : ''));
    if (url.pathname.endsWith('/token')) {
      if (tokenOutcome === 'network-failure') throw new TypeError('Failed to fetch');
      if (tokenOutcome === 'rejected') return json(400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
      return json(200, session('user-a', now() + 3600, 'refresh-user-a-2'));
    }
    if (url.pathname.endsWith('/logout')) throw new TypeError('Failed to fetch');
    return json(404, {});
  });
  const supabase = createClient(ORIGIN, 'synthetic-anon-key', {
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storageKey: STORAGE_KEY,
      storage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); }, removeItem: k => { store.delete(k); } } },
    global: { fetch: fetchStub as unknown as typeof fetch },
  });
  const boundary = createProviderIdentityBoundary(listener => {
    const { data } = supabase.auth.onAuthStateChange((event, s) => listener(event, s));
    return () => data.subscription.unsubscribe();
  });
  const unsubscribe = boundary.subscribe(() => {});
  return { supabase, store, paths, boundary, unsubscribe };
}
const settle = () => new Promise(r => setTimeout(r, 20));

describe('provider session lifecycle', () => {
  it('an unexpired session is restored without a refresh request, and the identity proof is stable', async () => {
    const t = setup(session('user-a', now() + 3600), 'refreshed');
    await settle();
    const proof = t.boundary.capture();
    expect((await t.supabase.auth.getSession()).data.session?.user.id).toBe('user-a');
    expect(t.paths.filter(p => p.includes('/token'))).toEqual([]);
    expect(t.boundary.isCurrent(proof)).toBe(true);
    t.unsubscribe();
  });

  it('an expired session is refreshed with its refresh token; a same-user refresh keeps work begun before it valid', async () => {
    const t = setup(session('user-a', now() - 60), 'refreshed');
    await settle();
    const proof = t.boundary.capture();
    const { data } = await t.supabase.auth.getSession();
    expect(data.session?.user.id).toBe('user-a');
    expect(data.session?.refresh_token).toBe('refresh-user-a-2');
    expect(t.paths).toContain('/auth/v1/token?refresh_token');
    await settle();
    expect(t.boundary.getSnapshot().uid).toBe('user-a');
    expect(t.boundary.isCurrent(proof)).toBe(true);
    t.unsubscribe();
  });

  it('an expired session whose refresh is rejected is removed, and its user is never exposed as the current identity', async () => {
    const t = setup(session('user-a', now() - 60), 'rejected');
    const seen: Array<string | null> = [];
    const stopWatching = t.boundary.subscribe(() => seen.push(t.boundary.getSnapshot().uid));
    await settle();
    const { data } = await t.supabase.auth.getSession();
    expect(data.session).toBeNull();
    expect(t.store.has(STORAGE_KEY)).toBe(false);
    expect(t.paths).toContain('/auth/v1/token?refresh_token');
    await settle();
    expect(t.boundary.getSnapshot()).toMatchObject({ uid: null, initialized: true });
    expect(seen).not.toContain('user-a');
    stopWatching(); t.unsubscribe();
  });

  it('a refresh that fails on the network keeps the session for a retry; signing out still removes it from this device', async () => {
    const t = setup(session('user-a', now() - 60), 'network-failure');
    await settle();
    const { error } = await t.supabase.auth.getSession();
    expect(error).toBeTruthy();
    expect(t.store.has(STORAGE_KEY)).toBe(true);
    expect(await signOutProviderSession(t.supabase)).toBe(false);
    expect(t.store.has(STORAGE_KEY)).toBe(false);
    t.unsubscribe();
  }, 60_000); // the client retries a retryable refresh with backoff before reporting it

  it('switching to another account invalidates work begun under the previous identity; same-user events do not', () => {
    let emit: (event: string, s: ReturnType<typeof session> | null) => void = () => {};
    const boundary = createProviderIdentityBoundary(listener => { emit = listener; return () => {}; });
    const unsubscribe = boundary.subscribe(() => {});
    emit('INITIAL_SESSION', session('user-a', now() + 3600));
    const proofA = boundary.capture();
    for (const event of ['TOKEN_REFRESHED', 'MFA_CHALLENGE_VERIFIED', 'USER_UPDATED']) {
      emit(event, session('user-a', now() + 7200, 'refresh-' + event));
      expect(boundary.isCurrent(proofA), event).toBe(true);
    }
    emit('SIGNED_IN', session('user-b', now() + 3600));
    expect(boundary.getSnapshot().uid).toBe('user-b');
    expect(boundary.isCurrent(proofA)).toBe(false);
    const proofB = boundary.capture();
    emit('SIGNED_OUT', null);
    expect(boundary.getSnapshot().uid).toBeNull();
    expect(boundary.isCurrent(proofB)).toBe(false);
    unsubscribe();
  });
});
