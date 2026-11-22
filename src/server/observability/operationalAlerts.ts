/**
 * Operational alert conditions (Block 77). A deterministic evaluation of the administrator diagnostics: each condition
 * is a yes-or-no fact the probes already report (a dependency unavailable, a required provider not configured in
 * production, failed or overdue scans, security events lost or not durable). No numeric threshold is invented: rates,
 * paging policy and escalation are operational decisions for the owner.
 *
 * - Every change is written as one JSON line to standard output (RAISED or CLEARED) for the host's log collector. The
 *   line carries only the condition code, whether it blocks readiness, counts and a timestamp: no URL, host, tenant,
 *   identifier, message or secret.
 * - Delivery to a person (email, SMS, pager) is NOT_CONFIGURED: no notification provider is commissioned.
 * - State is process-local, like the operational metrics; it is not audit custody.
 */
import { Router, type RequestHandler } from 'express';
import { diagnostics as diagnose, type HealthProbes } from './health';
import { requireOperationalAdministrator } from '../operationalDiagnostics';

type Diagnostics = Awaited<ReturnType<typeof diagnose>>;
export type AlertCondition = 'DATABASE_UNAVAILABLE' | 'MIGRATIONS_NOT_READY' | 'IDENTITY_NOT_CONFIGURED' | 'STORAGE_NOT_CONFIGURED'
  | 'SCANNER_BACKLOG_UNAVAILABLE' | 'SCANS_FAILED' | 'SCANS_OVERDUE' | 'SECURITY_EVENTS_NOT_DURABLE' | 'SECURITY_EVENTS_LOST';
export interface Alert { condition: AlertCondition; blocksReadiness: boolean; counts?: Record<string, number> }
export interface ActiveAlert extends Alert { since: string }

const count = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

/** The conditions that hold now. Configuration conditions apply only in production, where they are required. */
export function evaluateAlerts(d: Diagnostics): Alert[] {
  const production = d.environment?.nodeEnv === 'production';
  const out: Alert[] = [];
  if (d.database?.state === 'UNAVAILABLE') out.push({ condition: 'DATABASE_UNAVAILABLE', blocksReadiness: true });
  else if (d.database?.migrationReadiness !== 'DATABASE_READY') out.push({ condition: 'MIGRATIONS_NOT_READY', blocksReadiness: true });
  if (production && d.identity?.state !== 'OK') out.push({ condition: 'IDENTITY_NOT_CONFIGURED', blocksReadiness: true });
  if (production && d.storage?.state !== 'OK') out.push({ condition: 'STORAGE_NOT_CONFIGURED', blocksReadiness: false });
  const scanner = d.scanner as { state?: string; backlog?: { failed24h?: number; overdue?: number } } | undefined;
  if (scanner?.state === 'BACKLOG_UNAVAILABLE' || scanner?.state === 'UNAVAILABLE') out.push({ condition: 'SCANNER_BACKLOG_UNAVAILABLE', blocksReadiness: false });
  if (count(scanner?.backlog?.failed24h)) out.push({ condition: 'SCANS_FAILED', blocksReadiness: false, counts: { failed24h: count(scanner?.backlog?.failed24h) } });
  if (count(scanner?.backlog?.overdue)) out.push({ condition: 'SCANS_OVERDUE', blocksReadiness: false, counts: { overdue: count(scanner?.backlog?.overdue) } });
  const events = d.securityEvents ?? { mode: 'MEMORY_ONLY' };
  if (production && events.mode !== 'DURABLE') out.push({ condition: 'SECURITY_EVENTS_NOT_DURABLE', blocksReadiness: false });
  const lost = { failed: count(events.failed), dropped: count(events.dropped) };
  if (lost.failed || lost.dropped) out.push({ condition: 'SECURITY_EVENTS_LOST', blocksReadiness: false, counts: lost });
  return out;
}

/** Remembers which conditions are active and writes one line for each change. */
export function createAlertTracker(opts: { write?: (line: string) => void; now?: () => Date } = {}) {
  const write = opts.write ?? (line => { process.stdout.write(line + '\n'); });
  const now = opts.now ?? (() => new Date());
  const active = new Map<AlertCondition, ActiveAlert>();
  const line = (state: 'RAISED' | 'CLEARED', a: Alert, at: string) => write(JSON.stringify({ type: 'taxguard.operational_alert', state, condition: a.condition,
    blocksReadiness: a.blocksReadiness, ...(a.counts ? { counts: a.counts } : {}), at }));
  return {
    update(alerts: Alert[]): ActiveAlert[] {
      const at = now().toISOString();
      const current = new Map(alerts.map(a => [a.condition, a]));
      for (const [condition, previous] of [...active]) if (!current.has(condition)) { active.delete(condition); line('CLEARED', previous, at); }
      for (const a of alerts) {
        const previous = active.get(a.condition);
        if (!previous) { active.set(a.condition, { ...a, since: at }); line('RAISED', a, at); }
        else active.set(a.condition, { ...a, since: previous.since });
      }
      return [...active.values()].sort((x, y) => x.condition.localeCompare(y.condition));
    },
    active: () => [...active.values()].sort((x, y) => x.condition.localeCompare(y.condition)),
  };
}

/** An opt-in evaluation interval in seconds (30 to 3600), or null when none is configured. No default is assumed. */
export function alertInterval(env: Record<string, string | undefined>): number | null {
  const raw = env.TAXGUARD_OPERATIONAL_ALERT_INTERVAL_SECONDS;
  if (raw === undefined || raw === '') return null;
  const n = Number(raw);
  return /^\d+$/.test(raw) && n >= 30 && n <= 3600 ? n : null;
}

/**
 * GET /api/operational-alerts (operational administrators with an AAL2 session, no-store): evaluates the conditions now
 * and returns the active ones. With TAXGUARD_OPERATIONAL_ALERT_INTERVAL_SECONDS set, they are also evaluated on that
 * interval so that changes reach the log without a request; the timer never keeps the process alive.
 */
export function createOperationalAlertsRouter(deps: { probes: () => HealthProbes; authenticate: RequestHandler; tracker?: ReturnType<typeof createAlertTracker>;
  serverErrors?: () => number; env?: Record<string, string | undefined> }) {
  const tracker = deps.tracker ?? createAlertTracker();
  const evaluate = async () => tracker.update(evaluateAlerts(await diagnose(deps.probes())));
  const interval = alertInterval(deps.env ?? process.env);
  if (interval !== null) setInterval(() => { evaluate().catch(() => undefined); }, interval * 1000).unref?.();
  const router = Router();
  router.get('/', deps.authenticate, requireOperationalAdministrator as RequestHandler, async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const active = await evaluate();
      res.json({ scope: 'PROCESS_LOCAL', evaluatedAt: new Date().toISOString(), active, log: 'STDOUT_JSON_LINES', delivery: 'NOT_CONFIGURED',
        evaluationIntervalSeconds: interval, serverErrorsSinceStart: deps.serverErrors?.() ?? null });
    } catch { res.status(503).json({ code: 'OPERATIONAL_ALERTS_UNAVAILABLE' }); }
  });
  return router;
}
