import { Router } from 'express';
import { authenticateToken } from '../auth';

export function createServiceUnavailableRouter(serviceCode: string, requireAuth = true) {
  const router = Router();
  if (requireAuth) {
    router.use(authenticateToken);
  }
  router.use((_req, res) => {
    res.status(503).json({
      code: `${serviceCode}_UNAVAILABLE`,
      error: 'Durable backing store is not configured in this environment.',
    });
  });
  return router;
}
