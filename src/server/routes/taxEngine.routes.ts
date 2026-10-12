/**
 * Tax engine foundation API (/api/tax-engine). Development-only until proposal 033 is reviewed and
 * applied: answers only with an injected store (tests) or TAXGUARD_PRACTICE_STORE=durable against a
 * non-production project; never mounted in createProductionApp. TaxGuard ships no tax rules; every
 * response states returnUse BLOCKED because stages 9-18 remain blocked.
 */
import express, { Router, type RequestHandler, type Response } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { getSupabaseAdmin } from '../supabase';
import { practiceStoreConfigured } from '../taxguard/practice/practiceStoreConfig';
import { TaxEngineStore, TaxEngineStoreError } from '../taxguard/taxEngine/taxEngineStore';

export function createTaxEngineRouter(deps: { store?: () => TaxEngineStore; authenticate?: RequestHandler } = {}) {
  const router = Router();
  let cached: TaxEngineStore | null = null;
  const store = () => deps.store?.() ?? (cached ??= new TaxEngineStore(getSupabaseAdmin() as any));
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!deps.store && !practiceStoreConfigured()) return res.status(503).json({ code: 'TAX_ENGINE_UNAVAILABLE' });
    next();
  });
  router.use(deps.authenticate || authenticateToken);
  router.use((req: AuthenticatedRequest, res, next) => {
    const user = req.user;
    if (!user?.tenantId || user.status !== 'active' || ['client', 'prospective_client', 'recruiter', 'bookkeeper'].includes(user.role)) return res.status(403).json({ code: 'TAX_ENGINE_ACCESS_DENIED' });
    next();
  });
  router.use(express.json({ limit: '512kb' }));
  const run = (handler: (req: AuthenticatedRequest) => Promise<unknown>, status = 200): RequestHandler => async (req, res: Response) => {
    try { return res.status(status).json(await handler(req as AuthenticatedRequest)); }
    catch (error) {
      if (error instanceof TaxEngineStoreError) return res.status(error.status).json({ code: error.code, ...(error.detail ? { detail: error.detail } : {}) });
      return res.status(503).json({ code: 'TAX_ENGINE_STORE_UNAVAILABLE' });
    }
  };
  const t = (req: AuthenticatedRequest) => req.user!.tenantId!, u = (req: AuthenticatedRequest) => req.user!.id;
  const year = (v: unknown) => typeof v === 'string' && /^\d{4}$/.test(v) ? Number(v) : undefined;
  const note = (v: unknown) => typeof v === 'string' && v.length <= 1000 ? v : undefined;

  router.get('/sources', run(async req => ({ items: await store().sources(t(req), u(req)) })));
  router.post('/sources', run(req => store().registerSource(t(req), u(req), req.body ?? {}), 201));
  router.post('/sources/:sourceId/verify', run(req => store().verifySource(t(req), u(req), req.params.sourceId, String(req.body?.documentSha256 ?? ''))));
  router.get('/rule-sets', run(async req => ({ items: await store().ruleSets(t(req), u(req), year(req.query.taxYear)) })));
  router.get('/rule-sets/:ruleSetId', run(req => store().ruleSet(t(req), u(req), req.params.ruleSetId)));
  router.post('/rule-sets', run(req => store().draftRuleSet(t(req), u(req), req.body?.definition), 201));
  router.post('/rule-sets/:ruleSetId/:action(submit|approve|reject)', run(req => store().transitionRuleSet(t(req), u(req), req.params.ruleSetId,
    req.params.action as 'submit' | 'approve' | 'reject', note(req.body?.note))));
  router.get('/cases/:caseId/runs', run(async req => ({ items: await store().runs(t(req), u(req), req.params.caseId), returnUse: 'BLOCKED' })));
  router.post('/cases/:caseId/runs', run(req => store().calculate(t(req), u(req), req.params.caseId, String(req.body?.ruleSetId ?? ''),
    { filingStatus: typeof req.body?.filingStatus === 'string' ? req.body.filingStatus : undefined, inputs: Array.isArray(req.body?.inputs) ? req.body.inputs : [] }), 201));
  router.post('/runs/:runId/:decision(approve|reject)', run(req => store().reviewRun(t(req), u(req), req.params.runId, req.params.decision as 'approve' | 'reject', note(req.body?.note) ?? '')));
  return router;
}
