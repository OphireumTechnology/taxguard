import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  User, 
  UserRole, 
  Engagement, 
  DocumentItem, 
  Appointment, 
  ServicePlan, 
  Invoice, 
  AccountingConnection, 
  Message, 
  JobListing, 
  JobPosting,
  Applicant, 
  AuditLog,
  DocumentStatus,
  EngagementStatus,
  OnboardingState,
  JournalEntryDraft,
  LegalCoordinationRecord,
  SecurityTestResult,
  JobApplication,
  JobApplicationResult,
  ServicePlanUpdateResult,
  UserStatusUpdateResult,
  ClientReassignmentResult
} from '../types';
import { 
  INITIAL_USERS, 
  INITIAL_SERVICE_PLANS, 
  INITIAL_ENGAGEMENTS, 
  INITIAL_DOCUMENTS, 
  INITIAL_APPOINTMENTS, 
  INITIAL_INVOICES, 
  INITIAL_ACCOUNTING_CONNECTIONS, 
  INITIAL_MESSAGES, 
  INITIAL_JOBS, 
  INITIAL_APPLICANTS, 
  INITIAL_AUDIT_LOGS 
} from '../data/mockData';
import { api, getStoredToken, setStoredToken, clearStoredToken } from '../services/api';
import { auth, db } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { loginWithEmail, registerWithEmail, logout as firebaseLogout, getVerifiedUserRole } from '../firebase/auth';
import { seedInitialServicesIfEmpty } from '../firebase/seed';
import { 
  testConnection,
  subscribeClientDocuments, 
  subscribeUserAppointments, 
  subscribeClientInvoices,
  subscribeUserNotifications,
  sendMessage as sendFirestoreMessage,
  recordLegalConsent
} from '../firebase/firestore';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export type PageRoute = 
  | 'home'
  | 'about'
  | 'services'
  | 'industries'
  | 'tax_strategies'
  | 'pricing'
  | 'founder'
  | 'resources'
  | 'careers'
  | 'job_detail'
  | 'contact'
  | 'book_consultation'
  | 'login'
  | 'register'
  | 'onboarding'
  | 'client_onboarding'
  | 'stage_one_onboard'
  | 'staff_onboarding'
  | 'client_portal'
  | 'accountant_workspace'
  | 'staff_portal'
  | 'reviewer_workspace'
  | 'senior_reviewer_workspace'
  | 'reviewer_portal'
  | 'admin_dashboard'
  | 'admin_portal'
  | 'live_calendar'
  | 'virtual_consultation_room'
  | 'client_login'
  | 'client_register'
  | 'staff_login'
  | 'privacy'
  | 'terms'
  | 'accessibility'
  | 'security'
  | 'disclaimers'
  | 'cookies'
  | 'portals'
  | 'public_v2'
  | 'not_found';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  read?: boolean;
  type: 'info' | 'success' | 'warning' | 'critical';
  linkTarget?: PageRoute;
}

interface AppContextType {
  currentUser: User | null;
  currentRole: UserRole | 'guest';
  setCurrentRole: (role: UserRole | 'guest') => void;
  currentPage: PageRoute;
  setCurrentPage: (page: PageRoute, params?: any) => void;
  pageParams: any;
  isSyncingWithBackend: boolean;
  isLoadingData: boolean;
  isInitialized: boolean;
  dataError: string | null;
  
  // Data entities
  users: User[];
  engagements: Engagement[];
  documents: DocumentItem[];
  appointments: Appointment[];
  servicePlans: ServicePlan[];
  invoices: Invoice[];
  accountingConnections: AccountingConnection[];
  messages: Message[];
  
  // Canonical Job Postings Contract
  jobPostings: JobPosting[];
  /**
   * @deprecated Use `jobPostings` instead. Preserved for backward compatibility.
   */
  jobs: JobPosting[];

  selectedJob: JobPosting | null;
  setSelectedJob: (job: JobPosting | null) => void;
  applyForJob: (application: JobApplication) => Promise<JobApplicationResult>;
  applicants: Applicant[];
  auditLogs: AuditLog[];
  notifications: AppNotification[];
  onboardingState: OnboardingState | null;
  onboardingProgress: { percentComplete: number; missingRequirements: string[]; nextAction: string } | null;
  legalRecords: LegalCoordinationRecord[];
  securityTestResults: SecurityTestResult[];
  
  // Auth actions
  login: (email: string, password: string, mfaCode?: string) => Promise<{ success: boolean; mfaRequired?: boolean; error?: string }>;
  register: (payload: { name: string; email: string; password?: string; phone?: string; companyName?: string; company?: string; clientType?: 'individual' | 'business'; role?: UserRole; taxFilingType?: string; }) => Promise<{ success: boolean; error?: string; verificationTokenSimulated?: string }>;
  logout: () => Promise<void>;
  switchTestAccount: (userId: string) => Promise<void>;
  
