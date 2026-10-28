export const SESSION_TOKEN_CHANGED_EVENT = "taxguard:session-token-changed";

export function reconcileSessionStorageEvent(event: StorageEvent): void {
  if (event.key === TOKEN_KEY) {
    window.dispatchEvent(new CustomEvent(SESSION_TOKEN_CHANGED_EVENT));
  }
}

const TOKEN_KEY = 'taxguard_session_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
}

export function setStoredToken(token: string, persist = true): void {
  if (typeof window === 'undefined') return;
  if (persist) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearStoredToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // Session expired or invalid
  }

  if (res.status === 204) {
    return {} as T;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || data.error || `HTTP error ${res.status}`);
    (error as any).status = res.status;
    (error as any).code = data.code;
    throw error;
  }
  return data as T;
}

export const api = {
  request,
  get: <T = any>(endpoint: string, options?: RequestInit) => request<T>(endpoint, { method: 'GET', ...options }),
  post: <T = any>(endpoint: string, body?: any, options?: RequestInit) => request<T>(endpoint, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined, ...options }),
  put: <T = any>(endpoint: string, body?: any, options?: RequestInit) => request<T>(endpoint, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined, ...options }),
  patch: <T = any>(endpoint: string, body?: any, options?: RequestInit) => request<T>(endpoint, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined, ...options }),
  delete: <T = any>(endpoint: string, options?: RequestInit) => request<T>(endpoint, { method: 'DELETE', ...options }),
  auth: {
    getMe: () => request('/api/auth/me'),
    login: (credentials: any) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    logout: () => request('/api/auth/logout', { method: 'POST' }),
    supabaseSession: (payload: any) => request('/api/auth/session', { method: 'POST', body: JSON.stringify(payload) }),
  },
  accountant: {
    getDashboard: (signal?: AbortSignal) => request('/api/accountant/dashboard', { signal }),
  },
  admin: {
    getAuditLogs: () => request('/api/admin/audit-logs'),
    getSystemHealth: () => request('/api/health'),
    reassignClient: (payload: any) => request('/api/admin/reassign-client', { method: 'POST', body: JSON.stringify(payload) }),
    setUserStatus: (payload: any) => request('/api/admin/user-status', { method: 'POST', body: JSON.stringify(payload) }),
    updatePlanPrice: (payload: any) => request('/api/admin/update-plan', { method: 'POST', body: JSON.stringify(payload) }),
  },
  bookkeeper: {
    getClients: (signal?: AbortSignal) => request('/api/bookkeeping/clients', { signal }),
    getDashboard: (signal?: AbortSignal) => request('/api/bookkeeping/dashboard', { signal }),
  },
  careers: {
    apply: (payload: any) => request('/api/careers/apply', { method: 'POST', body: JSON.stringify(payload) }),
    getApplicants: () => request('/api/careers/applicants'),
    getJobs: () => request('/api/careers/jobs'),
    updateApplicant: (payload: any) => request('/api/careers/applicant-status', { method: 'POST', body: JSON.stringify(payload) }),
  },
  caseAuthority: {
    activateAiKillSwitch: (payload: any) => request('/api/case-authority/kill-switch', { method: 'POST', body: JSON.stringify(payload) }),
    getAiControlCenter: () => request('/api/ai-governance/control-center'),
    getCase: (id: string) => request(`/api/cases/${id}`),
    getProviderReadiness: () => request('/api/provider-readiness'),
    getStages: () => request('/api/case-authority/stages'),
    listAiKillSwitches: () => request('/api/ai-governance/kill-switches'),
    listDraftReturns: () => request('/api/case-authority/draft-returns'),
    listWorkpapers: () => request('/api/case-authority/workpapers'),
  },
  clientDashboard: {
    createCollectionRequest: (payload: any) => request('/api/collection/request', { method: 'POST', body: JSON.stringify(payload) }),
    read: (signal?: AbortSignal) => request('/api/client-portal/dashboard', { signal }),
    resolveCollectionRequest: (id: string) => request(`/api/collection/request/${id}/resolve`, { method: 'POST' }),
    respond: (payload: any) => request('/api/collection/respond', { method: 'POST', body: JSON.stringify(payload) }),
    saveQuestionnaire: (payload: any) => request('/api/collection/questionnaire', { method: 'POST', body: JSON.stringify(payload) }),
  },
  clientService: {
    conversation: (id: string) => request(`/api/client-service/conversation/${id}`),
    getDashboard: (signal?: AbortSignal) => request('/api/client-service/dashboard', { signal }),
    requestDetail: (id: string) => request(`/api/client-service/requests/${id}`),
    search: (query: string) => request(`/api/client-service/search?q=${encodeURIComponent(query)}`),
  },
  onboarding: {
    getState: () => request('/api/onboarding/state'),
    saveStep: (payload: any) => request('/api/onboarding/step', { method: 'POST', body: JSON.stringify(payload) }),
    submitDossier: (payload: any) => request('/api/onboarding/submit', { method: 'POST', body: JSON.stringify(payload) }),
  },
  practiceManager: {
    getDashboard: (signal?: AbortSignal) => request('/api/practice/dashboard', { signal }),
  },
  profile: {
    getAuthoritative: () => request('/api/profile/authoritative'),
    requestAmendment: (payload: any) => request('/api/profile/amendment', { method: 'POST', body: JSON.stringify(payload) }),
    updateOrdinary: (payload: any) => request('/api/profile/update', { method: 'POST', body: JSON.stringify(payload) }),
  },
  reviewer: {
    decide: (payload: any) => request('/api/reviewer/decision', { method: 'POST', body: JSON.stringify(payload) }),
    getDashboard: (signal?: AbortSignal) => request('/api/reviewer/dashboard', { signal }),
    getWorkspace: (id: string) => request(`/api/reviewer/workspace/${id}`),
  },
  security: {
    runNegativeTests: () => request('/api/security/test', { method: 'POST' }),
  },
  staffAccess: {
    approveMember: (id: string) => request(`/api/staff-access/members/${id}/approve`, { method: 'POST' }),
    approveRecovery: (id: string) => request(`/api/staff-access/recoveries/${id}/approve`, { method: 'POST' }),
    cancelRecovery: (id: string) => request(`/api/staff-access/recoveries/${id}/cancel`, { method: 'POST' }),
    changeMemberStatus: (id: string, status: string) => request(`/api/staff-access/members/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
    completeRecovery: (id: string) => request(`/api/staff-access/recoveries/${id}/complete`, { method: 'POST' }),
    createInvitation: (payload: any) => request('/api/staff-access/invitations', { method: 'POST', body: JSON.stringify(payload) }),
    invitations: (query?: any, signal?: AbortSignal) => request('/api/staff-access/invitations', { signal }),
    members: (query?: any, signal?: AbortSignal) => request('/api/staff-access/members', { signal }),
    recoveries: (query?: any, signal?: AbortSignal) => request('/api/staff-access/recoveries', { signal }),
    recoveryHistory: (id: string) => request(`/api/staff-access/recoveries/${id}/history`),
    requestRecovery: (payload: any) => request('/api/staff-access/recoveries', { method: 'POST', body: JSON.stringify(payload) }),
    retryRecovery: (id: string) => request(`/api/staff-access/recoveries/${id}/retry`, { method: 'POST' }),
    revokeInvitation: (id: string) => request(`/api/staff-access/invitations/${id}/revoke`, { method: 'POST' }),
    revokeMemberSessions: (id: string) => request(`/api/staff-access/members/${id}/revoke-sessions`, { method: 'POST' }),
    revokeOtherSessions: () => request('/api/staff-access/sessions/revoke-others', { method: 'POST' }),
    revokeSession: (id: string) => request(`/api/staff-access/sessions/${id}/revoke`, { method: 'POST' }),
    securityEvents: () => request('/api/staff-access/security-events'),
    sessions: () => request('/api/staff-access/sessions'),
  },
  superAdmin: {
    getSession: () => request('/api/super-admin/session'),
    recordDashboardView: () => request('/api/super-admin/view', { method: 'POST' }),
  },
  taxForms: {
    getCatalog: () => request('/api/tax-forms/catalog'),
  },
};
