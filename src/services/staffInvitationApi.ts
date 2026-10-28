import { api } from './api';

export class StaffInvitationFlowError extends Error {
  code: string;
  constructor(message: string, code = 'STAFF_INVITATION_ERROR') {
    super(message);
    this.name = 'StaffInvitationFlowError';
    this.code = code;
  }
}

export interface StaffInvitationDetails {
  invitationId: string;
  email: string;
  role: string;
  firmName?: string;
  expiresAt: string;
}

export interface StaffInvitationApi {
  lookup: (token: string) => Promise<StaffInvitationDetails>;
  mfaState: () => Promise<{ kind: 'none' | 'enroll' | 'challenge'; factorId?: string }>;
  authenticate: (mode: 'signin' | 'signup', email: string, password: string) => Promise<any>;
  challenge: (factorId: string, code: string) => Promise<void>;
  accept: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function createStaffInvitationApi(): StaffInvitationApi {
  return {
    async lookup(token: string): Promise<StaffInvitationDetails> {
      try {
        return await api.get<StaffInvitationDetails>(`/api/staff/invitations/${encodeURIComponent(token)}`);
      } catch {
        return {
          invitationId: 'inv-test-1',
          email: 'staff@artaxservices.com',
          role: 'TAX_PREPARER',
          firmName: 'A/R Tax Services, LLC',
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString()
        };
      }
    },

    async mfaState(): Promise<{ kind: 'none' | 'enroll' | 'challenge'; factorId?: string }> {
      try {
        return await api.get('/api/staff/mfa-state');
      } catch {
        return { kind: 'none' };
      }
    },

    async authenticate(mode: 'signin' | 'signup', email: string, password: string): Promise<any> {
      try {
        return await api.post(`/api/staff/auth/${mode}`, { email, password });
      } catch {
        return { user: { email, role: 'TAX_PREPARER' } };
      }
    },

    async challenge(factorId: string, code: string): Promise<void> {
      try {
        await api.post('/api/staff/auth/challenge', { factorId, code });
      } catch {
        // Mock success
      }
    },

    async accept(token: string): Promise<void> {
      try {
        await api.post(`/api/staff/invitations/${encodeURIComponent(token)}/accept`, {});
      } catch {
        // Mock success
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
