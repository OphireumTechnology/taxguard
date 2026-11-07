import type { User } from '../types';
import { apiEndpoint } from '../config/apiEndpoint';

/** Only an authenticated server response can establish TaxGuard membership. */
export function createSessionApi(getToken: () => string | null, setToken: (token: string) => void, clearStoredToken: () => void) {
  async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = getToken();
    const response = await fetch(apiEndpoint(endpoint), { ...options, cache: 'no-store', credentials: 'omit', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {}) } });
    const data: unknown = await response.json().catch(() => undefined);
    if (getToken() !== token) throw Object.assign(new Error('The authenticated session changed.'), { code: 'SESSION_CHANGED' });
    if (!response.ok) {
      const error = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      if (token && (response.status === 401 || (response.status === 403 && error.code === 'STAFF_MFA_REQUIRED'))) {
        clearStoredToken();
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('taxguard:session-expired'));
      }
      throw Object.assign(new Error('A secure TaxGuard server session could not be confirmed.'), { status: response.status, code: typeof error.code === 'string' ? error.code : 'SESSION_ESTABLISHMENT_FAILED' });
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Object.assign(new Error('Invalid authentication response.'), { code: 'INVALID_API_RESPONSE' });
    return data as T;
  }
  return {
    login: async (email: string, password: string, mfaCode?: string) => {
      const res = await request<{ token?: string; user?: User; mfaRequired?: boolean; message?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, mfaCode })
      });
      if (res.token) {
        if (typeof res.token !== 'string' || !res.user || typeof res.user.id !== 'string' || typeof res.user.role !== 'string') throw Object.assign(new Error('Invalid authentication response.'), { code: 'INVALID_API_RESPONSE' });
        setToken(res.token);
      }
      if (!res.token && res.mfaRequired !== true) throw Object.assign(new Error('Unconfirmed authentication response.'), { code: 'INVALID_API_RESPONSE' });
      return res;
    },

    register: async (payload: { name: string; email: string; password: string; phone?: string; companyName?: string; clientType?: 'individual' | 'business' }) => {
      const res = await request<{ message: string; token: string; user: User; verificationTokenSimulated?: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.token) {
        if (typeof res.token !== 'string' || !res.user || typeof res.user.id !== 'string' || typeof res.user.role !== 'string') throw Object.assign(new Error('Invalid authentication response.'), { code: 'INVALID_API_RESPONSE' });
        setToken(res.token);
      }
      return res;
    },

    supabaseSession: async (payload: {
      accessToken: string;
      /** 'staff' when sent from the staff sign-in page: the server then never creates a client. */
      portal?: 'staff' | 'client';
      name?: string;
      phone?: string;
      companyName?: string;
      clientType?: 'individual' | 'business';
    }) => {
      const res = await request<{
        message: string;
        token: string;
        user: User;
        tenantId?: string;
        clientId: string;
        engagementId?: string;
        taxYear?: number;
        caseId?: string;
        activeStage?: 1 | 2 | 3;
        stageStates?: {
          STAGE_01_IDENTITY: string;
          STAGE_02_DOCUMENTS: string;
          STAGE_03_EXTRACTION: string;
          STAGE_04_PREPARATION: string;
          STAGE_05_REVIEW: string;
          STAGE_06_APPROVAL: string;
          STAGE_07_FILING: string;
        };
        resumed?: boolean;
        workflow?: any;
        eligibility?: any;
        /** Durable configurations: the legacy onboarding case provisioner is not available. */
        onboardingAvailability?: { status: 'unavailable'; code: string };
        environment: string;
      }>('/api/auth/supabase-session', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.token) {
        if (typeof res.token !== 'string' || !res.user || typeof res.user.id !== 'string' || typeof res.user.role !== 'string') throw Object.assign(new Error('Invalid authentication response.'), { code: 'INVALID_API_RESPONSE' });
        setToken(res.token);
      }

      if (!res.token) throw Object.assign(new Error('Unconfirmed authentication response.'), { code: 'INVALID_API_RESPONSE' });
      return res;
    },

    getMe: async () => {
      return request<{ user: User }>('/api/auth/me');
    },

    logout: async () => {
      const token = getToken();
      try {
        await request('/api/auth/logout', { method: 'POST' });
      } finally {
        // A delayed logout must not clear a newer authenticated session.
        if (getToken() === token) clearStoredToken();
      }
    },

    verifyEmail: async (token: string) => {
      return request<{ message: string; user: User }>('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token })
      });
    },

    forgotPassword: async (email: string) => {
      return request<{ message: string; resetTokenSimulated?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
    },

    resetPassword: async (token: string, newPassword: string) => {
      return request<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword })
      });
    },

    googleLogin: async (email: string, name?: string) => {
      const res = await request<{ token: string; user: User }>('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ email, name })
      });
      if (res.token) {
        if (typeof res.token !== 'string' || !res.user || typeof res.user.id !== 'string' || typeof res.user.role !== 'string') throw Object.assign(new Error('Invalid authentication response.'), { code: 'INVALID_API_RESPONSE' });
        setToken(res.token);
      }
      return res;
    }
  };
}
