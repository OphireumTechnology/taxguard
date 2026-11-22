export type RecoveryStep = 'idle' | 'authenticate' | 'enroll' | 'verify' | 'complete' | 'error' | string;

export class RecoveryEnrollmentError extends Error {
  constructor(public readonly code: string, message?: string, public readonly status?: number) {
    super(message || code);
    this.name = 'RecoveryEnrollmentError';
  }
}

export interface RecoveryEnrollmentApi {
  authenticate(email: string, password: string): Promise<any>;
  status(): Promise<any>;
  begin(): Promise<any>;
  verifyCode(factorId: string, code: string): Promise<any>;
  cancel(factorId?: string): Promise<void>;
  signOut(): Promise<void>;
  [key: string]: any;
}

export function createRecoveryEnrollmentApi(): RecoveryEnrollmentApi {
  return {
    async authenticate() {
      throw new RecoveryEnrollmentError('RECOVERY_UNAVAILABLE', 'MFA recovery enrollment is not configured.', 503);
    },
    async status() {
      return { eligible: false };
    },
    async begin() {
      throw new RecoveryEnrollmentError('RECOVERY_UNAVAILABLE', 'MFA recovery enrollment is not configured.', 503);
    },
    async verifyCode() {
      throw new RecoveryEnrollmentError('RECOVERY_UNAVAILABLE', 'MFA recovery enrollment is not configured.', 503);
    },
    async cancel() {
      return;
    },
    async signOut() {
      return;
    },
  };
}
