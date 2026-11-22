export interface StaffInvitationLease {
  isActive: () => boolean;
  track: <T>(operation: Promise<T>) => Promise<T>;
  close: () => Promise<void>;
}

export function createStaffInvitationLifecycle(
  beginFlow?: () => (() => void) | void,
  onClose?: () => Promise<void> | void
) {
  return {
    mount(): StaffInvitationLease {
      let active = true;
      const pending = new Set<Promise<any>>();
      const releaseFlow = typeof beginFlow === 'function' ? beginFlow() : undefined;
      return {
        isActive: () => active,
        track<T>(op: Promise<T>): Promise<T> {
          pending.add(op);
          op.finally(() => pending.delete(op));
          return op;
        },
        async close(): Promise<void> {
          if (!active) return;
          active = false;
          try {
            await Promise.allSettled(Array.from(pending));
          } finally {
            if (typeof releaseFlow === 'function') releaseFlow();
            if (typeof onClose === 'function') await onClose();
          }
        },
      };
    },
  };
}
