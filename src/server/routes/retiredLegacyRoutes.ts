/**
 * Legacy in-memory routes retired in Phase 10. Each had a durable replacement and no remaining
 * consumer in the application (verified by src/tests/legacyRouteRetirement.test.ts). They answer
 * 410 with the replacement path, so a stale client fails visibly instead of reading or writing
 * in-memory records. Nothing is processed: no authentication, body parsing or logging of input.
 * The router source files remain for their unit tests until the owner approves deletion.
 */
import { Router } from 'express';

export const RETIRED_LEGACY_ROUTES: ReadonlyArray<{ path: string; replacement: string; proposal: string }> = Object.freeze([
  { path: '/api/engagements', replacement: '/api/practice', proposal: '025 / 044' },
  { path: '/api/appointments', replacement: '/api/scheduling', proposal: '040' },
  { path: '/api/payments', replacement: '/api/billing', proposal: '028 / 047' },
  { path: '/api/messages', replacement: '/api/communications', proposal: '039' },
  { path: '/api/legal', replacement: '/api/legal-matters', proposal: '042' },
  { path: '/api/assignments', replacement: '/api/practice', proposal: '025 / 045' },
]);

export function retiredLegacyRoute(replacement: string) {
  const router = Router();
  router.all('*', (_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.status(410).json({ code: 'LEGACY_ROUTE_RETIRED', replacement }); });
  return router;
}

export function mountRetiredLegacyRoutes(app: { use: (path: string, handler: Router) => unknown }) {
  for (const r of RETIRED_LEGACY_ROUTES) app.use(r.path, retiredLegacyRoute(r.replacement));
}
