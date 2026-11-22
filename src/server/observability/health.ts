import { Router, type RequestHandler } from 'express';

export function createHealthRouter(options: {
  probes: () => Record<string, any>;
  authenticate: RequestHandler;
}) {
  const router = Router();

  router.get('/live', (_req, res) => {
    res.json({ status: 'live', timestamp: new Date().toISOString() });
  });

  router.get('/ready', (_req, res) => {
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  });

  router.get('/diagnostics', options.authenticate, (_req, res) => {
    res.json({ status: 'ok', probes: options.probes() });
  });

  return router;
}
