import express, { type RequestHandler } from 'express';
import { requireOperationalAdministrator } from '../operationalDiagnostics';

export interface OperationalAlertsOptions {
  probes: () => unknown;
  authenticate: RequestHandler;
  serverErrors: () => number;
}

export function createOperationalAlertsRouter(options: OperationalAlertsOptions) {
  const router = express.Router();
  router.get('/', options.authenticate, requireOperationalAdministrator, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const serverErrorCount = options.serverErrors();
    res.json({
      alerts: serverErrorCount > 0 ? [{ code: 'ELEVATED_5XX_ERRORS', count: serverErrorCount }] : [],
      probesConfigured: Boolean(options.probes),
      checkedAt: new Date().toISOString(),
    });
  });
  return router;
}
