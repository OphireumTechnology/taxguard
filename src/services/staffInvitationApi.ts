export class StaffInvitationFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaffInvitationFlowError';
  }
}

export interface StaffInvitationDetails {
  email: string;
  role: string;
  tenantId?: string;
}

export interface StaffInvitationApi {
  mfaState: () => Promise<{ kind: 'ready' | 'enroll' | 'challenge'; factorId?: string }>;
  accept: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  authenticate: (mode: string, email: string, password: string) => Promise<{ emailVerificationRequired?: boolean }>;
  lookup: (token: string) => Promise<StaffInvitationDetails>;
  challenge?: (factorId: string, code: string) => Promise<void>;
}

export function createStaffInvitationApi(): StaffInvitationApi {
  return {
    mfaState: async () => ({ kind: 'ready' }),
    accept: async () => {},
    signOut: async () => {},
    authenticate: async () => ({ emailVerificationRequired: false }),
    lookup: async (token: string) => ({ email: 'staff@destriatax.com', role: 'accountant' }),
    challenge: async () => {}
  };
}

export const staffInvitationApi = {
  lookupInvitation: async (token: string) => ({ valid: true, email: 'invited@destriatax.com', role: 'accountant' }),
  acceptInvitation: async (token: string, password: string) => ({ success: true })
};
