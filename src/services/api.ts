import { apiEndpoint } from '../config/apiEndpoint';
import type { User } from '../types';

const TOKEN_STORAGE_KEY = 'taxguard_session_token';
export const SESSION_TOKEN_CHANGED_EVENT = 'taxguard:session-token-changed';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY) || window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent(SESSION_TOKEN_CHANGED_EVENT, { detail: { token } }));
  } catch {
    // Ignore storage access restrictions
  }
}

export function clearStoredToken(): void {
  setStoredToken(null);
}

export function reconcileSessionStorageEvent(event: StorageEvent): boolean {
  return event.key === TOKEN_STORAGE_KEY || event.key === null;
}

export class ApiRequestError extends Error {
  status: number;
  code: string;
  body?: any;
  constructor(message: string, status = 500, code = 'API_ERROR', body?: any) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const authToken = token !== undefined ? token : getStoredToken();
  const reqHeaders = new Headers(headers || {});
  if (!reqHeaders.has('Content-Type') && rest.body && !(rest.body instanceof FormData)) {
    reqHeaders.set('Content-Type', 'application/json');
  }
  if (authToken && !reqHeaders.has('Authorization')) {
    reqHeaders.set('Authorization', `Bearer ${authToken}`);
    reqHeaders.set('x-session-token', authToken);
  }

  const res = await fetch(apiEndpoint(path), {
    ...rest,
    headers: reqHeaders,
  });

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || `Request failed (${res.status})`;
    const code = data?.code || `HTTP_${res.status}`;
    throw new ApiRequestError(msg, res.status, code, data);
  }

  return data as T;
}

function buildQuery(params?: Record<string, any>): string {
  if (!params || typeof params !== 'object') return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const q = sp.toString();
  return q ? `?${q}` : '';
}

function extractSignal(args: any[]): AbortSignal | undefined {
  return args.find((a) => typeof AbortSignal !== 'undefined' && a instanceof AbortSignal);
}

export type ClientDashboardResource =
  | 'questionnaire'
  | 'requests'
  | 'requirements'
  | 'overview'
  | string;

