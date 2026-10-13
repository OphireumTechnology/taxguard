/**
 * Durable appointments (/api/scheduling). Development-only until proposal 040 is reviewed and
 * applied: answers only with an injected store (tests) or when TAXGUARD_PRACTICE_STORE=durable
 * points at a non-production project; otherwise 503. Not mounted in createProductionApp. Clients
 * and staff share the routes; the database decides scope, eligibility, conflicts and transitions.
 */
import { Router, type RequestHandler, type Response } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { getSupabaseAdmin } from '../supabase';
import { practiceStoreConfigured } from '../taxguard/practice/practiceStoreConfig';
import { AppointmentStore, AppointmentStoreError } from '../taxguard/appointments/appointmentStore';

export interface SchedulingRouterDeps { store?: () => AppointmentStore; authenticate?: RequestHandler }

export function createSchedulingRouter(deps: SchedulingRouterDeps = {}) {
  const router = Router();
  let cached: AppointmentStore | null = null;
  const store = () => deps.store?.() ?? (cached ??= new AppointmentStore(getSupabaseAdmin() as any));
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!deps.store && !practiceStoreConfigured()) return res.status(503).json({ code: 'APPOINTMENT_STORE_UNAVAILABLE' });
    next();
  });
  router.use(deps.authenticate || authenticateToken);
  router.use((req: AuthenticatedRequest, res, next) => {
    if (!req.user?.tenantId || req.user.status !== 'active') return res.status(403).json({ code: 'APPOINTMENT_ACCESS_DENIED' });
    next();
  });
  const run = (handler: (req: AuthenticatedRequest) => Promise<unknown>, status = 200): RequestHandler => async (req, res: Response) => {
    try { return res.status(status).json(await handler(req as AuthenticatedRequest)); }
    catch (error) {
      if (error instanceof AppointmentStoreError) return res.status(error.status).json({ code: error.code });
      return res.status(503).json({ code: 'APPOINTMENT_STORE_UNAVAILABLE' });
    }
  };
  const t = (req: AuthenticatedRequest) => req.user!.tenantId!;
  const u = (req: AuthenticatedRequest) => req.user!.id;
  const key = (req: AuthenticatedRequest) => req.get('idempotency-key') || '';
  const c = (req: AuthenticatedRequest) => req.params.clientId;
  const str = (v: unknown) => typeof v === 'string' && v !== '' ? v : undefined;

  router.get('/schedule', run(req => store().schedule(t(req), u(req), req.query.from, req.query.to, str(req.query.staffUid))));
  router.get('/clients/:clientId/appointments', run(req => store().listForClient(t(req), c(req), u(req))));
  router.post('/clients/:clientId/appointments', run(req => store().create(t(req), c(req), u(req), key(req), req.body ?? {}), 201));
  router.get('/clients/:clientId/appointments/:id', run(req => store().get(t(req), c(req), u(req), req.params.id)));
  router.post('/clients/:clientId/appointments/:id/update', run(req => store().update(t(req), c(req), u(req), req.params.id, req.body?.version, key(req), req.body?.fields)));
  router.post('/clients/:clientId/appointments/:id/reschedule', run(req => store().reschedule(t(req), c(req), u(req), req.params.id, req.body?.version, key(req),
    { startsAt: req.body?.startsAt, endsAt: req.body?.endsAt, timezone: req.body?.timezone, staffUid: req.body?.staffUid })));
  router.post('/clients/:clientId/appointments/:id/status', run(req => store().transition(t(req), c(req), u(req), req.params.id, req.body?.version, key(req),
    req.body?.action, req.body?.reason)));
  return router;
}
