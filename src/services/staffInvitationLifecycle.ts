export interface StaffInvitationLease {
  isActive: () => boolean;
  close: () => Promise<void>;
  track: (operation: Promise<void>) => void;
}

export function createStaffInvitationLifecycle(
  beginIdentityFlow: () => any,
  onSignOut: () => Promise<void>
) {
  let active = false;

  return {
    mount(): StaffInvitationLease {
      active = true;
      beginIdentityFlow();

      return {
        isActive: () => active,
        close: async () => {
          active = false;
          await onSignOut();
        },
        track: (_operation: Promise<void>) => {
          // Track background operation
        }
      };
    }
  };
}