export const api = {
  request: apiRequest,
  get: <T = any>(path: string, signal?: AbortSignal): Promise<T> =>
    apiRequest<T>(path, { method: 'GET', signal }),
  post: <T = any>(path: string, body?: any, signal?: AbortSignal): Promise<T> =>
    apiRequest<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined, signal }),
  put: <T = any>(path: string, body?: any, signal?: AbortSignal): Promise<T> =>
    apiRequest<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined, signal }),
  patch: <T = any>(path: string, body?: any, signal?: AbortSignal): Promise<T> =>
    apiRequest<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined, signal }),
  delete: <T = any>(path: string, signal?: AbortSignal): Promise<T> =>
    apiRequest<T>(path, { method: 'DELETE', signal }),

  auth: {
    login: async (
      email: string,
      password: string,
      mfaCode?: string,
      portal?: string
    ): Promise<{ token?: string; user?: User; mfaRequired?: boolean; [key: string]: any }> => {
      const res = await apiRequest<{ token?: string; user?: User; mfaRequired?: boolean; [key: string]: any }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password, mfaCode, portal }),
        }
      );
      if (res?.token) setStoredToken(res.token);
      return res;
    },
    logout: async (..._args: any[]): Promise<void> => {
      try {
        await apiRequest('/api/auth/logout', { method: 'POST' });
      } finally {
        clearStoredToken();
      }
    },
    getMe: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/auth/me', { signal: extractSignal(args) }),
    supabaseSession: (
      tokenOrPayload: string | { accessToken: string; portal?: string; [key: string]: any },
      extra?: Record<string, any>
    ): Promise<any> => {
      const accessToken = typeof tokenOrPayload === 'string' ? tokenOrPayload : tokenOrPayload?.accessToken;
      const bodyPayload =
        typeof tokenOrPayload === 'string' ? extra || {} : { ...tokenOrPayload, ...(extra || {}) };
      return apiRequest<any>('/api/auth/supabase-session', {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify(bodyPayload),
      });
    },
  },

  accountant: {
    getDashboard: (...args: any[]): Promise<any> =>
      apiRequest<any>(
        `/api/accountant/dashboard${buildQuery(typeof args[0] === 'object' && !(args[0] instanceof AbortSignal) ? args[0] : undefined)}`,
        { signal: extractSignal(args) }
      ),
  },

  bookkeeper: {
    getDashboard: (...args: any[]): Promise<any> =>
      apiRequest<any>(
        `/api/bookkeeping/dashboard${buildQuery(typeof args[0] === 'object' && !(args[0] instanceof AbortSignal) ? args[0] : { taxYear: args[0] })}`,
        { signal: extractSignal(args) }
      ),
    getClients: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/bookkeeping/clients', { signal: extractSignal(args) }),
  },

  clientService: {
    getDashboard: (...args: any[]): Promise<any> =>
      apiRequest<any>(
        `/api/operations/client-service/dashboard${buildQuery(typeof args[0] === 'object' && !(args[0] instanceof AbortSignal) ? args[0] : { taxYear: args[0] })}`,
        { signal: extractSignal(args) }
      ),
    conversation: (...args: any[]): Promise<any> =>
      apiRequest<any>(`/api/communications/threads/${encodeURIComponent(String(args[0] ?? ''))}`, {
        signal: extractSignal(args),
      }),
    requestDetail: (...args: any[]): Promise<any> =>
      apiRequest<any>(`/api/operations/client-service/requests/${encodeURIComponent(String(args[0] ?? ''))}`, {
        signal: extractSignal(args),
      }),
    search: (...args: any[]): Promise<any> =>
      apiRequest<any>(`/api/operations/client-service/search${buildQuery({ q: args[0] })}`, {
        signal: extractSignal(args),
      }),
  },

  practiceManager: {
    getDashboard: (...args: any[]): Promise<any> =>
      apiRequest<any>(
        `/api/practice/manager/dashboard${buildQuery(typeof args[0] === 'object' && !(args[0] instanceof AbortSignal) ? args[0] : { taxYear: args[0] })}`,
        { signal: extractSignal(args) }
      ),
  },

  reviewer: {
    getDashboard: (...args: any[]): Promise<any> =>
      apiRequest<any>(
        `/api/cases/reviewer/dashboard${buildQuery(typeof args[0] === 'object' && !(args[0] instanceof AbortSignal) ? args[0] : { taxYear: args[0] })}`,
        { signal: extractSignal(args) }
      ),
    getWorkspace: (...args: any[]): Promise<any> =>
      apiRequest<any>(`/api/cases/${encodeURIComponent(String(args[0] ?? ''))}/reviewer-workspace`, {
        signal: extractSignal(args),
      }),
    decide: (caseId: string, payload?: any, ..._args: any[]): Promise<any> =>
      apiRequest<any>(`/api/cases/${encodeURIComponent(caseId)}/review-decision`, {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      }),
  },

  admin: {
    getAuditLogs: (...args: any[]): Promise<any> =>
      apiRequest<any>(
        `/api/admin/audit-logs${buildQuery(typeof args[0] === 'object' && !(args[0] instanceof AbortSignal) ? args[0] : undefined)}`,
        { signal: extractSignal(args) }
      ),
    getSystemHealth: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/admin/system-health', { signal: extractSignal(args) }),
    reassignClient: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/admin/reassign-client', {
        method: 'POST',
        body: JSON.stringify(args.length === 1 ? args[0] : { clientId: args[0], accountantId: args[1], args }),
      }),
    setUserStatus: (userId: string, status: string, ..._rest: any[]): Promise<any> =>
      apiRequest<any>(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    updatePlanPrice: (planId: string, payload: any, ..._rest: any[]): Promise<any> =>
      apiRequest<any>(`/api/admin/plans/${encodeURIComponent(planId)}`, {
        method: 'PATCH',
        body: JSON.stringify(typeof payload === 'object' ? payload : { price: payload }),
      }),
  },

  careers: {
    getJobs: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/careers/jobs', { signal: extractSignal(args) }),
    getApplicants: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/careers/applicants', { signal: extractSignal(args) }),
    apply: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/careers/apply', {
        method: 'POST',
        body: JSON.stringify(args[0] || {}),
      }),
    updateApplicant: (id: string, payload: any, ..._rest: any[]): Promise<any> =>
      apiRequest<any>(`/api/careers/applicants/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
  },

  caseAuthority: {
    getProviderReadiness: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/provider-readiness', { signal: extractSignal(args) }),
    getAiControlCenter: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/ai-governance/control-center', { signal: extractSignal(args) }),
    listAiKillSwitches: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/ai-governance/kill-switches', { signal: extractSignal(args) }),
    activateAiKillSwitch: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/ai-governance/kill-switches', {
        method: 'POST',
        body: JSON.stringify(args[0] || {}),
      }),
    getAiCommandCenterMasterPlanImage: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/ai-governance/master-plan', { signal: extractSignal(args) }),
  },

  clientDashboard: {
    read: <T = any>(
      resource: ClientDashboardResource,
      clientId?: string,
      taxYear?: number,
      signal?: AbortSignal,
      engagementId?: string
    ): Promise<T> =>
      apiRequest<T>(
        `/api/client-portal/dashboard${buildQuery({ resource, clientId, taxYear, engagementId })}`,
        { signal }
      ),
    saveQuestionnaire: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/client-portal/questionnaire', {
        method: 'POST',
        body: JSON.stringify(args.length === 1 ? args[0] : { args }),
      }),
    createCollectionRequest: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/client-portal/collection-requests', {
        method: 'POST',
        body: JSON.stringify(args.length === 1 ? args[0] : { args }),
      }),
    respond: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/client-portal/collection-requests/respond', {
        method: 'POST',
        body: JSON.stringify(args.length === 1 ? args[0] : { args }),
        signal: extractSignal(args),
      }),
    resolveCollectionRequest: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/client-portal/collection-requests/resolve', {
        method: 'POST',
        body: JSON.stringify(args.length === 1 ? args[0] : { args }),
        signal: extractSignal(args),
      }),
  },

  onboarding: {
    getState: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/onboarding/state', { signal: extractSignal(args) }),
    saveStep: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/onboarding/step', {
        method: 'POST',
        body: JSON.stringify(args[0] || {}),
      }),
    submitDossier: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/onboarding/submit', {
        method: 'POST',
        body: JSON.stringify(args[0] || {}),
      }),
  },

  profile: {
    getAuthoritative: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/profile/authoritative', { signal: extractSignal(args) }),
    updateOrdinary: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/profile/ordinary', {
        method: 'PATCH',
        body: JSON.stringify(args[0] || {}),
      }),
    requestAmendment: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/profile/amendment', {
        method: 'POST',
        body: JSON.stringify(args[0] || {}),
      }),
  },

  security: {
    runNegativeTests: (..._args: any[]): Promise<any> =>
      apiRequest<any>('/api/security/negative-tests', { method: 'POST' }),
  },

  staffAccess: {
    members: (...args: any[]): Promise<any> =>
      apiRequest<any>(
        `/api/staff-access/members${buildQuery(typeof args[0] === 'object' && !(args[0] instanceof AbortSignal) ? args[0] : undefined)}`,
        { signal: extractSignal(args) }
      ),
    invitations: (...args: any[]): Promise<any> =>
      apiRequest<any>(
        `/api/staff-access/invitations${buildQuery(typeof args[0] === 'object' && !(args[0] instanceof AbortSignal) ? args[0] : undefined)}`,
        { signal: extractSignal(args) }
      ),
    createInvitation: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/staff-access/invitations', {
        method: 'POST',
        body: JSON.stringify(args[0] || {}),
        signal: extractSignal(args),
      }),
    revokeInvitation: (id: string, ...args: any[]): Promise<any> =>
      apiRequest<any>(`/api/staff-access/invitations/${encodeURIComponent(id)}/revoke`, {
        method: 'POST',
        signal: extractSignal(args),
      }),
    approveMember: (id: string, ...args: any[]): Promise<any> =>
      apiRequest<any>(`/api/staff-access/members/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        signal: extractSignal(args),
      }),
    changeMemberStatus: (id: string, payload?: any, ...args: any[]): Promise<any> =>
      apiRequest<any>(`/api/staff-access/members/${encodeURIComponent(id)}/status`, {
        method: 'POST',
        body: JSON.stringify(typeof payload === 'object' ? payload : { action: payload }),
        signal: extractSignal(args),
      }),
    sessions: (...args: any[]): Promise<any> =>
      apiRequest<any>(
        `/api/staff-access/sessions${buildQuery(typeof args[0] === 'object' && !(args[0] instanceof AbortSignal) ? args[0] : undefined)}`,
        { signal: extractSignal(args) }
      ),
    revokeSession: (id: string, ...args: any[]): Promise<any> =>
      apiRequest<any>(`/api/staff-access/sessions/${encodeURIComponent(id)}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason: typeof args[0] === 'string' ? args[0] : undefined }),
        signal: extractSignal(args),
      }),
    revokeOtherSessions: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/staff-access/sessions/revoke-others', {
        method: 'POST',
        body: JSON.stringify({ reason: typeof args[0] === 'string' ? args[0] : undefined }),
        signal: extractSignal(args),
      }),
    revokeMemberSessions: (memberId: string, ...args: any[]): Promise<any> =>
      apiRequest<any>(`/api/staff-access/members/${encodeURIComponent(memberId)}/revoke-sessions`, {
        method: 'POST',
        body: JSON.stringify({ reason: typeof args[0] === 'string' ? args[0] : undefined }),
        signal: extractSignal(args),
      }),
    securityEvents: (...args: any[]): Promise<any> =>
      apiRequest<any>(
        `/api/staff-access/security-events${buildQuery(typeof args[0] === 'object' && !(args[0] instanceof AbortSignal) ? args[0] : undefined)}`,
        { signal: extractSignal(args) }
      ),
    recoveries: (...args: any[]): Promise<any> =>
      apiRequest<any>(
        `/api/staff-access/recoveries${buildQuery(typeof args[0] === 'object' && !(args[0] instanceof AbortSignal) ? args[0] : undefined)}`,
        { signal: extractSignal(args) }
      ),
    recoveryHistory: (...args: any[]): Promise<any> =>
      apiRequest<any>(
        `/api/staff-access/recoveries/history${buildQuery(typeof args[0] === 'object' && !(args[0] instanceof AbortSignal) ? args[0] : undefined)}`,
        { signal: extractSignal(args) }
      ),
    requestRecovery: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/staff-access/recoveries', {
        method: 'POST',
        body: JSON.stringify(args[0] || {}),
        signal: extractSignal(args),
      }),
    approveRecovery: (id: string, ...args: any[]): Promise<any> =>
      apiRequest<any>(`/api/staff-access/recoveries/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        signal: extractSignal(args),
      }),
    cancelRecovery: (id: string, ...args: any[]): Promise<any> =>
      apiRequest<any>(`/api/staff-access/recoveries/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        signal: extractSignal(args),
      }),
    completeRecovery: (id: string, ...args: any[]): Promise<any> =>
      apiRequest<any>(`/api/staff-access/recoveries/${encodeURIComponent(id)}/complete`, {
        method: 'POST',
        signal: extractSignal(args),
      }),
    retryRecovery: (id: string, ...args: any[]): Promise<any> =>
      apiRequest<any>(`/api/staff-access/recoveries/${encodeURIComponent(id)}/retry`, {
        method: 'POST',
        signal: extractSignal(args),
      }),
  },

  superAdmin: {
    getSession: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/super-admin/session', { signal: extractSignal(args) }),
    recordDashboardView: (dashboard: string, ...args: any[]): Promise<any> =>
      apiRequest<any>('/api/super-admin/dashboard-view', {
        method: 'POST',
        body: JSON.stringify({ dashboard }),
        signal: extractSignal(args),
      }),
  },

  taxForms: {
    getCatalog: (...args: any[]): Promise<any> =>
      apiRequest<any>('/api/tax-forms/catalog', { signal: extractSignal(args) }),
  },
};
