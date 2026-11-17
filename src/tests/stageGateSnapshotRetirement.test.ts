import express from 'express';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Synthetic authenticated caller: the retirement must hold for an authenticated session of any role, so the
// authentication middleware is replaced by one that attaches a synthetic active user chosen by a test header.
vi.mock('../server/auth', async importOriginal => ({
  ...(await importOriginal<typeof import('../server/auth')>()),
  authenticateToken: (req: any, res: any, next: any) => {
    const role = req.headers['x-synthetic-role'];
    if (typeof role !== 'string') return res.status(401).json({ error: 'Authentication required' });
    req.user = { id: 'synthetic-' + role, role, name: 'Synthetic ' + role, status: 'active', tenantId: 'tenant-synthetic', clientId: role.endsWith('client') ? 'cl-synthetic' : undefined };
    next();
  },
}));
import { STAGE_GATE_SNAPSHOT_RETIRED, stageTwoThreeRouter } from '../server/routes/stage-two-three.routes';

// A snapshot claiming every requirement is satisfied; the retired endpoints computed "passed: true" from it.
const FORGED = { snapshot: {
  completenessPassed: true, unresolvedBlockingExceptions: 0, reconciliationPassed: true, professionalCertificationPassed: true,
  validationComplete: true, provenanceComplete: true, humanReviewRequired: false, humanReviewApproved: true, hardExitGatePassed: true,
} };

let server: Server; let origin = '';
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api/stage-two-three', stageTwoThreeRouter);
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); });

const files = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = path.join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });

describe('caller-supplied stage gate snapshot evaluation is retired', () => {
  it.each(['stage-2', 'stage-3'])('%s: a forged all-passed snapshot (and an empty one) gets 410 and no decision, for every role', async stage => {
    for (const role of ['client', 'accountant', 'senior_reviewer', 'admin', 'super_admin']) {
      for (const body of [FORGED, {}]) {
        const r = await fetch(`${origin}/api/stage-two-three/gates/${stage}/evaluate`, {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-synthetic-role': role }, body: JSON.stringify(body) });
        expect(r.status, role).toBe(410);
        const json = await r.json();
        expect(json).toEqual({ code: 'STAGE_GATE_SNAPSHOT_RETIRED', replacement: STAGE_GATE_SNAPSHOT_RETIRED.replacement });
        expect(json).not.toHaveProperty('decision');
        expect(r.headers.get('cache-control')).toBe('no-store');
      }
    }
  });
  it('still requires authentication first', async () => {
    const r = await fetch(`${origin}/api/stage-two-three/gates/stage-2/evaluate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(FORGED) });
    expect(r.status).toBe(401);
  });
  it('the router no longer evaluates gate functions from the request', () => {
    const source = readFileSync('src/server/routes/stage-two-three.routes.ts', 'utf8');
    expect(source).not.toMatch(/evaluateStage(Two|Three)ServerGate/);
    expect(source).not.toMatch(/hardExitGatePassed\s*:\s*snapshot\./);
  });
  it('no application code calls the retired endpoints', () => {
    const app = files('src').filter(f => !/[\\/](server|tests|tests-db|tests-e2e)[\\/]/.test(f));
    expect(app.filter(f => /gates\/stage-[23]\/evaluate/.test(readFileSync(f, 'utf8')))).toEqual([]);
  });
});
