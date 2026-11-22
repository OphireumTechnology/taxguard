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
  for (const route of RETIRED_PATHS) {
    app.use(route, (_req, res) => {
      res.status(410).json({
        code: 'LEGACY_ROUTE_RETIRED',
        error: `Route ${route} has been retired in favor of durable endpoints.`,
      });
    });
  }
}
