/**
 * Durable legal-coordination matters (/api/legal-matters). Development-only until proposal 042 is
 * reviewed and applied: answers only with an injected store (tests) or when the durable store is
 * configured against a non-production project; otherwise 503. Tracking only — nothing here signs,
 * files or transmits documents. The database decides scope and every rule.
 */
import { Router, type RequestHandler, type Response } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { getSupabaseAdmin } from '../supabase';
import { practiceStoreConfigured } from '../taxguard/practice/practiceStoreConfig';
import { LEGAL_DISCLAIMER_TEXT, LEGAL_DISCLAIMER_VERSION, LegalMatterError, LegalMatterStore } from '../taxguard/legal/legalMatterStore';

export interface LegalMattersRouterDeps { store?: () => LegalMatterStore; authenticate?: RequestHandler }

export function createLegalMattersRouter(deps: LegalMattersRouterDeps = {}) {
  const router = Router();
  let cached: LegalMatterStore | null = null;
  const store = () => deps.store?.() ?? (cached ??= new LegalMatterStore(getSupabaseAdmin() as any));
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!deps.store && !practiceStoreConfigured()) return res.status(503).json({ code: 'LEGAL_STORE_UNAVAILABLE' });
    next();
  });
  router.use(deps.authenticate || authenticateToken);
  router.use((req: AuthenticatedRequest, res, next) => {
    if (!req.user?.tenantId || req.user.status !== 'active' || req.user.role === 'recruiter') return res.status(403).json({ code: 'LEGAL_ACCESS_DENIED' });
    next();
  });
  const run = (handler: (req: AuthenticatedRequest) => Promise<unknown>, status = 200): RequestHandler => async (req, res: Response) => {
    try { return res.status(status).json(await handler(req as AuthenticatedRequest)); }
    catch (error) {
      if (error instanceof LegalMatterError) return res.status(error.status).json({ code: error.code });
      return res.status(503).json({ code: 'LEGAL_STORE_UNAVAILABLE' });
    }
  };
  const t = (req: AuthenticatedRequest) => req.user!.tenantId!;
  const u = (req: AuthenticatedRequest) => req.user!.id;
  const key = (req: AuthenticatedRequest) => req.get('idempotency-key') || '';
  const c = (req: AuthenticatedRequest) => req.params.clientId;
  router.get('/disclaimer', (_req, res) => res.json({ version: LEGAL_DISCLAIMER_VERSION, text: LEGAL_DISCLAIMER_TEXT }));
  router.get('/clients/:clientId/matters', run(req => store().list(t(req), c(req), u(req))));
  router.post('/clients/:clientId/matters', run(req => store().create(t(req), c(req), u(req), key(req), req.body ?? {}), 201));
  router.post('/clients/:clientId/matters/:id/update', run(req => store().update(t(req), c(req), u(req), req.params.id, req.body?.version, key(req), req.body?.fields)));
  router.post('/clients/:clientId/matters/:id/status', run(req => store().transition(t(req), c(req), u(req), req.params.id, req.body?.version, key(req), req.body?.action, req.body?.reason)));
  router.post('/clients/:clientId/matters/:id/documents', run(req => store().linkDocument(t(req), c(req), u(req), req.params.id, key(req), req.body?.documentId, req.body?.version)));
  return router;
}
