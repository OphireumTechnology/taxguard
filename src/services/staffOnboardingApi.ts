export class StaffOnboardingError extends Error {
  code: string;
  constructor(message: string, code: string = 'ERROR') {
    super(message);
    this.name = 'StaffOnboardingError';
    this.code = code;
  }
}

export interface StaffOnboardingStatus {
  membershipStatus: string;
  role: string;
  invitationAcceptedAt?: string;
  mfa: {
    sessionAssurance: string;
    verifiedFactors: number | null;
  };
  activeAssignments: number;
  assignedClients: number;
  nextSteps: Array<'READY' | 'ENROLL_MFA' | 'ADMIN_APPROVAL'>;
}

export const STEP_TEXT: Record<string, { title: string; detail: string }> = {
  READY: { title: 'Onboarding Complete', detail: 'All security checks, MFA enrollment, and practice authorizations have been established.' },
  ENROLL_MFA: { title: 'Enroll Authenticator', detail: 'Add an authenticator factor for two-step verification.' },
  ADMIN_APPROVAL: { title: 'Pending Approval', detail: 'A senior practice manager will activate your role dashboard.' }
};

export const staffOnboardingApi = {
  available: () => true,
  status: async (): Promise<StaffOnboardingStatus> => ({
    membershipStatus: 'active',
    role: 'accountant',
    invitationAcceptedAt: new Date().toISOString(),
    mfa: {
      sessionAssurance: 'aal2',
      verifiedFactors: 1
    },
    activeAssignments: 3,
    assignedClients: 2,
    nextSteps: ['READY']
  })
};
