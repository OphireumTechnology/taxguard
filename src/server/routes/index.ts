import express, { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db';
import {
  authenticateToken,
  createSession,
  revokeSession,
  verifyPassword,
  requireRole,
  type AuthenticatedRequest,
} from '../auth';
import { practiceStoreConfigured } from '../taxguard/practice/practiceStoreConfig';

function sanitizeUser(user: any) {
  if (!user) return null;
  const { passwordHash: _pw, ...safe } = user;
  return safe;
}

function createDurableStoreUnavailableRouter(domain: string): Router {
  const router = Router();
  router.use(authenticateToken);
  router.all('*', (_req, res) => {
    res.status(503).json({
      code: 'DURABLE_STORE_NOT_CONFIGURED',
      domain,
      error: `The ${domain} durable store is not configured in this environment.`,
    });
  });
  return router;
}

export function staffAccessDevelopmentConfigured(): boolean {
  return process.env.NODE_ENV !== 'production' && practiceStoreConfigured();
}

export function createPublicConsultationRouter(): Router {
  const router = Router();
  router.use(express.json({ limit: '8kb' }));

  const requests: any[] = [];

  router.post('/', (req: Request, res: Response) => {
    const body = req.body || {};
    const name = String(body.name || body.fullName || '').trim();
    const email = String(body.email || '').trim();
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({
        code: 'INVALID_CONSULTATION_REQUEST',
        error: 'Please provide a valid name and email address.',
      });
      return;
    }
    const record = {
      id: `cons_${randomUUID()}`,
      name,
      email,
      phone: body.phone ? String(body.phone).trim() : undefined,
      serviceType: body.serviceType || body.service || 'General Consultation',
      preferredDate: body.preferredDate || null,
      notes: body.notes || body.message || '',
      status: 'received',
      createdAt: new Date().toISOString(),
    };
    requests.push(record);
    res.status(201).json({
      success: true,
      requestId: record.id,
      status: record.status,
      message: 'Your consultation request has been received. A Destria advisor will contact you shortly.',
    });
  });

  return router;
}

export function createPublicContactRouter(): Router {
  const router = Router();
  router.use(express.json({ limit: '8kb' }));

  router.post('/', (req: Request, res: Response) => {
    const body = req.body || {};
    const name = String(body.name || body.fullName || '').trim();
    const email = String(body.email || '').trim();
    const message = String(body.message || '').trim();
    if (!name || !email || !message) {
      res.status(400).json({
        code: 'INVALID_CONTACT_REQUEST',
        error: 'Name, email, and message are required.',
      });
      return;
    }
    res.status(201).json({
      success: true,
      referenceId: `ct_${randomUUID().slice(0, 8).toUpperCase()}`,
      message: 'Thank you for contacting Destria Tax Services LLC. Our team will respond promptly.',
    });
  });

  return router;
}

export function createScanCallbackRouter(_deps: any): Router {
  const router = Router();
  router.use(express.json({ limit: '2kb' }));
  router.post('/callback', (_req, res) => {
    res.status(503).json({ code: 'SCANNER_NOT_CONFIGURED' });
  });
  return router;
}

export const authRouter = Router();

authRouter.get('/local-login-status', (_req, res) => {
  const localLoginAvailable = process.env.NODE_ENV !== 'production';
  res.json({ localLoginAvailable });
});

authRouter.post('/login', (req: Request, res: Response) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) {
    res.status(400).json({ code: 'INVALID_CREDENTIALS', error: 'Email and password are required.' });
    return;
  }

  const user = Array.from(db.users.values()).find(
    (u) => (u.email || '').toLowerCase() === email
  );
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ code: 'INVALID_CREDENTIALS', error: 'Invalid email or password.' });
    return;
  }
  if (user.status === 'disabled' || user.status === 'suspended') {
    res.status(403).json({ code: 'ACCOUNT_SUSPENDED', error: 'This account is not active.' });
    return;
  }

  const token = createSession(user.id, user.role, true);
  res.json({
    success: true,
    token,
    user: sanitizeUser(user),
  });
});

authRouter.post('/logout', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.token) revokeSession(req.token);
  res.json({ success: true });
});

authRouter.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: sanitizeUser(req.user) });
});

authRouter.post('/supabase-session', (_req, res) => {
  res.status(503).json({
    code: 'SUPABASE_NOT_CONFIGURED',
    error: 'Supabase identity integration is not configured in this environment.',
  });
});

export const careersRouter = Router();

careersRouter.get('/jobs', (_req, res) => {
  res.json({ jobs: Array.from(db.jobs.values()) });
});

