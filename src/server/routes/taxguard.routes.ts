import { Router, type Response } from 'express';
import type { AuthenticatedRequest } from '../auth';

export const taxguardRouter = Router();

taxguardRouter.get('/status', (_req, res) => {
  res.json({ status: 'integrated', standaloneDisabled: true });
});

export function handleLegacyTaxGuardRoute(_req: AuthenticatedRequest, res: Response) {
  return res.status(403).json({
    code: 'STANDALONE_TAXGUARD_REMOVED',
    error: 'Standalone TaxGuard console has been retired. Use your authorized role workspace.',
  });
}
