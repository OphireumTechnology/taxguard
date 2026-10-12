import { listStaffRecoveries } from '../staffRecoveryDirectory';
import { listOwnSessions, revokeOwnSession, revokeOtherOwnSessions, revokeMemberSessions, listOwnSecurityEvents } from '../staffSessionManagement';
import { requestMfaRecovery, approveMfaRecovery } from '../mfaRecoveryRequests';
import { listStaffMembers, listStaffInvitations } from '../staffAccessDirectory';
import { changeStaffMembershipStatus } from '../staffMembershipLifecycle';
import { Router, type RequestHandler } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import { getSupabaseAdmin, verifySupabaseAccessToken, type VerifiedSupabaseUser } from '../supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthorityError } from '../taxguard/authority.repository';
import { createStaffInvitation, lookupStaffInvitation, revokeStaffInvitation } from '../staffInvitationManagement';
import { acceptStaffInvitation } from '../staffInvitationAcceptance';
import { approveStaffActivation } from '../staffActivation';
import { StaffAccessRateLimit } from '../staffAccessRateLimit';

export interface StaffAccessDependencies {
  client?: () => SupabaseClient;
  authenticate?: RequestHandler;
  verifyIdentity?: (token: string) => Promise<VerifiedSupabaseUser>;
  tenantId?: () => string;
  limiter?: StaffAccessRateLimit;
}

/** New identity APIs stay development-only until concurrency and integration reviews pass. */
export function staffAccessDevelopmentConfigured(): boolean {
  if (process.env.NODE_ENV === 'production' || process.env.TAXGUARD_STAFF_ACCESS_DEVELOPMENT_ENABLED !== 'true') return false;
  try {
    const url = new URL(process.env.SUPABASE_URL || '');
    return !url.hostname.includes('cvrlhixxczerytiocxid') &&
      (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) &&
      Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) && Boolean(process.env.TAXGUARD_TENANT_ID?.trim());
  } catch { return false; }
}
export function createStaffAccessRouter(deps: StaffAccessDependencies = {}) {
  const router = Router();
  const limiter = deps.limiter || new StaffAccessRateLimit();
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!deps.client && !staffAccessDevelopmentConfigured()) return res.status(503).json({ code: 'STAFF_ACCESS_DEVELOPMENT_UNAVAILABLE' });
    if (!limiter.allow(req.ip || 'unknown')) { res.setHeader('Retry-After', '60'); return res.status(429).json({ code: 'STAFF_ACCESS_RATE_LIMITED' }); }
    next();
  });
  const client = () => deps.client?.() || getSupabaseAdmin();
  const tenant = () => deps.tenantId?.() || process.env.TAXGUARD_TENANT_ID || '';
  const run = (handler: (req: AuthenticatedRequest) => Promise<unknown>, status = 200): RequestHandler => async (req, res) => {
    try { return res.status(status).json(await handler(req)); }
    catch (error) { return res.status(error instanceof AuthorityError ? error.status : 503).json({ code: error instanceof AuthorityError ? error.code : 'STAFF_ACCESS_UNAVAILABLE' }); }
  };
  const identity = async (req: AuthenticatedRequest) => {
    const token = req.body?.providerAccessToken;
    if (typeof token !== 'string' || !token || token.length > 16_384) throw new AuthorityError('PROVIDER_TOKEN_REQUIRED', 401);
    try { return await (deps.verifyIdentity?.(token) || verifySupabaseAccessToken(token)); }
    catch { throw new AuthorityError('PROVIDER_IDENTITY_DENIED', 401); }
  };
  // Provider-authenticated endpoints do not require a TaxGuard session: membership is pending or absent.
  router.post('/invitation/lookup', run(async req => lookupStaffInvitation(client(), tenant(), req.body?.token, await identity(req))));
  router.post('/invitation/accept', run(async req => acceptStaffInvitation(client(), tenant(), req.body?.token, await identity(req))));
  router.use(deps.authenticate || authenticateToken);
  const recoveryToken = (req: AuthenticatedRequest) => {
    if (!req.token || !/^tg_live_[a-f0-9]{64}$/.test(req.token)) throw new AuthorityError('AUTH_REQUIRED', 401);
    return req.token;
  };
  router.get('/mfa-recoveries', run(async req => listStaffRecoveries(client(), tenant(), req.user!, recoveryToken(req), req.query)));
  router.post('/mfa-recoveries', run(async req => requestMfaRecovery(client(), tenant(), req.user!, recoveryToken(req), req.body), 201));
  router.post('/mfa-recoveries/:id/approve', run(async req => {
    if (req.body && (typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length)) throw new AuthorityError('MFA_RECOVERY_INPUT_INVALID', 400);
    return approveMfaRecovery(client(), tenant(), req.user!, recoveryToken(req), req.params.id);
  }));
  const emptyBody = (req: AuthenticatedRequest) => {
    if (req.body && (typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length)) throw new AuthorityError('SESSION_INPUT_INVALID', 400);
  };
  router.get('/sessions', run(async req => listOwnSessions(client(), tenant(), req.user!, recoveryToken(req))));
  router.get('/sessions/events', run(async req => listOwnSecurityEvents(client(), tenant(), req.user!, recoveryToken(req), req.query.limit ?? 50)));
  router.post('/sessions/revoke-others', run(async req => { emptyBody(req); return revokeOtherOwnSessions(client(), tenant(), req.user!, recoveryToken(req)); }));
  router.post('/sessions/:id/revoke', run(async req => { emptyBody(req); return revokeOwnSession(client(), tenant(), req.user!, recoveryToken(req), req.params.id); }));
  router.post('/members/:uid/sessions/revoke', run(async req => revokeMemberSessions(client(), tenant(), req.user!, recoveryToken(req), { ...req.body, targetUid: req.params.uid })));
  router.get('/members', run(async req => listStaffMembers(client(), tenant(), req.user!, req.query)));
  router.get('/invitations', run(async req => listStaffInvitations(client(), tenant(), req.user!, req.query)));
  router.post('/invitations', run(async req => createStaffInvitation(client(), tenant(), req.user!, req.body), 201));
  router.post('/invitations/:id/revoke', run(async req => revokeStaffInvitation(client(), tenant(), req.user!, req.params.id)));
  router.post('/members/:uid/approve', run(async req => approveStaffActivation(client(), tenant(), req.user!, req.params.uid)));
  router.post('/members/:uid/status', run(async req => changeStaffMembershipStatus(client(), tenant(), req.user!, { ...req.body, targetUid: req.params.uid })));
  return router;
}
