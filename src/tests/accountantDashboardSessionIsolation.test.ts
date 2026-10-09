import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
import type { AccountantCase } from '../components/workspace/accountantDashboardModel';

const harness = vi.hoisted(() => ({ token: 'session-a', state: undefined as any,
  deps: undefined as unknown[] | undefined, cleanup: undefined as (() => void) | undefined,
  dashboard: vi.fn(), getCase: vi.fn(),
}));
vi.mock('react', () => ({
  useState: (initial: unknown) => {
    if (harness.state === undefined) harness.state = initial;
    return [harness.state, (next: unknown) => { harness.state = next; }];
  },
  useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
    if (!harness.deps || deps.some((value, i) => !Object.is(value, harness.deps![i]))) {
      harness.cleanup?.(); harness.deps = deps; harness.cleanup = effect();
    }
  },
}));
vi.mock('../services/api', () => ({ getStoredToken: () => harness.token,
  api: { accountant: { getDashboard: harness.dashboard }, caseAuthority: { getCase: harness.getCase } },
}));
import { useAccountantDashboardData } from '../hooks/useAccountantDashboardData';

const user = { id: 'accountant-a', tenantId: 'tenant-a', role: 'accountant', status: 'active', authorizedClientIds: ['client-a'] } as User;
const row = { id: 'case-a', tenantId: 'tenant-a', clientId: 'client-a', authorityClientId: 'authority-a', engagementId: 'engagement-a', taxYear: 2024, documents: [], activeStage: 5 } as AccountantCase;
const authority = { tenantId: row.tenantId, clientId: row.authorityClientId, engagementId: row.engagementId, taxYear: row.taxYear, activeStage: 6 };
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const render = (actor = user, auth = 'AUTHENTICATED', refresh = 0) => useAccountantDashboardData(actor, auth, refresh);
beforeEach(() => {
  harness.cleanup?.(); harness.state = undefined; harness.deps = undefined; harness.cleanup = undefined;
  harness.token = 'session-a'; harness.dashboard.mockReset(); harness.getCase.mockReset();
  harness.dashboard.mockResolvedValue({ cases: [row] }); harness.getCase.mockResolvedValue(authority);
});

describe('accountant dashboard session isolation', () => {
  it('invalidates queue and loading/error state when the token changes', async () => {
    render(); await settle(); expect(render().rows[0].activeStage).toBe(6);
    const signal = harness.dashboard.mock.calls[0][0] as AbortSignal;
    harness.token = 'session-b'; const changed = render();
    expect(changed.rows).toEqual([]); expect(changed.loading).toBe(true); expect(changed.error).toBe('');
    expect(signal.aborted).toBe(true); expect(harness.dashboard).toHaveBeenCalledTimes(2);
  });
  it.each(['INITIALIZING', 'suspended', 'reviewer', 'tenantless'])('clears cache and requires fresh reads after %s interruption', async interruption => {
    render(); await settle(); expect(render().rows).toHaveLength(1);
    const actor = interruption === 'suspended' ? { ...user, status: 'suspended' }
      : interruption === 'reviewer' ? { ...user, role: 'reviewer' }
      : interruption === 'tenantless' ? { ...user, tenantId: undefined } : user;
    expect(render(actor as User, interruption === 'INITIALIZING' ? interruption : 'AUTHENTICATED').rows).toEqual([]);
    expect(harness.dashboard.mock.calls[0][0].aborted).toBe(true);
    expect(render().rows).toEqual([]); expect(harness.dashboard).toHaveBeenCalledTimes(2);
    await settle(); expect(render().rows).toHaveLength(1);
  });
  it('invalidates cache when trusted assignment context changes or refresh is requested', async () => {
    render(); await settle();
    const changed = { ...user, authorizedClientIds: [] };
    expect(render(changed).rows).toEqual([]); await settle();
    expect(render(changed, 'AUTHENTICATED', 1).rows).toEqual([]);
    expect(harness.dashboard).toHaveBeenCalledTimes(3);
  });
  it.each(['success', 'failure'])('suppresses late dashboard %s and starts no enrichment after logout', async outcome => {
    let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
    harness.dashboard.mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
    render(); render(user, 'ANONYMOUS');
    if (outcome === 'success') resolve({ cases: [row] }); else reject(new Error('old session'));
    await settle(); expect(render(user, 'ANONYMOUS').rows).toEqual([]);
    expect(harness.getCase).not.toHaveBeenCalled();
    expect(render().rows).toEqual([]);
  });
  it('suppresses late case enrichment from the previous token', async () => {
    let resolve!: (value: unknown) => void;
    harness.getCase.mockImplementationOnce(() => new Promise(yes => { resolve = yes; }));
    render(); await settle(); harness.token = 'session-b'; render(); await settle();
    resolve({ ...authority, activeStage: 18 }); await settle();
    expect(render().rows[0].activeStage).toBe(6);
  });
  it('preserves exact scope checks when enriching the stage', async () => {
    harness.getCase.mockResolvedValue({ ...authority, clientId: 'other-client', activeStage: 18 });
    render(); await settle(); expect(render().rows[0].activeStage).toBe(5);
  });
  it('reports sanitized queue failure without retaining cases', async () => {
    render(); await settle(); harness.dashboard.mockRejectedValue(new Error('private provider details'));
    render(user, 'AUTHENTICATED', 1); await settle(); const failed = render(user, 'AUTHENTICATED', 1);
    expect(failed.rows).toEqual([]); expect(failed.loading).toBe(false);
    expect(failed.error).toContain('Retry'); expect(failed.error).not.toContain('private');
  });
});
