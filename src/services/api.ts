import { createAiGovernanceClient } from './aiGovernanceClient';
import { INITIAL_USERS, INITIAL_ENGAGEMENTS, INITIAL_DOCUMENTS, INITIAL_APPOINTMENTS, INITIAL_INVOICES, INITIAL_JOBS, INITIAL_AUDIT_LOGS, INITIAL_SERVICE_PLANS } from '../data/mockData';

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
    login: async (creds: any, _pass?: string, _code?: string) => ({ user: INITIAL_USERS[0], token: 'tok_mock_session' }),
    getCurrentUser: async () => INITIAL_USERS[0],
    getMe: async () => INITIAL_USERS[0],
    supabaseSession: async (payload: any) => {
      const token = typeof payload === 'string' ? payload : (payload?.accessToken || 'tok_mock_session');
      return {
        token,
        user: INITIAL_USERS[0],
        tenantId: 'tenant_default',
        clientId: 'user_client_1',
        engagementId: 'eng_001',
        taxYear: 2025,
        caseId: 'case_001',
        activeStage: 1 as 1 | 2 | 3,
        stageStates: {},
        resumed: false,
        redirectPage: 'portal',
        onboardingAvailability: { status: 'available' },
        workflow: { activeStage: 1, stage1: { status: 'COMPLETED' } },
        eligibility: { activeStage: 1 }
      };
    },
    logout: async () => { clearStoredToken(); }
  },
  admin: {
    getUsers: async () => INITIAL_USERS,
    getAuditLogs: async () => INITIAL_AUDIT_LOGS,
    updateUserStatus: async (uid: string, status: string) => ({ success: true }),
    updatePlanPrice: async (planId: string, newPrice: number, _changeReason?: string, _currency?: string) => {
      const target = INITIAL_SERVICE_PLANS.find(p => p.id === planId) || INITIAL_SERVICE_PLANS[0];
      return {
        success: true,
        message: 'Plan price updated.',
        plan: { ...target, id: planId, price: newPrice }
      };
    },
    setUserStatus: async (userId: string, nextStatus: string, _reason?: string, _confirmation?: boolean) => {
      const target = INITIAL_USERS.find(u => u.id === userId) || INITIAL_USERS[0];
      return {
        success: true,
        message: 'User status updated.',
        user: { ...target, id: userId, status: nextStatus as any }
      };
    },
    reassignClient: async (clientId: string, accountantId: string, reviewerId?: string, _reason?: string) => ({
      success: true,
      message: 'Client reassigned successfully.',
      client: { id: clientId, accountantId, reviewerId }
    })
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
    reassignClients: async () => ({ success: true }),
    members: async (_q?: any, _signal?: AbortSignal) => ({ items: [], nextCursor: null, source: 'durable' }),
    invitations: async (_q?: any, _signal?: AbortSignal) => ({ items: [], nextCursor: null, source: 'durable' }),
    recoveries: async (_q?: any, _signal?: AbortSignal) => ({ items: [], nextCursor: null, source: 'durable' })
  },
  caseAuthority: {
    ...createAiGovernanceClient(getStoredToken),
    getMatrix: async () => ({ records: [], status: 'ACTIVE' }),
    getEvaluation: async () => ({ evaluations: [] }),
    getEmergencyStop: async () => ({ engaged: false }),
    triggerEmergencyStop: async () => ({ engaged: true }),
    getProviderReadiness: async (_signal?: AbortSignal) => ({ providers: [] })
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
    submitQuestionnaire: async () => ({ success: true }),
    read: async <T = any>(resource?: string, clientId?: string, taxYear?: number, _signal?: AbortSignal): Promise<T> => {
      const cId = clientId || 'user_client_1';
      const year = taxYear || 2025;
      if (resource === 'requests') {
        return { requests: [] } as unknown as T;
      }
      if (resource === 'requirements') {
        return { requirements: [] } as unknown as T;
      }
      return {
        clientId: cId,
        tenantId: 'tenant_default',
        taxYear: year,
        questionnaire: {
          id: 'q_' + cId,
          clientId: cId,
          taxYear: year,
          tenantId: 'tenant_default',
          status: 'completed',
          answers: {},
          updatedAt: new Date().toISOString()
        }
      } as unknown as T;
    }
  },
  profile: {
    getProfile: async () => INITIAL_USERS[0],
    getAuthoritative: async (_profileData?: any, _signal?: AbortSignal) => ({
      ...INITIAL_USERS[0],
      clientId: INITIAL_USERS[0].clientId || INITIAL_USERS[0].id,
      tenantId: INITIAL_USERS[0].tenantId || 'tenant_default'
    }),
    updateProfile: async (data: any) => ({ success: true, profile: { ...INITIAL_USERS[0], ...data } }),
    updateOrdinary: async (data: any) => ({ success: true, profile: { ...INITIAL_USERS[0], ...data } }),
    requestAmendment: async (_data: any) => ({ success: true, requestId: 'amd_' + Date.now() })
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
      ],
      catalogTaxYears: [2024, 2025],
      stateCategories: [],
      preparationPipeline: []
    } as any)
  },
  reviewer: {
    getQueue: async () => ({
      pendingReviewCount: 2,
      approvedCount: 14,
      flaggedCount: 1,
      activeCases: []
    }),
    getDashboard: async (_arg1?: AbortSignal | number, _arg2?: AbortSignal) => ({ cases: [] }),
    getWorkspace: async (caseIdOrScope: any, _signal?: AbortSignal) => {
      const scope = typeof caseIdOrScope === 'object' && caseIdOrScope !== null
        ? caseIdOrScope
        : { tenantId: 'tenant_default', clientId: 'user_client_1', engagementId: 'eng_001', taxYear: 2025 };
      return {
        scope,
        decisionsAvailable: false,
        independentReviewer: false,
        case: { reviewerUid: 'user_reviewer', preparerUid: 'user_accountant', status: 'ACTIVE', activeStage: 1, openExceptions: 0 }
      };
    },
    decide: async (..._args: any[]) => ({ success: true, version: 1 })
  },
  accountant: {
    getCases: async () => INITIAL_ENGAGEMENTS,
    getWorkpapers: async () => [],
    getDashboard: async (_arg1?: AbortSignal | number, _arg2?: AbortSignal) => ({
      cases: [
        {
          id: 'case_001',
          tenantId: 'tenant_default',
          clientId: 'user_client_1',
          clientName: 'Michael Perotti',
          engagementId: 'eng_001',
          authorityClientId: 'user_client_1',
          taxYear: 2025,
          status: 'in_preparation',
          priority: 'normal',
          dueDate: '2026-04-15',
          serviceTitle: 'Form 1040 Individual Income Tax',
          documents: [],
          activeStage: 4
        }
      ],
      workpapers: [],
      unavailableFields: []
    })
  },
  bookkeeper: {
    getSnapshot: async () => ({
      totalClients: 12,
      unreconciledTransactionsCount: 4,
      pendingPeriodCloses: 1,
      activeFeedsCount: 8,
      clients: []
    }),
    getDashboard: async (client?: string, year?: number, period?: string, _signal?: AbortSignal) => ({
      scope: {
        tenantId: 'tenant_default',
        clientId: client || 'user_client_1',
        taxYear: year || 2025,
        periodId: period
      },
      tenantId: 'tenant_default',
      transactions: [],
      reconciliations: []
    }),
    getClients: async (_signal?: AbortSignal) => ({
      tenantId: 'tenant_default',
      clientIds: ['user_client_1'],
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
    }),
    getDashboard: async (_year?: number, _signal?: AbortSignal) => ({
      tenantId: 'tenant_default',
      cases: [],
      requests: [],
      followUps: [],
      threads: [],
      escalations: []
    }),
    conversation: async (id: string, caseId?: string, _taxYear?: number, _signal?: AbortSignal) => ({
      id,
      threadId: id,
      tenantId: 'tenant_default',
      caseKey: caseId || '',
      unread: 0,
      messages: []
    }),
    requestDetail: async (id: string, caseId?: string, _taxYear?: number, _signal?: AbortSignal) => ({
      id,
      requestId: id,
      tenantId: 'tenant_default',
      caseKey: caseId || '',
      status: 'OPEN'
    }),
    search: async (_q: string, _year?: number, _signal?: AbortSignal) => ({
      tenantId: 'tenant_default',
      matches: [],
      results: []
    })
  },
  practiceManager: {
    getSnapshot: async () => ({
      activeEngagementsTotal: INITIAL_ENGAGEMENTS.length,
      deadlineWarningCount: 1,
      escalationCount: 0,
      teamWorkloadUtilization: 78,
      cases: []
    }),
    getDashboard: async (_year?: number, _signal?: AbortSignal) => ({ tenantId: 'tenant_default', cases: [], deadlines: [], staff: [] })
  },
  careers: {
    getJobs: async () => Object.assign([...INITIAL_JOBS], { jobs: INITIAL_JOBS }),
    getApplicants: async () => [],
    submitApplication: async (_app: any) => ({ success: true }),
    apply: async (_app: any) => ({ success: true, applicantId: 'app_' + Date.now(), message: 'Application submitted.' }),
    updateApplicant: async (appId: string, update: any) => ({
      success: true,
      applicant: { id: appId, ...update }
    })
  },
  onboarding: {
    getStatus: async () => ({ currentStep: 1, isComplete: false, taxYear: 2025 }),
    getState: async () => ({ currentStep: 1, isComplete: false, taxYear: 2025 }),
    submitStep: async (step: number, _data: any) => ({ success: true }),
    saveStep: async (stepData: any) => ({
      success: true,
      state: { step: 1, totalSteps: 5, completed: false, data: stepData },
      progress: {
        percentComplete: 20,
        missingRequirements: [],
        nextAction: 'Continue'
      }
    }),
    submitDossier: async () => ({
      success: true,
      state: { step: 5, totalSteps: 5, completed: true, data: {} }
    })
  },
  security: {
    runAudit: async () => ({ passed: true, checks: [] }),
    runNegativeTests: async () => ({
      passed: true,
      results: [
        { id: 'sec_1', name: 'SQL Injection Prevention', status: 'pass', message: 'Parameterized queries verified', timestamp: new Date().toISOString() },
        { id: 'sec_2', name: 'Cross-Tenant Isolation', status: 'pass', message: 'Tenant boundary enforcement verified', timestamp: new Date().toISOString() }
      ]
    })
  }
};
