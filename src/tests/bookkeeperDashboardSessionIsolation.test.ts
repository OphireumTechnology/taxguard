import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
import type { BookkeeperSnapshot } from '../types/bookkeeperDashboard';

// Run each real hook with effect cleanup and state, without a browser dependency.
const harness = vi.hoisted(() => ({
  token: 'session-a', state: undefined as any, deps: undefined as unknown[] | undefined,
  cleanup: undefined as (() => void) | undefined, dashboard: vi.fn(), grants: vi.fn(),
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
vi.mock('../services/api', () => ({
  getStoredToken: () => harness.token,
  api: { bookkeeper: { getDashboard: harness.dashboard, getClients: harness.grants } },
}));
import { useBookkeeperClientGrants, useBookkeeperDashboardData } from '../hooks/useBookkeeperDashboardData';

const user = { id: 'bookkeeper-a', tenantId: 'tenant-a', role: 'bookkeeper', status: 'active', authorizedClientIds: ['client-a'] } as User;
const snapshot: BookkeeperSnapshot = {
  scope: { tenantId: 'tenant-a', clientId: 'client-a', taxYear: 2024 },
  transactions: [], accounts: [], journals: [], reconciliations: [], periods: [],
  capabilities: { mutations: false, periodClose: false, privateDocumentPreview: false },
};
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
beforeEach(() => {
  harness.cleanup?.(); harness.state = undefined; harness.deps = undefined; harness.cleanup = undefined;
  harness.token = 'session-a'; harness.dashboard.mockReset(); harness.grants.mockReset();
  harness.dashboard.mockResolvedValue(snapshot);
  harness.grants.mockResolvedValue({ tenantId: 'tenant-a', clientIds: ['client-a'] });
});

describe.each(['snapshot', 'grants'] as const)('bookkeeper %s session isolation', kind => {
  const render = (actor = user, auth = 'AUTHENTICATED') => kind === 'snapshot'
    ? useBookkeeperDashboardData(actor, auth, 'client-a', '2024', '', 0).data
    : useBookkeeperClientGrants(actor, auth).clients;
  const reads = () => kind === 'snapshot' ? harness.dashboard : harness.grants;
  const empty = () => kind === 'snapshot' ? null : [];
  const loaded = () => kind === 'snapshot' ? snapshot : ['client-a'];
  const signal = () => reads().mock.calls[0][kind === 'snapshot' ? 3 : 0] as AbortSignal;

  it('hides cached data and aborts old reads when the token is replaced', async () => {
    render(); await settle(); expect(render()).toEqual(loaded());
    const oldSignal = signal(); harness.token = 'session-b';
    expect(render()).toEqual(empty()); expect(oldSignal.aborted).toBe(true);
    expect(reads()).toHaveBeenCalledTimes(2);
    await settle(); expect(render()).toEqual(loaded());
  });

  it.each(['INITIALIZING', 'suspended', 'accountant'])('clears cached data across %s access interruption', async interruption => {
    render(); await settle(); expect(render()).toEqual(loaded());
    const actor = interruption === 'suspended' ? { ...user, status: 'suspended' }
      : interruption === 'accountant' ? { ...user, role: 'accountant' } : user;
    expect(render(actor as User, interruption === 'INITIALIZING' ? interruption : 'AUTHENTICATED')).toEqual(empty());
    expect(signal().aborted).toBe(true); expect(reads()).toHaveBeenCalledTimes(1);
    expect(render()).toEqual(empty()); expect(reads()).toHaveBeenCalledTimes(2);
    await settle(); expect(render()).toEqual(loaded());
  });

  it('ignores late success from the previous session', async () => {
    let resolveOld!: (value: unknown) => void;
    reads().mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    render(); harness.token = 'session-b'; render(); await settle();
    expect(render()).toEqual(loaded());
    resolveOld(kind === 'snapshot' ? { ...snapshot, accounts: [{ id: 'stale' }] }
      : { tenantId: 'tenant-a', clientIds: ['stale-client'] });
    await settle(); expect(render()).toEqual(loaded());
  });

  it('ignores a late failure from the previous session', async () => {
    let rejectOld!: (reason: Error) => void;
    reads().mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject; }));
    render(); harness.token = 'session-b'; render(); await settle();
    rejectOld(new Error('Old session unavailable')); await settle();
    expect(render()).toEqual(loaded());
  });

  it('reloads when client assignments change for the same identity', async () => {
    render(); await settle();
    expect(render({ ...user, authorizedClientIds: [] })).toEqual(empty());
    expect(signal().aborted).toBe(true); expect(reads()).toHaveBeenCalledTimes(2);
  });
});
