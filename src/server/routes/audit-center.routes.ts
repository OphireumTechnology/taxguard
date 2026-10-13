/**
 * Read-only administrative audit center (/api/audit-center). Development-only until proposal 041
 * is reviewed and applied: answers only with an injected store (tests) or when the durable store is
 * configured against a non-production project; otherwise 503. GET only; clients are refused before
 * the database, which re-checks administrator authority and redacts every row.
 */
import { Router, type RequestHandler, type Response } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { getSupabaseAdmin } from '../supabase';
import { practiceStoreConfigured } from '../taxguard/practice/practiceStoreConfig';
import { AuditCenterError, AuditCenterStore } from '../taxguard/audit/auditCenterStore';

export interface AuditCenterRouterDeps { store?: () => AuditCenterStore; authenticate?: RequestHandler }

export function createAuditCenterRouter(deps: AuditCenterRouterDeps = {}) {
  const router = Router();
  let cached: AuditCenterStore | null = null;
  const store = () => deps.store?.() ?? (cached ??= new AuditCenterStore(getSupabaseAdmin() as any));
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!deps.store && !practiceStoreConfigured()) return res.status(503).json({ code: 'AUDIT_STORE_UNAVAILABLE' });
    if (req.method !== 'GET') return res.status(405).json({ code: 'AUDIT_READ_ONLY' });
    next();
  });
  router.use(deps.authenticate || authenticateToken);
  router.use((req: AuthenticatedRequest, res, next) => {
    const user = req.user;
    if (!user?.tenantId || user.status !== 'active' || ['client', 'prospective_client'].includes(user.role)) return res.status(403).json({ code: 'AUDIT_ADMIN_REQUIRED' });
    next();
  });
  const run = (handler: (req: AuthenticatedRequest) => Promise<unknown>): RequestHandler => async (req, res: Response) => {
    try { return res.status(200).json(await handler(req as AuthenticatedRequest)); }
    catch (error) {
      if (error instanceof AuditCenterError) return res.status(error.status).json({ code: error.code });
      return res.status(503).json({ code: 'AUDIT_STORE_UNAVAILABLE' });
    }
  };
  const str = (v: unknown) => typeof v === 'string' && v !== '' ? v : undefined;
  router.get('/events', run(req => store().list(req.user!.tenantId!, req.user!.id, { from: String(req.query.from ?? ''), to: String(req.query.to ?? ''),
    category: str(req.query.category), action: str(req.query.action), actorUid: str(req.query.actorUid), clientId: str(req.query.clientId), cursor: str(req.query.cursor),
    limit: req.query.limit === undefined ? undefined : Number(req.query.limit) })));
  router.get('/events/:eventId', run(req => store().event(req.user!.tenantId!, req.user!.id, req.params.eventId)));
  router.get('/categories', run(req => store().categories(req.user!.tenantId!, req.user!.id, req.query.from, req.query.to)));
  return router;
}
