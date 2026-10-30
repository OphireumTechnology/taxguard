import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import type { HealthProbes } from '../server/observability/health';
import { alertInterval, createAlertTracker, createOperationalAlertsRouter, evaluateAlerts } from '../server/observability/operationalAlerts';

// Block 77: operational alert conditions over the administrator diagnostics. Synthetic probes only.
const probes = (patch: Partial<Record<keyof HealthProbes, unknown>> = {}): HealthProbes => ({
  database: async () => ({ state: 'OK', schema: 'DATABASE_READY' }),
  identity: () => 'OK', storage: () => 'OK',
  scanner: async () => ({ state: 'CONFIGURED', backlog: { open: 0, overdue: 0, failed24h: 0, pendingDocuments: 0 } }),
  ai: () => ({ state: 'NOT_CONFIGURED', materialActions: 'BLOCKED', providerCommissioned: false }),
  securityEvents: () => ({ mode: 'DURABLE', recorded: 3, failed: 0, dropped: 0, pending: 0 }),
  environment: () => ({ nodeEnv: 'production', deployment: 'staging', durableStore: true }),
  ...patch,
} as HealthProbes);
const diag = (p: HealthProbes) => import('../server/observability/health').then(h => h.diagnostics(p));

describe('operational alert conditions', () => {
  it('raises nothing when every probe is healthy', async () => {
    expect(evaluateAlerts(await diag(probes()))).toEqual([]);
  });

  it('turns each failing probe into its condition, with counts only', async () => {
    const d = await diag(probes({
      database: async () => ({ state: 'UNAVAILABLE', schema: 'DATABASE_UNAVAILABLE' }), identity: () => 'NOT_CONFIGURED', storage: () => 'NOT_CONFIGURED',
      scanner: async () => ({ state: 'CONFIGURED', backlog: { open: 4, overdue: 2, failed24h: 1, pendingDocuments: 4 } }),
      securityEvents: () => ({ mode: 'MEMORY_ONLY', failed: 1, dropped: 2 }),
    }));
    expect(evaluateAlerts(d)).toEqual([
      { condition: 'DATABASE_UNAVAILABLE', blocksReadiness: true },
      { condition: 'IDENTITY_NOT_CONFIGURED', blocksReadiness: true },
      { condition: 'STORAGE_NOT_CONFIGURED', blocksReadiness: false },
      { condition: 'SCANS_FAILED', blocksReadiness: false, counts: { failed24h: 1 } },
      { condition: 'SCANS_OVERDUE', blocksReadiness: false, counts: { overdue: 2 } },
      { condition: 'SECURITY_EVENTS_NOT_DURABLE', blocksReadiness: false },
      { condition: 'SECURITY_EVENTS_LOST', blocksReadiness: false, counts: { failed: 1, dropped: 2 } },
    ]);
    expect(evaluateAlerts(await diag(probes({ database: async () => ({ state: 'OK', schema: 'DATABASE_SCHEMA_MISSING' }) }))))
      .toEqual([{ condition: 'MIGRATIONS_NOT_READY', blocksReadiness: true }]);
    expect(evaluateAlerts(await diag(probes({ scanner: async () => ({ state: 'BACKLOG_UNAVAILABLE' }) }))))
      .toEqual([{ condition: 'SCANNER_BACKLOG_UNAVAILABLE', blocksReadiness: false }]);
  });

  it('applies configuration conditions only in production', async () => {
    const dev = await diag(probes({ identity: () => 'NOT_CONFIGURED', storage: () => 'NOT_CONFIGURED', securityEvents: () => ({ mode: 'MEMORY_ONLY' }),
      environment: () => ({ nodeEnv: 'development', deployment: 'unspecified', durableStore: false }) }));
    expect(evaluateAlerts(dev)).toEqual([]);
  });

  it('writes one JSON line per change, keeps the first time a condition was seen, and writes nothing else', () => {
    const lines: string[] = []; let t = Date.parse('2026-10-30T10:00:00Z');
    const tracker = createAlertTracker({ write: l => lines.push(l), now: () => new Date(t) });
    const db = { condition: 'DATABASE_UNAVAILABLE' as const, blocksReadiness: true };
    const lost = { condition: 'SECURITY_EVENTS_LOST' as const, blocksReadiness: false, counts: { failed: 0, dropped: 1 } };
    expect(tracker.update([db])).toEqual([{ ...db, since: '2026-10-30T10:00:00.000Z' }]);
    t += 60_000; expect(tracker.update([db, lost])).toEqual([{ ...db, since: '2026-10-30T10:00:00.000Z' }, { ...lost, since: '2026-10-30T10:01:00.000Z' }]);
    t += 60_000; tracker.update([db, lost]);
    t += 60_000; expect(tracker.update([lost])).toEqual([{ ...lost, since: '2026-10-30T10:01:00.000Z' }]);
    expect(lines.map(l => JSON.parse(l))).toEqual([
      { type: 'taxguard.operational_alert', state: 'RAISED', condition: 'DATABASE_UNAVAILABLE', blocksReadiness: true, at: '2026-10-30T10:00:00.000Z' },
      { type: 'taxguard.operational_alert', state: 'RAISED', condition: 'SECURITY_EVENTS_LOST', blocksReadiness: false, counts: { failed: 0, dropped: 1 }, at: '2026-10-30T10:01:00.000Z' },
      { type: 'taxguard.operational_alert', state: 'CLEARED', condition: 'DATABASE_UNAVAILABLE', blocksReadiness: true, at: '2026-10-30T10:03:00.000Z' },
    ]);
  });

  it('evaluates on an interval only when one is configured, within bounds', () => {
    expect(alertInterval({})).toBeNull();
    expect(alertInterval({ TAXGUARD_OPERATIONAL_ALERT_INTERVAL_SECONDS: '60' })).toBe(60);
    for (const v of ['', '29', '3601', '1e3', '60s', '-60']) expect(alertInterval({ TAXGUARD_OPERATIONAL_ALERT_INTERVAL_SECONDS: v }), v).toBeNull();
  });
});

