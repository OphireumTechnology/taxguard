import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
const harness = vi.hoisted(() => ({ token: 'session-a' as string | null, state: undefined as any,
  deps: undefined as unknown[] | undefined, cleanup: undefined as (() => void) | undefined, read: vi.fn(),
}));
vi.mock('react', () => ({
  useState: (initial: unknown) => { if (harness.state === undefined) harness.state = initial; return [harness.state, (next: unknown) => { harness.state = next; }]; },
  useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
    if (!harness.deps || deps.some((value, i) => !Object.is(value, harness.deps![i]))) { harness.cleanup?.(); harness.deps = deps; harness.cleanup = effect(); }
  },
}));
vi.mock('../services/api', () => ({ getStoredToken: () => harness.token, api: { profile: { getAuthoritative: harness.read } } }));
import { useAuthoritativeClientProfile } from '../hooks/useAuthoritativeClientProfile';
const user = { id: 'user-a', clientId: 'client-a', tenantId: 'tenant-a', role: 'client', status: 'active' } as User;
const data = { clientId: user.clientId, personal: { legalName: 'Synthetic Taxpayer' }, identity: { status: 'NOT_VERIFIED' } };
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const render = (actor = user, auth = 'AUTHENTICATED', refresh = 0) => useAuthoritativeClientProfile(actor, auth, refresh);
beforeEach(() => {
  harness.cleanup?.(); harness.state = undefined; harness.deps = undefined; harness.cleanup = undefined;
  harness.token = 'session-a'; harness.read.mockReset(); harness.read.mockResolvedValue(data);
});
describe('authoritative client profile reads', () => {
  it('returns a failed state without local fallback data on a service outage', async () => {
    harness.read.mockRejectedValue(new Error('sensitive diagnostic')); render(); await settle();
    expect(render().status).toBe('error'); expect(render().data).toBeNull();
  });
  it('rejects another client response', async () => {
    harness.read.mockResolvedValue({ ...data, clientId: 'client-b' }); render(); await settle();
    expect(render().status).toBe('error'); expect(render().data).toBeNull();
  });
  it('hides cached data and aborts the previous read on token replacement', async () => {
    render(); await settle(); expect(render().data).toEqual(data); harness.token = 'session-b';
    expect(render().data).toBeNull(); expect(harness.read.mock.calls[0][1].aborted).toBe(true);
    expect(harness.read).toHaveBeenCalledTimes(2);
  });
  it.each(['INITIALIZING', 'suspended', 'accountant', 'missing token'])('clears profile across %s and recovers through a new read', async interruption => {
    render(); await settle();
    const actor = interruption === 'suspended' ? { ...user, status: 'suspended' } : interruption === 'accountant' ? { ...user, role: 'accountant' } : user;
    if (interruption === 'missing token') harness.token = null;
    expect(render(actor as User, interruption === 'INITIALIZING' ? interruption : 'AUTHENTICATED').data).toBeNull();
    expect(harness.read.mock.calls[0][1].aborted).toBe(true); harness.token = 'session-a';
    expect(render().data).toBeNull(); expect(harness.read).toHaveBeenCalledTimes(2);
  });
  it.each(['success', 'failure'])('ignores late old-session %s', async outcome => {
    let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
    harness.read.mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
    render(); render(user, 'INITIALIZING');
    if (outcome === 'success') resolve(data); else reject(new Error('old session'));
    await settle(); expect(render(user, 'INITIALIZING').data).toBeNull(); expect(render().data).toBeNull();
  });
  it('clears the current profile while a fresh refresh is pending', async () => {
    render(); await settle(); expect(render(user, 'AUTHENTICATED', 1).data).toBeNull();
    await settle(); expect(render(user, 'AUTHENTICATED', 1).data).toEqual(data);
  });
});
