import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';

const ADMIN_ROLES = new Set(['admin', 'administrator', 'super_admin', 'super_administrator']);

export function requireOperationalAdministrator(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || !ADMIN_ROLES.has(req.user.role)) {
    res.status(403).json({
      code: 'OPERATIONAL_ADMIN_REQUIRED',
      error: 'Administrator privileges are required for operational diagnostics.',
    });
    return;
  }
  next();
}
