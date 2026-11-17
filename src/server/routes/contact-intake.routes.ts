/**
 * Contract C8: /api/public/contact, PREPARED BUT DISABLED. Answers 503 CONTACT_INTAKE_DISABLED unless
 * a store is injected (tests) or TAXGUARD_CONTACT_INTAKE=enabled is set with a configured durable
 * store; even then the database refuses submissions until an approved intake policy is recorded.
 * 8 KB body limit, honeypot field, per-address limiter, database abuse limits. No e-mail is sent and
 * the response never claims delivery. Not mounted in createProductionApp.
 */
import express, { Router, type Request, type Response } from 'express';
import { getSupabaseAdmin } from '../supabase';
import { practiceStoreConfigured } from '../taxguard/practice/practiceStoreConfig';
import { ContactIntakeError, ContactStore } from '../taxguard/contact/contactStore';
import { StaffAccessRateLimit } from '../staffAccessRateLimit';

export interface ContactRouterDeps { store?: () => ContactStore; tenantId?: () => string; limiter?: StaffAccessRateLimit; enabled?: () => boolean }

export function createPublicContactRouter(deps: ContactRouterDeps = {}) {
  const router = Router();
  let cached: ContactStore | null = null;
  const store = () => deps.store?.() ?? (cached ??= new ContactStore(getSupabaseAdmin() as any));
  const enabled = () => deps.enabled?.() ?? (Boolean(deps.store) || (process.env.TAXGUARD_CONTACT_INTAKE === 'enabled' && practiceStoreConfigured()));
  const limiter = deps.limiter ?? new StaffAccessRateLimit(5, 10 * 60_000);
  const tenant = () => (deps.tenantId?.() ?? process.env.TAXGUARD_TENANT_ID ?? '').trim();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!enabled() || !tenant()) return res.status(503).json({ code: 'CONTACT_INTAKE_DISABLED' });
    next();
  });
  router.post('/', express.json({ limit: '8kb', strict: true }), async (req: Request, res: Response) => {
    const address = req.ip || 'unknown';
    if (!limiter.allow(address)) { res.setHeader('Retry-After', '600'); return res.status(429).json({ code: 'CONTACT_RATE_LIMITED' }); }
    const body = req.body as Record<string, unknown> | undefined;
    // Honeypot: real visitors never see or fill this field. Answer like a receipt, store nothing.
    if (body && typeof body.website === 'string' && body.website !== '') return res.status(202).json({ received: true });
    const { website: _ignored, ...input } = body ?? {};
    try { return res.status(202).json(await store().submit(tenant(), req.get('idempotency-key'), address, input)); }
    catch (error) { return error instanceof ContactIntakeError ? res.status(error.status).json({ code: error.code }) : res.status(503).json({ code: 'CONTACT_INTAKE_UNAVAILABLE' }); }
  });
  router.use((error: any, _req: Request, res: Response, next: (e?: unknown) => void) => {
    if (error?.type === 'entity.too.large') return res.status(413).json({ code: 'CONTACT_TOO_LARGE' });
    if (error?.type === 'entity.parse.failed') return res.status(400).json({ code: 'CONTACT_INPUT_INVALID' });
    next(error);
  });
  return router;
}
