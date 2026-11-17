/**
 * Durable book-to-tax API (/api/book-to-tax). Development-only until proposal 029 is reviewed and
 * applied; not mounted in createProductionApp. Workpapers are for professional review only.
 */
import express, { Router, type RequestHandler, type Response } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { getSupabaseAdmin } from '../supabase';
import { BookToTaxError, BookToTaxStore } from '../taxguard/bookkeeping/bookToTaxStore';
import { practiceStoreConfigured } from './practice.routes';

export function createBookToTaxRouter(deps: { store?: () => BookToTaxStore; authenticate?: RequestHandler } = {}) {
  const router = Router();
  router.use(express.json({ limit: '64kb' }));
  let cached: BookToTaxStore | null = null;
  const store = () => deps.store?.() ?? (cached ??= new BookToTaxStore(getSupabaseAdmin() as any));
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!deps.store && !practiceStoreConfigured()) return res.status(503).json({ code: 'B2T_UNAVAILABLE' });
    next();
  });
  router.use(deps.authenticate || authenticateToken);
  router.use((req: AuthenticatedRequest, res, next) => {
    const user = req.user;
    if (!user?.tenantId || user.status !== 'active' || ['client', 'prospective_client', 'recruiter'].includes(user.role)) return res.status(403).json({ code: 'B2T_ACCESS_DENIED' });
    next();
  });
  const run = (handler: (req: AuthenticatedRequest) => Promise<unknown>, status = 200): RequestHandler => async (req, res: Response) => {
    try { return res.status(status).json(await handler(req as AuthenticatedRequest)); }
    catch (error) {
      if (error instanceof BookToTaxError) return res.status(error.status).json({ code: error.code });
      return res.status(503).json({ code: 'B2T_STORE_UNAVAILABLE' });
    }
  };
  const t = (req: AuthenticatedRequest) => req.user!.tenantId!, u = (req: AuthenticatedRequest) => req.user!.id;
  const year = (v: unknown) => typeof v === 'string' && /^\d{4}$/.test(v) ? Number(v) : typeof v === 'number' ? v : NaN;
  const fam = (v: unknown) => String(v ?? '');
  router.get('/categories/:family', run(async req => ({ items: await store().categories(t(req), u(req), req.params.family) })));
  router.post('/categories', run(async req => store().saveCategory(t(req), u(req), req.body ?? {})));
  router.get('/clients/:clientId/:taxYear/:family', run(async req => store().overview(t(req), req.params.clientId, u(req), year(req.params.taxYear), req.params.family)));
  router.post('/clients/:clientId/:taxYear/:family/mapping-sets', run(async req => store().openSet(t(req), req.params.clientId, u(req), year(req.params.taxYear), req.params.family), 201));
  router.post('/clients/:clientId/mapping-sets/:setId/mappings', run(async req => store().setMapping(t(req), req.params.clientId, u(req), req.params.setId,
    String(req.body?.accountId ?? ''), typeof req.body?.categoryCode === 'string' ? req.body.categoryCode : null)));
  router.post('/clients/:clientId/mapping-sets/:setId/:action(submit|approve|reject)', run(async req => store().reviewSet(t(req), req.params.clientId, u(req), req.params.setId,
    req.params.action as 'submit', typeof req.body?.note === 'string' ? req.body.note : undefined)));
  router.post('/clients/:clientId/adjustments', run(async req => store().prepareAdjustment(t(req), req.params.clientId, u(req), req.get('idempotency-key'), {
    taxYear: year(req.body?.taxYear), returnFamily: fam(req.body?.returnFamily), categoryCode: String(req.body?.categoryCode ?? ''), amount: req.body?.amount,
    adjustmentType: String(req.body?.adjustmentType ?? ''), description: String(req.body?.description ?? ''), evidenceDocumentId: req.body?.evidenceDocumentId }), 201));
  router.post('/clients/:clientId/adjustments/:adjustmentId/:decision(approve|reject)', run(async req => store().reviewAdjustment(t(req), req.params.clientId, u(req),
    req.params.adjustmentId, req.params.decision === 'approve', typeof req.body?.note === 'string' ? req.body.note : undefined)));
  router.post('/clients/:clientId/:taxYear/:family/workpapers', run(async req => store().generateWorkpaper(t(req), req.params.clientId, u(req), year(req.params.taxYear),
    req.params.family, typeof req.body?.caseId === 'string' ? req.body.caseId : undefined), 201));
  router.post('/clients/:clientId/workpapers/:workpaperId/:decision(approve|reject)', run(async req => store().reviewWorkpaper(t(req), req.params.clientId, u(req),
    req.params.workpaperId, req.params.decision === 'approve', typeof req.body?.note === 'string' ? req.body.note : undefined)));
  return router;
}
