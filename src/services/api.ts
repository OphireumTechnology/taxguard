import { apiEndpoint } from '../config/apiEndpoint';
import type { User } from '../types';

export const SESSION_TOKEN_CHANGED_EVENT = 'taxguard:session-token-changed';
const TOKEN_STORAGE_KEY = 'ar_tax_session_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent(SESSION_TOKEN_CHANGED_EVENT, { detail: { token } }));
  } catch {
    // ignore storage restriction
  }
}

export function clearStoredToken(): void {
  setStoredToken(null);
}

export function reconcileSessionStorageEvent(event: StorageEvent): void {
  if (typeof window === 'undefined') return;
  if (event.key !== TOKEN_STORAGE_KEY && event.key !== null) return;
  try {
    if (!event.newValue) {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } else {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, event.newValue);
    }
  } catch {
    // ignore storage restriction
  }
}

export function reconcileSessionStorageEvents(onChange: (token: string | null) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handleStorage = (e: StorageEvent) => {
    reconcileSessionStorageEvent(e);
    if (e.key === TOKEN_STORAGE_KEY || e.key === null) {
      onChange(getStoredToken());
    }
  };
  const handleCustom = () => onChange(getStoredToken());
  window.addEventListener('storage', handleStorage);
  window.addEventListener(SESSION_TOKEN_CHANGED_EVENT, handleCustom);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(SESSION_TOKEN_CHANGED_EVENT, handleCustom);
  };
}

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  body?: any;
  constructor(message: string, status: number, code?: string, body?: any) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

