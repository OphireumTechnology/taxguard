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
vi.mock('../services/api', () => ({ getStoredToken: () => harness.token, api: { caseAuthority: { getProviderReadiness: harness.read } } }));
import { useAdminProviderReadiness } from '../hooks/useAdminProviderReadiness';
const user = { id: 'admin-a', tenantId: 'tenant-a', role: 'admin', status: 'active' } as User;
const row = { provider: 'DATABASE', status: 'NOT_CONFIGURED', description: 'Synthetic configuration report', lastChecked: '2026-10-09T00:00:00Z', secret: 'must-not-reach-ui' };
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const render = (actor = user, auth = 'AUTHENTICATED', refresh = 0) => useAdminProviderReadiness(actor, auth, refresh);
beforeEach(() => {
  harness.cleanup?.(); harness.state = undefined; harness.deps = undefined; harness.cleanup = undefined;
  harness.token = 'session-a'; harness.read.mockReset(); harness.read.mockResolvedValue({ providers: [row] });
});
describe('admin provider report', () => {
  it('returns only supported public report fields', async () => {
    render(); await settle(); expect(render().providers).toEqual([{ provider: row.provider, status: row.status, description: row.description, lastChecked: row.lastChecked }]);
    expect(JSON.stringify(render())).not.toContain(row.secret);
  });
  it.each(['INITIALIZING', 'suspended', 'accountant', 'tenantless', 'missing token'])('denies %s and clears cached reports before recovery', async interruption => {
    render(); await settle(); const actor = interruption === 'suspended' ? { ...user, status: 'suspended' }
      : interruption === 'accountant' ? { ...user, role: 'accountant' } : interruption === 'tenantless' ? { ...user, tenantId: undefined } : user;
    if (interruption === 'missing token') harness.token = null;
    expect(render(actor as User, interruption === 'INITIALIZING' ? interruption : 'AUTHENTICATED').providers).toEqual([]);
    expect(harness.read.mock.calls[0][0].aborted).toBe(true); harness.token = 'session-a';
    expect(render().providers).toEqual([]); expect(harness.read).toHaveBeenCalledTimes(2);
  });
  it('invalidates cached report on token or tenant replacement', async () => {
    render(); await settle(); harness.token = 'session-b'; expect(render().providers).toEqual([]);
    await settle(); expect(render({ ...user, tenantId: 'tenant-b' }).providers).toEqual([]);
    expect(harness.read).toHaveBeenCalledTimes(3);
  });
  it.each(['unknown provider', 'unknown status', 'invalid date', 'duplicate provider', 'not an array'])('fails closed for %s response', invalid => {
    const providers = invalid === 'unknown provider' ? [{ ...row, provider: 'UNRECOGNIZED' }]
      : invalid === 'unknown status' ? [{ ...row, status: 'VERIFIED_LIVE' }]
      : invalid === 'invalid date' ? [{ ...row, lastChecked: 'bad' }]
      : invalid === 'duplicate provider' ? [row, row] : null;
    harness.read.mockResolvedValue({ providers }); render();
    return settle().then(() => { expect(render().status).toBe('error'); expect(render().providers).toEqual([]); });
  });
  it.each(['success', 'failure'])('suppresses late old-session %s', async outcome => {
    let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
    harness.read.mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
    render(); render(user, 'INITIALIZING');
    if (outcome === 'success') resolve({ providers: [row] }); else reject(new Error('old session'));
    await settle(); expect(render(user, 'INITIALIZING').providers).toEqual([]); expect(render().providers).toEqual([]);
  });
  it('supports current super-admin role without granting operational mutations', async () => {
    render({ ...user, role: 'super_admin' }); await settle(); expect(render({ ...user, role: 'super_admin' }).providers).toHaveLength(1);
  });
});
