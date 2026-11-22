import type { Express } from 'express';

const RETIRED_PATHS = [
  '/api/engagements',
  '/api/appointments',
  '/api/payments',
  '/api/messages',
  '/api/legal',
  '/api/assignments',
];

export function mountRetiredLegacyRoutes(app: Express): void {
  for (const routePath of RETIRED_PATHS) {
    app.use(routePath, (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.status(410).json({
        code: 'LEGACY_ROUTE_RETIRED',
        error: `Endpoint ${routePath} has been retired in favor of durable APIs.`,
      });
    });
  }
}
