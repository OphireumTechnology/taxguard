import { afterEach, expect, it, vi } from 'vitest';
import { clearLegacyWorkflowHints } from '../services/clearLegacyWorkflowHints';
import { guardLiveWorkflowStage } from '../services/liveWorkflowRouteGuard';
afterEach(() => vi.unstubAllGlobals());
it('removes only legacy workflow hints and preserves session storage keys', () => {
  const removeItem = vi.fn(); vi.stubGlobal('localStorage', { removeItem });
  clearLegacyWorkflowHints();
  expect(removeItem.mock.calls.map(call => call[0])).toEqual([
    'taxguard_stage', 'taxguard_active_stage', 'stageOneCompleted', 'stageTwoCompleted',
    'stageThreeCompleted', 'stage_one_completed', 'stage_two_completed', 'stage_three_completed',
  ]);
  expect(removeItem).not.toHaveBeenCalledWith('artax_session_token');
  expect(removeItem).not.toHaveBeenCalledWith('token');
});
it('continues cleanup after a failed removal without granting workflow authority', () => {
  const removeItem = vi.fn().mockImplementationOnce(() => { throw new Error('restricted'); });
  vi.stubGlobal('localStorage', { removeItem });
  expect(() => clearLegacyWorkflowHints()).not.toThrow();
  expect(removeItem).toHaveBeenCalledTimes(8);
  expect(guardLiveWorkflowStage({ status: 'loading', workflow: null, eligibility: null } as any, 3).allowed).toBe(false);
});
it('tolerates a denied storage property getter', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('restricted'); } });
  try { expect(() => clearLegacyWorkflowHints()).not.toThrow(); }
  finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
