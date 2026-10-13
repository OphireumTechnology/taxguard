/**
 * Client-portal reads (proposal 044): engagements per tax year with case status, for the client
 * dashboard. Development-only until reviewed and applied: answers only with an injected client
 * (tests) or when the durable store is configured against a non-production project; otherwise
 * 503. The database decides scope (own client / assigned staff / managers) and what clients see.
 */
import { Router, type RequestHandler } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { getSupabaseAdmin } from '../supabase';
import { practiceStoreConfigured } from '../taxguard/practice/practiceStoreConfig';
import type { PracticeRpcClient } from '../taxguard/practice/practiceStore';

export interface ClientPortalRouterDeps { client?: () => PracticeRpcClient; authenticate?: RequestHandler }

export function createClientPortalRouter(deps: ClientPortalRouterDeps = {}) {
  const router = Router();
  const rpc = () => deps.client?.() ?? (getSupabaseAdmin() as unknown as PracticeRpcClient);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!deps.client && !practiceStoreConfigured()) return res.status(503).json({ code: 'PORTAL_STORE_UNAVAILABLE' });
    next();
  });
  router.use(deps.authenticate || authenticateToken);
  router.get('/clients/:clientId/engagements', async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user?.tenantId || user.status !== 'active' || user.role === 'recruiter') return res.status(403).json({ code: 'PORTAL_ACCESS_DENIED' });
    let response;
    try { response = await rpc().rpc('taxguard_portal_engagements', { p_tenant: user.tenantId, p_client: req.params.clientId, p_actor: user.id }); }
    catch { return res.status(503).json({ code: 'PORTAL_STORE_UNAVAILABLE' }); }
    if (response?.error) {
      const m = response.error.message;
      if (response.error.code === 'P0001' && (m === 'DOCUMENT_NOT_FOUND' || m === 'DOCUMENT_INPUT_INVALID')) return res.status(404).json({ code: 'PORTAL_CLIENT_NOT_FOUND' });
      if (response.error.code === 'P0001' && m === 'DOCUMENT_ACCESS_DENIED') return res.status(403).json({ code: 'PORTAL_ACCESS_DENIED' });
      return res.status(503).json({ code: 'PORTAL_STORE_UNAVAILABLE' });
    }
    return res.json({ items: Array.isArray(response?.data) ? response.data : [] });
  });
  return router;
}
