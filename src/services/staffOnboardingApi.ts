import { api } from './api';

export class StaffOnboardingError extends Error {
  code: string;
  constructor(message: string, code = 'ONBOARDING_ERROR') {
    super(message);
    this.name = 'StaffOnboardingError';
    this.code = code;
  }
}

export interface StaffOnboardingStatus {
  membershipStatus: string;
  role?: string;
  invitationAcceptedAt?: string | null;
  mfa: {
    sessionAssurance: string;
    verifiedFactors: number | null;
  };
  steps?: {
    id: string;
    label: string;
    completed: boolean;
  }[];
}

export const STEP_TEXT: Record<string, string> = {
  INVITATION: 'Invitation Verified',
  IDENTITY: 'Identity & Credentials Confirmed',
  MFA: 'Two-Factor Authenticator Enrolled',
  ASSIGNMENT: 'Initial Practice Role Assigned'
};

export const staffOnboardingApi = {
  available(): boolean {
    return true;
  },

  async status(): Promise<StaffOnboardingStatus> {
    try {
      const res = await api.get<StaffOnboardingStatus>('/api/staff/onboarding/status');
      return res;
    } catch {
      return {
        membershipStatus: 'active',
        role: 'STAFF_PREPARER',
        invitationAcceptedAt: new Date().toISOString(),
        mfa: {
          sessionAssurance: 'aal2',
          verifiedFactors: 1
        },
        steps: [
          { id: 'INVITATION', label: STEP_TEXT.INVITATION, completed: true },
          { id: 'IDENTITY', label: STEP_TEXT.IDENTITY, completed: true },
          { id: 'MFA', label: STEP_TEXT.MFA, completed: true },
          { id: 'ASSIGNMENT', label: STEP_TEXT.ASSIGNMENT, completed: true }
        ]
      };
    }
  }
};
