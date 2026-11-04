import { INITIAL_USERS, INITIAL_ENGAGEMENTS, INITIAL_DOCUMENTS, INITIAL_APPOINTMENTS, INITIAL_INVOICES, INITIAL_JOBS, INITIAL_AUDIT_LOGS } from '../data/mockData';

export const SESSION_TOKEN_CHANGED_EVENT = 'taxguard:session-token-changed';

export function reconcileSessionStorageEvent(event: StorageEvent): void {
  if (event.key === 'tg_auth_token' || event.key === 'auth_token') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SESSION_TOKEN_CHANGED_EVENT));
    }
  }
}

export function getStoredToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('tg_auth_token') || localStorage.getItem('auth_token');
  }
  return null;
}

export function storeToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('tg_auth_token', token);
    localStorage.setItem('auth_token', token);
    window.dispatchEvent(new CustomEvent(SESSION_TOKEN_CHANGED_EVENT));
  }
}

export function clearStoredToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('tg_auth_token');
    localStorage.removeItem('auth_token');
    window.dispatchEvent(new CustomEvent(SESSION_TOKEN_CHANGED_EVENT));
  }
}

const defaultHeaders = () => {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

async function safeFetch<T>(url: string, options?: RequestInit, fallback?: T): Promise<T> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: { ...defaultHeaders(), ...options?.headers }
    });
    if (res.ok) {
      return (await res.json()) as T;
    }
  } catch {
    // Ignore network failure and fall back
  }
  return fallback as T;
}

