import { describe, expect, it, vi } from 'vitest';
import { createStaffInvitationLifecycle } from '../services/staffInvitationLifecycle';
function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(signOut = vi.fn(async () => {})) {
  let held = 0;
  const released = vi.fn(() => { held--; });
  const lifecycle = createStaffInvitationLifecycle(() => { held++; return released; }, signOut);
  return { lifecycle, signOut, released, held: () => held };
}

describe('provider-only invitation lifecycle', () => {
  it('waits for in-flight identity setup and logout before releasing suppression', async () => {
    const logout = deferred(); const logoutStarted = deferred();
    const { lifecycle, signOut, held, released } = fixture(vi.fn(() => { logoutStarted.resolve(); return logout.promise; }));
    const lease = lifecycle.mount();
    const work = deferred(); lease.track(work.promise);
    const closing = lease.close();
    expect(lease.isActive()).toBe(false);
    expect(held()).toBe(1); expect(signOut).not.toHaveBeenCalled();
    work.resolve(); await logoutStarted.promise;
    expect(signOut).toHaveBeenCalledOnce(); expect(released).not.toHaveBeenCalled();
    logout.resolve(); await closing;
    expect(held()).toBe(0); expect(released).toHaveBeenCalledOnce();
  });
  it('prevents canceled identity completion from issuing further invitation requests', async () => {
    const { lifecycle, held } = fixture(); const lease = lifecycle.mount();
    const identity = deferred(); const lookup = vi.fn(); const mfa = vi.fn(); const accept = vi.fn();
    const work = (async () => { await identity.promise; if (!lease.isActive()) return; lookup(); mfa(); accept(); })();
    lease.track(work); const closing = lease.close(); identity.resolve(); await closing;
    expect(lookup).not.toHaveBeenCalled(); expect(mfa).not.toHaveBeenCalled(); expect(accept).not.toHaveBeenCalled(); expect(held()).toBe(0);
  });
  it('retains suppression on logout failure', async () => {
    const { lifecycle, held, released } = fixture(vi.fn(async () => { throw new Error('synthetic failure'); }));
    const lease = lifecycle.mount(); await lease.close();
    expect(lease.isActive()).toBe(false); expect(held()).toBe(1); expect(released).not.toHaveBeenCalled();
  });
  it('StrictMode replacement retains its own lease without signing out the newer flow', async () => {
    const { lifecycle, signOut, held, released } = fixture();
    const obsolete = lifecycle.mount(); const closing = obsolete.close();
    const replacement = lifecycle.mount(); await closing;
    expect(obsolete.isActive()).toBe(false); expect(replacement.isActive()).toBe(true);
    expect(signOut).not.toHaveBeenCalled(); expect(held()).toBe(1); expect(released).toHaveBeenCalledOnce();
    await replacement.close(); expect(signOut).toHaveBeenCalledOnce(); expect(held()).toBe(0);
  });
  it('obsolete asynchronous work cannot borrow a replacement lease', async () => {
    const { lifecycle, signOut, held } = fixture();
    const obsolete = lifecycle.mount(); const work = deferred(); const continuation = vi.fn();
    obsolete.track((async () => { await work.promise; if (obsolete.isActive()) continuation(); })());
    const closing = obsolete.close(); const replacement = lifecycle.mount(); work.resolve(); await closing;
    expect(continuation).not.toHaveBeenCalled(); expect(signOut).not.toHaveBeenCalled(); expect(held()).toBe(1);
    await replacement.close();
  });
  it('settles rejected work before logout without leaking errors or keeping unnecessary suppression', async () => {
    const { lifecycle, signOut, held } = fixture(); const lease = lifecycle.mount(); const work = deferred();
    lease.track(work.promise); const closing = lease.close(); work.reject(new Error('synthetic provider rejection'));
    await closing; expect(signOut).toHaveBeenCalledOnce(); expect(held()).toBe(0);
  });
});
