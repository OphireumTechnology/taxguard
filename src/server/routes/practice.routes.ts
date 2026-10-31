/**
 * Client and engagement management API (/api/practice). Development-only until proposal 025
 * is reviewed and applied: the router answers only with an injected store (tests) or when
 * TAXGUARD_PRACTICE_STORE=durable points at a non-production Supabase project; otherwise
 * 503. Not mounted in createProductionApp. The database re-verifies every authority rule.
 */
import { Router, type RequestHandler, type Response } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { getSupabaseAdmin } from '../supabase';
import { practiceStoreConfigured } from '../taxguard/practice/practiceStoreConfig';
import { PracticeStore, PracticeStoreError } from '../taxguard/practice/practiceStore';

export interface PracticeRouterDeps { store?: () => PracticeStore; authenticate?: RequestHandler }

export { practiceStoreConfigured };

export function createPracticeRouter(deps: PracticeRouterDeps = {}) {
  const router = Router();
  let cached: PracticeStore | null = null;
  const store = () => deps.store?.() ?? (cached ??= new PracticeStore(getSupabaseAdmin() as any));
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!deps.store && !practiceStoreConfigured()) return res.status(503).json({ code: 'PRACTICE_STORE_UNAVAILABLE' });
    next();
  });
  router.use(deps.authenticate || authenticateToken);
  router.use((req: AuthenticatedRequest, res, next) => {
    const user = req.user;
    if (!user?.tenantId || user.status !== 'active' || ['client', 'prospective_client'].includes(user.role)) return res.status(403).json({ code: 'PRACTICE_ACCESS_DENIED' });
    next();
  });
  const run = (handler: (req: AuthenticatedRequest) => Promise<unknown>, status = 200): RequestHandler => async (req, res: Response) => {
    try { return res.status(status).json(await handler(req as AuthenticatedRequest)); }
    catch (error) {
      if (error instanceof PracticeStoreError) return res.status(error.status).json({ code: error.code });
      return res.status(503).json({ code: 'PRACTICE_STORE_UNAVAILABLE' });
    }
  };
  const t = (req: AuthenticatedRequest) => req.user!.tenantId!;
  const u = (req: AuthenticatedRequest) => req.user!.id;
  const key = (req: AuthenticatedRequest) => req.get('idempotency-key') || '';
  const str = (v: unknown) => typeof v === 'string' ? v : undefined;
  const int = (v: unknown) => typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;

  router.get('/my-work', run(req => store().myWork(t(req), u(req))));
  router.get('/workload', run(req => store().workload(t(req), u(req), str(req.query.userId))));
  router.get('/summary', run(req => store().practiceSummary(t(req), u(req), req.query.taxYear ? int(req.query.taxYear) : undefined)));
  router.get('/clients', run(req => store().listClients(t(req), u(req), { q: str(req.query.q), status: str(req.query.status) as any, clientType: str(req.query.clientType),
    after: str(req.query.cursor), limit: req.query.limit === undefined ? undefined : int(req.query.limit) })));
  router.get('/clients/:clientId', run(req => store().clientDetail(t(req), req.params.clientId, u(req))));
  router.post('/clients/:clientId/status', run(req => store().setClientStatus(t(req), req.params.clientId, u(req), req.body?.status, req.body?.reason)));
  router.post('/clients/:clientId/type', run(req => store().setClientType(t(req), req.params.clientId, u(req), req.body?.clientType)));
  router.post('/clients/:clientId/engagements', run(req => store().createEngagement(t(req), req.params.clientId, u(req), key(req),
    { title: req.body?.title, type: req.body?.type, description: str(req.body?.description), taxYears: req.body?.taxYears }), 201));
  router.post('/clients/:clientId/engagements/:engagementId/status', run(req => store().setEngagementStatus(t(req), req.params.clientId, u(req), req.params.engagementId,
    req.body?.status, int(req.body?.version), str(req.body?.reason))));
  router.post('/clients/:clientId/engagements/:engagementId/tax-years', run(req => store().addTaxYear(t(req), req.params.clientId, u(req), req.params.engagementId, int(req.body?.taxYear)), 201));
  router.post('/clients/:clientId/engagements/:engagementId/team', run(req => store().assign(t(req), req.params.clientId, u(req), key(req),
    { engagementId: req.params.engagementId, taxYear: int(req.body?.taxYear), role: req.body?.role, userId: req.body?.userId, reason: req.body?.reason }), 201));
  router.post('/clients/:clientId/team/:assignmentId/revoke', run(req => store().unassign(t(req), req.params.clientId, u(req), req.params.assignmentId, req.body?.reason)));
  router.post('/clients/:clientId/notes', run(req => store().addNote(t(req), req.params.clientId, u(req), req.body?.body, str(req.body?.engagementId)), 201));
  router.post('/clients/:clientId/tasks', run(req => {
    const b = req.body || {};
    return store().createTask(t(req), req.params.clientId, u(req), key(req), { title: b.title, description: b.description, taskType: b.taskType, priority: b.priority,
      assignedUserId: b.assignedUserId, dueDate: b.dueDate, dependencies: Array.isArray(b.dependencies) ? b.dependencies : [], engagementId: b.engagementId, taxYear: b.taxYear, caseId: b.caseId });
  }, 201));
  router.post('/clients/:clientId/tasks/:taskId/status', run(req => store().setTaskStatus(t(req), req.params.clientId, u(req), req.params.taskId, req.body?.status, int(req.body?.version))));
  // assignedUserId must be given: a string assigns, null clears. A missing field is refused rather than read as clearing.
  router.post('/clients/:clientId/tasks/:taskId/reassign', run(async req => {
    const assignee = req.body?.assignedUserId;
    if (assignee !== null && (typeof assignee !== 'string' || !assignee)) throw new PracticeStoreError('PRACTICE_INPUT_INVALID', 400);
    return store().reassignTask(t(req), req.params.clientId, u(req), req.params.taskId, assignee, int(req.body?.version), str(req.body?.reason));
  }));
  router.post('/clients/:clientId/deadlines', run(req => {
    const b = req.body || {};
    return store().addDeadline(t(req), req.params.clientId, u(req), key(req), { title: b.title, category: b.category, dueDate: b.dueDate, authorityType: b.authorityType,
      sourceCitation: b.sourceCitation, caseId: b.caseId, taxYear: b.taxYear });
  }, 201));
  router.post('/clients/:clientId/deadlines/:deadlineId/resolve', run(req => store().resolveDeadline(t(req), req.params.clientId, u(req), req.params.deadlineId, req.body?.status, str(req.body?.reason))));
  return router;
}
