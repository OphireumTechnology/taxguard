import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readHashView, slug } from '../hooks/useHashView';
import { notificationKind, NOTIFICATION_KINDS } from '../components/portal/dashboard/ClientNotificationsPanel';
import { clearStoredToken, getStoredToken, reconcileSessionStorageEvent, SESSION_TOKEN_CHANGED_EVENT, setStoredToken } from '../services/api';
import { vaultService } from '../services/vaultService';
import { documentRequestService } from '../services/documentRequestService';

beforeEach(() => { setStoredToken('synthetic-original'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });

describe('allowlisted workspace hashes', () => {
  it.each(['Dashboard', 'Document Requests', 'AI & Governance', 'ai_control'])('roundtrips %s', view => {
    expect(readHashView('#view=' + slug(view), 'view', [view])).toBe(view);
  });
  it.each(['#view=unavailable', '#view=documents&role=admin', '#view=%64ocuments', '#view=<script>', '#view=', '#view=documents/other'])
  ('ignores unknown or malformed %s', hash => { expect(readHashView(hash, 'view', ['documents'])).toBeNull(); });
  it('cannot turn the hash key into a regex or an authority grant', () => {
    expect(readHashView('#view=users', '.*', ['users'])).toBeNull();
    expect(readHashView('#view=users', 'view', ['Dashboard'])).toBeNull();
  });
});
describe('notification meaning', () => {
  it('describes every supported kind and labels unknown kinds neutrally', () => {
    expect(Object.keys(NOTIFICATION_KINDS)).toHaveLength(7);
    for (const kind of Object.keys(NOTIFICATION_KINDS)) {
      expect(notificationKind(kind).label).toBeTruthy(); expect(notificationKind(kind).description).toBeTruthy();
    }
    expect(notificationKind('UNKNOWN_INTERNAL_KIND')).toEqual({ label: 'Practice notice', description: 'A notice from your practice.' });
  });
});
it('publishes session changes without putting the token in the event', () => {
  const dispatchEvent = vi.fn(); vi.stubGlobal('window', { dispatchEvent });
  setStoredToken('synthetic-new'); clearStoredToken();
  expect(dispatchEvent).toHaveBeenCalledTimes(2);
  for (const [event] of dispatchEvent.mock.calls) {
    expect(event.type).toBe(SESSION_TOKEN_CHANGED_EVENT); expect(event.detail).toBeUndefined();
  }
});
describe('cross-tab session invalidation', () => {
  const store = () => {
    const values = new Map<string, string>();
    return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), clear: () => values.clear() };
  };
  it('purges an old sessionStorage fallback when another tab removes the current token', () => {
    const local = store(), session = store(); vi.stubGlobal('localStorage', local); vi.stubGlobal('sessionStorage', session);
    setStoredToken('synthetic-original'); local.clear();
    expect(getStoredToken()).toBe('synthetic-original');
    reconcileSessionStorageEvent({ storageArea: local as unknown as Storage, key: 'artax_session_token', oldValue: 'synthetic-original', newValue: null });
    expect(getStoredToken()).toBeNull(); expect(session.getItem('artax_session_token')).toBeNull();
  });
  it('ignores an old removal event delivered after a new login', () => {
    const local = store(), session = store(); vi.stubGlobal('localStorage', local); vi.stubGlobal('sessionStorage', session);
    setStoredToken('synthetic-new');
    reconcileSessionStorageEvent({ storageArea: local as unknown as Storage, key: 'artax_session_token', oldValue: 'synthetic-original', newValue: null });
    expect(getStoredToken()).toBe('synthetic-new');
  });
  it('honors a cleared shared store while ignoring unrelated storage changes', () => {
    const local = store(), session = store(); vi.stubGlobal('localStorage', local); vi.stubGlobal('sessionStorage', session);
    setStoredToken('synthetic-original');
    reconcileSessionStorageEvent({ storageArea: local as unknown as Storage, key: 'sidebar', oldValue: null, newValue: null });
    expect(getStoredToken()).toBe('synthetic-original'); local.clear();
    reconcileSessionStorageEvent({ storageArea: local as unknown as Storage, key: null, oldValue: null, newValue: null });
    expect(getStoredToken()).toBeNull();
  });
});

describe.each([['vault', () => vaultService.list('client-a')], ['requests', () => documentRequestService.notifications('client-a')]] as const)
('%s session/response boundary', (_name, read) => {
  it('ignores a late unauthorized reply rather than clearing a newer session', async () => {
    let answer!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { answer = resolve; })));
    const pending = read(); setStoredToken('synthetic-replacement');
    answer(new Response(JSON.stringify({ code: 'SESSION_EXPIRED' }), { status: 401 }));
    await expect(pending).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(getStoredToken()).toBe('synthetic-replacement');
  });
  it('clears only the current session on expiration', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    await expect(read()).rejects.toMatchObject({ status: 401 }); expect(getStoredToken()).toBeNull();
  });
  it('clears a staff session whose required MFA assurance has been revoked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"code":"STAFF_MFA_REQUIRED"}', { status: 403 })));
    await expect(read()).rejects.toMatchObject({ status: 403, code: 'STAFF_MFA_REQUIRED' }); expect(getStoredToken()).toBeNull();
  });
  it('retains the current session on an ordinary object authorization denial', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"code":"ACCESS_DENIED"}', { status: 403 })));
    await expect(read()).rejects.toMatchObject({ status: 403 }); expect(getStoredToken()).toBe('synthetic-original');
  });
  it.each(['null', '[]', 'not json'])('refuses malformed successful payload %s', async body => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));
    await expect(read()).rejects.toMatchObject({ status: 502, code: 'INVALID_VAULT_RESPONSE' });
  });
});
