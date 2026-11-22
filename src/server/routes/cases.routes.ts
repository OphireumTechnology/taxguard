/**
 * Durable case workflow API (/api/cases). Development-only until proposal 026 is reviewed and
 * applied: answers only with an injected store or TAXGUARD_PRACTICE_STORE=durable against a
 * non-production project; not mounted in createProductionApp.
 */
import { Router, type RequestHandler, type Response } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { getSupabaseAdmin } from '../supabase';
import { CaseStore, CaseStoreError } from '../taxguard/practice/caseStore';
import { PracticeStoreError } from '../taxguard/practice/practiceStore';
import { practiceStoreConfigured } from './practice.routes';

export function createCasesRouter(deps: { store?: () => CaseStore; authenticate?: RequestHandler } = {}) {
  const router = Router();
  let cached: CaseStore | null = null;
  const store = () => deps.store?.() ?? (cached ??= new CaseStore(getSupabaseAdmin() as any));
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!deps.store && !practiceStoreConfigured()) return res.status(503).json({ code: 'CASE_STORE_UNAVAILABLE' });
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
      if (error instanceof CaseStoreError) return res.status(error.status).json({ code: error.code, ...(error.failedChecks.length ? { failedChecks: error.failedChecks } : {}) });
      if (error instanceof PracticeStoreError) return res.status(error.status).json({ code: error.code });
      return res.status(503).json({ code: 'CASE_STORE_UNAVAILABLE' });
    }
  };
  const t = (req: AuthenticatedRequest) => req.user!.tenantId!, u = (req: AuthenticatedRequest) => req.user!.id;
  const int = (v: unknown) => typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : undefined;
  router.get('/', run(req => store().queue(t(req), u(req), { role: req.query.role as string | undefined, stage: int(req.query.stage), status: req.query.status as string | undefined,
    taxYear: int(req.query.taxYear), after: req.query.cursor as string | undefined, limit: int(req.query.limit) })));
  router.get('/report', run(req => store().statusReport(t(req), u(req))));
  router.post('/', run(req => store().create(t(req), String(req.body?.clientId ?? ''), u(req), req.get('idempotency-key') || '',
    { engagementId: req.body?.engagementId, taxYear: int(req.body?.taxYear) as number, returnFamily: req.body?.returnFamily }), 201));
  router.get('/:caseId', run(req => store().detail(t(req), req.params.caseId, u(req))));
  router.post('/:caseId/advance', run(req => store().advance(t(req), req.params.caseId, u(req), int(req.body?.fromStage) as number, int(req.body?.version) as number,
    req.body?.attestation && typeof req.body.attestation === 'object' ? { confirmed: Array.isArray(req.body.attestation.confirmed) ? req.body.attestation.confirmed : [],
      statement: String(req.body.attestation.statement ?? '') } : undefined)));
  router.post('/:caseId/return', run(req => store().returnTo(t(req), req.params.caseId, u(req), int(req.body?.toStage) as number, int(req.body?.version) as number, req.body?.reason)));
  router.post('/:caseId/hold', run(req => store().setHold(t(req), req.params.caseId, u(req), req.body?.hold === true, int(req.body?.version) as number, req.body?.reason)));
  router.post('/:caseId/notes', run(req => store().addNote(t(req), req.params.caseId, u(req), req.body?.body), 201));
  router.post('/:caseId/team', run(req => store().restaff(t(req), req.params.caseId, u(req), { role: String(req.body?.role ?? ''), userId: String(req.body?.userId ?? ''),
    version: int(req.body?.version) as number, reason: String(req.body?.reason ?? '') })));
  return router;
}
