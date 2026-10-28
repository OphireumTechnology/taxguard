/** Holds provider-only suppression until identity work and logout finish. No credentials are retained here. */
export function createStaffInvitationLifecycle(begin: () => () => void, signOut: () => Promise<void>) {
  type Lease = { active: boolean; released: boolean; release: () => void; work: Set<Promise<unknown>> };
  let current: Lease | undefined;
  const release = (lease: Lease) => { if (!lease.released) { lease.released = true; lease.release(); } };
  return {
    mount() {
      const lease: Lease = { active: true, released: false, release: begin(), work: new Set() };
      current = lease;
      return {
        isActive: () => lease.active && current === lease,
        track<T>(operation: Promise<T>) {
          lease.work.add(operation);
          void operation.then(() => lease.work.delete(operation), () => lease.work.delete(operation));
          return operation;
        },
        async close() {
          lease.active = false;
          await Promise.allSettled([...lease.work]);
          // StrictMode immediately mounts a replacement effect on the same coordinator.
          // The replacement owns the provider session and holds its own suppression lease.
          if (current !== lease && current?.active) { release(lease); return; }
          try { await signOut(); }
          catch { return; } // Failed logout retains suppression; never auto-bridge this identity.
          release(lease);
        },
      };
    },
  };
}
