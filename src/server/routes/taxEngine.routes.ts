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
  router.get('/rule-sets/:ruleSetId/tests', run(req => store().tests(t(req), u(req), req.params.ruleSetId)));
  router.get('/rule-sets/:ruleSetId/coverage', run(req => store().coverage(t(req), u(req), req.params.ruleSetId)));
  router.post('/rule-sets/:ruleSetId/tests', run(req => store().addTest(t(req), u(req), req.params.ruleSetId, req.body ?? {}), 201));
  router.post('/rule-sets/:ruleSetId/tests/:testId/remove', run(req => store().removeTest(t(req), u(req), req.params.ruleSetId, req.params.testId)));
  router.post('/rule-sets/:ruleSetId/run-tests', run(req => store().runTests(t(req), u(req), req.params.ruleSetId)));
  router.get('/cases/:caseId/runs', run(async req => ({ items: await store().runs(t(req), u(req), req.params.caseId), returnUse: 'BLOCKED' })));
  router.post('/cases/:caseId/runs', run(req => store().calculate(t(req), u(req), req.params.caseId, String(req.body?.ruleSetId ?? ''),
    { filingStatus: typeof req.body?.filingStatus === 'string' ? req.body.filingStatus : undefined, inputs: Array.isArray(req.body?.inputs) ? req.body.inputs : [] }), 201));
  // Tax conclusions and evidence-to-conclusion traces (proposal 20261019100000). Scope comes from the database for every
  // request; the trace is bounded to one conclusion or one piece of evidence of one case.
  router.get('/cases/:caseId/conclusions', run(async req => ({ items: await store().conclusions(t(req), u(req), req.params.caseId), returnUse: 'BLOCKED' })));
  router.post('/cases/:caseId/conclusions', run(req => store().proposeConclusion(t(req), u(req), req.params.caseId, req.body), 201));
  router.get('/cases/:caseId/conclusions/readiness', run(req => store().conclusionReadiness(t(req), u(req), req.params.caseId)));
  router.get('/cases/:caseId/evidence-trace', run(req => store().traceEvidence(t(req), u(req), req.params.caseId, String(req.query.ref ?? ''))));
  router.get('/conclusions/:conclusionId/trace', run(req => store().traceConclusion(t(req), u(req), req.params.conclusionId)));
  router.post('/conclusions/:conclusionId/revise', run(req => store().reviseConclusion(t(req), u(req), req.params.conclusionId, req.body), 201));
  router.post('/conclusions/:conclusionId/submit', run(req => store().submitConclusion(t(req), u(req), req.params.conclusionId)));
  router.post('/conclusions/:conclusionId/:decision(approve|return|reject)', run(req => store().reviewConclusion(t(req), u(req), req.params.conclusionId,
    req.params.decision as 'approve' | 'return' | 'reject', note(req.body?.note) ?? '')));
  // Deterministic form mapping (proposal 20261019110000): versioned mapping rules under maker-checker, and per-case
  // mappings derived by the database from approved, current conclusions. No value can be supplied by the request.
  router.get('/form-rules', run(async req => ({ items: await store().formRules(t(req), u(req), year(req.query.taxYear)) })));
  router.get('/form-rules/:ruleId', run(req => store().formRuleDetail(t(req), u(req), req.params.ruleId)));
  router.post('/form-rules', run(req => store().draftFormRule(t(req), u(req), req.body?.definition), 201));
  router.post('/form-rules/:ruleId/:action(submit|approve|reject)', run(req => store().transitionFormRule(t(req), u(req), req.params.ruleId,
    req.params.action as 'submit' | 'approve' | 'reject', note(req.body?.note))));
  router.get('/cases/:caseId/form-mappings', run(async req => ({ items: await store().formMappings(t(req), u(req), req.params.caseId), returnUse: 'BLOCKED' })));
  router.post('/cases/:caseId/form-mappings', run(req => store().mapForm(t(req), u(req), req.params.caseId, String(req.body?.ruleId ?? '')), 201));
  router.get('/form-mappings/:mappingId', run(req => store().formMappingDetail(t(req), u(req), req.params.mappingId)));
  // Draft return preparation (proposal 20261019120000): versioned return templates under maker-checker, and per-case
  // return versions assembled by the database from current form mappings. The request only names the template.
  router.get('/return-templates', run(async req => ({ items: await store().returnTemplates(t(req), u(req), year(req.query.taxYear)) })));
  router.get('/return-templates/:templateRuleId', run(req => store().returnTemplateDetail(t(req), u(req), req.params.templateRuleId)));
  router.post('/return-templates', run(req => store().draftReturnTemplate(t(req), u(req), req.body?.definition), 201));
  router.post('/return-templates/:templateRuleId/:action(submit|approve|reject)', run(req => store().transitionReturnTemplate(t(req), u(req),
    req.params.templateRuleId, req.params.action as 'submit' | 'approve' | 'reject', note(req.body?.note))));
  router.get('/cases/:caseId/returns', run(async req => ({ items: await store().caseReturns(t(req), u(req), req.params.caseId), returnUse: 'BLOCKED' })));
  router.post('/cases/:caseId/returns', run(req => store().prepareReturn(t(req), u(req), req.params.caseId, String(req.body?.templateRuleId ?? '')), 201));
  router.get('/cases/:caseId/returns/stage-facts', run(req => store().returnStageFacts(t(req), u(req), req.params.caseId)));
  router.get('/returns/:returnVersionId', run(req => store().returnDetail(t(req), u(req), req.params.returnVersionId)));
  router.post('/returns/:returnVersionId/:action(submit|approve|return)', run(req => store().transitionReturn(t(req), u(req), req.params.returnVersionId,
    req.params.action as 'submit' | 'approve' | 'return', note(req.body?.note))));
  router.get('/runs/:runId/lineage', run(req => store().runLineage(t(req), u(req), req.params.runId)));
  router.post('/runs/:runId/:decision(approve|reject)', run(req => store().reviewRun(t(req), u(req), req.params.runId, req.params.decision as 'approve' | 'reject', note(req.body?.note) ?? '')));
  // Tax research memos for a case (proposal 20261018150000). Scope, authority levels and maker-checker are enforced by
  // the database; nothing here makes research authoritative for a return.
  const textOf = (v: unknown, max: number) => typeof v === 'string' && v.length <= max ? v : '';
  const versionOf = (v: unknown) => Number.isSafeInteger(v) ? v as number : -1;
  router.get('/cases/:caseId/research', run(async req => ({ items: await store().research(t(req), u(req), req.params.caseId), returnUse: 'BLOCKED' })));
  router.post('/cases/:caseId/research', run(req => store().openResearch(t(req), u(req), req.params.caseId, textOf(req.body?.question, 2000)), 201));
  router.post('/research/:memoId/citations', run(req => store().citeResearch(t(req), u(req), req.params.memoId, req.body ?? {}), 201));
  router.post('/research/:memoId/submit', run(req => store().submitResearch(t(req), u(req), req.params.memoId, textOf(req.body?.conclusion, 8000), versionOf(req.body?.version))));
  router.post('/research/:memoId/:decision(approve|reject)', run(req => store().reviewResearch(t(req), u(req), req.params.memoId,
    req.params.decision as 'approve' | 'reject', textOf(req.body?.note, 2000), versionOf(req.body?.version))));
  // Case readiness diagnostics and risk assessments (proposals 20261018160000 and 20261018170000). The database decides
  // severity, scope, who may acknowledge and the risk outcome; neither makes a return usable.
  router.get('/cases/:caseId/diagnostics', run(req => store().diagnostics(t(req), u(req), req.params.caseId)));
  router.post('/cases/:caseId/diagnostics/run', run(req => store().runDiagnostics(t(req), u(req), req.params.caseId)));
  router.post('/diagnostics/:diagnosticId/acknowledge', run(req => store().acknowledgeDiagnostic(t(req), u(req), req.params.diagnosticId, textOf(req.body?.note, 1000))));
  router.get('/cases/:caseId/risk', run(async req => ({ items: await store().riskAssessments(t(req), u(req), req.params.caseId), returnUse: 'BLOCKED' })));
  router.post('/cases/:caseId/risk', run(req => store().assessRisk(t(req), u(req), req.params.caseId,
    { amountCents: req.body?.amountCents, unsupportedPosition: req.body?.unsupportedPosition }), 201));
  return router;
}