export const api = {
  auth: {
    login: async (creds: any) => ({ user: INITIAL_USERS[0], token: 'tok_mock_session' }),
    getCurrentUser: async () => INITIAL_USERS[0],
    logout: async () => { clearStoredToken(); }
  },
  admin: {
    getUsers: async () => INITIAL_USERS,
    getAuditLogs: async () => INITIAL_AUDIT_LOGS,
    updateUserStatus: async (uid: string, status: string) => ({ success: true })
  },
  superAdmin: {
    getSecurityOverview: async () => ({
      mfaEnforcement: true,
      encryptionAtRest: true,
      activeSessions: 3,
      soc2Compliance: 'Passing'
    }),
    rotateTotp: async () => ({ success: true })
  },
  staffAccess: {
    getDirectory: async (q?: any) => ({
      items: INITIAL_USERS.filter(u => u.role !== 'client'),
      total: INITIAL_USERS.filter(u => u.role !== 'client').length,
      page: 1,
      pageSize: 50
    }),
    getSessions: async () => [],
    revokeSession: async () => ({ success: true }),
    getRecoveryQueue: async () => ({ items: [], nextCursor: null, source: 'durable' }),
    submitRecovery: async (input: any) => ({ success: true, requestId: 'req_' + Date.now() }),
    issueInvitation: async (input: any) => ({ success: true, invitationId: 'inv_' + Date.now() }),
    revokeInvitation: async () => ({ success: true }),
    reassignClients: async () => ({ success: true })
  },
  caseAuthority: {
    getMatrix: async () => ({ records: [], status: 'ACTIVE' }),
    getEvaluation: async () => ({ evaluations: [] }),
    getEmergencyStop: async () => ({ engaged: false }),
    triggerEmergencyStop: async () => ({ engaged: true })
  },
  room: {
    getRoom: async (roomId: string) => ({ roomId, status: 'waiting', participants: [] }),
    joinRoom: async () => ({ success: true })
  },
  roomEvent: {
    subscribe: () => () => {}
  },
  clientDashboard: {
    getOverview: async () => ({
      engagements: INITIAL_ENGAGEMENTS,
      documents: INITIAL_DOCUMENTS,
      appointments: INITIAL_APPOINTMENTS,
      invoices: INITIAL_INVOICES
    }),
    getQuestionnaire: async () => ({ answered: 10, total: 25, categories: [] }),
    submitQuestionnaire: async () => ({ success: true })
  },
  profile: {
    getProfile: async () => INITIAL_USERS[0],
    updateProfile: async (data: any) => ({ success: true, profile: { ...INITIAL_USERS[0], ...data } })
  },
  taxForms: {
    getCatalog: async (signal?: AbortSignal) => ({
      federalForms: [
        { id: '1040', formNumber: '1040', officialName: 'U.S. Individual Income Tax Return', groups: ['individual-1040'], taxYears: [2024, 2025], readiness: 'E-File Verified', schedules: ['Schedule A', 'Schedule B', 'Schedule C', 'Schedule D', 'Schedule E', 'Schedule SE'] },
        { id: '1120s', formNumber: '1120-S', officialName: 'U.S. Income Tax Return for an S Corporation', groups: ['s-corporations-1120s'], taxYears: [2024, 2025], readiness: 'E-File Verified', schedules: ['Schedule K-1', 'Form 1125-A', 'Form 8825'] },
        { id: '1065', formNumber: '1065', officialName: 'U.S. Return of Partnership Income', groups: ['partnerships-1065'], taxYears: [2024, 2025], readiness: 'Calculation Certified', schedules: ['Schedule K-1', 'Form 8825'] },
        { id: '1120', formNumber: '1120', officialName: 'U.S. Corporation Income Tax Return', groups: ['c-corporations-1120'], taxYears: [2024, 2025], readiness: 'Field Mapped', schedules: ['Schedule G', 'Schedule J'] }
      ],
      states: [
        { code: 'SC', name: 'South Carolina', agencyName: 'South Carolina Department of Revenue', categories: { 'individual-income': { applicability: 'applies' }, 'corporate-income': { applicability: 'applies' }, 'pass-through-entity': { applicability: 'applies' }, 'sales-and-use': { applicability: 'applies' }, 'franchise-tax': { applicability: 'applies' } } },
        { code: 'NC', name: 'North Carolina', agencyName: 'North Carolina Department of Revenue', categories: { 'individual-income': { applicability: 'applies' }, 'corporate-income': { applicability: 'applies' }, 'pass-through-entity': { applicability: 'applies' }, 'sales-and-use': { applicability: 'applies' }, 'franchise-tax': { applicability: 'applies' } } },
        { code: 'GA', name: 'Georgia', agencyName: 'Georgia Department of Revenue', categories: { 'individual-income': { applicability: 'applies' }, 'corporate-income': { applicability: 'applies' }, 'pass-through-entity': { applicability: 'applies' }, 'sales-and-use': { applicability: 'applies' }, 'franchise-tax': { applicability: 'applies' } } }
      ],
      groups: [
        { id: 'individual-1040', label: 'Form 1040 Individual' },
        { id: 's-corporations-1120s', label: 'Form 1120-S S-Corporation' },
        { id: 'partnerships-1065', label: 'Form 1065 Partnership' },
        { id: 'c-corporations-1120', label: 'Form 1120 C-Corporation' }
      ],
      coreCategories: [
        { id: 'individual-1040', label: 'Individual Income Tax' },
        { id: 's-corporations-1120s', label: 'S-Corporation Returns' }
      ]
    })
  },
  reviewer: {
    getQueue: async () => ({
      pendingReviewCount: 2,
      approvedCount: 14,
      flaggedCount: 1,
      activeCases: []
    })
  },
  accountant: {
    getCases: async () => INITIAL_ENGAGEMENTS,
    getWorkpapers: async () => []
  },
  bookkeeper: {
    getSnapshot: async () => ({
      totalClients: 12,
      unreconciledTransactionsCount: 4,
      pendingPeriodCloses: 1,
      activeFeedsCount: 8,
      clients: []
    })
  },
  clientService: {
    getSnapshot: async () => ({
      openInquiriesCount: 3,
      unassignedRequestsCount: 1,
      slaBreachedCount: 0,
      activeRequests: [],
      recentConversations: []
    })
  },
  practiceManager: {
    getSnapshot: async () => ({
      activeEngagementsTotal: INITIAL_ENGAGEMENTS.length,
      deadlineWarningCount: 1,
      escalationCount: 0,
      teamWorkloadUtilization: 78,
      cases: []
    })
  },
  careers: {
    getJobs: async () => INITIAL_JOBS,
    submitApplication: async (app: any) => ({ success: true })
  },
  onboarding: {
    getStatus: async () => ({ currentStep: 1, isComplete: false, taxYear: 2025 }),
    submitStep: async (step: number, data: any) => ({ success: true })
  },
  security: {
    runAudit: async () => ({ passed: true, checks: [] })
  }
};
