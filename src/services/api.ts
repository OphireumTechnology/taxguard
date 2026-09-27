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

const TOKEN_KEY = 'artax_session_token';
let memoryToken: string | null = null;

export function getStoredToken(): string | null {
  try {
    return (
      localStorage.getItem(TOKEN_KEY) ||
      sessionStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('token') ||
      memoryToken
    );
  } catch (e) {
    return memoryToken;
  }
}

export function setStoredToken(token: string) {
  memoryToken = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem('token', token);
    sessionStorage.setItem('token', token);
  } catch (e) {
    // Storage restricted or unavailable in sandboxed iframe; memoryToken is active
  }
}

export function clearStoredToken() {
  memoryToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
  } catch (e) {
    // Storage restricted or unavailable in sandboxed iframe
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

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg) as any;
    err.status = response.status;
    err.code = data.code;
    err.data = data;
    throw err;
  }

  return data as T;
}

export const api = {
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

    getMe: async () => {
      return request<{ user: User }>('/api/auth/me');
    },

    logout: async () => {
      try {
        await request('/api/auth/logout', { method: 'POST' });
      } finally {
        clearStoredToken();
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
    }
  },

  // Engagements & Maker-Checker Workflows
  engagements: {
    list: async () => {
      return request<{ engagements: Engagement[] }>('/api/engagements');
    },

    get: async (id: string) => {
      return request<{ engagement: Engagement }>(`/api/engagements/${id}`);
    },

    updateStatus: async (id: string, payload: { status: string; progressPercent?: number; notes?: string }) => {
      return request<{ message: string; engagement: Engagement }>(`/api/engagements/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
    },

    dispatch8879: async (id: string) => {
      return request<{ message: string; engagement: Engagement; deliverableDocumentId: string }>(`/api/engagements/${id}/dispatch-8879`, {
        method: 'POST'
      });
    },

    getJournalEntries: async (clientId: string) => {
      return request<{ journalEntries: JournalEntryDraft[] }>(`/api/engagements/journal-entries/${clientId}`);
    },

    createJournalEntry: async (payload: Partial<JournalEntryDraft>) => {
      return request<{ journalEntry: JournalEntryDraft }>('/api/engagements/journal-entries', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },

    approveJournalEntry: async (id: string) => {
      return request<{ message: string; journalEntry: JournalEntryDraft }>(`/api/engagements/journal-entries/${id}/approve`, {
        method: 'PATCH'
      });
    }
  },

  // Appointments & Calendar Conflict Prevention
  appointments: {
    list: async () => {
      return request<{ appointments: Appointment[] }>('/api/appointments');
    },

    book: async (payload: {
      clientName: string;
      clientEmail: string;
      clientPhone?: string;
      serviceType?: string;
      accountantId?: string;
      requestedFounder?: boolean;
      date: string;
      timeSlot: string;
      type: 'virtual' | 'phone' | 'in_office';
      notes?: string;
    }) => {
      return request<{ message: string; appointment: Appointment; confirmationDetails: any }>('/api/appointments/book', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },

    update: async (id: string, payload: Partial<Appointment>) => {
      return request<{ message: string; appointment: Appointment }>(`/api/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
    }
  },

  // Payments, Subscriptions & Invoices
  payments: {
    charge: async (payload: {
      amount: number;
      currency?: string;
      invoiceId?: string;
      servicePlanId?: string;
      description?: string;
      paymentMethod?: string;
      idempotencyKey?: string;
      discountCode?: string;
    }) => {
      return request<{ success: boolean; message: string; invoice: Invoice; receipt: any }>('/api/payments/charge', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },

    getInvoices: async () => {
      return request<{ invoices: Invoice[] }>('/api/payments/invoices');
    }
  },

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
  messages: {
    list: async (params: { engagementId?: string } = {}) => {
      const q = params.engagementId ? `?engagementId=${params.engagementId}` : '';
      return request<{ messages: Message[] }>(`/api/messages${q}`);
    },

    send: async (payload: {
      recipientId?: string;
      recipientName?: string;
      engagementId?: string;
      content: string;
      isInternalNote?: boolean;
      attachments?: string[];
    }) => {
      return request<{ message: string; messageData: Message }>('/api/messages', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },

    markRead: async (id: string) => {
      return request<{ success: boolean; message: Message }>(`/api/messages/${id}/read`, {
        method: 'PATCH'
      });
    }
  },

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
  legal: {
    list: async () => {
      return request<{ legalRecords: LegalCoordinationRecord[]; statutoryDisclaimer: string }>('/api/legal');
    },

    create: async (payload: Partial<LegalCoordinationRecord>) => {
      return request<{ message: string; record: LegalCoordinationRecord; statutoryDisclaimer: string }>('/api/legal', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
  },

  // Admin & Compliance Management
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
  assignments: {
    list: async () => {
      return request<{ bindings: ClientAccountantBinding[] }>('/api/assignments');
    },

    listForClient: async (clientId: string) => {
      return request<{ bindings: ClientAccountantBinding[] }>(`/api/assignments/client/${clientId}`);
    },

    getWorkload: async () => {
      return request<{ profiles: AccountantProfile[] }>('/api/assignments/accountants-workload');
    },

    bind: async (payload: {
      clientId: string;
      accountantId: string;
      assignmentType?: string;
      accessScope?: string[];
      effectiveDate?: string;
      expirationDate?: string;
      reason?: string;
      internalNotes?: string;
    }) => {
      return request<{ message: string; binding: ClientAccountantBinding }>('/api/assignments/bind', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },

    unbind: async (bindingId: string, reason: string, replacementAccountantId?: string) => {
      return request<{ message: string; binding: ClientAccountantBinding }>('/api/assignments/unbind', {
        method: 'POST',
        body: JSON.stringify({ bindingId, reason, replacementAccountantId })
      });
    },

    suspend: async (bindingId: string, reason?: string) => {
      return request<{ message: string; binding: ClientAccountantBinding }>('/api/assignments/suspend', {
        method: 'POST',
        body: JSON.stringify({ bindingId, reason })
      });
    },

    restore: async (bindingId: string) => {
      return request<{ message: string; binding: ClientAccountantBinding }>('/api/assignments/restore', {
        method: 'POST',
        body: JSON.stringify({ bindingId })
      });
    },

    reassign: async (currentBindingId: string, newAccountantId: string, reason?: string) => {
      return request<{ message: string; oldBinding: ClientAccountantBinding; newBinding: ClientAccountantBinding }>('/api/assignments/reassign', {
        method: 'POST',
        body: JSON.stringify({ currentBindingId, newAccountantId, reason })
      });
    },

    requestReassignment: async (reason: string, preferredSpecialization?: string) => {
      return request<{ message: string; request: ReassignmentRequest }>('/api/assignments/request-reassignment', {
        method: 'POST',
        body: JSON.stringify({ reason, preferredSpecialization })
      });
    },

    listReassignmentRequests: async () => {
      return request<{ requests: ReassignmentRequest[] }>('/api/assignments/reassignment-requests');
    },

    reviewReassignmentRequest: async (id: string, action: 'approved' | 'rejected', notes?: string) => {
      return request<{ message: string; request: ReassignmentRequest }>(`/api/assignments/reassignment-requests/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ action, notes })
      });
    }
  },

  // Dedicated Accountant Workspace & Tasks
  accountant: {
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
  }
};
