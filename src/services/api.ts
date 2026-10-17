import type { StaffRecoveryQuery, StaffRecoveryPage, StaffRecoveryRequestInput, StaffRecoveryMutationResult } from '../types/staffRecovery';
import type { StaffDirectoryQuery, StaffDirectoryPage, StaffMemberRecord, StaffInvitationRecord, StaffInvitationIssueInput, StaffInvitationIssueResult, StaffMembershipAction } from '../types/staffAccess';
import type { DurableSessionList, SessionRevocationReason } from '../types/staffSessions';
import { isStaffIdentityDevelopmentConfigured } from '../supabase/config';
/**
 * Enterprise API Client for A/R Tax Services, LLC
 * Bridges client React interface to the secure Express + Vite backend.
 * Handles bearer token injection, automated error decoding, and real-time state synchronization.
 */

import { 
  User, 
  Engagement, 
  DocumentItem, 
  Appointment, 
  Invoice, 
  AccountingConnection, 
  Message, 
  JobListing, 
  Applicant, 
  AuditLog,
  OnboardingState,
  JournalEntryDraft,
  LegalCoordinationRecord,
  SecurityTestResult,
  ClientAccountantBinding,
  AccountantProfile,
  AccountingWorkflowTask,
  DocumentRequest,
  ReassignmentRequest,
  DetailedAccountingIntegration
} from '../types';
import { apiEndpoint } from '../config/apiEndpoint';

const TOKEN_KEY = 'artax_session_token';
let memoryToken: string | null = null;
let memoryAuthoritative = false;
const tokenStores = ['localStorage', 'sessionStorage'] as const;
const tokenKeys = [TOKEN_KEY, 'token'];

export function getStoredToken(): string | null {
  // A failed write/removal must not resurrect an older persisted identity.
  if (memoryAuthoritative) return memoryToken;
  for (const key of tokenKeys) for (const store of tokenStores) {
    try {
      const token = globalThis[store].getItem(key);
      if (token) return token;
    } catch {
      // One restricted store must not prevent reading the other store.
    }
  }
  return memoryToken;
}

export function setStoredToken(token: string) {
  memoryToken = token;
  memoryAuthoritative = false;
  for (const key of tokenKeys) for (const store of tokenStores) {
    try { globalThis[store].setItem(key, token); }
    catch { memoryAuthoritative = true; }
  }
}

export function clearStoredToken() {
  memoryToken = null;
  memoryAuthoritative = true;
  for (const key of tokenKeys) for (const store of tokenStores) {
    try { globalThis[store].removeItem(key); }
    catch { /* Session stays cleared even when persistent storage is restricted. */ }
  }
}
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-session-token'] = token;
  }

const response = await fetch(apiEndpoint(endpoint), {
    ...options,
    headers
  });

  const data = await response.json().catch(() => undefined);
  if (getStoredToken() !== token) {
    const err = new Error('The authenticated session changed before this response completed.') as Error & {
      code?: string;
    };
    err.code = 'SESSION_CHANGED';
    throw err;
  }

  if (!response.ok) {
    const staffMfaRequired = response.status === 403 && (data as any)?.code === 'STAFF_MFA_REQUIRED';
    if ((response.status === 401 || staffMfaRequired) && token) {
      clearStoredToken();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('taxguard:session-expired'));
    }
    const errorData = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    let errorMsg = errorData.error || errorData.message;
    if (response.status === 405) {
      console.error('[TaxGuard API] HTTP 405 Method Not Allowed.');
      errorMsg = 'We could not securely connect to the TaxGuard authentication service. Please try again or contact support.';
    } else if (!errorMsg) {
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        console.error(`[TaxGuard API] Service unavailable (${response.status}).`);
        errorMsg = 'The TaxGuard service is temporarily unavailable. Please try again shortly or contact support.';
      } else {
        errorMsg = `We could not securely connect to the TaxGuard service (${response.status}). Please try again or contact support.`;
      }
    }
    const err = new Error(errorMsg) as any;
    err.status = response.status;
    err.code = errorData.code || (response.status === 405 ? 'METHOD_NOT_ALLOWED' : undefined);
    err.data = errorData;
    // Local diagnostics only: correlates a refused request with its server log line.
    err.requestId = response.headers?.get?.('x-taxguard-request-id') || undefined;
    throw err;
  }

  if (response.status === 204) return undefined as T;
  if (data === undefined || data === null || typeof data !== 'object') {
    const err = new Error('The TaxGuard service returned an invalid response. Please try again or contact support.') as Error & { code: string; status: number };
    err.code = 'INVALID_API_RESPONSE'; err.status = response.status;
    throw err;
  }
  return data as T;
}

