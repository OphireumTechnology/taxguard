import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth';
import { createFailClosedRouter } from './_failClosedRouter';

export const taxguardRouter = createFailClosedRouter('TAXGUARD_LEGACY');

export function handleLegacyTaxGuardRoute(req: AuthenticatedRequest, res: Response): void {
  res.setHeader('Cache-Control', 'no-store');
  if (!req.user) {
    res.status(401).json({
      code: 'AUTH_REQUIRED',
      error: 'Authentication is required to access TaxGuard workspace routes.',
    });
    return;
  }
  res.status(410).json({
    code: 'LEGACY_TAXGUARD_ROUTE_RETIRED',
    error: 'Use the authenticated SPA workspace and /api/stages-09-18 endpoints.',
  });
}
