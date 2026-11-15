import {
  INITIAL_USERS,
  INITIAL_ENGAGEMENTS,
  INITIAL_DOCUMENTS,
  INITIAL_APPOINTMENTS,
  INITIAL_INVOICES,
  INITIAL_JOBS,
  INITIAL_AUDIT_LOGS,
  INITIAL_SERVICE_PLANS
} from '../data/mockData';
import type { User, AuditLog, JobListing, Applicant, SecurityTestResult } from '../types';
import type { BookkeeperSnapshot } from '../types/bookkeeperDashboard';
import type { ReviewerSnapshot } from '../types/reviewerDashboard';
import type {
  ClientServiceSnapshot,
  ClientServiceConversation,
  ClientServiceRequestDetail,
  ClientServiceCase
} from '../types/clientServiceDashboard';

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

export const api = {
  auth: {
    login: async (_creds: any, _pass?: string, _code?: string) => ({ user: INITIAL_USERS[0], token: 'tok_mock_session' }),
    getCurrentUser: async () => INITIAL_USERS[0],
    getMe: async (): Promise<{ user: User }> => ({ user: INITIAL_USERS[0] }),
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
    getUsers: async (): Promise<User[]> => INITIAL_USERS,
    getAuditLogs: async (): Promise<{ auditLogs: AuditLog[] }> => ({ auditLogs: INITIAL_AUDIT_LOGS }),
    getSystemHealth: async () => ({
      healthStatus: 'HEALTHY',
      serverTimestamp: new Date().toISOString(),
      metrics: { failedLoginAttemptsTracked: 0 }
    }),
    updateUserStatus: async (_uid: string, _status: string) => ({ success: true }),
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
    rotateTotp: async () => ({ success: true }),
    recordDashboardView: async (_dashboard: string) => ({ success: true }),
    getSession: async () => ({
      session: {
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        idleTimeoutMinutes: 30,
        absoluteExpiresAt: new Date(Date.now() + 28800_000).toISOString()
      },
      secondFactor: 'TOTP'
    })
  },
  staffAccess: {
    getDirectory: async (_q?: any) => ({
      items: INITIAL_USERS.filter(u => u.role !== 'client'),
      total: INITIAL_USERS.filter(u => u.role !== 'client').length,
      page: 1,
      pageSize: 50
    }),
    getSessions: async () => [] as any[],
    sessions: async (_signal?: AbortSignal) => ({
      source: 'durable',
      items: [] as any[]
    }),
    revokeSession: async (_sessionId?: string, _signal?: AbortSignal) => ({ success: true, revoked: true }),
    revokeOtherSessions: async (_signal?: AbortSignal) => ({ revokedSessions: 0 }),
    revokeMemberSessions: async (_uid: string, _reason: string, _signal?: AbortSignal) => ({ revokedSessions: 0 }),
    getRecoveryQueue: async () => ({ items: [] as any[], nextCursor: null, source: 'durable' }),
    submitRecovery: async (_input: any) => ({ success: true, requestId: 'req_' + Date.now() }),
    requestRecovery: async (input: any, _signal?: AbortSignal) => ({
      requestId: input?.requestId || 'req_' + Date.now(),
      targetUid: input?.targetUid || '',
      status: 'pending_approval'
    }),
    approveRecovery: async (requestId: string, _signal?: AbortSignal) => ({ requestId, status: 'approved' }),
    completeRecovery: async (requestId: string, _signal?: AbortSignal) => ({ requestId, status: 'completed' }),
    cancelRecovery: async (requestId: string, _reason: string, _signal?: AbortSignal) => ({ requestId, status: 'cancelled' }),
    retryRecovery: async (requestId: string, _signal?: AbortSignal) => ({ requestId, status: 'pending' }),
    recoveryHistory: async (requestId: string, _signal?: AbortSignal) => ({
      requestId,
      items: [] as Array<{ action: string; actorUid: string; actorRole: string | null; at: string; details: Record<string, unknown> }>
    }),
    issueInvitation: async (_input: any) => ({ success: true, invitationId: 'inv_' + Date.now() }),
    createInvitation: async (_payload: any, _signal?: AbortSignal) => ({
      id: 'inv_' + Date.now(),
      token: '0'.repeat(64),
      delivery: 'administrator_handoff' as const,
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      status: 'pending'
    }),
    revokeInvitation: async (id?: string, _signal?: AbortSignal) => ({ id: id || '', success: true, status: 'revoked' }),
    approveMember: async (uid: string, _signal?: AbortSignal) => ({ uid, status: 'active' }),
    changeMemberStatus: async (uid: string, action: string, _reason: string, _signal?: AbortSignal) => ({
      uid,
      status: action === 'suspend' ? 'suspended' : action === 'deactivate' ? 'disabled' : 'active'
    }),
    reassignClients: async () => ({ success: true }),
    members: async (_q?: any, _signal?: AbortSignal) => ({ items: [] as any[], nextCursor: null, source: 'durable' }),
    invitations: async (_q?: any, _signal?: AbortSignal) => ({ items: [] as any[], nextCursor: null, source: 'durable' }),
    recoveries: async (_q?: any, _signal?: AbortSignal) => ({ items: [] as any[], nextCursor: null, source: 'durable' }),
    securityEvents: async (_signal?: AbortSignal) => ({
      items: [] as Array<{ action: string; actorUid: string; actorRole: string | null; at: string; byAdministrator: boolean; details: Record<string, unknown> }>
    })
  },
  caseAuthority: {
    getMatrix: async () => ({ records: [] as any[], status: 'ACTIVE' }),
    getEvaluation: async () => ({ evaluations: [] as any[] }),
    getEmergencyStop: async () => ({ engaged: false }),
    triggerEmergencyStop: async () => ({ engaged: true }),
    getProviderReadiness: async (_signal?: AbortSignal) => ({ providers: [] as any[] }),
    getAiControlCenter: async (_view: string, _query?: Record<string, string>, _signal?: AbortSignal): Promise<Record<string, any>> => ({
      agents: [],
      items: [],
      by_agent: [],
      suites: [],
      runs: [],
      sections: [],
      modules: [],
      lifecycle: [],
      governance: { agents_by_status: {}, runs_by_status: {}, global_stop: false, active_stops: 0, security_events_24h: 0 },
      knowledge: { status: 'UNAVAILABLE', code: 'OFFLINE' },
      inference: { status: 'UNAVAILABLE' },
      checked_at: new Date().toISOString(),
      global_stop: false,
      scoped_stops: [],
      material_actions: 'BLOCKED',
      framework: 'NOT_APPLIED',
      activation: 'NOT_PERFORMED_HERE',
      dimensions: []
    }),
    getAiCommandCenterMasterPlanImage: async (_signal?: AbortSignal): Promise<Blob> =>
      new Blob([], { type: 'image/png' }),
    listAiKillSwitches: async (_signal?: AbortSignal) => ({ kill_switches: [] as any[] }),
    activateAiKillSwitch: async (payload: any) => ({
      switch_id: 'sw_' + Date.now(),
      target: payload?.agent_id || payload?.tool_id || payload?.scope || 'GLOBAL',
      enabled: true,
      already_active: false
    })
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
    saveQuestionnaire: async (_clientId: string, _taxYear: number, _answers: any, _revision?: number, _engagementId?: string) => ({
      success: true
    }),
    respond: async (_taxYear: number, _requestId: string, _content: string, _engagementId?: string) => ({
      success: true
    }),
    createCollectionRequest: async (_clientId: string, _taxYear: number, _engagementId: string, _payload: any, _idempotencyKey?: string) => ({
      success: true
    }),
    resolveCollectionRequest: async (_clientId: string, _taxYear: number, _engagementId: string, _requestId: string, _rowVersion?: number) => ({
      success: true
    }),
    read: async <T = any>(
      resource?: string,
      clientId?: string,
      taxYear?: number,
      _signal?: AbortSignal,
      _engagementId?: string
    ): Promise<T> => {
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
          version: 1,
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
    getCatalog: async (_signal?: AbortSignal) => ({
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
    getDashboard: async (_arg1?: AbortSignal | number, _arg2?: AbortSignal) => ({ cases: [] as any[] }),
    getWorkspace: async (caseIdOrScope: any, _signal?: AbortSignal): Promise<ReviewerSnapshot> => {
      const scope = typeof caseIdOrScope === 'object' && caseIdOrScope !== null
        ? caseIdOrScope
        : { tenantId: 'tenant_default', clientId: 'user_client_1', engagementId: 'eng_001', taxYear: 2025 };
      return {
        scope,
        decisionsAvailable: false,
        independentReviewer: false,
        case: { reviewerUid: 'user_reviewer', preparerUid: 'user_accountant', status: 'ACTIVE', activeStage: 1, openExceptions: 0 },
        returns: [],
        exceptions: [],
        resolutions: [],
        documents: [],
        reconciliations: [],
        stages: [],
        records: [],
        extractedFields: [],
        history: [],
        workpapers: [],
        aiFindings: []
      };
    },
    decide: async (..._args: any[]) => ({ success: true, version: 1 })
  },
  accountant: {
    getCases: async () => INITIAL_ENGAGEMENTS,
    getWorkpapers: async () => [] as any[],
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
    getDashboard: async (client?: string, year?: number, period?: string, _signal?: AbortSignal): Promise<BookkeeperSnapshot> => ({
      scope: {
        tenantId: 'tenant_default',
        clientId: client || 'user_client_1',
        taxYear: year || 2025,
        periodId: period
      },
      periods: [],
      transactions: [],
      reconciliations: [],
      accounts: [],
      journals: []
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
    getDashboard: async (_year?: number, _signal?: AbortSignal): Promise<ClientServiceSnapshot> => ({
      tenantId: 'tenant_default',
      cases: [],
      requests: [],
      followUps: [],
      threads: [],
      escalations: []
    }),
    conversation: async (id: string, caseId?: string, _taxYear?: number, _signal?: AbortSignal): Promise<ClientServiceConversation> => ({
      tenantId: 'tenant_default',
      caseKey: caseId || '',
      threadId: id,
      messages: []
    }),
    requestDetail: async (id: string, caseId?: string, _taxYear?: number, _signal?: AbortSignal): Promise<ClientServiceRequestDetail> => ({
      tenantId: 'tenant_default',
      caseKey: caseId || '',
      requestId: id,
      title: 'Information Request',
      description: '',
      status: 'OPEN'
    }),
    search: async (_q: string, _year?: number, _signal?: AbortSignal): Promise<{
      tenantId: string;
      matches: Omit<ClientServiceCase, 'documents'>[];
      results: any[];
    }> => ({
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
    getJobs: async () => Object.assign([...INITIAL_JOBS], { jobs: INITIAL_JOBS }) as JobListing[] & { jobs: JobListing[] },
    getApplicants: async (): Promise<{ applicants: Applicant[] }> => ({ applicants: [] }),
    submitApplication: async (_app: any) => ({ success: true }),
    apply: async (_app: any) => ({ success: true, applicantId: 'app_' + Date.now(), message: 'Application submitted.' }),
    updateApplicant: async (appId: string, update: any) => ({
      success: true,
      applicant: { id: appId, ...update }
    })
  },
  onboarding: {
    getStatus: async () => ({ currentStep: 1, isComplete: false, taxYear: 2025 }),
    getState: async () => ({
      state: { currentStep: 1, completed: false, status: 'IN_PROGRESS', data: {} },
      progress: { percentComplete: 20, missingRequirements: [] as string[], nextAction: 'Continue' }
    }),
    submitStep: async (step: number, _data: any) => ({ success: true, nextStep: step + 1 }),
    saveStep: async (stepData: any) => ({
      success: true,
      state: { step: 1, totalSteps: 5, completed: false, data: stepData },
      progress: {
        percentComplete: 20,
        missingRequirements: [] as string[],
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
    runNegativeTests: async (): Promise<{ passed: boolean; results: SecurityTestResult[] }> => ({
      passed: true,
      results: [
        { id: 'sec_1', name: 'SQL Injection Prevention', passed: true, status: 'pass', message: 'Parameterized queries verified', timestamp: new Date().toISOString() },
        { id: 'sec_2', name: 'Cross-Tenant Isolation', passed: true, status: 'pass', message: 'Tenant boundary enforcement verified', timestamp: new Date().toISOString() }
      ]
    })
  }
};
