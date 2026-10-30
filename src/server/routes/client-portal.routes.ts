/**
 * Client-portal reads (proposal 044): engagements per tax year with case status, for the client
 * dashboard. Development-only until reviewed and applied: answers only with an injected client
 * (tests) or when the durable store is configured against a non-production project; otherwise
 * 503. The database decides scope (own client / assigned staff / managers) and what clients see.
 */
import { Router, type RequestHandler, type Response } from 'express';
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
  // Contract C3 (proposal 20261016000000): canonical stage state for one engagement year.
  router.get('/clients/:clientId/case-stages', async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user?.tenantId || user.status !== 'active' || user.role === 'recruiter') return res.status(403).json({ code: 'PORTAL_ACCESS_DENIED' });
    const engagementId = typeof req.query.engagementId === 'string' ? req.query.engagementId : '';
    const taxYear = typeof req.query.taxYear === 'string' && /^\d{4}$/.test(req.query.taxYear) ? Number(req.query.taxYear) : NaN;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(engagementId) || !Number.isInteger(taxYear)) return res.status(400).json({ code: 'PORTAL_INPUT_INVALID' });
    return portalRpc(res, 'taxguard_portal_case_stages', { p_tenant: user.tenantId, p_client: req.params.clientId, p_actor: user.id, p_engagement: engagementId, p_year: taxYear });
  });
  // Contract C1 (proposal 20261016010000): consultation requests converted for this client, with
  // the real appointment's current status. Bounded keyset pages; the cursor is opaque base64url JSON.
  router.get('/clients/:clientId/consultations', async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user?.tenantId || user.status !== 'active' || user.role === 'recruiter') return res.status(403).json({ code: 'PORTAL_ACCESS_DENIED' });
    let after: unknown = null;
    if (typeof req.query.after === 'string' && req.query.after) {
      try { after = JSON.parse(Buffer.from(req.query.after, 'base64url').toString('utf8')); } catch { return res.status(400).json({ code: 'PORTAL_INPUT_INVALID' }); }
      if (!after || typeof after !== 'object' || Array.isArray(after)) return res.status(400).json({ code: 'PORTAL_INPUT_INVALID' });
    }
    const send = res.json.bind(res);
    // Re-shape the page: return an opaque cursor instead of the raw keyset.
    res.json = (body: any) => send(body && Array.isArray(body.items)
      ? { items: body.items, nextCursor: body.next ? Buffer.from(JSON.stringify(body.next)).toString('base64url') : null } : body);
    return portalRpc(res, 'taxguard_portal_consultations', { p_tenant: user.tenantId, p_client: req.params.clientId, p_actor: user.id, p_limit: 20, p_after: after });
  });
  return router;

  function portalRpc(res: Response, name: string, args: Record<string, unknown>) { return callPortalRpc(rpc(), res, name, args); }
}

/**
 * Stage 11 signature packages for the client portal (proposal 20261019190000): status only, no figures, forms or signing
 * action. A separate mount, so its cutover does not hold back the other portal reads.
 */
export function createClientSignaturesRouter(deps: ClientPortalRouterDeps = {}) {
  const router = Router();
  const rpc = () => deps.client?.() ?? (getSupabaseAdmin() as unknown as PracticeRpcClient);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!deps.client && !practiceStoreConfigured()) return res.status(503).json({ code: 'PORTAL_STORE_UNAVAILABLE' });
    next();
  });
  router.use(deps.authenticate || authenticateToken);
  router.get('/clients/:clientId/signature-packages', async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user?.tenantId || user.status !== 'active' || user.role === 'recruiter') return res.status(403).json({ code: 'PORTAL_ACCESS_DENIED' });
    const send = res.json.bind(res);
    res.json = (body: any) => send(Array.isArray(body) ? { items: body, signature: 'NOT_AVAILABLE' } : body);
    return callPortalRpc(rpc(), res, 'taxguard_portal_signature_packages', { p_tenant: user.tenantId, p_client: req.params.clientId, p_actor: user.id });
  });
  return router;
}

/** Calls a portal RPC and maps database codes to safe HTTP answers (no database text is returned). */
async function callPortalRpc(client: PracticeRpcClient, res: Response, name: string, args: Record<string, unknown>) {
  let response;
  try { response = await client.rpc(name, args); } catch { return res.status(503).json({ code: 'PORTAL_STORE_UNAVAILABLE' }); }
  if (response?.error) {
    const m = response.error.message;
    if (response.error.code === 'P0001') {
      if (m === 'DOCUMENT_NOT_FOUND' || m === 'PORTAL_ENGAGEMENT_NOT_FOUND' || m === 'CONSULT_CLIENT_NOT_FOUND') return res.status(404).json({ code: 'PORTAL_NOT_FOUND' });
      if (m === 'DOCUMENT_ACCESS_DENIED') return res.status(403).json({ code: 'PORTAL_ACCESS_DENIED' });
      if (m === 'DOCUMENT_INPUT_INVALID' || m === 'PORTAL_INPUT_INVALID') return res.status(400).json({ code: 'PORTAL_INPUT_INVALID' });
    }
    return res.status(503).json({ code: 'PORTAL_STORE_UNAVAILABLE' });
  }
  return res.json(response?.data ?? null);
}