  // Data Actions
  uploadDocument: (fileData: Partial<DocumentItem>, sampleText?: string) => Promise<DocumentItem | null>;
  updateDocumentStatus: (docId: string, status: DocumentStatus, notes?: string, correctedFields?: any[]) => Promise<void>;
  verifyExtractedField: (docId: string, fieldKey: string, newValue?: string | number) => void;
  updateEngagementStatus: (engId: string, status: EngagementStatus, notes?: string) => Promise<{ success: boolean; error?: string }>;
  dispatch8879: (engId: string) => Promise<{ success: boolean; error?: string }>;
  toggleEngagementTask: (engId: string, taskId: string) => void;
  bookAppointment: (apt: Omit<Appointment, 'id' | 'createdAt' | 'status'>) => Promise<{ success: boolean; error?: string; appointment?: Appointment }>;
  cancelAppointment: (aptId: string) => Promise<void>;
  payInvoice: (invId: string, paymentMethod?: string, idempotencyKey?: string) => Promise<{ success: boolean; error?: string; receipt?: any }>;
  updateServicePlan: (planId: string, updatedPlan: Partial<ServicePlan>) => Promise<void>;
  triggerAccountingSync: (connectionId: string) => Promise<void>;
  connectAccountingProvider: (provider: string, companyName?: string) => Promise<void>;
  disconnectAccountingProvider: (connectionId: string) => Promise<void>;
  sendMessage: (content: string, isInternalOnly: boolean, engagementId?: string) => Promise<void>;
  submitJobApplication: (application: Omit<Applicant, 'id' | 'appliedDate' | 'status'>) => Promise<boolean>;
  updateApplicantStatus: (appId: string, status: Applicant['status']) => Promise<void>;
  
  // Onboarding
  saveOnboardingStep: (stepData: Partial<OnboardingState>) => Promise<boolean>;
  submitOnboardingDossier: () => Promise<boolean>;
  
  // Legal Coordination
  createLegalRecord: (record: Partial<LegalCoordinationRecord>) => Promise<boolean>;
  
  // Security & Audit
  runSecuritySuite: () => Promise<any>;
  refreshBackendData: () => Promise<void>;
  addAuditLog: (actionOrLog: string | Partial<AuditLog>, userRoleOrResource?: string, detailsStr?: string) => void;
  addNotification: (notification: Partial<AppNotification> & { title: string; message: string }) => void;
  markNotificationRead: (notifId: string) => void;
  clearAllNotifications: () => void;

  // Admin Governance
  updateServicePlanPrice: (planId: string, newPrice: number, changeReason?: string, currency?: 'USD') => Promise<ServicePlanUpdateResult>;
  toggleUserStatus: (userId: string, reason?: string, confirmation?: boolean) => Promise<UserStatusUpdateResult>;
  impersonateUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  reassignClient: (clientId: string, accountantId: string, reviewerId?: string, reason?: string) => Promise<ClientReassignmentResult>;
  
