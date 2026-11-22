/**
 * Durable Stage 01 onboarding API (/api/stage-one). Clients read and edit only their own record; staff
 * reads follow practice visibility and decisions need a practice manager or administrator (all enforced in
 * the database). The client view never carries staff notes, decider identities or duplicate details.
 */
import { Router, type RequestHandler, type Response } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { getSupabaseAdmin } from '../supabase';
import { practiceStoreConfigured } from '../taxguard/practice/practiceStoreConfig';
import { OnboardingError, OnboardingStore } from '../taxguard/onboarding/onboardingStore';

export interface OnboardingRouterDeps { store?: () => OnboardingStore; enabled?: () => boolean; authenticate?: RequestHandler }

export function createOnboardingRouter(deps: OnboardingRouterDeps = {}) {
  const router = Router();
  let cached: OnboardingStore | null = null;
  const store = () => deps.store?.() ?? (cached ??= new OnboardingStore(getSupabaseAdmin() as any));
  const enabled = deps.enabled ?? practiceStoreConfigured;
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!enabled()) return res.status(503).json({ code: 'ONBOARDING_STORE_UNAVAILABLE' });
    next();
  });
  router.use(deps.authenticate || authenticateToken);
  router.use((req: AuthenticatedRequest, res, next) => {
    if (!req.user?.tenantId || req.user.status !== 'active') return res.status(403).json({ code: 'ONBOARDING_ACCESS_DENIED' });
    next();
  });
  const isClient = (req: AuthenticatedRequest) => ['client', 'prospective_client'].includes(req.user!.role);
  // A client always acts on its own record; the route parameter cannot select another one.
  const clientOf = (req: AuthenticatedRequest) => (isClient(req) ? req.user!.clientId : req.params.clientId);
  const run = (operation: (req: AuthenticatedRequest, client: string) => Promise<unknown>): RequestHandler => async (req, res: Response) => {
    const request = req as AuthenticatedRequest;
    const client = clientOf(request);
    if (!client || !/^[A-Za-z0-9_-]{1,64}$/.test(client) || (isClient(request) && req.params.clientId !== undefined && req.params.clientId !== client))
      return res.status(isClient(request) ? 403 : 400).json({ code: isClient(request) ? 'ONBOARDING_ACCESS_DENIED' : 'ONBOARDING_INPUT_INVALID' });
    try { return res.json(await operation(request, client)); }
    catch (e) { return res.status(e instanceof OnboardingError ? e.status : 503).json({ code: e instanceof OnboardingError ? e.code : 'ONBOARDING_UNAVAILABLE' }); }
  };
  const t = (req: AuthenticatedRequest) => req.user!.tenantId!;
  const u = (req: AuthenticatedRequest) => req.user!.id;

  router.get('/me', run((r, c) => store().get(t(r), c, u(r))));
  router.post('/me', run((r, c) => store().save(t(r), c, u(r), r.body?.revision, r.body?.fields)));
  router.post('/me/submit', run((r, c) => store().submit(t(r), c, u(r), r.body?.revision, r.body?.consentVersion, r.body?.signer)));
  router.get('/queue', async (req: AuthenticatedRequest, res) => {
    if (isClient(req)) return res.status(403).json({ code: 'ONBOARDING_ACCESS_DENIED' });
    try { return res.json({ items: await store().queue(t(req), u(req)) }); }
    catch (e) { return res.status(e instanceof OnboardingError ? e.status : 503).json({ code: e instanceof OnboardingError ? e.code : 'ONBOARDING_UNAVAILABLE' }); }
  });
  router.get('/clients/:clientId', run((r, c) => store().get(t(r), c, u(r))));
  router.post('/clients/:clientId/decision', run((r, c) => {
    if (isClient(r)) throw new OnboardingError('ONBOARDING_ACCESS_DENIED', 403);
    return store().decide(t(r), c, u(r), r.body?.revision, r.body?.decision, { clientReason: r.body?.clientReason, internalNote: r.body?.internalNote, duplicateOverride: r.body?.duplicateOverride });
  }));
  return router;
}
