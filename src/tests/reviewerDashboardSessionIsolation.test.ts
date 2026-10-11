import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
import type { ReviewerQueueCase, ReviewerSnapshot } from '../types/reviewerDashboard';

const harness = vi.hoisted(() => ({
  token: 'session-a', stateIndex: 0, effectIndex: 0, states: [] as any[],
  effects: [] as { deps: unknown[]; cleanup?: () => void }[],
  queue: vi.fn(), workspace: vi.fn(),
}));
vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const index = harness.stateIndex++;
    if (harness.states[index] === undefined) harness.states[index] = initial;
    return [harness.states[index], (next: unknown) => { harness.states[index] = next; }];
  },
  useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
    const index = harness.effectIndex++, previous = harness.effects[index];
    if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
      previous?.cleanup?.(); harness.effects[index] = { deps, cleanup: effect() };
    }
  },
}));
vi.mock('../services/api', () => ({ getStoredToken: () => harness.token,
  api: { reviewer: { getDashboard: harness.queue, getWorkspace: harness.workspace } },
}));
import { useReviewerDashboardData } from '../hooks/useReviewerDashboardData';

const user = { id: 'reviewer-a', tenantId: 'tenant-a', role: 'reviewer', status: 'active' } as User;
const row = { id: 'case-a', scope: { tenantId: 'tenant-a', clientId: 'client-a', engagementId: 'engagement-a', taxYear: 2024 }, reviewerUid: user.id, activeStage: 6 } as ReviewerQueueCase;
const snapshot = { scope: row.scope, case: { reviewerUid: user.id } } as ReviewerSnapshot;
function render(actor = user, auth = 'AUTHENTICATED') {
  harness.stateIndex = 0; harness.effectIndex = 0;
  return useReviewerDashboardData(actor, auth, row.id, 0);
}
async function load() {
  render(); await settle(); render(); await settle(); return render();
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
beforeEach(() => {
  harness.effects.forEach(effect => effect.cleanup?.()); harness.effects = []; harness.states = [];
  harness.token = 'session-a'; harness.queue.mockReset(); harness.workspace.mockReset();
  harness.queue.mockResolvedValue({ cases: [row] }); harness.workspace.mockResolvedValue(snapshot);
});

describe('reviewer dashboard session isolation', () => {
  it.each(['INITIALIZING', 'suspended', 'accountant'])('requires fresh queue and workspace after %s interruption', async interruption => {
    expect((await load()).snapshot.data).toEqual(snapshot);
    const queueSignal = harness.queue.mock.calls[0][0] as AbortSignal;
    const workspaceSignal = harness.workspace.mock.calls[0][1] as AbortSignal;
    const actor = interruption === 'suspended' ? { ...user, status: 'suspended' }
      : interruption === 'accountant' ? { ...user, role: 'accountant' } : user;
    const denied = render(actor as User, interruption === 'INITIALIZING' ? interruption : 'AUTHENTICATED');
    expect(denied.queue.data).toEqual([]); expect(denied.snapshot.data).toBeNull();
    expect(queueSignal.aborted).toBe(true); expect(workspaceSignal.aborted).toBe(true);
    const restored = render();
    expect(restored.queue.data).toEqual([]); expect(restored.snapshot.data).toBeNull();
    expect(harness.queue).toHaveBeenCalledTimes(2);
    await settle(); expect(render().snapshot.data).toBeNull();
    await settle(); expect(render().snapshot.data).toEqual(snapshot);
    expect(harness.workspace).toHaveBeenCalledTimes(2);
  });

  it('hides queue and workspace when assignment grants change within the same session', async () => {
    await load();
    const oldSignal = harness.queue.mock.calls[0][0] as AbortSignal;
    const changed = render({ ...user, authorizedClientIds: ['synthetic-new-client'] });
    expect(changed.queue.data).toEqual([]);
    expect(changed.snapshot.data).toBeNull();
    expect(oldSignal.aborted).toBe(true);
    expect(harness.queue).toHaveBeenCalledTimes(2);
  });
  it('hides both caches on token replacement', async () => {
    await load(); harness.token = 'session-b';
    const changed = render(); expect(changed.queue.data).toEqual([]); expect(changed.snapshot.data).toBeNull();
    expect(harness.queue.mock.calls[0][0].aborted).toBe(true);
    expect(harness.workspace.mock.calls[0][1].aborted).toBe(true);
  });

  it.each(['success', 'failure'])('ignores late queue %s after access denial', async outcome => {
    let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
    harness.queue.mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
    render(); render(user, 'INITIALIZING');
    if (outcome === 'success') resolve({ cases: [row] }); else reject(new Error('old session'));
    await settle(); expect(render(user, 'INITIALIZING').queue.data).toEqual([]);
    expect(render().queue.status).toBe('loading'); expect(harness.workspace).not.toHaveBeenCalled();
  });
});
