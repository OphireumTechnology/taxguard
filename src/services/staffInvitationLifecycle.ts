export function createStaffInvitationLifecycle(begin: any, signout: any) {
  return {
    mount: () => ({
      isActive: () => true,
      close: async () => {},
      track: async (op: Promise<void>) => await op
    })
  };
}

export const staffInvitationLifecycle = {
  createInvitation: async (data: any) => ({ success: true, invitationId: 'inv_' + Date.now() }),
  revokeInvitation: async (id: string) => ({ success: true })
};
