import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { PGlite } from '@electric-sql/pglite';
import { ControlCenterReadService } from '../server/ai/governance/ControlCenterReadService';
import { createGovernanceFixture, fixtureAuthority } from './aiGovernanceFixture';

vi.mock('../server/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/auth')>();
  return { ...actual, authenticateToken: (req: any, res: any, next: any) => {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!token) return res.status(401).json({ code: 'AUTH_REQUIRED' });
    req.token = token; next();
  } };
});
import { createAiGovernanceRouter } from '../server/routes/ai-governance.routes';

// Block 108: the command center read goes through the same governance role check as the rest of the control center,
// is scoped to the caller's tenant, reveals no infrastructure, and offers nothing that writes.
let pg: PGlite, db: any, server: Server, origin: string;
const runtimeSeen: string[] = [];
const service = (knowledge?: () => Promise<any>, runtime?: () => Promise<any>) => new ControlCenterReadService(fixtureAuthority, db,
  knowledge ?? (async () => ({ status: 'UNAVAILABLE', code: 'KNOWLEDGE_STATUS_NOT_FOUND' })),
  runtime ?? (async () => { runtimeSeen.push('read'); return { status: 'AVAILABLE', endpoint: 'http://127.0.0.1:11434', version: '0.40.13', models: [{ name: 'taxguard-model:8b', sizeBytes: 1 }, { name: 'qwen3:8b', sizeBytes: 1 }], loaded: [] }; }));
const call = (token: string | null, method = 'GET', route = '/control-center/command-center') => fetch(origin + route, { method, headers: token ? { authorization: 'Bearer ' + token } : {} });

beforeAll(async () => {
  const fixture = await createGovernanceFixture();
  pg = fixture.pg; db = fixture.db;
  const app = express();
  app.use(express.json());
  app.use(createAiGovernanceRouter(undefined, undefined, () => service()));
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise(resolve => server.close(resolve)); await pg.close(); });

describe('command center read', () => {
  it('returns the report to a governance role', async () => {
    const response = await call('admin');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body.sections).toHaveLength(6);
    expect(body.lifecycle).toHaveLength(7);
    expect(typeof body.governance.agents_by_status).toBe('object');
  });

  it('refuses without a session', async () => {
    expect((await call(null)).status).toBe(401);
  });

  it('refuses a non-governance role before reading the runtime or the knowledge status', async () => {
    const knowledge = vi.fn(async () => ({ status: 'UNAVAILABLE', code: 'KNOWLEDGE_STATUS_NOT_FOUND' }));
    const runtime = vi.fn(async () => ({ status: 'UNAVAILABLE', endpoint: 'x' }));
    await expect(service(knowledge as any, runtime as any).commandCenter('valid')).rejects.toMatchObject({ code: 'AI_CONTROL_CENTER_ROLE_DENIED', status: 403 });
    expect(knowledge).not.toHaveBeenCalled();
    expect(runtime).not.toHaveBeenCalled();
  });

  it('refuses an invalid token', async () => {
    await expect(service().commandCenter('')).rejects.toMatchObject({ code: 'AI_AUTH_REQUIRED', status: 401 });
  });

  it('never returns the address, version, vendor or model tag', async () => {
    const text = await (await call('admin')).text();
    expect(text).not.toMatch(/11434|127\.0\.0\.1|0\.40\.13|ollama|qwen|taxguard-model|ophir(?!eum)|"endpoint"/i);
    const body = JSON.parse(text);
    expect(body.inference).toEqual({ status: 'AVAILABLE', model_installed: true, model_loaded: false });
  });

  it('reports a runtime that is down, or that throws, as unavailable', async () => {
    const down = await service(undefined, async () => ({ status: 'UNAVAILABLE', endpoint: 'http://127.0.0.1:11434' })).commandCenter('admin');
    expect(down.inference).toEqual({ status: 'UNAVAILABLE' });
    const threw = await service(undefined, async () => { throw new Error('boom 127.0.0.1:11434'); }).commandCenter('admin');
    expect(threw.inference).toEqual({ status: 'UNAVAILABLE' });
  });

  it('keeps governance figures when the knowledge status fails', async () => {
    const out = await service(async () => { throw new Error('disk'); }).commandCenter('admin');
    expect(out.knowledge).toEqual({ status: 'UNAVAILABLE', code: 'KNOWLEDGE_STATUS_NOT_FOUND' });
    expect(out.governance.active_stops).toBeGreaterThanOrEqual(0);
  });

  it('scopes runs and stops to the caller\'s tenant', async () => {
    const before = await service().commandCenter('admin');
    const other = await service().commandCenter('adminB');
    await pg.query(`INSERT INTO ai_kill_switches(tenant_id,scope,target,enabled,reason,activated_by) SELECT 'tenantB','AGENT','A01',true,'Synthetic stop for the tenant test','adminB' WHERE NOT EXISTS (SELECT 1 FROM ai_kill_switches WHERE tenant_id='tenantB' AND scope='AGENT' AND target='A01')`).catch(() => undefined);
    const after = await service().commandCenter('admin');
    expect(after.governance.active_stops).toBe(before.governance.active_stops);
    expect(other.governance).toBeTruthy();
  });

  it('offers no way to write', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) expect((await call('admin', method)).status, method).toBe(404);
  });

  it('does not let a request choose the status file', async () => {
    const seen: string[] = [];
    const response = await fetch(origin + '/control-center/command-center?file=C:/Windows/win.ini', { headers: { authorization: 'Bearer admin' } });
    seen.push(String(response.status));
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain('win.ini');
  });
});
