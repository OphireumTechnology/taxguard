/**
 * Consultation requests (proposal 043). Development-only until reviewed and applied: answers only
 * with an injected store (tests) or when the durable store is configured against a non-production
 * project; otherwise 503. Not mounted in createProductionApp.
 *
 *   /api/public/consultation-requests  POST, unauthenticated: 8 KB body limit, honeypot field,
 *                                      per-address limiter, database abuse limits; no account, no
 *                                      appointment, no e-mail; the response never echoes data.
 *   /api/consultations                 authenticated review by practice managers / administrators.
 */
import express, { Router, type Request, type RequestHandler, type Response } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { getSupabaseAdmin } from '../supabase';
import { practiceStoreConfigured } from '../taxguard/practice/practiceStoreConfig';
import { CONSULTATION_CONSENT_TEXT, CONSULTATION_CONSENT_VERSION, ConsultationError, ConsultationStore } from '../taxguard/consultations/consultationStore';
import { StaffAccessRateLimit } from '../staffAccessRateLimit';

export interface ConsultationRouterDeps { store?: () => ConsultationStore; authenticate?: RequestHandler; tenantId?: () => string; limiter?: StaffAccessRateLimit }

const fail = (res: Response, error: unknown, fallback: string) => error instanceof ConsultationError ? res.status(error.status).json({ code: error.code }) : res.status(503).json({ code: fallback });

export function createPublicConsultationRouter(deps: ConsultationRouterDeps = {}) {
  const router = Router();
  let cached: ConsultationStore | null = null;
  const store = () => deps.store?.() ?? (cached ??= new ConsultationStore(getSupabaseAdmin() as any));
  // 5 submissions per 10 minutes per client address in this process; the database applies its own limits.
  const limiter = deps.limiter ?? new StaffAccessRateLimit(5, 10 * 60_000);
  const tenant = () => (deps.tenantId?.() ?? process.env.TAXGUARD_TENANT_ID ?? '').trim();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!deps.store && !practiceStoreConfigured()) return res.status(503).json({ code: 'CONSULTATION_UNAVAILABLE' });
    if (!tenant()) return res.status(503).json({ code: 'CONSULTATION_UNAVAILABLE' });
    next();
  });
  router.get('/consent', (_req, res) => res.json({ version: CONSULTATION_CONSENT_VERSION, text: CONSULTATION_CONSENT_TEXT }));
  router.post('/', express.json({ limit: '8kb', strict: true }), async (req: Request, res: Response) => {
    const address = req.ip || 'unknown';
    if (!limiter.allow(address)) { res.setHeader('Retry-After', '600'); return res.status(429).json({ code: 'CONSULTATION_RATE_LIMITED' }); }
    const body = req.body as Record<string, unknown> | undefined;
    // Honeypot: real visitors never see or fill this field. Answer like a success, store nothing.
    if (body && typeof body.website === 'string' && body.website !== '') return res.status(202).json({ received: true });
    const { website: _ignored, ...input } = body ?? {};
    try { return res.status(202).json(await store().submit(tenant(), req.get('idempotency-key'), address, input)); }
    catch (error) { return fail(res, error, 'CONSULTATION_UNAVAILABLE'); }
  });
  // Oversized or malformed JSON: a fixed refusal without parser details.
  router.use((error: any, _req: Request, res: Response, next: (e?: unknown) => void) => {
    if (error?.type === 'entity.too.large') return res.status(413).json({ code: 'CONSULTATION_TOO_LARGE' });
    if (error?.type === 'entity.parse.failed') return res.status(400).json({ code: 'CONSULTATION_INPUT_INVALID' });
    next(error);
  });
  return router;
}

export function createConsultationReviewRouter(deps: ConsultationRouterDeps = {}) {
  const router = Router();
  let cached: ConsultationStore | null = null;
  const store = () => deps.store?.() ?? (cached ??= new ConsultationStore(getSupabaseAdmin() as any));
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!deps.store && !practiceStoreConfigured()) return res.status(503).json({ code: 'CONSULTATION_STORE_UNAVAILABLE' });
    next();
  });
  router.use(deps.authenticate || authenticateToken);
  router.use((req: AuthenticatedRequest, res, next) => {
    if (!req.user?.tenantId || req.user.status !== 'active' || ['client', 'prospective_client'].includes(req.user.role)) return res.status(403).json({ code: 'CONSULTATION_REVIEWER_REQUIRED' });
    next();
  });
  const run = (handler: (req: AuthenticatedRequest) => Promise<unknown>): RequestHandler => async (req, res) => {
    try { return res.status(200).json(await handler(req as AuthenticatedRequest)); } catch (error) { return fail(res, error, 'CONSULTATION_STORE_UNAVAILABLE'); }
  };
  const t = (req: AuthenticatedRequest) => req.user!.tenantId!;
  const u = (req: AuthenticatedRequest) => req.user!.id;
  const key = (req: AuthenticatedRequest) => req.get('idempotency-key') || '';
  router.get('/requests', run(req => store().list(t(req), u(req), typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined,
    req.query.limit === undefined ? undefined : Number(req.query.limit))));
  router.post('/requests/:id/decision', run(req => store().decide(t(req), u(req), req.params.id, req.body?.version, key(req), req.body?.action, req.body?.reason)));
  router.post('/requests/:id/convert', run(req => store().convert(t(req), u(req), req.params.id, req.body?.version, key(req), req.body?.clientId, req.body?.appointment)));
  return router;
}