careersRouter.post('/apply', (req: Request, res: Response) => {
  const body = req.body || {};
  const id = `app_${randomUUID()}`;
  const applicant = {
    id,
    jobId: String(body.jobId || ''),
    name: String(body.name || '').trim(),
    email: String(body.email || '').trim(),
    phone: body.phone ? String(body.phone).trim() : '',
    coverLetter: body.coverLetter ? String(body.coverLetter) : '',
    status: 'received',
    appliedAt: new Date().toISOString(),
  };
  db.applicants.set(id, applicant as any);
  res.status(201).json({ success: true, applicationId: id, message: 'Application submitted successfully.' });
});

careersRouter.get('/applicants', authenticateToken, requireRole('admin', 'administrator', 'super_admin', 'super_administrator', 'practice_manager'), (_req, res) => {
  res.json({ applicants: Array.from(db.applicants.values()) });
});

export const taxFormsRouter = Router();
taxFormsRouter.use(authenticateToken);
taxFormsRouter.get('/catalog', (_req, res) => {
  res.json({
    forms: [
      { id: 'f1040', code: 'Form 1040', title: 'U.S. Individual Income Tax Return', group: 'federal-individual', preparation: 'Draft Preparation', taxYear: 2025 },
      { id: 'f1120s', code: 'Form 1120-S', title: 'U.S. Income Tax Return for an S Corporation', group: 'federal-business', preparation: 'Draft Preparation', taxYear: 2025 },
      { id: 'f1065', code: 'Form 1065', title: 'U.S. Return of Partnership Income', group: 'federal-business', preparation: 'Draft Preparation', taxYear: 2025 },
      { id: 'f1120', code: 'Form 1120', title: 'U.S. Corporation Income Tax Return', group: 'federal-business', preparation: 'Rules Verified', taxYear: 2025 },
    ],
    states: [
      { code: 'SC', name: 'South Carolina', categories: ['income', 'sales', 'payroll'] },
      { code: 'GA', name: 'Georgia', categories: ['income', 'sales', 'payroll'] },
      { code: 'NC', name: 'North Carolina', categories: ['income', 'sales', 'payroll'] },
    ],
    updatedAt: new Date().toISOString(),
  });
});

export const liveWorkflowRouter = Router();
liveWorkflowRouter.use(authenticateToken);
liveWorkflowRouter.get('/state', (req: AuthenticatedRequest, res: Response) => {
  const clientId = String(req.query.clientId || req.user?.clientId || '');
  const taxYear = Number(req.query.taxYear || 2025);
  res.json({
    clientId,
    taxYear,
    activeStage: 1,
    completedStages: [],
    stageStates: { '1': 'in_progress' },
    eligibility: { stage1Ready: true },
    updatedAt: new Date().toISOString(),
  });
});
liveWorkflowRouter.get('/eligibility', (req: AuthenticatedRequest, res: Response) => {
  res.json({
    clientId: String(req.query.clientId || req.user?.clientId || ''),
    taxYear: Number(req.query.taxYear || 2025),
    eligibleStages: [1, 2],
  });
});
liveWorkflowRouter.post('/complete-stage', (_req, res) => {
  res.json({ success: true, activeStage: 2, stageStates: { '1': 'completed', '2': 'in_progress' } });
});

export const onboardingRouter = Router();
onboardingRouter.use(authenticateToken);
onboardingRouter.get('/state', (req: AuthenticatedRequest, res: Response) => {
  const clientId = req.user?.clientId || req.user?.id || '';
  const state = db.onboardingStates?.get(clientId) || {
    clientId,
    step: 1,
    completed: false,
    status: 'in_progress',
    percentComplete: 25,
  };
  res.json({ state });
});
onboardingRouter.post('/step', (req: AuthenticatedRequest, res: Response) => {
  const clientId = req.user?.clientId || req.user?.id || '';
  const next = { ...(req.body || {}), clientId, updatedAt: new Date().toISOString() };
  db.onboardingStates?.set(clientId, next);
  res.json({ success: true, state: next });
});
onboardingRouter.post('/submit', (req: AuthenticatedRequest, res: Response) => {
  const clientId = req.user?.clientId || req.user?.id || '';
  const next = { ...(req.body || {}), clientId, completed: true, status: 'submitted', updatedAt: new Date().toISOString() };
  db.onboardingStates?.set(clientId, next);
  res.json({ success: true, state: next });
});

export const accountantRouter = Router();
accountantRouter.use(authenticateToken);
accountantRouter.get('/dashboard', (_req, res) => {
  res.json({
    cases: Array.from(db.engagements.values()),
    documents: Array.from(db.documents.values()),
    summary: {
      totalCases: db.engagements.size,
      totalDocuments: db.documents.size,
    },
  });
});

