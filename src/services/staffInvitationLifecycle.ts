export interface StaffInvitationLease {
  isActive: () => boolean;
  track: <T>(promise: Promise<T>) => Promise<T>;
  close: () => Promise<void>;
}

export function createStaffInvitationLifecycle(
  beginFlow?: () => (() => void) | void,
  onSignOut?: () => Promise<void> | void
) {
  return {
    mount(): StaffInvitationLease {
      let active = true;
      const release = typeof beginFlow === 'function' ? beginFlow() : undefined;
      const pending = new Set<Promise<any>>();
      return {
        isActive: () => active,
        track: <T,>(promise: Promise<T>): Promise<T> => {
          pending.add(promise);
          promise.finally(() => pending.delete(promise)).catch(() => undefined);
          return promise;
        },
        close: async () => {
          active = false;
          try {
            if (typeof release === 'function') release();
          } finally {
            await Promise.allSettled([...pending]);
            if (typeof onSignOut === 'function') {
              await Promise.resolve(onSignOut()).catch(() => undefined);
            }
          }
        },
      };
    },
  };
}
