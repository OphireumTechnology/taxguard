export type RecoveryStep =
  | 'none'
  | 'awaiting_approval'
  | 'awaiting_reset'
  | 'reset_failed'
  | 'ready_for_enrollment'
  | 'awaiting_reactivation';

export class RecoveryEnrollmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecoveryEnrollmentError';
  }
}

export interface RecoveryEnrollmentApi {
  available: () => boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  step: () => Promise<RecoveryStep>;
  submit: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function createRecoveryEnrollmentApi(): RecoveryEnrollmentApi {
  return {
    available: () => true,
    signIn: async () => {},
    step: async () => 'none',
    submit: async () => {},
    signOut: async () => {}
  };
}

export const staffRecoveryEnrollmentApi = {
  checkAvailability: async () => ({ available: true }),
  startEnrollment: async () => ({ success: true, factorId: 'fac_' + Date.now() }),
  verifyCode: async (code: string) => ({ success: true })
};