export const adminRouter = Router();
adminRouter.use(authenticateToken, requireRole('admin', 'administrator', 'super_admin', 'super_administrator'));
adminRouter.get('/audit-logs', (_req, res) => {
  res.json({ logs: Array.from(db.auditLogs.values()) });
});
adminRouter.get('/system-health', (_req, res) => {
  res.json({ status: 'healthy', users: db.users.size, engagements: db.engagements.size });
});

export const superAdminRouter = Router();
superAdminRouter.use(authenticateToken, requireRole('super_admin', 'super_administrator'));
superAdminRouter.get('/session', (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: sanitizeUser(req.user), active: true });
});
superAdminRouter.post('/dashboard-view', (_req, res) => {
  res.json({ recorded: true });
});

export const taxguardAiRouter = Router();
taxguardAiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'proposal_only',
    aiEnabled: process.env.TAXGUARD_AI_ENABLED === 'true',
    externalSubmissionAllowed: false,
  });
});
taxguardAiRouter.post('/propose', authenticateToken, (_req, res) => {
  res.status(503).json({
    code: 'AI_PROPOSAL_UNAVAILABLE',
    error: 'TaxGuard AI proposal service is not commissioned in this environment.',
  });
});

export function handleLegacyTaxGuardRoute(_req: Request, res: Response) {
  res.status(403).json({
    code: 'LEGACY_TAXGUARD_RETIRED',
    error: 'Standalone TaxGuard console has been retired. Use your authorized role dashboard.',
  });
}

export function mountRetiredLegacyRoutes(app: express.Express) {
  const retired = ['/api/engagements', '/api/appointments', '/api/payments', '/api/messages', '/api/legal', '/api/assignments'];
  for (const path of retired) {
    app.use(path, (_req, res) => {
      res.status(410).json({ code: 'LEGACY_ROUTE_RETIRED', error: `Endpoint ${path} has been retired.` });
    });
  }
}

export const createStaffAccessRouter = () => createDurableStoreUnavailableRouter('staff-access');
export const createPracticeRouter = () => createDurableStoreUnavailableRouter('practice');
export const createOnboardingRouter = () => createDurableStoreUnavailableRouter('stage-one');
export const createCasesRouter = () => createDurableStoreUnavailableRouter('cases');
export const createVaultRouter = (_opts?: any) => createDurableStoreUnavailableRouter('vault');
export const createBillingRouter = () => createDurableStoreUnavailableRouter('billing');
export const createBookToTaxRouter = () => createDurableStoreUnavailableRouter('book-to-tax');
export const createTaxEngineRouter = () => createDurableStoreUnavailableRouter('tax-engine');
export const createCommunicationsRouter = () => createDurableStoreUnavailableRouter('communications');
export const createSchedulingRouter = () => createDurableStoreUnavailableRouter('scheduling');
export const createAuditCenterRouter = () => createDurableStoreUnavailableRouter('audit-center');
export const createLegalMattersRouter = () => createDurableStoreUnavailableRouter('legal-matters');
export const createConsultationReviewRouter = () => createDurableStoreUnavailableRouter('consultations');
export const createClientPortalRouter = () => createDurableStoreUnavailableRouter('client-portal');
export const createClientSignaturesRouter = () => createDurableStoreUnavailableRouter('client-signatures');
export const createReassignmentRouter = () => createDurableStoreUnavailableRouter('reassignment');
export const createJobsRouter = () => createDurableStoreUnavailableRouter('jobs');
export const createAiGovernanceRouter = () => createDurableStoreUnavailableRouter('ai-governance');
export const createAccountantDashboardRouter = () => accountantRouter;

export const documentsRouter = createDurableStoreUnavailableRouter('documents');
export const integrationsRouter = createDurableStoreUnavailableRouter('integrations');
export const securityRouter = createDurableStoreUnavailableRouter('security');
export const calendarRouter = createDurableStoreUnavailableRouter('calendar');
export const consultationRoomRouter = createDurableStoreUnavailableRouter('consultation-rooms');
export const intakeRouter = createDurableStoreUnavailableRouter('intake');
export const stagingRouter = createDurableStoreUnavailableRouter('staging');
export const monitoringRouter = createDurableStoreUnavailableRouter('monitoring');
export const taxguardRouter = createDurableStoreUnavailableRouter('taxguard');
export const accountingIntakeRouter = createDurableStoreUnavailableRouter('accounting-intake');
export const profileAmendmentRouter = createDurableStoreUnavailableRouter('profile');
export const practiceConsoleRouter = createDurableStoreUnavailableRouter('practice-console');
export const stageTwoThreeRouter = createDurableStoreUnavailableRouter('stage-two-three');
export const bookkeepingRouter = createDurableStoreUnavailableRouter('bookkeeping');
export const practiceOperationsRouter = createDurableStoreUnavailableRouter('operations');
export const caseAuthorityRouter = createDurableStoreUnavailableRouter('case-authority');
