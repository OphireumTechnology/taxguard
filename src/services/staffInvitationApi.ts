import { apiRequest, ApiRequestError } from './api';
import { loginWithEmail, logout, registerWithEmail, supabaseMfaStatus, verifySupabaseMfa } from '../supabase/auth';

export class StaffInvitationFlowError extends ApiRequestError {}

export interface StaffInvitationDetails {
  id: string;
  email: string;
  role: string;
  status: string;
  firmName?: string;
  expiresAt?: string;
  [key: string]: any;
}

export interface StaffInvitationApi {
  authenticate: (mode: 'signin' | 'signup', email: string, password: string) => Promise<any>;
  lookup: (token: string) => Promise<StaffInvitationDetails>;
  accept: (token: string, payload?: any) => Promise<any>;
  status: (token: string) => Promise<any>;
  mfaState: () => Promise<{ kind: 'ready' | 'enroll' | 'challenge'; factorId?: string }>;
  challenge: (factorId: string, code: string) => Promise<any>;
  signOut: () => Promise<void>;
  [key: string]: any;
}

export function createStaffInvitationApi(): StaffInvitationApi {
  return {
    authenticate: async (mode, email, password) => {
      const res =
        mode === 'signup'
          ? await registerWithEmail('', email, password)
          : await loginWithEmail(email, password);
      if (!res.success && !res.emailVerificationRequired) {
        throw new StaffInvitationFlowError(res.error || 'Authentication failed.', 401, res.code || 'AUTH_FAILED');
      }
      return res;
    },
    lookup: (token: string) =>
      apiRequest(`/api/staff-access/invitations/lookup?token=${encodeURIComponent(token)}`),
    accept: (token: string, payload?: any) =>
      apiRequest('/api/staff-access/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token, ...(payload || {}) }),
      }),
    status: (token: string) =>
      apiRequest(`/api/staff-access/invitations/status?token=${encodeURIComponent(token)}`),
    mfaState: async () => {
      const status = await supabaseMfaStatus();
      if (status.verified) return { kind: 'ready' };
      if (status.enrolled) return { kind: 'challenge', factorId: status.factorId ?? undefined };
      return { kind: 'enroll' };
    },
    challenge: async (factorId: string, code: string) => {
      const res = await verifySupabaseMfa(code, factorId);
      if (!res.success) {
        throw new StaffInvitationFlowError(res.error || 'Invalid verification code.', 400, res.code || 'MFA_INVALID');
      }
      return res;
    },
    signOut: () => logout(),
  };
}
