import { api } from './api';

export class RecoveryEnrollmentError extends Error {
  code: string;
  constructor(message: string, code = 'RECOVERY_ERROR') {
    super(message);
    this.name = 'RecoveryEnrollmentError';
    this.code = code;
  }
}

export type RecoveryStep =
  | 'ready_for_enrollment'
  | 'awaiting_reset'
  | 'awaiting_approval'
  | 'awaiting_reactivation'
  | 'reset_failed'
  | 'completed';

export interface RecoveryEnrollmentApi {
  available: () => boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  step: () => Promise<RecoveryStep>;
  submit: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function createRecoveryEnrollmentApi(): RecoveryEnrollmentApi {
  let currentStep: RecoveryStep = 'ready_for_enrollment';

  return {
    available(): boolean {
      return true;
    },

    async signIn(_email: string, _pass: string): Promise<void> {
      currentStep = 'ready_for_enrollment';
    },

    async step(): Promise<RecoveryStep> {
      try {
        const res = await api.get<{ step: RecoveryStep }>('/api/staff/recovery/step');
        return res.step || currentStep;
      } catch {
        return currentStep;
      }
    },

    async submit(): Promise<void> {
      try {
        await api.post('/api/staff/recovery/submit', {});
        currentStep = 'awaiting_approval';
      } catch {
        currentStep = 'awaiting_approval';
      }
    },

    async signOut(): Promise<void> {
      try {
        await api.post('/api/auth/logout', {});
      } catch {
        // Mock success
      }
    }
  };
}
