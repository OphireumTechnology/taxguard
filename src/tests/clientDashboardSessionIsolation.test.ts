import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';

// Exercise the real hook's effects and state without a browser dependency.
const harness = vi.hoisted(() => ({
  token: 'session-a', state: undefined as any, deps: undefined as unknown[] | undefined,
  cleanup: undefined as (() => void) | undefined, reads: vi.fn(),
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
  api: { clientDashboard: { read: harness.reads } },
}));
import { useClientDashboardData } from '../hooks/useClientDashboardData';
const user = { id: 'user-a', clientId: 'client-a', tenantId: 'tenant-a', role: 'client', status: 'active' } as User;
const render = (actor = user, auth = 'AUTHENTICATED', year = 2024) => useClientDashboardData(actor, auth, 'client-a', year);
const response = (resource: string) => resource === 'questionnaire'
  ? { clientId: 'client-a', tenantId: 'tenant-a', taxYear: 2024, questionnaire: null }
  : resource === 'documents' ? { documents: [{ id: 'authorized-document', clientId: 'client-a', tenantId: 'tenant-a', taxYear: 2024 }] }
  : { [resource]: [] };
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
beforeEach(() => {
  harness.cleanup?.(); harness.state = undefined; harness.deps = undefined; harness.cleanup = undefined;
  harness.token = 'session-a'; harness.reads.mockReset();
  harness.reads.mockImplementation(async (resource: string) => response(resource));
});
describe('client dashboard authenticated session isolation', () => {
  it('hides cached records immediately on token replacement and reloads the session', async () => {
    render(); await settle(); expect(render().documents.data?.[0].id).toBe('authorized-document');
    const signal = harness.reads.mock.calls[0][3] as AbortSignal;
    harness.token = 'session-b';
    expect(render().documents).toEqual({ status: 'loading', data: null });
    expect(signal.aborted).toBe(true); expect(harness.reads).toHaveBeenCalledTimes(14);
    await settle(); expect(render().documents.status).toBe('ready');
  });
  it('does not restore old cached data after authentication is interrupted', async () => {
    render(); await settle();
    expect(render(user, 'INITIALIZING').documents.status).toBe('unavailable');
    expect(render().documents).toEqual({ status: 'loading', data: null });
    expect(harness.reads).toHaveBeenCalledTimes(14);
  });
  it('denies suspended and staff sessions without making additional reads', async () => {
    render(); await settle();
    expect(render({ ...user, status: 'suspended' }).documents.data).toBeNull();
    expect(render({ ...user, role: 'accountant' }).documents.status).toBe('unavailable');
    expect(harness.reads).toHaveBeenCalledTimes(7);
  });
  it('ignores late responses from a replaced session', async () => {
    const pending: (() => void)[] = [];
    harness.reads.mockImplementation((resource: string) => new Promise(resolve => pending.push(() => resolve(response(resource)))));
    render(); const old = pending.splice(0);
    harness.token = 'session-b'; render();
    old.forEach(resolve => resolve()); await settle();
    expect(render().documents).toEqual({ status: 'loading', data: null });
    pending.forEach(resolve => resolve()); await settle();
    expect(render().documents.status).toBe('ready');
  });
});
