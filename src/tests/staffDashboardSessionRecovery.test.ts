import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';

const harness = vi.hoisted(() => ({ token: 'session-a', state: undefined as any,
  deps: undefined as unknown[] | undefined, cleanup: undefined as (() => void) | undefined,
  manager: vi.fn(), operations: vi.fn(),
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
  api: { practiceManager: { getDashboard: harness.manager }, clientService: { getDashboard: harness.operations } },
}));
import { usePracticeManagerDashboardData } from '../hooks/usePracticeManagerDashboardData';
import { useClientServiceDashboardData } from '../hooks/useClientServiceDashboardData';

const data = { tenantId: 'tenant-a', cases: [] };
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
beforeEach(() => {
  harness.cleanup?.(); harness.state = undefined; harness.deps = undefined; harness.cleanup = undefined;
  harness.token = 'session-a'; harness.manager.mockReset(); harness.operations.mockReset();
  harness.manager.mockResolvedValue(data); harness.operations.mockResolvedValue(data);
});
describe.each(['practice_manager', 'operations'] as const)('%s dashboard recovery', role => {
  const user = { id: 'staff-a', tenantId: 'tenant-a', role, status: 'active' } as User;
  const read = () => role === 'practice_manager' ? harness.manager : harness.operations;
  const render = (actor = user, auth = 'AUTHENTICATED', year = '2024') => role === 'practice_manager'
    ? usePracticeManagerDashboardData(actor, auth, year, 0)
    : useClientServiceDashboardData(actor, auth, year, 0);
  it.each(['INITIALIZING', 'suspended', 'accountant', 'invalid year'])('clears cached data through %s and requires fresh recovery', async interruption => {
    render(); await settle(); expect(render().data).toEqual(data);
    const oldSignal = read().mock.calls[0][1] as AbortSignal;
    const actor = interruption === 'suspended' ? { ...user, status: 'suspended' }
      : interruption === 'accountant' ? { ...user, role: 'accountant' } : user;
    const denied = render(actor as User, interruption === 'INITIALIZING' ? interruption : 'AUTHENTICATED', interruption === 'invalid year' ? 'bad' : '2024');
    expect(denied.data).toBeNull(); expect(oldSignal.aborted).toBe(true);
    expect(read()).toHaveBeenCalledTimes(1);
    expect(render().data).toBeNull(); expect(read()).toHaveBeenCalledTimes(2);
    await settle(); expect(render().data).toEqual(data);
  });
  it('invalidates cached reads when assignment grants change within the same session', async () => {
    render(); await settle(); expect(render().data).toEqual(data);
    const oldSignal = read().mock.calls[0][1] as AbortSignal;
    expect(render({ ...user, authorizedClientIds: ['synthetic-new-client'] }).data).toBeNull();
    expect(oldSignal.aborted).toBe(true);
    expect(read()).toHaveBeenCalledTimes(2);
    await settle();
    expect(render({ ...user, authorizedClientIds: ['synthetic-new-client'] }).data).toEqual(data);
  });
  it.each(['success', 'failure'])('suppresses late %s from an interrupted session', async outcome => {
    let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
    read().mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
    render(); render(user, 'INITIALIZING');
    if (outcome === 'success') resolve(data); else reject(new Error('old session'));
    await settle(); expect(render(user, 'INITIALIZING').data).toBeNull();
    expect(render().data).toBeNull(); await settle(); expect(render().data).toEqual(data);
  });
});
