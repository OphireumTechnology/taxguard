/**
 * Durable client reassignment requests (proposal 045), replacing the in-memory
 * /api/assignments request-reassignment / reassignment-requests workflow. Development-only until
 * reviewed and applied: answers only with an injected client (tests) or when the durable store is
 * configured against a non-production project; otherwise 503. The database enforces client-only
 * requests, leadership-only review, versions, idempotency and audit. Approval does not reassign.
 */
import { createHash } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { getSupabaseAdmin } from '../supabase';
import { practiceStoreConfigured } from '../taxguard/practice/practiceStoreConfig';
import type { PracticeRpcClient } from '../taxguard/practice/practiceStore';

export interface ReassignmentRouterDeps { client?: () => PracticeRpcClient; authenticate?: RequestHandler }
const STATUS: Record<string, number> = { REASSIGNMENT_CLIENT_ONLY: 403, REASSIGNMENT_REVIEWER_REQUIRED: 403, PRACTICE_ACCESS_DENIED: 403, DOCUMENT_ACCESS_DENIED: 403,
  REASSIGNMENT_VERSION_CONFLICT: 409, REASSIGNMENT_ALREADY_REVIEWED: 409, IDEMPOTENCY_KEY_REUSED: 409 };
const PUBLIC: Record<string, string> = { DOCUMENT_NOT_FOUND: 'REASSIGNMENT_CLIENT_NOT_FOUND', DOCUMENT_ACCESS_DENIED: 'REASSIGNMENT_ACCESS_DENIED', DOCUMENT_INPUT_INVALID: 'REASSIGNMENT_INPUT_INVALID' };
const KEY = /^[A-Za-z0-9_.:-]{8,80}$/;

export function createReassignmentRouter(deps: ReassignmentRouterDeps = {}) {
  const router = Router();
  const rpc = () => deps.client?.() ?? (getSupabaseAdmin() as unknown as PracticeRpcClient);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!deps.client && !practiceStoreConfigured()) return res.status(503).json({ code: 'REASSIGNMENT_STORE_UNAVAILABLE' });
    next();
  });
  router.use(deps.authenticate || authenticateToken);
  router.use((req: AuthenticatedRequest, res, next) => {
    if (!req.user?.tenantId || req.user.status !== 'active' || req.user.role === 'recruiter') return res.status(403).json({ code: 'REASSIGNMENT_ACCESS_DENIED' });
    next();
  });
  const call = (name: string, args: Record<string, unknown>, status = 200): RequestHandler => async (_req, res) => {
    let response;
    try { response = await rpc().rpc(name, args); } catch { return res.status(503).json({ code: 'REASSIGNMENT_STORE_UNAVAILABLE' }); }
    if (response?.error) {
      const m = response.error.message;
      if (response.error.code === 'P0001' && typeof m === 'string' && /^[A-Z_]{3,64}$/.test(m)) {
        const code = PUBLIC[m] ?? m;
        return res.status(STATUS[m] ?? (code.endsWith('_NOT_FOUND') ? 404 : 400)).json({ code });
      }
      return res.status(503).json({ code: 'REASSIGNMENT_STORE_UNAVAILABLE' });
    }
    return res.status(status).json(response?.data);
  };
  const key = (req: AuthenticatedRequest) => req.get('idempotency-key') || '';
  const base = (req: AuthenticatedRequest) => ({ p_tenant: req.user!.tenantId, p_actor: req.user!.id });
  router.get('/clients/:clientId/requests', (req: AuthenticatedRequest, res, next) => call('taxguard_rar_list_client', { ...base(req), p_client: req.params.clientId })(req, res, next));
  router.post('/clients/:clientId/requests', (req: AuthenticatedRequest, res, next) => {
    const k = key(req);
    if (!KEY.test(k)) return res.status(400).json({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const reason = req.body?.reason, preferred = req.body?.preferredSpecialization;
    if (typeof reason !== 'string' || reason.length > 2000 || (preferred !== undefined && (typeof preferred !== 'string' || preferred.length > 200))) return res.status(400).json({ code: 'REASSIGNMENT_INPUT_INVALID' });
    const id = 'rar_' + createHash('sha256').update(['rar', req.user!.tenantId, req.params.clientId, req.user!.id, k].join('|')).digest('hex').slice(0, 32);
    return call('taxguard_rar_create', { ...base(req), p_client: req.params.clientId, p_id: id, p_key: k, p_input: { reason, ...(preferred ? { preferredSpecialization: preferred } : {}) } }, 201)(req, res, next);
  });
  router.get('/queue', (req: AuthenticatedRequest, res, next) => call('taxguard_rar_queue', { ...base(req), p_status: typeof req.query.status === 'string' && req.query.status ? req.query.status : null,
    p_limit: req.query.limit === undefined ? 50 : Number(req.query.limit) })(req, res, next));
  router.post('/queue/:id/review', (req: AuthenticatedRequest, res, next) => {
    const k = key(req);
    if (!KEY.test(k)) return res.status(400).json({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    if (!Number.isInteger(req.body?.version) || (req.body?.note !== undefined && typeof req.body.note !== 'string')) return res.status(400).json({ code: 'REASSIGNMENT_INPUT_INVALID' });
    return call('taxguard_rar_review', { ...base(req), p_request: req.params.id, p_version: req.body.version, p_key: k, p_decision: req.body?.decision, p_note: req.body?.note ?? null })(req, res, next);
  });
  return router;
}
