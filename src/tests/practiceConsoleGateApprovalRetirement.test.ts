import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// D1 (Issue #65): POST /api/practice-console/gate-approval completed Stage 02 for any clientId in the body, with no
// client assignment, no requirement evaluation and no independent reviewer. It is retired in every environment.
// Synthetic actors; the session middleware is replaced by one that reads a synthetic role.
vi.mock('../server/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/auth')>();
  return {
    ...actual,
    authenticateToken: (req: any, res: any, next: any) => {
      const role = req.headers['x-test-role'];
      if (typeof role !== 'string') return res.status(401).json({ error: 'AUTH_REQUIRED' });
      req.user = { id: 'synthetic-' + role, role, name: 'Synthetic ' + role, tenantId: 'tenantA', status: 'active' };
      next();
    },
  };
});
import { LiveWorkflowRepository } from '../server/taxguard/liveWorkflow.repository';
import { practiceConsoleRouter } from '../server/routes/practice-console.routes';

let server: Server; let origin = '';
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api/practice-console', practiceConsoleRouter);
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/practice-console/gate-approval`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

const post = (role?: string) => fetch(origin, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(role ? { 'x-test-role': role } : {}) },
  body: JSON.stringify({ clientId: 'synthetic-client', taxYear: 2025, notes: 'Synthetic approval attempt' }) });

describe('practice-console Stage 02 gate approval is retired', () => {
  it('answers 410 for every staff role it used to accept, in development and production, and never touches the workflow', async () => {
    const complete = vi.spyOn(LiveWorkflowRepository, 'completeStage');
    const read = vi.spyOn(LiveWorkflowRepository, 'getCase');
    for (const env of ['development', 'production']) {
      vi.stubEnv('NODE_ENV', env);
      for (const role of ['accountant', 'senior_reviewer', 'admin', 'super_admin']) {
        const r = await post(role);
        expect(r.status, `${env} ${role}`).toBe(410);
        expect(await r.json()).toEqual({ code: 'STAGE_VERDICT_ROUTE_RETIRED', replacement: '/api/cases/:caseId/advance' });
        expect(r.headers.get('cache-control')).toBe('no-store');
      }
    }
    expect(complete).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });
  it('keeps authentication and role checks ahead of the refusal', async () => {
    expect((await post()).status).toBe(401);
    for (const role of ['client', 'bookkeeper', 'reviewer']) expect((await post(role)).status, role).toBe(403);
  });
});