describe('GET /api/operational-alerts', () => {
  it('is for operational administrators with multi-factor sessions, no-store, and discloses no topology', async () => {
    let actor: any; const lines: string[] = []; let dbState: 'OK' | 'UNAVAILABLE' = 'UNAVAILABLE';
    const app = express();
    app.use('/api/operational-alerts', createOperationalAlertsRouter({
      probes: () => probes({ database: async () => ({ state: dbState, schema: dbState === 'OK' ? 'DATABASE_READY' : 'DATABASE_UNAVAILABLE' }) }),
      authenticate: (req: any, _res, next) => { req.user = actor; next(); }, tracker: createAlertTracker({ write: l => lines.push(l) }), serverErrors: () => 2, env: {} }));
    const server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    const url = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api/operational-alerts';
    try {
      expect((await fetch(url)).status).toBe(401);
      for (const [role, status, aal] of [['accountant', 'active', 'aal2'], ['admin', 'active', 'aal1'], ['admin', 'suspended', 'aal2']]) {
        actor = { id: 'synthetic', tenantId: 't', role, status, sessionAssuranceLevel: aal };
        expect((await fetch(url)).status).toBe(403);
      }
      expect(lines).toEqual([]); // nothing is evaluated for a refused caller
      actor = { id: 'synthetic-admin', tenantId: 'tenant-secret', role: 'admin', status: 'active', sessionAssuranceLevel: 'aal2' };
      const r = await fetch(url);
      expect(r.status).toBe(200);
      expect(r.headers.get('cache-control')).toBe('no-store');
      const body = await r.json();
      expect(body).toMatchObject({ scope: 'PROCESS_LOCAL', log: 'STDOUT_JSON_LINES', delivery: 'NOT_CONFIGURED', evaluationIntervalSeconds: null, serverErrorsSinceStart: 2,
        active: [{ condition: 'DATABASE_UNAVAILABLE', blocksReadiness: true }] });
      expect(JSON.stringify(body) + lines.join('')).not.toMatch(/tenant-secret|synthetic-admin|staging/);
      dbState = 'OK'; expect((await (await fetch(url)).json()).active).toEqual([]);
      expect(lines.map(l => JSON.parse(l).state)).toEqual(['RAISED', 'CLEARED']);
    } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
  });
});
