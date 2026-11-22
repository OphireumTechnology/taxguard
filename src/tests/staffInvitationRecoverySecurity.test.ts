import { describe, expect, it, vi } from 'vitest';
import { createStaffInvitationLifecycle } from '../services/staffInvitationLifecycle';

describe('staff invitation recovery security regression', () => {
  it('retains identity suppression when provider logout fails', async () => {
    const release = vi.fn();
    const signOut = vi.fn(async () => { throw new Error('provider unavailable'); });
    const coordinator = createStaffInvitationLifecycle(() => release, signOut);
    const lease = coordinator.mount();
    await lease.close();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
    expect(lease.isActive()).toBe(false);
  });

  it('does not log out the replacement StrictMode lease', async () => {
    const releaseOld = vi.fn();
    const releaseNew = vi.fn();
    const begin = vi.fn().mockReturnValueOnce(releaseOld).mockReturnValueOnce(releaseNew);
    const signOut = vi.fn(async () => {});
    const coordinator = createStaffInvitationLifecycle(begin, signOut);
    const oldLease = coordinator.mount();
    const newLease = coordinator.mount();
    await oldLease.close();
    expect(releaseOld).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
    expect(newLease.isActive()).toBe(true);
    await newLease.close();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(releaseNew).toHaveBeenCalledTimes(1);
  });
});
