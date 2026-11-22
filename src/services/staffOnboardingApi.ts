import { api } from './api';

export interface StaffOnboardingStatus {
  membershipStatus: string;
  role?: string;
  invitationAcceptedAt?: string | null;
  mfa: {
    sessionAssurance: string;
    verifiedFactors: number | null;
  };
  activeAssignments: number;
  assignedClients: number;
  nextSteps: string[];
  [key: string]: any;
}

export const STEP_TEXT: Record<string, { title: string; detail: string }> = new Proxy(
  {
    ACCEPT_INVITATION: {
      title: 'Accept your staff invitation',
      detail: 'Complete your invitation using the private invitation code issued by your administrator.',
    },
    ENROLL_MFA: {
      title: 'Enroll an authenticator',
      detail: 'Register a TOTP authenticator app for verified AAL2 sign-in assurance.',
    },
    AWAIT_APPROVAL: {
      title: 'Await independent administrator approval',
      detail: 'An administrator must independently review and activate your staff membership.',
    },
    READY: {
      title: 'Staff onboarding complete',
      detail: 'Your account is active and authorized for assigned practice workspaces.',
    },
  } as Record<string, { title: string; detail: string }>,
  {
    get(target, prop: string) {
      return (
        target[prop] || {
          title: String(prop).replace(/_/g, ' '),
          detail: 'Follow your practice administrator instructions to complete this step.',
        }
      );
    },
  }
);

export class StaffOnboardingError extends Error {
  constructor(public readonly code: string, message?: string, public readonly status?: number) {
    super(message || code);
    this.name = 'StaffOnboardingError';
  }
}

export const staffOnboardingApi = {
  available: () => true,
  status: (): Promise<StaffOnboardingStatus> => api.request('/api/onboarding-durable/staff/status'),
};
