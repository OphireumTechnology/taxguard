import express, { type Router } from 'express';
import { authenticateToken } from '../auth';

/**
 * Fail-closed Express router for uncommissioned durable or legacy API surfaces.
 * Never returns fabricated records; enforces authentication on protected routes
 * and returns 503 with an explicit status code when durable services are unconfigured.
 */
export function createFailClosedRouter(
  serviceCode: string,
  options?: { requireAuth?: boolean; statusCode?: number; message?: string }
): Router {
  const router = express.Router();
  const requireAuth = options?.requireAuth !== false;
  const statusCode = options?.statusCode ?? 503;
  const message =
    options?.message ??
    `${serviceCode} is not configured for this environment and fails closed by default.`;

  if (requireAuth) {
    router.use(authenticateToken);
  }

  router.all('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(statusCode).json({
      code: `${serviceCode}_NOT_CONFIGURED`,
      error: message,
    });
  });

  return router;
}