  // Cookie consent
  cookieConsentAccepted: boolean;
  setCookieConsentAccepted: (accepted: boolean) => void;
  cookieModalOpen: boolean;
  setCookieModalOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation & Page State - Root-compatible route resolver for artaxserv.com
  const resolveRoute = (rawInput: string): PageRoute | null => {
    if (!rawInput) return null;
    const clean = rawInput
      .replace(/^#\/?/, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
      .toLowerCase()
      .trim();
    if (!clean || clean === 'index.html') return 'home';

    const validRoutes: PageRoute[] = [
      'home', 'about', 'services', 'industries', 'tax_strategies', 'pricing', 'founder',
      'resources', 'careers', 'job_detail', 'contact', 'book_consultation', 'login',
      'register', 'onboarding', 'client_onboarding', 'staff_onboarding', 'client_portal',
      'accountant_workspace', 'staff_portal', 'reviewer_workspace', 'senior_reviewer_workspace',
      'reviewer_portal', 'admin_dashboard', 'admin_portal', 'live_calendar',
      'virtual_consultation_room', 'client_login', 'client_register', 'staff_login',
      'privacy', 'terms', 'accessibility', 'security', 'disclaimers', 'cookies', 'portals', 'not_found'
    ];
    if (validRoutes.includes(clean as PageRoute)) {
      return clean as PageRoute;
    }

    // Handle normalized kebab-case or underscore aliases
    const normalized = clean.replace(/_/g, '-');
    const aliasMap: Record<string, PageRoute> = {
      'portals': 'portals',
      'portal': 'portals',
      'home': 'home',
      'about': 'about',
      'founder': 'founder',
      'services': 'services',
      'pricing': 'pricing',
      'industries': 'industries',
      'tax-strategies': 'tax_strategies',
      'book-consultation': 'book_consultation',
      'resources': 'resources',
      'careers': 'careers',
      'job-detail': 'job_detail',
      'contact': 'contact',
      'login': 'client_login',
      'register': 'client_register',
      'client-login': 'client_login',
      'client-register': 'client_register',
      'staff-login': 'staff_login',
      'onboarding': 'client_onboarding',
      'client-onboarding': 'client_onboarding',
      'staff-onboarding': 'staff_onboarding',
      'client-portal': 'client_portal',
      'accountant-workspace': 'accountant_workspace',
      'staff-portal': 'accountant_workspace',
      'reviewer-workspace': 'senior_reviewer_workspace',
      'reviewer-portal': 'senior_reviewer_workspace',
      'senior-reviewer-workspace': 'senior_reviewer_workspace',
      'admin-dashboard': 'admin_dashboard',
      'admin-portal': 'admin_dashboard',
      'live-calendar': 'live_calendar',
      'virtual-consultation-room': 'virtual_consultation_room',
      'privacy': 'privacy',
      'privacy-policy': 'privacy',
      'terms': 'terms',
      'terms-of-service': 'terms',
      'accessibility': 'accessibility',
      'security': 'security',
      'security-data-handling': 'security',
      'disclaimers': 'disclaimers',
      'cookies': 'cookies',
    };

    return aliasMap[normalized] || null;
  };

  const isDemoUrl = (raw: string): boolean => {
    const clean = raw.replace(/^#\/?/, '').replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase().trim();
    if (clean.startsWith('error/')) return true;
    if (clean === 'portals' || clean.startsWith('portals/')) return true;
    if (clean.includes('/login') || clean.includes('/dashboard')) return true;
    if (['client-portal', 'reviewer-portal', 'staff-portal', 'cpa-portal', 'admin-dashboard', 'admin-portal', 'reviewer-workspace', 'accountant-workspace', 'portals'].includes(clean)) return true;
    return false;
  };

  const getPageFromUrl = (): PageRoute | null => {
    if (typeof window === 'undefined') return 'home';
    const hash = window.location.hash || '';
    const pathname = window.location.pathname || '';

    // If the URL is for the 29-role demonstration environment, do not overwrite AppContext with 'home'
    if (isDemoUrl(hash) || isDemoUrl(pathname)) {
      return null;
    }

    // 1. Check hash first (e.g. #/services or #services)
    if (hash) {
      const match = resolveRoute(hash);
      if (match) return match;
    }
    // 2. Check pathname (e.g. /services or /pricing)
    if (pathname && pathname !== '/') {
      const match = resolveRoute(pathname);
      if (match) return match;
    }
    return 'home';
  };

  // Initial route check from URL pathname or hash
  const [currentPage, setCurrentPageState] = useState<PageRoute>(() => {
    return getPageFromUrl() || 'home';
  });
  const [pageParams, setPageParams] = useState<any>({});
  const [isSyncingWithBackend, setIsSyncingWithBackend] = useState<boolean>(false);

  // Roles & Users: Default to Client Michael Perotti
  const [currentRole, setCurrentRoleState] = useState<UserRole | 'guest'>('client');
  const [currentUser, setCurrentUser] = useState<User | null>(INITIAL_USERS[0]);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);

  // Data Stores
  const [engagements, setEngagements] = useState<Engagement[]>(INITIAL_ENGAGEMENTS);
  const [documents, setDocuments] = useState<DocumentItem[]>(INITIAL_DOCUMENTS);
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [servicePlans, setServicePlans] = useState<ServicePlan[]>(INITIAL_SERVICE_PLANS);
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [accountingConnections, setAccountingConnections] = useState<AccountingConnection[]>(INITIAL_ACCOUNTING_CONNECTIONS);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [jobPostings, setJobPostings] = useState<JobPosting[]>(INITIAL_JOBS);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>(INITIAL_APPLICANTS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  const [onboardingProgress, setOnboardingProgress] = useState<{ percentComplete: number; missingRequirements: string[]; nextAction: string } | null>(null);
  const [legalRecords, setLegalRecords] = useState<LegalCoordinationRecord[]>([]);
  const [securityTestResults, setSecurityTestResults] = useState<SecurityTestResult[]>([]);

  // Cookie consent
  const [cookieConsentAccepted, setCookieConsentAccepted] = useState<boolean>(true);
  const [cookieModalOpen, setCookieModalOpen] = useState<boolean>(false);

  // In-App Notifications
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 'notif_1',
      title: 'Tax Document Under Review',
      message: 'Senior Reviewer Elena Rostova is conducting final compliance review on your 2025 return.',
      timestamp: '10 mins ago',
      isRead: false,
      type: 'info',
      linkTarget: 'client_portal'
    },
    {
      id: 'notif_2',
      title: 'Upcoming Consultation',
      message: 'Strategy session with Desmond Hinds confirmed for Sept 15 at 10:00 AM EST.',
      timestamp: '2 hours ago',
      isRead: false,
      type: 'success',
      linkTarget: 'client_portal'
    },
    {
      id: 'notif_3',
      title: 'Security Scan Passed',
      message: 'Zero vulnerabilities detected. AES-256 encrypted storage active.',
      timestamp: '1 day ago',
      isRead: true,
      type: 'info'
    }
  ]);

  // Synchronize location changes (supporting both popstate history and hash changes)
  useEffect(() => {
    const handleLocationChange = () => {
      const pageFromUrl = getPageFromUrl();
      if (pageFromUrl && pageFromUrl !== currentPage) {
        setCurrentPageState(pageFromUrl);
      }
    };
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, [currentPage]);

  const setCurrentPage = (page: PageRoute, params?: any) => {
    setCurrentPageState(page);
    if (params) setPageParams(params);
    if (typeof window !== 'undefined') {
      const targetPath = page === 'home' ? '/' : `/${page}`;
      try {
        window.history.pushState({ page }, '', targetPath);
      } catch {
        window.location.hash = `#/${page}`;
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sync state with backend
  const refreshBackendData = useCallback(async () => {
    setIsSyncingWithBackend(true);
    setIsLoadingData(true);
    setDataError(null);
    try {
      // 1. Check current session
      const meRes = await api.auth.getMe().catch(() => null);
      if (meRes?.user) {
        setCurrentUser(meRes.user);
        setCurrentRoleState(meRes.user.role);
      }

      // 2. Fetch parallel data
      const [docsRes, engsRes, aptsRes, invRes, connRes, msgsRes, jobsRes, legalRes] = await Promise.all([
        api.documents.list().catch(() => ({ documents: [] })),
        api.engagements.list().catch(() => ({ engagements: [] })),
        api.appointments.list().catch(() => ({ appointments: [] })),
        api.payments.getInvoices().catch(() => ({ invoices: [] })),
        api.integrations.list().catch(() => ({ connections: [] })),
        api.messages.list().catch(() => ({ messages: [] })),
        api.careers.getJobs().catch(() => ({ jobs: [] })),
        api.legal.list().catch(() => ({ legalRecords: [] }))
      ]);

      if (docsRes.documents?.length) setDocuments(docsRes.documents);
      if (engsRes.engagements?.length) setEngagements(engsRes.engagements);
      if (aptsRes.appointments?.length) setAppointments(aptsRes.appointments);
      if (invRes.invoices?.length) setInvoices(invRes.invoices);
      if (connRes.connections?.length) setAccountingConnections(connRes.connections);
      if (msgsRes.messages?.length) setMessages(msgsRes.messages);
      if (jobsRes.jobs?.length) setJobPostings(jobsRes.jobs);
      if (legalRes.legalRecords?.length) setLegalRecords(legalRes.legalRecords);

      // Onboarding state if logged in as client
      if (currentUser?.role === 'client' || currentUser?.role === 'prospective_client') {
        const onb = await api.onboarding.getState().catch(() => null);
        if (onb) {
          setOnboardingState(onb.state);
          setOnboardingProgress(onb.progress);
        }
      }

      // Admin logs if admin
      if (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') {
        const auditRes = await api.admin.getAuditLogs().catch(() => null);
        if (auditRes?.auditLogs) setAuditLogs(auditRes.auditLogs);
      }

      // Recruiter applicants if recruiter or admin
      if (['recruiter', 'admin', 'super_admin'].includes(currentUser?.role || '')) {
        const appsRes = await api.careers.getApplicants().catch(() => null);
        if (appsRes?.applicants) setApplicants(appsRes.applicants);
      }
    } catch (err: any) {
      console.warn('Backend sync note:', err);
      setDataError(err?.message || 'Failed to synchronize workspace records.');
    } finally {
      setIsSyncingWithBackend(false);
      setIsLoadingData(false);
      setIsInitialized(true);
    }
  }, [currentUser?.role]);

  // Initial mount: verify Firestore, seed services, and init session
  useEffect(() => {
    async function initSession() {
      // 1. Verify Firestore connectivity & seed services catalog
      testConnection().catch(() => {});
      seedInitialServicesIfEmpty().catch(() => {});

      // 2. Listen to live Firebase Auth state changes
      const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          const role = await getVerifiedUserRole(fbUser);
          setCurrentUser({
            id: fbUser.uid,
            name: fbUser.displayName || 'Michael Perotti',
            email: fbUser.email || 'm.perotti@example.com',
            role: role as UserRole,
            phone: '678-205-9486',
            companyName: 'Perotti Capital Holdings LLC',
            status: 'active',
            isVerified: true,
            createdAt: new Date().toISOString(),
            mfaEnabled: false
          });
          setCurrentRoleState(role as UserRole);
        }
      });

      const existingToken = getStoredToken();
      if (!existingToken) {
        // Authenticate Michael Perotti by default
        await switchTestAccount('user_client_1');
      } else {
        await refreshBackendData();
      }

      return () => unsubscribeAuth();
    }
    initSession();
  }, []);

  // Quick switch test accounts with verified server-side session token
  const switchTestAccount = async (userId: string) => {
    const target = INITIAL_USERS.find(u => u.id === userId);
    if (!target) return;

    setIsSyncingWithBackend(true);
    try {
      // Determine seed password
      const password = (target.role === 'client' || target.role === 'prospective_client')
        ? 'ClientPass123!'
        : 'FirmPass123!';

      const res = await api.auth.login(target.email, password, target.mfaEnabled ? '123456' : undefined);
      if (res.user) {
        setCurrentUser(res.user);
        setCurrentRoleState(res.user.role);

        // Auto-navigate to appropriate view
        if (res.user.role === 'client' || res.user.role === 'prospective_client') {
          setCurrentPage('client_portal');
        } else if (res.user.role === 'accountant' || res.user.role === 'senior_reviewer') {
          setCurrentPage('accountant_workspace');
        } else if (res.user.role === 'recruiter') {
          setCurrentPage('careers');
        } else if (res.user.role === 'admin' || res.user.role === 'super_admin') {
          setCurrentPage('admin_dashboard');
        }

        await refreshBackendData();
      }
    } catch (err: any) {
      console.warn('Could not authenticate test account via /api/auth/login:', err);
      // Fallback local update
      setCurrentUser(target);
      setCurrentRoleState(target.role);
    } finally {
      setIsSyncingWithBackend(false);
    }
  };

  // Role switch helper
  const setCurrentRole = (role: UserRole | 'guest') => {
    setCurrentRoleState(role);
    if (role === 'guest') {
      setCurrentUser(null);
      clearStoredToken();
      if (['client_portal', 'accountant_workspace', 'admin_dashboard'].includes(currentPage)) {
        setCurrentPage('home');
      }
      return;
    }

    const matchedUser = INITIAL_USERS.find(u => u.role === role);
    if (matchedUser) {
      switchTestAccount(matchedUser.id);
    }
  };

  // Real Auth Login with Firebase Auth
  const login = async (email: string, password: string, mfaCode?: string) => {
    try {
      // 1. Attempt Firebase Authentication
      const fbRes = await loginWithEmail(email, password);
      if (fbRes.success && fbRes.user) {
        const userObj: User = {
          id: fbRes.user.uid,
          name: fbRes.user.fullName,
          email: fbRes.user.email,
          role: fbRes.user.role,
          phone: fbRes.user.phone,
          companyName: fbRes.user.organizationId || 'Client Organization',
          status: 'active',
          isVerified: true,
          createdAt: new Date().toISOString(),
          mfaEnabled: false
        };
        setCurrentUser(userObj);
        setCurrentRoleState(fbRes.user.role);
        await refreshBackendData();
        return { success: true };
      }

      // 2. Fallback to express auth
      const res = await api.auth.login(email, password, mfaCode);
      if (res.mfaRequired) {
        return { success: false, mfaRequired: true, message: res.message };
      }
      if (res.user) {
        setCurrentUser(res.user);
        setCurrentRoleState(res.user.role);
        await refreshBackendData();
        return { success: true };
      }
      return { success: false, error: fbRes.error || 'Login failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  };

  // Real Auth Register with Firebase Auth
  const register = async (payload: { name: string; email: string; password?: string; phone?: string; companyName?: string; company?: string; clientType?: 'individual' | 'business'; role?: UserRole; taxFilingType?: string; }) => {
    try {
      const effectivePassword = payload.password || 'SecurePass@2025!';
      const effectiveCompanyName = payload.companyName || payload.company || 'Personal';
      const effectiveRole = payload.role || 'client';

      // 1. Provision client in Firebase Auth and Firestore
      const fbRes = await registerWithEmail(
        payload.name,
        payload.email,
        effectivePassword,
        payload.phone,
        effectiveCompanyName
      );

      if (fbRes.success && fbRes.user) {
        const userObj: User = {
          id: fbRes.user.uid,
          name: fbRes.user.fullName,
          email: fbRes.user.email,
          role: effectiveRole,
          phone: fbRes.user.phone,
          companyName: effectiveCompanyName,
          company: effectiveCompanyName,
          taxFilingType: payload.taxFilingType,
          status: 'active',
          isVerified: true,
          createdAt: new Date().toISOString(),
          mfaEnabled: false
        };
        setCurrentUser(userObj);
        setCurrentRoleState(effectiveRole);
        await refreshBackendData();
        return { 
          success: true, 
          verificationTokenSimulated: 'firebase-auth-verified' 
        };
      }

      // 2. Fallback to express registration
      const res = await api.auth.register({
        name: payload.name,
        email: payload.email,
        password: effectivePassword,
        phone: payload.phone,
        companyName: effectiveCompanyName,
        clientType: payload.clientType
      });
      if (res.user) {
        setCurrentUser(res.user);
        setCurrentRoleState(res.user.role || effectiveRole);
        await refreshBackendData();
        return { 
          success: true, 
          verificationTokenSimulated: res.verificationTokenSimulated 
        };
      }
      return { success: false, error: fbRes.error || 'Registration failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed' };
    }
  };

  // Real Auth Logout
  const logout = async () => {
    try {
      await firebaseLogout().catch(() => {});
      await api.auth.logout().catch(() => {});
    } finally {
      clearStoredToken();
      setCurrentUser(null);
      setCurrentRoleState('guest');
      setCurrentPage('home');
    }
  };

  // Upload Document with AI Extraction & Malware scanning hook + Firestore storage record
  const uploadDocument = async (docData: Partial<DocumentItem>, sampleText?: string): Promise<DocumentItem | null> => {
    try {
      const docId = docData.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const clientId = currentUser?.id || 'client_1';

      // Record to Firestore
      setDoc(doc(db, 'documents', docId), {
        id: docId,
        clientId,
        uploadedBy: currentUser?.name || 'Client',
        fileName: docData.fileName || 'Uploaded_Document.pdf',
        category: docData.category || 'other',
        year: docData.taxYear || 2025,
        status: 'pending_review',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch((e) => console.warn('Firestore doc sync notice:', e));

      const res = await api.documents.upload({
        fileName: docData.fileName || 'Uploaded_Document.pdf',
        fileSize: docData.fileSize || '1.2 MB',
        fileType: docData.fileType || 'application/pdf',
        category: docData.category || 'other',
        taxYear: docData.taxYear || 2025,
        description: docData.description || 'Uploaded to 256-bit encrypted vault',
        rawContentSample: sampleText || `Sample OCR text for ${docData.fileName}`
      });

      const newDoc = res.document;
      setDocuments(prev => [newDoc, ...prev.filter(d => d.id !== newDoc.id)]);

      setNotifications(prev => [
        {
          id: `notif_${Date.now()}`,
          title: 'Document Securely Encrypted',
          message: `${newDoc.fileName} was verified by anti-malware and processed by AI extraction (${newDoc.ocrConfidence || 95}% confidence).`,
          timestamp: 'Just now',
          isRead: false,
          type: 'success',
          linkTarget: 'client_portal'
        },
        ...prev
      ]);

      return newDoc;
    } catch (err: any) {
      console.error('Document upload error:', err);
      return null;
    }
  };

  // Update Document Status (Accountant or Reviewer)
  const updateDocumentStatus = async (docId: string, status: DocumentStatus, notes?: string, correctedFields?: any[]) => {
    try {
      await api.documents.review(docId, { status, reviewerNotes: notes, correctedFields });
      setDocuments(prev => prev.map(doc => {
        if (doc.id === docId) {
          return {
            ...doc,
            status,
            reviewerNotes: notes || doc.reviewerNotes,
            reviewedBy: currentUser?.name,
            reviewedAt: new Date().toISOString(),
            extractedData: correctedFields || doc.extractedData
          };
        }
        return doc;
      }));
    } catch (err) {
      console.error('Document review update error:', err);
    }
  };

  // Verify Single Extracted Field
  const verifyExtractedField = (docId: string, fieldKey: string, newValue?: string | number) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === docId && doc.extractedData) {
        const updatedFields = doc.extractedData.map(f => {
          if (f.key === fieldKey) {
            return {
              ...f,
              value: newValue !== undefined ? newValue : f.value,
              reviewed: true,
              needsAttention: false
            };
          }
          return f;
        });
        // Also call backend update
        api.documents.review(docId, { status: doc.status, correctedFields: updatedFields }).catch(() => {});
        return { ...doc, extractedData: updatedFields };
      }
      return doc;
    }));
  };

  // Update Engagement Status with Maker-Checker Enforcement
  const updateEngagementStatus = async (engId: string, status: EngagementStatus, notes?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      let progress = 50;
      if (status === 'in_preparation') progress = 40;
      if (status === 'under_review') progress = 75;
      if (status === 'ready_for_signature') progress = 90;
      if (status === 'completed' || status === 'delivered') progress = 100;

      const res = await api.engagements.updateStatus(engId, { status, progressPercent: progress, notes });
      setEngagements(prev => prev.map(eng => eng.id === engId ? res.engagement : eng));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Dispatch Form 8879 Deliverable
  const dispatch8879 = async (engId: string) => {
    try {
      const res = await api.engagements.dispatch8879(engId);
      setEngagements(prev => prev.map(e => e.id === engId ? res.engagement : e));
      await refreshBackendData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Toggle task in engagement
  const toggleEngagementTask = (engId: string, taskId: string) => {
    setEngagements(prev => prev.map(eng => {
      if (eng.id === engId) {
        const updatedTasks = eng.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
        const completedCount = updatedTasks.filter(t => t.completed).length;
        const progress = Math.round((completedCount / updatedTasks.length) * 100);
        return {
          ...eng,
          tasks: updatedTasks,
          progressPercent: progress,
          updatedAt: new Date().toISOString()
        };
      }
      return eng;
    }));
  };

  // Book Appointment with Double Booking & Conflict Prevention + Firestore Sync
  const bookAppointment = async (aptData: Omit<Appointment, 'id' | 'createdAt' | 'status'>): Promise<{ success: boolean; error?: string; appointment?: Appointment }> => {
    try {
      const aptId = `apt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      setDoc(doc(db, 'appointments', aptId), {
        id: aptId,
        clientId: currentUser?.id || 'client_1',
        ...aptData,
        status: 'confirmed',
        createdAt: serverTimestamp()
      }).catch((e) => console.warn('Firestore appointment sync notice:', e));

      const res = await api.appointments.book(aptData);
      setAppointments(prev => [res.appointment, ...prev]);

      setNotifications(prev => [
        {
          id: `notif_${Date.now()}`,
          title: 'Consultation Confirmed',
          message: `Your ${res.appointment.serviceType} with ${res.appointment.accountantName} has been booked for ${res.appointment.date} at ${res.appointment.timeSlot} EST.`,
          timestamp: 'Just now',
          isRead: false,
          type: 'success',
          linkTarget: 'client_portal'
        },
        ...prev
      ]);

      return { success: true, appointment: res.appointment };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const cancelAppointment = async (aptId: string) => {
    try {
      await api.appointments.update(aptId, { status: 'cancelled' });
      setAppointments(prev => prev.map(apt => apt.id === aptId ? { ...apt, status: 'cancelled' } : apt));
    } catch (err) {
      console.error('Cancel appointment error:', err);
    }
  };

  // Pay Invoice with Idempotency Key & PCI compliance
  const payInvoice = async (invId: string, paymentMethod: string = 'Credit Card (Stored Vault)', idempotencyKey?: string): Promise<{ success: boolean; error?: string; receipt?: any }> => {
    try {
      const targetInv = invoices.find(i => i.id === invId);
      const amount = targetInv ? targetInv.amount : 250;

      const res = await api.payments.charge({
        amount,
        invoiceId: invId,
        paymentMethod,
        idempotencyKey: idempotencyKey || `idem_${Date.now()}`
      });

      setInvoices(prev => prev.map(inv => inv.id === invId ? res.invoice : inv));

      setNotifications(prev => [
        {
          id: `notif_${Date.now()}`,
          title: 'Payment Confirmed',
          message: `Settlement of $${amount} USD completed. Receipt ${res.receipt?.receiptNumber || 'REC-PCI'} generated.`,
          timestamp: 'Just now',
          isRead: false,
          type: 'success',
          linkTarget: 'client_portal'
        },
        ...prev
      ]);

      return { success: true, receipt: res.receipt };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateServicePlan = async (planId: string, updatedPlan: Partial<ServicePlan>) => {
    try {
      if (updatedPlan.price !== undefined) {
        await api.admin.updatePlanPrice(planId, updatedPlan.price);
      }
      setServicePlans(prev => prev.map(p => p.id === planId ? { ...p, ...updatedPlan } : p));
    } catch (err) {
      console.error('Update plan error:', err);
    }
  };

  // Accounting Integrations
  const triggerAccountingSync = async (connectionId: string) => {
    setAccountingConnections(prev => prev.map(c => c.id === connectionId ? { ...c, status: 'syncing' } : c));
    try {
      const res = await api.integrations.sync(connectionId);
      setAccountingConnections(prev => prev.map(c => c.id === connectionId ? res.connection : c));
    } catch (err) {
      console.error('Accounting sync error:', err);
    }
  };

  const connectAccountingProvider = async (provider: string, companyName?: string) => {
    try {
      const res = await api.integrations.connect(provider, companyName);
      setAccountingConnections(prev => [res.connection, ...prev]);
    } catch (err) {
      console.error('Connect provider error:', err);
    }
  };

  const disconnectAccountingProvider = async (connectionId: string) => {
    try {
      const res = await api.integrations.disconnect(connectionId);
      setAccountingConnections(prev => prev.map(c => c.id === connectionId ? res.connection : c));
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  };

  // Messaging & Staff Notes
  const sendMessage = async (content: string, isInternalOnly: boolean, engagementId?: string) => {
    try {
      const res = await api.messages.send({
        content,
        isInternalNote: isInternalOnly,
        engagementId: engagementId || 'eng_2025_001'
      });
      setMessages(prev => [...prev, res.messageData]);
    } catch (err) {
      console.error('Send message error:', err);
    }
  };

  // Job Application
  const submitJobApplication = async (appData: Omit<Applicant, 'id' | 'appliedDate' | 'status'>): Promise<boolean> => {
    try {
      await api.careers.apply(appData);
      setNotifications(prev => [
        {
          id: `notif_${Date.now()}`,
          title: 'Job Application Received',
          message: `Thank you ${appData.fullName}. Your resume has been submitted for review.`,
          timestamp: 'Just now',
          isRead: false,
          type: 'success',
          linkTarget: 'careers'
        },
        ...prev
      ]);
      return true;
    } catch (err) {
      console.error('Job application error:', err);
      return false;
    }
  };

  const updateApplicantStatus = async (appId: string, status: Applicant['status']) => {
    try {
      const res = await api.careers.updateApplicant(appId, { status });
      setApplicants(prev => prev.map(a => a.id === appId ? res.applicant : a));
    } catch (err) {
      console.error('Update applicant status error:', err);
    }
  };

  const applyForJob = useCallback(async (application: JobApplication): Promise<JobApplicationResult> => {
    try {
      const res = await api.careers.apply(application);
      if (res && res.applicantId) {
        const newApp: Applicant = {
          id: res.applicantId,
          jobId: application.jobId,
          jobTitle: application.jobTitle,
          fullName: application.fullName,
          email: application.email,
          phone: application.phone,
          linkedinUrl: application.linkedinUrl,
          yearsExperience: application.yearsExperience || 3,
          resumeFileName: application.resumeFileName,
          coverLetter: application.coverLetter || '',
          status: 'submitted',
          appliedAt: new Date().toISOString()
        };
        setApplicants(prev => [newApp, ...prev]);

        // Increment applicant count for the specific job
        setJobPostings(prev => prev.map(j => {
          if (j.id === application.jobId) {
            return { ...j, applicantCount: (j.applicantCount || 0) + 1 };
          }
          return j;
        }));

        return {
          success: true,
          applicantId: res.applicantId,
          message: res.message || 'Application submitted successfully.'
        };
      }
      return {
        success: false,
        error: res?.message || 'Application submission was rejected by the server.',
        message: res?.message || 'Submission rejected.'
      };
    } catch (err: any) {
      const msg = err?.message || 'Application submission failed. Please try again.';
      return {
        success: false,
        error: msg,
        message: msg
      };
    }
  }, []);

  // Onboarding wizard + Firestore Sync
  const saveOnboardingStep = async (stepData: Partial<OnboardingState>): Promise<boolean> => {
    try {
      const clientId = currentUser?.id || 'client_1';
      setDoc(doc(db, 'onboarding_dossiers', clientId), {
        clientId,
        ...stepData,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch((e) => console.warn('Firestore onboarding sync notice:', e));

      const res = await api.onboarding.saveStep(stepData);
      setOnboardingState(res.state);
      setOnboardingProgress(res.progress);
      return true;
    } catch (err) {
      console.error('Save onboarding step error:', err);
      return false;
    }
  };

  const submitOnboardingDossier = async (): Promise<boolean> => {
    try {
      const clientId = currentUser?.id || 'client_1';
      setDoc(doc(db, 'onboarding_dossiers', clientId), {
        clientId,
        submitted: true,
        status: 'pending_review',
        submittedAt: serverTimestamp()
      }, { merge: true }).catch((e) => console.warn('Firestore onboarding submit sync notice:', e));

      const res = await api.onboarding.submitDossier();
      setOnboardingState(res.state);
      return true;
    } catch (err) {
      console.error('Submit onboarding error:', err);
      return false;
    }
  };

  // Legal Record + Firestore Sync
  const createLegalRecord = async (record: Partial<LegalCoordinationRecord>): Promise<boolean> => {
    try {
      const recId = record.id || `legal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      setDoc(doc(db, 'consentRecords', recId), {
        ...record,
        id: recId,
        createdAt: serverTimestamp()
      }).catch((e) => console.warn('Firestore legal record sync notice:', e));

      const res = await api.legal.create(record);
      setLegalRecords(prev => [res.record, ...prev]);
      return true;
    } catch (err) {
      console.error('Create legal record error:', err);
      return false;
    }
  };

  // Automated Security Test Suite Runner
  const runSecuritySuite = async () => {
    try {
      const res = await api.security.runNegativeTests();
      setSecurityTestResults(res.results);
      return res;
    } catch (err) {
      console.error('Run security tests error:', err);
      return null;
    }
  };

  const markNotificationRead = (notifId: string) => {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const addNotification = useCallback((notif: any) => {
    const newNotif: AppNotification = {
      id: notif.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: notif.title || 'Notification',
      message: notif.message || '',
      timestamp: notif.timestamp || 'Just now',
      isRead: notif.isRead ?? notif.read ?? false,
      type: notif.type || 'info',
      linkTarget: notif.linkTarget
    };
    setNotifications(prev => [newNotif, ...prev]);
  }, []);

  const addAuditLog = useCallback((actionOrLog: string | Partial<AuditLog>, userRoleOrResource?: string, detailsStr?: string) => {
    let newLog: AuditLog;
    if (typeof actionOrLog === 'string') {
      newLog = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toISOString(),
        action: actionOrLog,
        userRole: (userRoleOrResource as any) || currentUser?.role || 'guest',
        userId: currentUser?.id || 'public',
        userName: currentUser?.name || 'Public Visitor',
        resource: 'Public Inquiry',
        details: detailsStr || '',
        ipAddress: '127.0.0.1',
        severity: 'info'
      };
    } else {
      newLog = {
        id: actionOrLog.id || `audit_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        timestamp: actionOrLog.timestamp || new Date().toISOString(),
        action: actionOrLog.action || 'GENERAL_ACTION',
        userRole: actionOrLog.userRole || currentUser?.role || 'guest',
        userId: actionOrLog.userId || currentUser?.id || 'system',
        userName: actionOrLog.userName || currentUser?.name || 'System User',
        resource: actionOrLog.resource || 'System',
        details: actionOrLog.details || '',
        ipAddress: actionOrLog.ipAddress || '127.0.0.1',
        severity: actionOrLog.severity || 'info'
      };
    }
    setAuditLogs(prev => [newLog, ...prev]);
  }, [currentUser]);

  const updateServicePlanPrice = useCallback(async (
    planId: string, 
    newPrice: number, 
    changeReason: string = 'Annual firm pricing schedule update',
    currency: 'USD' = 'USD'
  ): Promise<ServicePlanUpdateResult> => {
    try {
      const res = await api.admin.updatePlanPrice(planId, newPrice, changeReason, currency);
      if (res && res.plan) {
        setServicePlans(prev => prev.map(p => p.id === planId ? res.plan : p));
        return {
          success: true,
          message: res.message,
          plan: res.plan
        };
      }
      return {
        success: false,
        error: 'Failed to update plan pricing.',
        message: 'Failed to update plan pricing.'
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to update service plan price.',
        message: err?.message || 'Failed to update service plan price.'
      };
    }
  }, []);

  const toggleUserStatus = useCallback(async (
    userId: string,
    reason: string = 'Administrative account maintenance',
    confirmation: boolean = true
  ): Promise<UserStatusUpdateResult> => {
    try {
      const targetUser = users.find(u => u.id === userId);
      const nextStatus = targetUser?.status === 'active' ? 'suspended' : 'active';
      const res = await api.admin.setUserStatus(userId, nextStatus as any, reason, confirmation);
      if (res && res.user) {
        setUsers(prev => prev.map(u => u.id === userId ? res.user : u));
        return {
          success: true,
          message: res.message,
          user: res.user
        };
      }
      return {
        success: false,
        error: 'Failed to update user status.',
        message: 'Failed to update user status.'
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to update user status.',
        message: err?.message || 'Failed to update user status.'
      };
    }
  }, [users]);

  const impersonateUser = useCallback(async (userId: string): Promise<{ success: boolean; error?: string }> => {
    console.warn(`[SECURITY AUDIT] Attempted impersonation of user ${userId} blocked per firm policy.`);
    return {
      success: false,
      error: 'Direct user impersonation is disabled per firm security and SOC 2 / IRS data protection policies. Support sessions require verified dual-custody authorization.'
    };
  }, []);

  const reassignClient = useCallback(async (
    clientId: string, 
    accountantId: string, 
    reviewerId?: string,
    reason: string = 'Administrative workload balancing'
  ): Promise<ClientReassignmentResult> => {
    try {
      const res = await api.admin.reassignClient(clientId, accountantId, reviewerId, reason);
      await refreshBackendData();
      return {
        success: true,
        message: res.message,
        client: res.client
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to reassign client.',
        message: err?.message || 'Failed to reassign client.'
      };
    }
  }, [refreshBackendData]);

  const contextValue = useMemo<AppContextType>(() => ({
    currentUser,
    currentRole,
    setCurrentRole,
    currentPage,
    setCurrentPage,
    pageParams,
    isSyncingWithBackend,
    isLoadingData,
    isInitialized,
    dataError,
    users,
    engagements,
    documents,
    appointments,
    servicePlans,
    invoices,
    accountingConnections,
    messages,
    jobPostings,
    jobs: jobPostings,
    selectedJob,
    setSelectedJob,
    applyForJob,
    applicants,
    auditLogs,
    notifications,
    onboardingState,
    onboardingProgress,
    legalRecords,
    securityTestResults,
    login,
    register,
    logout,
    switchTestAccount,
    uploadDocument,
    updateDocumentStatus,
    verifyExtractedField,
    updateEngagementStatus,
    dispatch8879,
    toggleEngagementTask,
    bookAppointment,
    cancelAppointment,
    payInvoice,
    updateServicePlan,
    triggerAccountingSync,
    connectAccountingProvider,
    disconnectAccountingProvider,
    sendMessage,
    submitJobApplication,
    updateApplicantStatus,
    saveOnboardingStep,
    submitOnboardingDossier,
    createLegalRecord,
    runSecuritySuite,
    refreshBackendData,
    addAuditLog,
    addNotification,
    markNotificationRead,
    clearAllNotifications,
    updateServicePlanPrice,
    toggleUserStatus,
    impersonateUser,
    reassignClient,
    cookieConsentAccepted,
    setCookieConsentAccepted,
    cookieModalOpen,
    setCookieModalOpen
  }), [
    currentUser,
    currentRole,
    currentPage,
    pageParams,
    isSyncingWithBackend,
    isLoadingData,
    isInitialized,
    dataError,
    users,
    engagements,
    documents,
    appointments,
    servicePlans,
    invoices,
    accountingConnections,
    messages,
    jobPostings,
    selectedJob,
    applyForJob,
    applicants,
    auditLogs,
    notifications,
    onboardingState,
    onboardingProgress,
    legalRecords,
    securityTestResults,
    login,
    register,
    logout,
    switchTestAccount,
    uploadDocument,
    updateDocumentStatus,
    verifyExtractedField,
    updateEngagementStatus,
    dispatch8879,
    toggleEngagementTask,
    bookAppointment,
    cancelAppointment,
    payInvoice,
    updateServicePlan,
    triggerAccountingSync,
    connectAccountingProvider,
    disconnectAccountingProvider,
    sendMessage,
    submitJobApplication,
    updateApplicantStatus,
    saveOnboardingStep,
    submitOnboardingDossier,
    createLegalRecord,
    runSecuritySuite,
    refreshBackendData,
    addAuditLog,
    addNotification,
    markNotificationRead,
    clearAllNotifications,
    updateServicePlanPrice,
    toggleUserStatus,
    impersonateUser,
    reassignClient,
    cookieConsentAccepted,
    cookieModalOpen
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