/** New staff management stays development-only and never targets the protected public API. */
function staffAccessRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const denied = (code: string, status: number) => Promise.reject(Object.assign(new Error('Staff management is unavailable for this session or environment.'), { code, status }));
  if (!getStoredToken()) return denied('AUTH_REQUIRED', 401);
  if (!isStaffIdentityDevelopmentConfigured()) return denied('STAFF_ACCESS_DEVELOPMENT_UNAVAILABLE', 503);
  try {
    const target = new URL(apiEndpoint(endpoint), typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1');
    if (['api.artaxserv.com','artaxserv.com','www.artaxserv.com'].includes(target.hostname)) return denied('STAFF_ACCESS_DEVELOPMENT_UNAVAILABLE', 503);
  } catch { return denied('STAFF_ACCESS_DEVELOPMENT_UNAVAILABLE', 503); }
  return request<T>(endpoint, { cache: 'no-store', credentials: 'omit', ...options });
}
function staffDirectoryQuery(query: StaffDirectoryQuery | StaffRecoveryQuery): string {
  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.status !== undefined) params.set('status', query.status);
  if (query.cursor !== undefined) params.set('cursor', query.cursor);
  const suffix = params.toString(); return suffix ? '?' + suffix : '';
}

export const api = {
  staffAccess: {
    recoveries: (query: StaffRecoveryQuery = {}, signal?: AbortSignal) => staffAccessRequest<StaffRecoveryPage>('/api/staff-access/mfa-recoveries' + staffDirectoryQuery(query), { method: 'GET', signal }),
    requestRecovery: (input: StaffRecoveryRequestInput, signal?: AbortSignal) => staffAccessRequest<StaffRecoveryMutationResult>('/api/staff-access/mfa-recoveries', { method: 'POST', body: JSON.stringify(input), signal }),
    approveRecovery: (requestId: string, signal?: AbortSignal) => staffAccessRequest<StaffRecoveryMutationResult>('/api/staff-access/mfa-recoveries/' + encodeURIComponent(requestId) + '/approve', { method: 'POST', signal }),
    // Proposal 034/037: completion, cancellation, failed-reset re-queue and audit history.
    completeRecovery: (requestId: string, signal?: AbortSignal) => staffAccessRequest<{requestId: string; targetUid: string; status: 'completed'; resumed: boolean}>('/api/staff-access/mfa-recoveries/' + encodeURIComponent(requestId) + '/complete', { method: 'POST', signal }),
    cancelRecovery: (requestId: string, reason: string, signal?: AbortSignal) => staffAccessRequest<{requestId: string; targetUid: string; status: 'cancelled'}>('/api/staff-access/mfa-recoveries/' + encodeURIComponent(requestId) + '/cancel', { method: 'POST', body: JSON.stringify({reason}), signal }),
    retryRecovery: (requestId: string, signal?: AbortSignal) => staffAccessRequest<{jobId: string; status: 'pending'}>('/api/staff-access/mfa-recoveries/' + encodeURIComponent(requestId) + '/retry', { method: 'POST', signal }),
    recoveryHistory: (requestId: string, signal?: AbortSignal) => staffAccessRequest<{requestId: string; targetUid: string; items: Array<{action: string; actorUid: string; actorRole: string | null; at: string; details: Record<string, unknown>}>}>('/api/staff-access/mfa-recoveries/' + encodeURIComponent(requestId) + '/history', { method: 'GET', signal }),
    sessions: (signal?: AbortSignal) => staffAccessRequest<DurableSessionList>('/api/staff-access/sessions', { method: 'GET', signal }),
    securityEvents: (signal?: AbortSignal) => staffAccessRequest<{items: Array<{action: string; actorUid: string; actorRole: string | null; at: string; byAdministrator: boolean; details: Record<string, unknown>}>}>('/api/staff-access/sessions/events', { method: 'GET', signal }),
    revokeSession: (sessionId: string, signal?: AbortSignal) => staffAccessRequest<{revoked: boolean}>('/api/staff-access/sessions/' + encodeURIComponent(sessionId) + '/revoke', { method: 'POST', signal }),
    revokeOtherSessions: (signal?: AbortSignal) => staffAccessRequest<{revokedSessions: number}>('/api/staff-access/sessions/revoke-others', { method: 'POST', signal }),
    revokeMemberSessions: (uid: string, reasonCategory: SessionRevocationReason, signal?: AbortSignal) => staffAccessRequest<{revokedSessions: number}>('/api/staff-access/members/' + encodeURIComponent(uid) + '/sessions/revoke', { method: 'POST', body: JSON.stringify({reasonCategory}), signal }),
    members: (query: StaffDirectoryQuery = {}, signal?: AbortSignal) => staffAccessRequest<StaffDirectoryPage<StaffMemberRecord>>('/api/staff-access/members' + staffDirectoryQuery(query), { method: 'GET', signal }),
    invitations: (query: StaffDirectoryQuery = {}, signal?: AbortSignal) => staffAccessRequest<StaffDirectoryPage<StaffInvitationRecord>>('/api/staff-access/invitations' + staffDirectoryQuery(query), { method: 'GET', signal }),
    createInvitation: (input: StaffInvitationIssueInput, signal?: AbortSignal) => staffAccessRequest<StaffInvitationIssueResult>('/api/staff-access/invitations', { method: 'POST', body: JSON.stringify(input), signal }),
    revokeInvitation: (id: string, signal?: AbortSignal) => staffAccessRequest<{status: 'revoked'}>('/api/staff-access/invitations/' + encodeURIComponent(id) + '/revoke', { method: 'POST', signal }),
    approveMember: (uid: string, signal?: AbortSignal) => staffAccessRequest<{status: 'active'}>('/api/staff-access/members/' + encodeURIComponent(uid) + '/approve', { method: 'POST', signal }),
    changeMemberStatus: (uid: string, action: StaffMembershipAction, reason: string, signal?: AbortSignal) => staffAccessRequest<{status: string; revokedSessions: number}>('/api/staff-access/members/' + encodeURIComponent(uid) + '/status', { method: 'POST', body: JSON.stringify({action, reason}), signal }),
  },
  // Read-only Gate 3 adapter. Existing server authorization is unchanged.
  clientDashboard: {
    saveQuestionnaire: (clientId: string, taxYear: number, answers: unknown,revision=0,engagementId?:string) => request<{ success: boolean }>(`/api/stage-two-three/questionnaire/${taxYear}`, { method: 'POST',headers:{'Idempotency-Key':'collection-'+globalThis.crypto.randomUUID()}, body: JSON.stringify({ clientId, answers,revision,engagementId }) }),
    respond: async (taxYear: number, requestId: string, message: string,engagementId?:string) => {
      const token=getStoredToken();const record=await request<any>(`/api/stage-two-three/requests/${taxYear}/${encodeURIComponent(requestId)}`+(engagementId?'?engagementId='+encodeURIComponent(engagementId):''));
      if(getStoredToken()!==token)throw new Error('SESSION_CHANGED');if(!record||!Number.isInteger(record.rowVersion))throw new Error('COLLECTION_REQUEST_NOT_FOUND');
      return request<{success:boolean}>(`/api/stage-two-three/requests/${taxYear}/${encodeURIComponent(requestId)}/respond`,{method:'POST',headers:{'Idempotency-Key':'collection-reply-'+globalThis.crypto.randomUUID()},body:JSON.stringify({message,rowVersion:record.rowVersion,engagementId:record.engagementId})});
    },
    createCollectionRequest:(clientId:string,taxYear:number,engagementId:string,input:{title:string;message:string;requestType:'CLARIFICATION'|'AMENDMENT'},key:string)=>request<any>(`/api/stage-two-three/requests/${taxYear}`,{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify({clientId,engagementId,...input})}),
    resolveCollectionRequest:(clientId:string,taxYear:number,engagementId:string,requestId:string,rowVersion:number)=>request<any>(`/api/stage-two-three/requests/${taxYear}/${encodeURIComponent(requestId)}/resolve`,{method:'POST',body:JSON.stringify({clientId,engagementId,rowVersion})}),
    // Documents, engagements, messages, appointments and invoices come from the durable vault,
    // client-portal, communications, scheduling and billing APIs (useClientDashboardData).
    read: <T>(resource: 'questionnaire' | 'requirements' | 'requests', clientId: string, taxYear: number, signal?: AbortSignal,engagementId?:string) => {
      if (!getStoredToken()) return Promise.reject(new Error('Authenticated session required.'));
      const scope = `?clientId=${encodeURIComponent(clientId)}`+(engagementId?'&engagementId='+encodeURIComponent(engagementId):'');
      const endpoints = {
        questionnaire: `/api/stage-two-three/questionnaire/${taxYear}${scope}`,
        requirements: `/api/stage-two-three/requirements/${taxYear}${scope}`,
        requests: `/api/stage-two-three/requests/${taxYear}${scope}`,
      };
      if(resource!=='requests')return request<T>(endpoints[resource], { method: 'GET', signal });
      return (async()=>{const token=getStoredToken(),items:any[]=[],seen=new Set<string>();let after:string|null=null,first:any;
        for(let page=0;page<20;page++){
          if(getStoredToken()!==token)throw new Error('SESSION_CHANGED');
          const result=await request<any>(endpoints.requests+(after?'&after='+encodeURIComponent(after):''),{method:'GET',signal});
          if(!result||result.clientId!==clientId||result.taxYear!==taxYear||!Array.isArray(result.requests)||result.requests.length>100||(result.nextCursor!==null&&typeof result.nextCursor!=='string')||(first&&result.tenantId!==first.tenantId))throw new Error('COLLECTION_RESPONSE_INVALID');
          first??=result;for(const row of result.requests){if(!row||typeof row.requestId!=='string'||seen.has(row.requestId))throw new Error('COLLECTION_RESPONSE_INVALID');seen.add(row.requestId);items.push(row);}
          after=result.nextCursor;if(!after)return {...first,requests:items,nextCursor:null} as T;
        }throw new Error('COLLECTION_PAGE_LIMIT');
      })();
    },
  },
  // Authentication & Session
  auth: {
    login: async (email: string, password: string, mfaCode?: string) => {
      const res = await request<{ token?: string; user?: User; mfaRequired?: boolean; message?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, mfaCode })
      });
      if (res.token) {
        setStoredToken(res.token);
      }
      return res;
    },

    register: async (payload: { name: string; email: string; password: string; phone?: string; companyName?: string; clientType?: 'individual' | 'business' }) => {
      const res = await request<{ message: string; token: string; user: User; verificationTokenSimulated?: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.token) {
        setStoredToken(res.token);
      }
      return res;
    },

    supabaseSession: async (payload: {
      accessToken: string;
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
        setStoredToken(res.token);
      }

      return res;
    },

    getMe: async () => {
      return request<{ user: User }>('/api/auth/me');
    },

    logout: async () => {
      const token = getStoredToken();
      try {
        await request('/api/auth/logout', { method: 'POST' });
      } finally {
        // A delayed logout must not clear a newer authenticated session.
        if (getStoredToken() === token) clearStoredToken();
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
        setStoredToken(res.token);
      }
      return res;
    }
  },

  // 15-Step Client Onboarding
  onboarding: {
    getState: async () => {
      return request<{ state: OnboardingState; progress: { percentComplete: number; missingRequirements: string[]; nextAction: string } }>('/api/onboarding');
    },

    saveStep: async (stepData: Partial<OnboardingState>) => {
      return request<{ message: string; state: OnboardingState; progress: any }>('/api/onboarding/save-step', {
        method: 'POST',
        body: JSON.stringify(stepData)
      });
    },

    submitDossier: async () => {
      return request<{ message: string; state: OnboardingState }>('/api/onboarding/submit', {
        method: 'POST'
      });
    }
  },

  // Document Management & AI Extraction
  documents: {
    list: async (params: { category?: string; taxYear?: number; status?: string; search?: string; clientId?: string } = {}) => {
      const query = new URLSearchParams();
      if (params.category) query.append('category', params.category);
      if (params.taxYear) query.append('taxYear', String(params.taxYear));
      if (params.status) query.append('status', params.status);
      if (params.search) query.append('search', params.search);
      if (params.clientId) query.append('clientId', params.clientId);
      return request<{ documents: DocumentItem[] }>(`/api/documents?${query.toString()}`);
    },

    upload: async (payload: {
      fileName: string;
      fileSize?: string;
      fileType?: string;
      category?: string;
      taxYear?: number;
      description?: string;
      rawContentSample?: string;
      clientId?: string;
    }) => {
      return request<{ message: string; document: DocumentItem; extractionSummary: any }>('/api/documents/upload', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },

    getSignedUrl: async (documentId: string) => {
      return request<{ signedUrl: string; token: string; expiresInSeconds: number; expiresAt: string }>(`/api/documents/${documentId}/signed-url`, {
        method: 'POST'
      });
    },

    review: async (documentId: string, payload: { status: string; reviewerNotes?: string; correctedFields?: any[] }) => {
      return request<{ message: string; document: DocumentItem }>(`/api/documents/${documentId}/review`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
    },

    withdraw: async (documentId: string, payload: { reason?: string; justification: string }) => {
      return request<{ message: string; document: DocumentItem }>(`/api/documents/${documentId}/withdraw`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
  },

  // Authoritative Profile & Versioned Amendments (Directives 3 & 4)
  profile: {
    getAuthoritative: async (clientId?: string, signal?: AbortSignal) => {
      const q = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
      return request<any>(`/api/profile/authoritative${q}`, {signal});
    },

    updateOrdinary: async (payload: { phone?: string; mailingAddress?: any; communicationPreferences?: any; companyName?: string; notes?: string }) => {
      return request<{ success: boolean; message: string; amendedFields: any; user: User }>('/api/profile/ordinary', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
    },

    listAmendments: async (clientId?: string) => {
      const q = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
      return request<{ totalCount: number; amendments: any[] }>(`/api/profile/amendments${q}`);
    },

    requestAmendment: async (payload: {
      field: string;
      fieldLabel?: string;
      previousValue?: any;
      proposedValue: any;
      reason: string;
      isSensitiveIdentityChange?: boolean;
      verificationDocumentId?: string;
      clientId?: string;
    }) => {
      return request<{ message: string; amendment: any }>('/api/profile/amendments', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },

    reviewAmendment: async (amendmentId: string, payload: { disposition: 'APPROVED' | 'REJECTED' | 'INFO_REQUESTED'; notes?: string }) => {
      return request<{ message: string; amendment: any }>(`/api/profile/amendments/${amendmentId}/review`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
  },

  // Engagements & Maker-Checker Workflows

  // Appointments & Calendar Conflict Prevention

  // Payments, Subscriptions & Invoices

  // Accounting Integrations & 5-Stage Write Operations
  integrations: {
    list: async () => {
      return request<{ connections: AccountingConnection[] }>('/api/integrations');
    },

    connect: async (provider: string, companyName?: string) => {
      return request<{ message: string; connection: AccountingConnection }>('/api/integrations/connect', {
        method: 'POST',
        body: JSON.stringify({ provider, companyName })
      });
    },

    sync: async (id: string) => {
      return request<{ message: string; connection: AccountingConnection }>(`/api/integrations/${id}/sync`, {
        method: 'POST'
      });
    },

    disconnect: async (id: string) => {
      return request<{ message: string; connection: AccountingConnection }>(`/api/integrations/${id}/disconnect`, {
        method: 'POST'
      });
    },

    authorizeStage1Client: async (id: string) => {
      return request<{ message: string; writeAuthorization: any }>(`/api/integrations/${id}/authorize-write/client`, {
        method: 'POST'
      });
    },

    authorizeStage2Accountant: async (id: string) => {
      return request<{ message: string; writeAuthorization: any }>(`/api/integrations/${id}/authorize-write/accountant-prepare`, {
        method: 'POST'
      });
    },

    authorizeStage3Reviewer: async (id: string) => {
      return request<{ message: string; writeAuthorization: any }>(`/api/integrations/${id}/authorize-write/reviewer-approve`, {
        method: 'POST'
      });
    },

    executeStage4Commit: async (id: string) => {
      return request<{ success: boolean; message: string; connection: AccountingConnection }>(`/api/integrations/${id}/authorize-write/execute-commit`, {
        method: 'POST',
        body: JSON.stringify({ confirmationPhrase: 'CONFIRM_WRITE_TO_LEDGER' })
      });
    }
  },

  // Messaging & Staff Notes

  // Careers & Recruiting Workspace
  careers: {
    getJobs: async () => {
      return request<{ jobs: JobListing[] }>('/api/careers/jobs');
    },

    getJob: async (id: string) => {
      return request<{ job: JobListing }>(`/api/careers/jobs/${id}`);
    },

    apply: async (payload: {
      jobId: string;
      fullName: string;
      email: string;
      phone?: string;
      linkedinUrl?: string;
      yearsExperience?: number;
      resumeFileName?: string;
      coverLetter?: string;
    }) => {
      return request<{ message: string; applicantId: string }>('/api/careers/apply', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },

    getApplicants: async (params: { jobId?: string; status?: string } = {}) => {
      const q = new URLSearchParams();
      if (params.jobId) q.append('jobId', params.jobId);
      if (params.status) q.append('status', params.status);
      return request<{ applicants: Applicant[] }>(`/api/careers/applicants?${q.toString()}`);
    },

    updateApplicant: async (id: string, payload: Partial<Applicant>) => {
      return request<{ message: string; applicant: Applicant }>(`/api/careers/applicants/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
    }
  },

  // Legal & Professional Coordination

  // Admin & Compliance Management
  // Tax Forms Library: read-only reference catalog (server restricts to practice staff roles).
  taxForms: {
    getCatalog: async (signal?: AbortSignal) => request<import('../taxForms/registry').LibraryCatalog>('/api/tax-forms', { method: 'GET', signal }),
  },

  // Super administrator console (server verifies the super administrator role on every call).
  superAdmin: {
    getSession: async () => request<{
      user: { id: string; email: string; name: string; role: string; tenantId?: string };
      session: { createdAt: string; expiresAt: string; absoluteExpiresAt: string; idleTimeoutMinutes: number } | null;
      secondFactor: 'totp' | 'identity_provider';
      policy: string;
    }>('/api/super-admin/session'),
    recordDashboardView: async (dashboard: string) => request<{ recorded: boolean; dashboard: string; mode: string }>('/api/super-admin/dashboard-views', {
      method: 'POST',
      body: JSON.stringify({ dashboard })
    }),
  },

  admin: {
    getAuditLogs: async (params: { action?: string; userId?: string; severity?: string; limit?: number } = {}) => {
      const q = new URLSearchParams();
      if (params.action) q.append('action', params.action);
      if (params.userId) q.append('userId', params.userId);
      if (params.severity) q.append('severity', params.severity);
      if (params.limit) q.append('limit', String(params.limit));
      return request<{ auditLogs: AuditLog[]; totalCount: number }>(`/api/admin/audit-logs?${q.toString()}`);
    },

    getSecurityEvents: async () => {
      return request<{ securityEvents: any[] }>('/api/admin/security-events');
    },

    getSystemHealth: async () => {
      return request<{
        healthStatus: string;
        serverTimestamp: string;
        metrics: any;
        workloadBalancing: any[];
      }>('/api/admin/system-health');
    },

    getUsers: async () => {
      return request<{ users: User[] }>('/api/admin/users');
    },

    reassignClient: async (clientId: string, accountantId: string, reviewerId?: string, reason: string = 'Administrative workload balancing') => {
      return request<{ message: string; client: User }>(`/api/admin/users/${clientId}/reassign`, {
        method: 'PATCH',
        body: JSON.stringify({ assignedAccountantId: accountantId, assignedReviewerId: reviewerId, reason })
      });
    },

    setUserStatus: async (userId: string, status: 'active' | 'disabled' | 'suspended', reason: string = 'Administrative account maintenance', confirmation: boolean = true) => {
      return request<{ message: string; user: User }>(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason, confirmation })
      });
    },

    updatePlanPrice: async (planId: string, price: number, changeReason: string = 'Annual firm pricing schedule update', currency: 'USD' = 'USD') => {
      return request<{ message: string; plan: any }>(`/api/admin/service-plans/${planId}`, {
        method: 'PUT',
        body: JSON.stringify({ price, currency, changeReason })
      });
    },

    impersonate: async (clientId: string) => {
      const res = await request<{ message: string; token: string; user: User }>(`/api/admin/impersonate/${clientId}`, {
        method: 'POST'
      });
      if (res.token) {
        setStoredToken(res.token);
      }
      return res;
    }
  },

  // Automated Negative Security Test Suite Runner
  security: {
    runNegativeTests: async () => {
      return request<{
        summary: {
          totalTests: number;
          passed: number;
          failed: number;
          allPassed: boolean;
          executionDurationMs: number;
          completedAt: string;
        };
        results: SecurityTestResult[];
      }>('/api/security/run-suite');
    }
  },

  // Client-Accountant Binding & Governance

  // Dedicated Accountant Workspace & Tasks
  clientService: {
    getDashboard:(year?:number,signal?:AbortSignal)=>request<import('../types/clientServiceDashboard').ClientServiceSnapshot>('/api/operations/client-service/dashboard'+(year?'?taxYear='+year:''),{signal}),
    search:(q:string,year?:number,signal?:AbortSignal)=>request<{tenantId:string;matches:Omit<import('../types/clientServiceDashboard').ClientServiceCase,'documents'>[]}>('/api/operations/client-service/search?'+new URLSearchParams({q,...(year?{taxYear:String(year)}:{})}),{signal}),
    conversation:(threadId:string,caseKey:string,year:number,signal?:AbortSignal)=>request<import('../types/clientServiceDashboard').ClientServiceConversation>('/api/operations/client-service/conversation?'+new URLSearchParams({threadId,caseKey,taxYear:String(year)}),{signal}),
    requestDetail:(requestId:string,caseKey:string,year:number,signal?:AbortSignal)=>request<import('../types/clientServiceDashboard').ClientServiceRequestDetail>('/api/operations/client-service/request?'+new URLSearchParams({requestId,caseKey,taxYear:String(year)}),{signal}),
  },
  practiceManager: {getDashboard:(year?:number,signal?:AbortSignal)=>request<import('../types/practiceManagerDashboard').PracticeManagerSnapshot>('/api/operations/manager-dashboard'+(year?'?taxYear='+year:''),{signal})},
  bookkeeper: {
    getClients: (signal?:AbortSignal) => request<{tenantId:string;clientIds:string[]}>('/api/bookkeeping/bookkeeper-clients', {signal}),
    getDashboard: (clientId:string,taxYear:number,periodId?:string,signal?:AbortSignal) => request<import('../types/bookkeeperDashboard').BookkeeperSnapshot>('/api/bookkeeping/bookkeeper-dashboard?'+new URLSearchParams({clientId,taxYear:String(taxYear),...(periodId?{periodId}:{})}), {signal}),
  },
  reviewer: {
    getDashboard: (signal?: AbortSignal) => request<{ cases: import('../types/reviewerDashboard').ReviewerQueueCase[] }>('/api/case-authority/reviewer/dashboard', { signal }),
    getWorkspace: (scope: import('../types/reviewerDashboard').ReviewScope, signal?: AbortSignal) => request<import('../types/reviewerDashboard').ReviewerSnapshot>(`/api/case-authority/${encodeURIComponent(scope.tenantId)}/${encodeURIComponent(scope.clientId)}/${encodeURIComponent(scope.engagementId)}/${scope.taxYear}/reviewer-workspace`, { signal }),
    decide: (scope: import('../types/reviewerDashboard').ReviewScope, input: import('../types/reviewerDashboard').ReviewerDecision) => request<{ revision: number; version: number; approvalId?: string }>(`/api/case-authority/${encodeURIComponent(scope.tenantId)}/${encodeURIComponent(scope.clientId)}/${encodeURIComponent(scope.engagementId)}/${scope.taxYear}/reviewer-decision`, { method: 'POST', body: JSON.stringify(input) }),
  },
  accountant: {
    getDashboard: async (signal?: AbortSignal) => request<{ cases: import('../components/workspace/accountantDashboardModel').AccountantCase[]; source?: 'durable'; unavailableFields?: string[] }>('/api/accountant/dashboard', { signal }),
    getOverview: async () => {
      return request<{
        metrics: {
          totalAssignedClients: number;
          activeAssignmentsCount: number;
          tasksDueToday: number;
          upcomingDeadlinesCount: number;
          documentsAwaitingReview: number;
          clientQuestionsAwaitingResponse: number;
          completedTasks: number;
          overdueTasks: number;
          connectionAlerts: number;
        };
        urgentDeadlinesQueue: any[];
        recentTasks: AccountingWorkflowTask[];
        docsAwaitingReview: DocumentItem[];
      }>('/api/accountant/overview');
    },

    getClients: async () => {
      return request<{ clients: any[] }>('/api/accountant/clients');
    },

    getClientWorkspace: async (clientId: string) => {
      return request<{
        client: any;
        bindings: ClientAccountantBinding[];
        engagements: Engagement[];
        documents: DocumentItem[];
        tasks: AccountingWorkflowTask[];
        documentRequests: DocumentRequest[];
        integrations: DetailedAccountingIntegration[];
        journalEntries: JournalEntryDraft[];
        legalRecords: LegalCoordinationRecord[];
        messages: Message[];
      }>(`/api/accountant/workspace/${clientId}`);
    },

    saveTask: async (taskData: Partial<AccountingWorkflowTask>) => {
      return request<{ message: string; task: AccountingWorkflowTask }>('/api/accountant/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData)
      });
    },

    updateTaskStatus: async (taskId: string, status: string, comment?: string) => {
      return request<{ message: string; task: AccountingWorkflowTask }>(`/api/accountant/tasks/${taskId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, comment })
      });
    },

    reviewTask: async (taskId: string, action: 'approved' | 'rejected' | 'requested_changes', notes?: string) => {
      return request<{ message: string; task: AccountingWorkflowTask }>(`/api/accountant/tasks/${taskId}/review`, {
        method: 'POST',
        body: JSON.stringify({ action, notes })
      });
    },

    requestDocument: async (payload: { clientId: string; title: string; description?: string; category?: string; taxYear?: number; dueDate: string }) => {
      return request<{ message: string; request: DocumentRequest }>('/api/accountant/documents/request', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },

    uploadDeliverable: async (payload: { clientId: string; fileName: string; category?: string; taxYear?: number; notes?: string }) => {
      return request<{ message: string; document: DocumentItem }>('/api/accountant/documents/upload-deliverable', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },

    updateDocStatus: async (docId: string, status: string, notes?: string) => {
      return request<{ message: string; document: DocumentItem }>(`/api/accountant/documents/${docId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, notes })
      });
    },

    addNote: async (clientId: string, content: string, isInternalOnly = true) => {
      return request<{ message: string; note: any }>('/api/accountant/notes', {
        method: 'POST',
        body: JSON.stringify({ clientId, content, isInternalOnly })
      });
    }
  },

  // Authoritative Scoped Case, Stage Engine, Document Pipeline & OCR API (M18.4 - M18.6)
  caseAuthority: {
    getCase: async (tenantId: string, clientId: string, engagementId: string, taxYear: number) => {
      return request<any>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}`);
    },
    listCases: async (tenantId: string, clientId: string, engagementId: string) => {
      return request<any[]>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/cases`);
    },
    updateCase: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, payload: { version: number; operationId: string; patch: Record<string, unknown> }) => {
      return request<{ revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
    },
    activateCase: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, payload: { version: number; operationId: string }) => {
      return request<{ revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/activate`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    blockCase: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, payload: { version: number; operationId: string; reason: string }) => {
      return request<{ revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/block`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    reopenCase: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, payload: { version: number; operationId: string }) => {
      return request<{ revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/reopen`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    archiveCase: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, payload: { version: number; operationId: string }) => {
      return request<{ revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/archive`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    getStages: async (tenantId: string, clientId: string, engagementId: string, taxYear: number) => {
      return request<any[]>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/stages`);
    },
    getStageState: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, stage: number) => {
      return request<any>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/stages/${stage}`);
    },
    evaluateStage: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, stage: number, payload: { version: number; operationId: string; snapshot: unknown }) => {
      return request<{ revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/stages/${stage}/evaluate`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    transitionStage: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, stage: number, payload: { version: number; operationId: string; toStage?: number; approvalId?: string }) => {
      return request<{ revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/stages/${stage}/transition`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    blockStage: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, stage: number, payload: { version: number; operationId: string; reason: string }) => {
      return request<{ revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/stages/${stage}/block`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    reopenStage: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, stage: number, payload: { version: number; operationId: string }) => {
      return request<{ revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/stages/${stage}/reopen`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    invalidateDownstream: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, stage: number, payload: { version: number; operationId: string; reason: string }) => {
      return request<{ revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/stages/${stage}/invalidate`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    getDocuments: async (tenantId: string, clientId: string, engagementId: string, taxYear: number) => {
      return request<any[]>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/documents`);
    },
    registerDocument: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, payload: { version: number; operationId: string; document: Record<string, unknown> }) => {
      return request<{ revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/documents`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    submitOcr: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, docId: string, payload: { version: number; operationId: string }) => {
      return request<{ revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/documents/${docId}/ocr`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    reviewOcrField: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, fieldId: string, payload: { version: number; operationId: string; decision: { action: string; correctedValue?: unknown; reason?: string } }) => {
      return request<{ revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/ocr/${fieldId}/review`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    getProviderReadiness: async (signal?: AbortSignal) => {
      return request<{ providers: any[] }>('/api/provider-readiness', {signal});
    },
    // AI Control Center emergency stop: activation and listing only; the server re-verifies role and tenant.
    listAiKillSwitches: async (signal?: AbortSignal) => {
      return request<{ kill_switches: unknown[] }>('/api/ai-governance/kill-switches', {signal});
    },
    // AI Control Center read-only views; filters and cursor are validated server-side.
    getAiControlCenter: async (view: 'registry' | 'runs' | 'decisions' | 'security-events' | 'usage' | 'commissioning', query: Record<string, string> = {}, signal?: AbortSignal) => {
      const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== ''));
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return request<Record<string, unknown>>(`/api/ai-governance/control-center/${view}${suffix}`, {signal});
    },
    activateAiKillSwitch: async (payload: { scope: 'GLOBAL'; reason: string } | { scope: 'AGENT'; agent_id: string; reason: string }
      | { scope: 'MODEL'; model_id: string; model_version: string; reason: string } | { scope: 'TOOL'; tool_id: string; reason: string }
      | { scope: 'WORKFLOW'; workflow_stage: number; reason: string }) => {
      return request<Record<string, unknown>>('/api/ai-governance/kill-switches', { method: 'POST', body: JSON.stringify(payload) });
    },

    // Stage 04: Record
    createTaxRecord: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, payload: { version: number; operationId: string; record: Record<string, unknown> }) => {
      return request<{ recordId: string; revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/records`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    listTaxRecords: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, category?: string) => {
      const q = category ? `?category=${encodeURIComponent(category)}` : '';
      return request<any[]>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/records${q}`);
    },
    getTaxRecord: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, id: string) => {
      return request<any>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/records/${id}`);
    },
    resolveRecordDuplicate: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, id: string, payload: { version: number; operationId: string; resolution: string }) => {
      return request<{ revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/records/${id}/resolve-duplicate`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },

    // Stage 05: Reconcile
    runReconciliation: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, payload: { version: number; operationId: string; category: string; tolerance?: number }) => {
      return request<{ reconciliationId: string; revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/reconciliations/run`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    listReconciliations: async (tenantId: string, clientId: string, engagementId: string, taxYear: number) => {
      return request<any[]>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/reconciliations`);
    },
    getReconciliation: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, id: string) => {
      return request<any>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/reconciliations/${id}`);
    },
    resolveReconciliationVariance: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, id: string, payload: { version: number; operationId: string; reason: string }) => {
      return request<{ revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/reconciliations/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },

    // Stage 06: Review
    createWorkpaper: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, payload: { version: number; operationId: string; workpaper: Record<string, unknown> }) => {
      return request<{ workpaperId: string; revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/workpapers`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    listWorkpapers: async (tenantId: string, clientId: string, engagementId: string, taxYear: number) => {
      return request<any[]>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/workpapers`);
    },
    getWorkpaper: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, id: string) => {
      return request<any>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/workpapers/${id}`);
    },
    performReviewAction: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, payload: { version: number; operationId: string; target: { type: string; id: string }; action: string; notes?: string }) => {
      return request<{ revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/reviews/action`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },

    // Stage 07: Report
    generateReport: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, payload: { version: number; operationId: string; reportType: string }) => {
      return request<{ reportId: string; revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/reports/generate`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    listReports: async (tenantId: string, clientId: string, engagementId: string, taxYear: number) => {
      return request<any[]>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/reports`);
    },
    getReport: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, id: string) => {
      return request<any>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/reports/${id}`);
    },

    // Stage 08: Plan
    createPlanningScenario: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, payload: { version: number; operationId: string; scenario: Record<string, unknown> }) => {
      return request<{ scenarioId: string; revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/planning`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    listPlanningScenarios: async (tenantId: string, clientId: string, engagementId: string, taxYear: number) => {
      return request<any[]>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/planning`);
    },
    getPlanningScenario: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, id: string) => {
      return request<any>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/planning/${id}`);
    },

    // Stage 09: Prepare Taxes
    generateDraftReturn: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, payload: { version: number; operationId: string; returnType: string; jurisdiction: string }) => {
      return request<{ returnId: string; revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/returns/generate`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    listDraftReturns: async (tenantId: string, clientId: string, engagementId: string, taxYear: number) => {
      return request<any[]>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/returns`);
    },
    getDraftReturn: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, id: string) => {
      return request<any>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/returns/${id}`);
    },
    certifyDraftReturn: async (tenantId: string, clientId: string, engagementId: string, taxYear: number, id: string, payload: { version: number; operationId: string }) => {
      return request<{ revision: number; version: number }>(`/api/case-authority/${tenantId}/${clientId}/${engagementId}/${taxYear}/returns/${id}/certify`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
  }
};
