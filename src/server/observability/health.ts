/**
 * Liveness, readiness and administrator diagnostics (Phase 10).
 *
 * - GET /live  (public): the process answers. Body {status:'alive'} only.
 * - GET /ready (public): 200 {status:'ready'} or 503 {status:'not_ready'}; no dependency names,
 *   states, versions, hosts, tenants or timings, so the endpoint reveals nothing about topology.
 * - GET /diagnostics (administrators only): per-area state codes and counts for operators. Never
 *   includes URLs, connection strings, keys, secrets, tenant identifiers or row contents.
 * Probes are injected so every state, including a lost database connection, is testable offline.
 */
import { Router, type RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../auth';

export type ProbeState = 'OK' | 'UNAVAILABLE' | 'NOT_CONFIGURED' | 'BLOCKED' | 'DEGRADED';
export interface HealthProbes {
  database(): Promise<{ state: ProbeState; schema: string }>;
  identity(): ProbeState;
  storage(): ProbeState;
  scanner(): Promise<{ state: string; backlog?: { open: number; overdue: number; failed24h: number; pendingDocuments: number } }>;
  ai(): { state: string; materialActions: 'BLOCKED'; providerCommissioned: false };
  securityEvents(): { mode: string; recorded?: number; suppressed?: number; failed?: number; dropped?: number; pending?: number };
  environment(): { nodeEnv: string; deployment: string; durableStore: boolean };
}
const ADMIN_ROLES = ['admin', 'administrator', 'super_admin', 'super_administrator'];
const PROBE_TIMEOUT_MS = 3000;
const timed = <T>(p: Promise<T>, fallback: T) => Promise.race([p.catch(() => fallback), new Promise<T>(r => setTimeout(() => r(fallback), PROBE_TIMEOUT_MS).unref?.())]);

/** Readiness requires the database schema to be ready and identity configured; nothing else is disclosed. */
export async function isReady(probes: HealthProbes) {
  const db = await timed(probes.database(), { state: 'UNAVAILABLE' as ProbeState, schema: 'DATABASE_UNAVAILABLE' });
  return db.state === 'OK' && db.schema === 'DATABASE_READY' && probes.identity() === 'OK';
}

export async function diagnostics(probes: HealthProbes) {
  const mem = process.memoryUsage();
  const [database, scanner] = await Promise.all([timed(probes.database(), { state: 'UNAVAILABLE' as ProbeState, schema: 'DATABASE_UNAVAILABLE' }),
    timed(probes.scanner(), { state: 'UNAVAILABLE' })]);
  return {
    process: { state: 'OK', uptimeSeconds: Math.floor(process.uptime()), rssMb: Math.round(mem.rss / 1048576), heapUsedMb: Math.round(mem.heapUsed / 1048576), nodeMajor: Number(process.versions.node.split('.')[0]) },
    environment: probes.environment(),
    database: { state: database.state, migrationReadiness: database.schema },
    identity: { state: probes.identity() },
    storage: { state: probes.storage() },
    scanner,
    ai: probes.ai(),
    securityEvents: probes.securityEvents(),
    checkedAt: new Date().toISOString(),
  };
}

export function createHealthRouter(deps: { probes: () => HealthProbes; authenticate: RequestHandler }) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/live', (_req, res) => res.status(200).json({ status: 'alive' }));
  router.get('/ready', async (_req, res) => {
    let ready = false;
    try { ready = await isReady(deps.probes()); } catch { ready = false; }
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' });
  });
  router.get('/diagnostics', deps.authenticate, (req: AuthenticatedRequest, res, next) => {
    const u = req.user;
    if (!u?.tenantId || u.status !== 'active' || !ADMIN_ROLES.includes(u.role)) return res.status(403).json({ code: 'ADMIN_REQUIRED' });
    next();
  }, async (_req, res) => {
    try { res.status(200).json(await diagnostics(deps.probes())); } catch { res.status(503).json({ code: 'DIAGNOSTICS_UNAVAILABLE' }); }
  });
  return router;
}
