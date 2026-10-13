import type { RequestHandler } from 'express';
import { practiceStoreConfigured } from './taxguard/practice/practiceStoreConfig';

/** Replacements are composed and tested locally. Retire obsolete contracts in durable mode;
 * do not redirect financial mutations or delete unbuilt workflows. Local legacy fixtures can
 * still mount their routers directly. This boundary performs no provider calls. */
export const RETIRED_LEGACY_ROUTES = ['/documents', '/engagements', '/appointments', '/payments', '/messages', '/legal',
  '/admin/users', '/admin/security-events', '/admin/audit-logs'] as const;
export function legacyRouteBoundary(enabled = () => process.env.TAXGUARD_LEGACY_ROUTES === 'retired' || practiceStoreConfigured()): RequestHandler {
  return (req, res, next) => {
    if (enabled() && RETIRED_LEGACY_ROUTES.some(path => req.path === path || req.path.startsWith(path + '/'))) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(410).json({ code: 'LEGACY_ROUTE_RETIRED' });
    }
    next();
  };
}
