/**
 * Durable client / staff messaging (/api/communications). Development-only until proposal 039 is
 * reviewed and applied: answers only with an injected store (tests) or when
 * TAXGUARD_PRACTICE_STORE=durable points at a non-production project; otherwise 503. Not mounted in
 * createProductionApp. Clients and staff share the routes; the database decides what each may see
 * (clients: own client only, never internal notes; staff: assigned clients or managers).
 */
import { Router, type RequestHandler, type Response } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { getSupabaseAdmin } from '../supabase';
import { practiceStoreConfigured } from '../taxguard/practice/practiceStoreConfig';
import { CommunicationStore, CommunicationStoreError } from '../taxguard/communications/communicationStore';

export interface CommunicationsRouterDeps { store?: () => CommunicationStore; authenticate?: RequestHandler }

export function createCommunicationsRouter(deps: CommunicationsRouterDeps = {}) {
  const router = Router();
  let cached: CommunicationStore | null = null;
  const store = () => deps.store?.() ?? (cached ??= new CommunicationStore(getSupabaseAdmin() as any));
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!deps.store && !practiceStoreConfigured()) return res.status(503).json({ code: 'COMM_STORE_UNAVAILABLE' });
    next();
  });
  router.use(deps.authenticate || authenticateToken);
  router.use((req: AuthenticatedRequest, res, next) => {
    if (!req.user?.tenantId || req.user.status !== 'active') return res.status(403).json({ code: 'COMM_ACCESS_DENIED' });
    next();
  });
  const run = (handler: (req: AuthenticatedRequest) => Promise<unknown>, status = 200): RequestHandler => async (req, res: Response) => {
    try { return res.status(status).json(await handler(req as AuthenticatedRequest)); }
    catch (error) {
      if (error instanceof CommunicationStoreError) return res.status(error.status).json({ code: error.code });
      return res.status(503).json({ code: 'COMM_STORE_UNAVAILABLE' });
    }
  };
  const t = (req: AuthenticatedRequest) => req.user!.tenantId!;
  const u = (req: AuthenticatedRequest) => req.user!.id;
  const key = (req: AuthenticatedRequest) => req.get('idempotency-key') || '';
  const str = (v: unknown) => typeof v === 'string' && v !== '' ? v : undefined;
  const c = (req: AuthenticatedRequest) => req.params.clientId;

  router.get('/inbox', run(req => {
    const limit = req.query.limit === undefined ? undefined : Number(req.query.limit);
    return store().inbox(t(req), u(req), limit);
  }));
  router.get('/clients/:clientId/threads', run(req => store().threads(t(req), c(req), u(req), str(req.query.status))));
  router.post('/clients/:clientId/threads', run(req => store().createThread(t(req), c(req), u(req), key(req), {
    subject: req.body?.subject, body: req.body?.body, category: str(req.body?.category), engagementId: str(req.body?.engagementId), visibility: str(req.body?.visibility) }), 201));
  router.get('/clients/:clientId/threads/:threadId', run(req => store().messages(t(req), c(req), u(req), req.params.threadId)));
  router.post('/clients/:clientId/threads/:threadId/messages', run(req => store().post(t(req), c(req), u(req), req.params.threadId, key(req), req.body?.body, str(req.body?.visibility)), 201));
  router.post('/clients/:clientId/threads/:threadId/read', run(req => store().markRead(t(req), c(req), u(req), req.params.threadId)));
  router.post('/clients/:clientId/threads/:threadId/status', run(req => store().setStatus(t(req), c(req), u(req), req.params.threadId, req.body?.status)));
  return router;
}