async function request<T = any>(
  path: string,
  options: RequestInit & { query?: Record<string, any> } = {}
): Promise<T> {
  const { query, headers, ...rest } = options;
  let fullPath = path;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) fullPath += (fullPath.includes('?') ? '&' : '?') + qs;
  }
  const url = apiEndpoint(fullPath);
  const token = getStoredToken();
  const res = await fetch(url, {
    ...rest,
    headers: {
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new ApiRequestError(
      (data && (data.error || data.message)) || `Request failed (${res.status})`,
      res.status,
      data?.code,
      data
    );
  }
  return data as T;
}

export const api = {
  request,
  auth: {
    login: (
      email: string,
      password: string,
      mfaCode?: string
    ): Promise<{ user: User; token?: string; [key: string]: any }> =>
      request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password, mfaCode }) }),
    register: (payload: Record<string, any>): Promise<any> =>
      request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
    getMe: (signal?: AbortSignal): Promise<any> => request('/api/auth/me', { signal }),
    logout: (): Promise<any> => request('/api/auth/logout', { method: 'POST' }),
    supabaseSession: (
      accessTokenOrPayload: string | { accessToken: string; portal?: string; [key: string]: any },
      payload?: Record<string, any>
    ): Promise<any> => {
      const accessToken =
        typeof accessTokenOrPayload === 'string'
          ? accessTokenOrPayload
          : accessTokenOrPayload.accessToken;
      const body =
        typeof accessTokenOrPayload === 'string'
          ? payload || {}
          : { ...accessTokenOrPayload, ...(payload || {}) };
      return request('/api/auth/supabase-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
    },
  },
  careers: {
    getJobs: () => request('/api/careers/jobs'),
    apply: (payload: Record<string, any>) =>
      request('/api/careers/apply', { method: 'POST', body: JSON.stringify(payload) }),
    getApplicants: () => request('/api/careers/applicants'),
    updateApplicant: (id: string, payload: Record<string, any>) =>
      request(`/api/careers/applicants/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  } as Record<string, (...args: any[]) => Promise<any>>,
  taxForms: {
    getCatalog: (signal?: AbortSignal) => request('/api/tax-forms', { signal }),
  } as Record<string, (...args: any[]) => Promise<any>>,
  onboarding: {
    getState: (clientId?: string) => request('/api/onboarding/state', { query: { clientId } }),
    saveStep: (payload: Record<string, any>) =>
      request('/api/onboarding/step', { method: 'POST', body: JSON.stringify(payload) }),
    submitDossier: (payload: Record<string, any>) =>
      request('/api/onboarding/submit', { method: 'POST', body: JSON.stringify(payload) }),
  } as Record<string, (...args: any[]) => Promise<any>>,
  profile: {
    getAuthoritative: (clientId?: string, signal?: AbortSignal) =>
      request('/api/profile/authoritative', { query: { clientId }, signal }),
    requestAmendment: (payload: Record<string, any>) =>
      request('/api/profile-amendment/request', { method: 'POST', body: JSON.stringify(payload) }),
    updateOrdinary: (payload: Record<string, any>) =>
      request('/api/profile/ordinary', { method: 'PATCH', body: JSON.stringify(payload) }),
  } as Record<string, (...args: any[]) => Promise<any>>,
  accountant: {
    getDashboard: (query?: Record<string, any>, signal?: AbortSignal) =>
      request('/api/accountant/dashboard', { query, signal }),
  } as Record<string, (...args: any[]) => Promise<any>>,
  bookkeeper: {
    getClients: (signal?: AbortSignal) => request('/api/bookkeeping/clients', { signal }),
    getDashboard: (query?: Record<string, any>, signal?: AbortSignal) =>
      request('/api/bookkeeping/dashboard', { query, signal }),
  } as Record<string, (...args: any[]) => Promise<any>>,
  reviewer: {
    getDashboard: (query?: Record<string, any>, signal?: AbortSignal) =>
      request('/api/cases/reviewer/dashboard', { query, signal }),
    getWorkspace: (query?: Record<string, any>, signal?: AbortSignal) =>
      request('/api/cases/reviewer/workspace', { query, signal }),
    decide: (payload: Record<string, any>) =>
      request('/api/cases/reviewer/decision', { method: 'POST', body: JSON.stringify(payload) }),
  } as Record<string, (...args: any[]) => Promise<any>>,
  practiceManager: {
    getDashboard: (query?: Record<string, any>, signal?: AbortSignal) =>
      request('/api/practice/manager-dashboard', { query, signal }),
  } as Record<string, (...args: any[]) => Promise<any>>,
  clientService: {
    getDashboard: (query?: Record<string, any>, signal?: AbortSignal) =>
      request('/api/operations/client-service/dashboard', { query, signal }),
    conversation: (threadId: string, caseKey: string, signal?: AbortSignal) =>
      request(`/api/operations/client-service/conversations/${encodeURIComponent(threadId)}`, {
        query: { caseKey },
        signal,
      }),
    requestDetail: (requestId: string, caseKey: string, signal?: AbortSignal) =>
      request(`/api/operations/client-service/requests/${encodeURIComponent(requestId)}`, {
        query: { caseKey },
        signal,
      }),
    search: (q: string, signal?: AbortSignal) =>
      request('/api/operations/client-service/search', { query: { q }, signal }),
  } as Record<string, (...args: any[]) => Promise<any>>,
  clientDashboard: {
    read: <T = any>(
      resource: string,
      clientId?: string,
      taxYear?: number,
      signal?: AbortSignal,
      engagementId?: string
    ): Promise<T> =>
      request<T>(`/api/client-portal/${encodeURIComponent(resource)}`, {
        query: { clientId, taxYear, engagementId },
        signal,
      }),
    saveQuestionnaire: (...args: any[]) =>
      request(`/api/stage-two-three/questionnaire`, {
        method: 'POST',
        body: JSON.stringify({ args }),
      }),
    createCollectionRequest: (...args: any[]) =>
      request(`/api/stage-two-three/requests`, {
        method: 'POST',
        body: JSON.stringify({ args }),
      }),
    resolveCollectionRequest: (...args: any[]) =>
      request(`/api/stage-two-three/requests/resolve`, {
        method: 'POST',
        body: JSON.stringify({ args }),
      }),
    respond: (...args: any[]) =>
      request('/api/client-portal/respond', { method: 'POST', body: JSON.stringify({ args }) }),
  },
  admin: {
    getAuditLogs: (query?: Record<string, any>) => request('/api/admin/audit-logs', { query }),
    getSystemHealth: () => request('/api/health'),
    reassignClient: (payload: Record<string, any>) =>
      request('/api/admin/reassign-client', { method: 'POST', body: JSON.stringify(payload) }),
    setUserStatus: (userId: string, status: string) =>
      request(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    updatePlanPrice: (planId: string, price: number | string) =>
      request(`/api/admin/plans/${encodeURIComponent(planId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ price }),
      }),
  } as Record<string, (...args: any[]) => Promise<any>>,
  superAdmin: {
    getSession: (signal?: AbortSignal) => request('/api/super-admin/session', { signal }),
    recordDashboardView: (workspace: string) =>
      request('/api/super-admin/dashboard-view', { method: 'POST', body: JSON.stringify({ workspace }) }),
  } as Record<string, (...args: any[]) => Promise<any>>,
  security: {
    runNegativeTests: () => request('/api/security/negative-tests', { method: 'POST' }),
  } as Record<string, (...args: any[]) => Promise<any>>,
  caseAuthority: {
    getProviderReadiness: (signal?: AbortSignal) => request('/api/provider-readiness', { signal }),
    getAiControlCenter: (signal?: AbortSignal) => request('/api/ai-governance/control-center', { signal }),
    getAiCommandCenterMasterPlanImage: (signal?: AbortSignal) =>
      request('/api/ai-governance/master-plan-image', { signal }),
    listAiKillSwitches: (signal?: AbortSignal) => request('/api/ai-governance/kill-switches', { signal }),
    activateAiKillSwitch: (payload: Record<string, any>) =>
      request('/api/ai-governance/kill-switches', { method: 'POST', body: JSON.stringify(payload) }),
  } as Record<string, (...args: any[]) => Promise<any>>,
  staffAccess: {
    members: (query?: Record<string, any>, signal?: AbortSignal) =>
      request('/api/staff-access/members', { query, signal }),
    invitations: (query?: Record<string, any>, signal?: AbortSignal) =>
      request('/api/staff-access/invitations', { query, signal }),
    createInvitation: (payload: Record<string, any>) =>
      request('/api/staff-access/invitations', { method: 'POST', body: JSON.stringify(payload) }),
    revokeInvitation: (id: string) =>
      request(`/api/staff-access/invitations/${encodeURIComponent(id)}/revoke`, { method: 'POST' }),
    approveMember: (uid: string) =>
      request(`/api/staff-access/members/${encodeURIComponent(uid)}/approve`, { method: 'POST' }),
    changeMemberStatus: (uid: string, action: string, reason?: string) =>
      request(`/api/staff-access/members/${encodeURIComponent(uid)}/${encodeURIComponent(action)}`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    sessions: (query?: Record<string, any>, signal?: AbortSignal) =>
      request('/api/staff-access/sessions', { query, signal }),
    revokeSession: (id: string, reason?: string) =>
      request(`/api/staff-access/sessions/${encodeURIComponent(id)}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    revokeOtherSessions: (reason?: string) =>
      request('/api/staff-access/sessions/revoke-others', { method: 'POST', body: JSON.stringify({ reason }) }),
    revokeMemberSessions: (uid: string, reason?: string) =>
      request(`/api/staff-access/members/${encodeURIComponent(uid)}/revoke-sessions`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    recoveries: (query?: Record<string, any>, signal?: AbortSignal) =>
      request('/api/staff-access/mfa-recovery', { query, signal }),
    recoveryHistory: (query?: Record<string, any>, signal?: AbortSignal) =>
      request('/api/staff-access/mfa-recovery/history', { query, signal }),
    requestRecovery: (payload: Record<string, any>) =>
      request('/api/staff-access/mfa-recovery', { method: 'POST', body: JSON.stringify(payload) }),
    approveRecovery: (id: string) =>
      request(`/api/staff-access/mfa-recovery/${encodeURIComponent(id)}/approve`, { method: 'POST' }),
    cancelRecovery: (id: string) =>
      request(`/api/staff-access/mfa-recovery/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
    completeRecovery: (id: string) =>
      request(`/api/staff-access/mfa-recovery/${encodeURIComponent(id)}/complete`, { method: 'POST' }),
    retryRecovery: (id: string) =>
      request(`/api/staff-access/mfa-recovery/${encodeURIComponent(id)}/retry`, { method: 'POST' }),
    securityEvents: (query?: Record<string, any>, signal?: AbortSignal) =>
      request('/api/staff-access/security-events', { query, signal }),
  } as Record<string, (...args: any[]) => Promise<any>>,
};
