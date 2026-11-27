import { Router, type NextFunction, type Response } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { buildWorkforceMatrix, workforceMatrixTotals } from '../../ai/workforceMatrix';
import { assertCaseScopeMatch, validateScope } from '../ai/workforce/authority';
import { WorkforceDispatcher } from '../ai/workforce/WorkforceDispatcher';
import { A10DuplicateWorkflowService } from '../ai/workforce/a10DuplicateWorkflow';
import { createProductionWorkforceRuntime } from '../ai/workforce/productionWorkforceEnvironment';
import { WorkforceError, type WorkforceEnvironment, type WorkforceStore } from '../ai/workforce/contracts';

export type WorkforceAuthMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

export interface AiWorkforceRouterDeps {
  getRuntime?: () => { env: WorkforceEnvironment; store: WorkforceStore };
  authenticate?: WorkforceAuthMiddleware;
}

function defaultRuntimeFactory(): { env: WorkforceEnvironment; store: WorkforceStore } {
  return createProductionWorkforceRuntime(async () => null);
}

const defaultAuthMiddleware: WorkforceAuthMiddleware = async (req, res, next) => {
  try {
    const authMod = await import('../auth');
    await authMod.authenticateToken(req, res, next);
  } catch {
    res.status(401).json({
      code: 'WORKFORCE_AUTH_REQUIRED',
      human_review_required: true,
      authoritative_mutation: false,
      external_submission_allowed: false,
    });
  }
};

function sendError(res: Response, error: unknown): void {
  if (error instanceof WorkforceError) {
    res.status(error.status).json({
      code: error.code,
      details: error.details ?? undefined,
      human_review_required: true,
      authoritative_mutation: false,
      external_submission_allowed: false,
    });
    return;
  }
  res.status(503).json({
    code: 'AI_WORKFORCE_UNAVAILABLE',
    human_review_required: true,
    authoritative_mutation: false,
    external_submission_allowed: false,
  });
}

function bearerToken(req: AuthenticatedRequest): string {
  if (typeof req.token === 'string' && req.token.trim()) return req.token.trim();
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const sessionHeader = req.headers['x-session-token'];
  if (typeof sessionHeader === 'string' && sessionHeader.trim()) return sessionHeader.trim();
  return '';
}

/**
 * Express router for TaxGuard's 61-Agent Application Workforce (A00–A60).
 *
 * Mounted at `/api/ai-workforce`:
 * - GET  /matrix                          — 61-row per-agent matrix + aggregate lifecycle totals
 * - POST /agents/:agentId/execute         — Execute bounded domain agent advisory (A00–A60; A39 fail-closed)
 * - POST /a10/jobs                        — Stage Three A10 duplicate check job submission (idempotent)
 * - POST /a10/jobs/:jobId/process         — Stage Three A10 worker processing
 * - GET  /cases/:caseId/advisories        — Case-scoped advisories + live stale-evidence inspection
 * - POST /advisories/:advisoryId/decisions — Human review decision bound to advisory + evidence version
 */
export function createAiWorkforceRouter(deps: AiWorkforceRouterDeps = {}) {
  const router = Router();
  const auth = deps.authenticate ?? defaultAuthMiddleware;
  const resolveRuntime = deps.getRuntime ?? defaultRuntimeFactory;

  router.get('/matrix', auth, (_req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const rows = buildWorkforceMatrix();
    res.json({
      rows,
      totals: workforceMatrixTotals(rows),
    });
  });

  router.post('/agents/:agentId/execute', auth, async (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const { env, store } = resolveRuntime();
      const dispatcher = new WorkforceDispatcher(env, store);
      const advisory = await dispatcher.executeAgent(bearerToken(req), {
        request_id: String(req.body?.request_id ?? ''),
        idempotency_key: typeof req.body?.idempotency_key === 'string' ? req.body.idempotency_key : undefined,
        agent_id: req.params.agentId as any,
        scope: req.body?.scope,
        workflow_stage: Number(req.body?.workflow_stage),
        evidence_source_ids: req.body?.evidence_source_ids,
        payload: req.body?.payload ?? {},
      });
      res.status(201).json({ advisory });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/a10/jobs', auth, async (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const { env, store } = resolveRuntime();
      const a10 = new A10DuplicateWorkflowService(env, store);
      const result = await a10.submitDuplicateCheckJob(bearerToken(req), {
        request_id: req.body?.request_id,
        idempotency_key: req.body?.idempotency_key,
        scope: req.body?.scope,
        evidence_source_ids: req.body?.evidence_source_ids,
      });
      res.status(result.created ? 201 : 200).json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/a10/jobs/:jobId/process', auth, async (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const { env, store } = resolveRuntime();
      const a10 = new A10DuplicateWorkflowService(env, store);
      const tenantId = String(req.body?.tenant_id ?? req.user?.tenantId ?? '');
      const result = await a10.processDuplicateCheckJob(bearerToken(req), tenantId, req.params.jobId);
      res.status(200).json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/cases/:caseId/advisories', auth, async (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const { env, store } = resolveRuntime();
      const scope = validateScope({
        tenant_id: String(req.query.tenant_id ?? req.user?.tenantId ?? ''),
        client_id: String(req.query.client_id ?? ''),
        tax_case_id: req.params.caseId,
        tax_year: Number(req.query.tax_year),
      });
      if (req.query.agent_id === 'A10') {
        const a10 = new A10DuplicateWorkflowService(env, store);
        const items = await a10.getCaseDuplicateAdvisories(bearerToken(req), scope);
        res.json({ items });
        return;
      }
      const actor = await env.verifyActor(bearerToken(req));
      if (!actor || actor.session_revoked || actor.status !== 'active' || actor.tenant_id !== scope.tenant_id) {
        throw new WorkforceError('WORKFORCE_AUTH_REQUIRED', 401);
      }
      const caseRecord = await env.loadCase(actor.tenant_id, scope);
      if (!caseRecord || !(await env.isStaffAssigned(actor, caseRecord))) {
        throw new WorkforceError('WORKFORCE_STAFF_ASSIGNMENT_REQUIRED', 403);
      }
      assertCaseScopeMatch(caseRecord, scope);
      const agentFilter = typeof req.query.agent_id === 'string' ? (req.query.agent_id as any) : undefined;
      const advisories = await store.listCaseAdvisories(actor.tenant_id, scope.tax_case_id, agentFilter);
      res.json({ items: advisories.filter(({ scope: saved }) =>
        saved.tenant_id === scope.tenant_id && saved.client_id === scope.client_id &&
        saved.tax_case_id === scope.tax_case_id && saved.tax_year === scope.tax_year) });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/advisories/:advisoryId/decisions', auth, async (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const { env, store } = resolveRuntime();
      const agentId = req.body?.agent_id;
      const request = {
        request_id: String(req.body?.request_id ?? ''),
        advisory_id: req.params.advisoryId,
        scope: req.body?.scope,
        expected_evidence_fingerprint: String(req.body?.expected_evidence_fingerprint ?? ''),
        decision: req.body?.decision,
        rationale: String(req.body?.rationale ?? ''),
      };
      const record =
        agentId === 'A10'
          ? await new A10DuplicateWorkflowService(env, store).recordDuplicateDecision(bearerToken(req), request)
          : await new WorkforceDispatcher(env, store).recordHumanDecision(bearerToken(req), request);
      res.status(201).json({ decision: record });
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
}
