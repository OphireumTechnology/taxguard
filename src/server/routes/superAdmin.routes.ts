/**
 * Super administrator console support routes.
 *
 * Only super administrators (verified server-side from the session, never from the request)
 * may call these routes. They expose no taxpayer records and grant no extra permission:
 * dashboard "views" are inspection-only and are recorded in the audit log.
 */
import { Router, Response, NextFunction } from 'express';
import { db } from '../db';
import {
  authenticateToken,
  AuthenticatedRequest,
  isSuperAdministratorRole,
  PRIVILEGED_SESSION_IDLE_MS,
  PRIVILEGED_SESSION_ABSOLUTE_MS
} from '../auth';
import { hasTotpSecret } from '../totp';
import { DASHBOARD_DIRECTORY, findDashboard } from '../../config/superAdminDashboards';

export const superAdminRouter = Router();

function requireSuperAdministrator(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || !isSuperAdministratorRole(req.user.role)) {
    db.logSecurityEvent({
      eventType: 'RBAC_ACCESS_DENIED',
      ipAddress: req.ip || 'unknown',
      userId: req.user?.id,
      details: `Role ${req.user?.role || 'unknown'} attempted to use the super administrator console API.`,
      severity: 'warning'
    });
    return res.status(403).json({ error: 'Super administrator access is required.', code: 'SUPER_ADMIN_REQUIRED' });
  }
  if (!req.user.tenantId) {
    return res.status(403).json({ error: 'Authorized tenant context is unavailable.', code: 'TENANT_REQUIRED' });
  }
  next();
}

superAdminRouter.use(authenticateToken, requireSuperAdministrator);

superAdminRouter.get('/session', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const session = req.token ? db.sessions.get(req.token) : undefined;
  return res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId },
    session: session
      ? {
          createdAt: new Date(session.createdAt).toISOString(),
          expiresAt: new Date(session.expiresAt).toISOString(),
          absoluteExpiresAt: new Date(session.createdAt + PRIVILEGED_SESSION_ABSOLUTE_MS).toISOString(),
          idleTimeoutMinutes: PRIVILEGED_SESSION_IDLE_MS / 60000
        }
      : null,
    secondFactor: hasTotpSecret(user.id) ? 'totp' : 'identity_provider',
    policy: 'Dashboard inspection renders layouts only. It does not change your role, load other roles\' data or grant API permissions.'
  });
});

superAdminRouter.get('/dashboards', (_req: AuthenticatedRequest, res: Response) => {
  return res.json({ dashboards: DASHBOARD_DIRECTORY });
});

superAdminRouter.post('/dashboard-views', (req: AuthenticatedRequest, res: Response) => {
  const dashboardId = req.body?.dashboard;
  const entry = typeof dashboardId === 'string' ? findDashboard(dashboardId) : undefined;
  if (!entry) return res.status(400).json({ error: 'Unknown dashboard.', code: 'UNKNOWN_DASHBOARD' });
  const user = req.user!;
  db.logAudit({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'DASHBOARD_INSPECTION_VIEW',
    resource: `Dashboard ${entry.id}`,
    details: `Super administrator opened the ${entry.label} dashboard in ${entry.mode === 'live' ? 'inspection (layout-only)' : entry.mode} mode. Role, tenant and permissions unchanged.`,
    ipAddress: req.ip || 'unknown',
    severity: 'info'
  });
  return res.status(201).json({ recorded: true, dashboard: entry.id, mode: entry.mode });
});
