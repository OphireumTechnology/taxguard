export interface StaffInvitationDetails {
  id: string;
  email: string;
  role: string;
  legalFirstName: string;
  legalLastName: string;
  expiresAt: string;
  status: string;
  [key: string]: any;
}

export class StaffInvitationFlowError extends Error {
  constructor(public readonly code: string, message?: string, public readonly status?: number) {
    super(message || code);
    this.name = 'StaffInvitationFlowError';
  }
}

export interface StaffInvitationApi {
  lookup(token: string, signal?: AbortSignal): Promise<StaffInvitationDetails>;
  accept(token: string, payload?: Record<string, any>): Promise<any>;
  signIn(email: string, password: string): Promise<any>;
  signOut(): Promise<void>;
  mfaState(): Promise<any>;
  [key: string]: any;
}

export function createStaffInvitationApi(): StaffInvitationApi {
  return {
    async lookup() {
      throw new StaffInvitationFlowError('STAFF_INVITATION_UNAVAILABLE', 'Staff invitation service is not configured.', 503);
    },
    async accept() {
      throw new StaffInvitationFlowError('STAFF_INVITATION_UNAVAILABLE', 'Staff invitation service is not configured.', 503);
    },
    async signIn() {
      throw new StaffInvitationFlowError('STAFF_INVITATION_UNAVAILABLE', 'Staff invitation service is not configured.', 503);
    },
    async signOut() {
      return;
    },
    async mfaState() {
      return { enrolled: false, verified: false };
    },
  };
}
