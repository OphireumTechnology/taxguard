/**
 * Durable background job queue (proposal 20261019240000), replacing the in-memory /api/operations/jobs routes.
 * Development-only until reviewed and applied: answers only with an injected client (tests) or when the durable store
 * is configured against a non-production project; in production it is mounted only through the route cutover gate.
 * The database enforces staff-only access, engagement and case scope, administrator-only tenant-wide jobs and
 * retries, idempotency and the append-only event log. Nothing here runs a job.
 */
import { Router, type RequestHandler } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { getSupabaseAdmin } from '../supabase';
import { practiceStoreConfigured } from '../taxguard/practice/practiceStoreConfig';
import type { PracticeRpcClient } from '../taxguard/practice/practiceStore';

export interface JobsRouterDeps { client?: () => PracticeRpcClient; authenticate?: RequestHandler }
const STATUS: Record<string, number> = { PRACTICE_ACCESS_DENIED: 403, JOB_SCOPE_REQUIRED: 403, JOB_ADMIN_REQUIRED: 403, JOB_CANCEL_NOT_AUTHORIZED: 403,
  JOB_IDEMPOTENCY_CONFLICT: 409, JOB_STATE_INVALID: 409 };
const PUBLIC: Record<string, string> = { PRACTICE_ACCESS_DENIED: 'JOB_ACCESS_DENIED', PRACTICE_INPUT_INVALID: 'JOB_INPUT_INVALID' };
const KEY = /^[A-Za-z0-9_.:-]{8,128}$/;
const optionalInteger = (v: unknown) => v === undefined || Number.isSafeInteger(v);
const optionalString = (v: unknown, max: number) => v === undefined || (typeof v === 'string' && v.length > 0 && v.length <= max);

export function createJobsRouter(deps: JobsRouterDeps = {}) {
  const router = Router();
  const rpc = () => deps.client?.() ?? (getSupabaseAdmin() as unknown as PracticeRpcClient);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!deps.client && !practiceStoreConfigured()) return res.status(503).json({ code: 'JOB_STORE_UNAVAILABLE' });
    next();
  });
  router.use(deps.authenticate || authenticateToken);
  router.use((req: AuthenticatedRequest, res, next) => {
    if (!req.user?.tenantId || req.user.status !== 'active' || ['client', 'prospective_client', 'recruiter'].includes(req.user.role))
      return res.status(403).json({ code: 'JOB_ACCESS_DENIED' });
    next();
  });
  const call = async (res: any, name: string, args: Record<string, unknown>, status = 200) => {
    let response;
    try { response = await rpc().rpc(name, args); } catch { return res.status(503).json({ code: 'JOB_STORE_UNAVAILABLE' }); }
    if (response?.error) {
      const m = response.error.message;
      if (response.error.code === 'P0001' && typeof m === 'string' && /^[A-Z_]{3,64}$/.test(m)) {
        const code = PUBLIC[m] ?? m;
        return res.status(STATUS[m] ?? (code.endsWith('_NOT_FOUND') ? 404 : 400)).json({ code });
      }
      return res.status(503).json({ code: 'JOB_STORE_UNAVAILABLE' });
    }
    return res.status(status).json(response?.data);
  };
  const base = (req: AuthenticatedRequest) => ({ p_tenant: req.user!.tenantId, p_actor: req.user!.id });
  const queryInteger = (v: unknown, fallback: number) => v === undefined ? fallback : typeof v === 'string' && /^(0|[1-9]\d{0,5})$/.test(v) ? Number(v) : NaN;

  router.get('/', (req: AuthenticatedRequest, res) => {
    const limit = queryInteger(req.query.limit, 50), offset = queryInteger(req.query.offset, 0);
    const text = (v: unknown) => v === undefined ? null : typeof v === 'string' && v ? v : undefined;
    const client = text(req.query.clientId), status = text(req.query.status), jobType = text(req.query.jobType);
    if (!Number.isInteger(limit) || !Number.isInteger(offset) || client === undefined || status === undefined || jobType === undefined)
      return res.status(400).json({ code: 'JOB_QUERY_INVALID' });
    return call(res, 'taxguard_job_list', { ...base(req), p_client: client, p_status: status, p_job_type: jobType, p_limit: limit, p_offset: offset });
  });
  router.post('/', (req: AuthenticatedRequest, res) => {
    const key = req.get('idempotency-key') || '';
    if (!KEY.test(key)) return res.status(400).json({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const b = req.body ?? {};
    if (typeof b.jobType !== 'string' || b.payload === null || typeof b.payload !== 'object' || Array.isArray(b.payload)
        || !optionalString(b.clientId, 64) || !optionalString(b.caseId, 128) || !optionalInteger(b.priority) || !optionalInteger(b.maxAttempts)
        || (b.availableAt !== undefined && (typeof b.availableAt !== 'string' || !Number.isFinite(Date.parse(b.availableAt)))))
      return res.status(400).json({ code: 'JOB_INPUT_INVALID' });
    return call(res, 'taxguard_job_enqueue', { ...base(req), p_job_type: b.jobType, p_payload: b.payload, p_client: b.clientId ?? null, p_case: b.caseId ?? null,
      p_priority: b.priority ?? null, p_max_attempts: b.maxAttempts ?? null, p_available_at: b.availableAt ?? null, p_idempotency_key: key }, 201);
  });
  router.post('/:id/retry', (req: AuthenticatedRequest, res) => call(res, 'taxguard_job_retry', { ...base(req), p_job: req.params.id }));
  router.post('/:id/cancel', (req: AuthenticatedRequest, res) => call(res, 'taxguard_job_cancel', { ...base(req), p_job: req.params.id }));
  return router;
}
