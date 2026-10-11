/**
 * Production-compatible Accountant dashboard API (read-only).
 *
 * Mounted at /api/accountant by the production app. Authentication is the existing durable
 * session (which enforces staff MFA / AAL2); the role check is server-side; the tenant comes
 * only from the session and must equal the deployment tenant; cases come only from the durable
 * tenant-scoped store (never the in-memory development store).
 */
import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../auth';
import { getSupabaseAdmin } from '../supabase';
import { AuthorityError } from '../taxguard/authority.repository';
import { DURABLE_UNAVAILABLE_FIELDS, SupabaseAccountantCaseDirectory } from '../taxguard/accountantCaseDirectory';

export interface AccountantDashboardDeps {
  directory?: () => Pick<SupabaseAccountantCaseDirectory, 'listPreparerCases'>;
  deploymentTenantId?: () => string;
}

export function createAccountantDashboardRouter(deps: AccountantDashboardDeps = {}) {
  const router = Router();
  router.use(authenticateToken, requireRole('accountant'));
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  router.get('/dashboard', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const deploymentTenant = (deps.deploymentTenantId?.() ?? process.env.TAXGUARD_TENANT_ID ?? '').trim();
      if (!user.tenantId || !deploymentTenant || user.tenantId !== deploymentTenant) {
        throw new AuthorityError('ACCOUNTANT_TENANT_REQUIRED', 403);
      }
      const directory = deps.directory?.() ?? new SupabaseAccountantCaseDirectory(getSupabaseAdmin());
      const cases = await directory.listPreparerCases(user.tenantId, user.id, user.authorizedClientIds);
      res.json({ cases, source: 'durable', unavailableFields: [...DURABLE_UNAVAILABLE_FIELDS] });
    } catch (error) {
      res.status(error instanceof AuthorityError ? error.status : 503)
        .json({ code: error instanceof AuthorityError ? error.code : 'ACCOUNTANT_DASHBOARD_UNAVAILABLE' });
    }
  });

  return router;
}
