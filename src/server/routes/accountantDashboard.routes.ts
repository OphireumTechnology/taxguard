import { Router } from 'express';
import { authenticateToken } from '../auth';

export interface AccountantDashboardDeps {
  [key: string]: any;
}

export function createAccountantDashboardRouter(_deps?: AccountantDashboardDeps) {
  const router = Router();
  router.use(authenticateToken);
  router.get('/dashboard', (_req, res) => {
    res.json({ cases: [], metrics: { activeCases: 0, pendingReview: 0, openExceptions: 0 } });
  });
  return router;
}
