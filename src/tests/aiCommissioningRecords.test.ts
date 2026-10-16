import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { PGlite } from '@electric-sql/pglite';
import { GovernanceControlPlane } from '../server/ai/governance/GovernanceControlPlane';
import { SqlGovernanceStore } from '../server/ai/governance/SqlGovernanceStore';
import { KillSwitchService } from '../server/ai/governance/KillSwitchService';
import { ControlCenterReadService } from '../server/ai/governance/ControlCenterReadService';
import { createGovernanceFixture, fixtureAuthority } from './aiGovernanceFixture';

vi.mock('../server/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/auth')>();
  return { ...actual, authenticateToken: (req: any, res: any, next: any) => {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!token) return res.status(401).json({ code: 'AUTH_REQUIRED' });
    req.token = token; req.user = { id: 'browser-claimed', tenantId: 'tenantB', role: 'administrator' }; next();
  } };
});
import { createAiGovernanceRouter } from '../server/routes/ai-governance.routes';

// Contract C7: per-agent commissioning facts from the live governance tables (synthetic fixture).
// Nothing is invented: DRAFT stays DRAFT, a stop is reported, no agent is ever commissioned and
// material actions stay BLOCKED (AI-16) even if a non-read grant exists.
let pg: PGlite, service: ControlCenterReadService, server: Server, origin: string;
const snapshot = async () => (await pg.query<{ c: string }>(`SELECT md5(string_agg(t::text, '|' ORDER BY t::text)) AS c FROM (
  SELECT row_to_json(a)::text AS t FROM ai_agents a UNION ALL SELECT row_to_json(p)::text FROM ai_agent_permissions p UNION ALL SELECT row_to_json(k)::text FROM ai_kill_switches k) x`)).rows[0].c;

beforeAll(async () => {
  const fixture = await createGovernanceFixture();
  pg = fixture.pg;
  await fixture.activateA34();
  const stops = new KillSwitchService(fixtureAuthority, fixture.db);
  service = new ControlCenterReadService(fixtureAuthority, fixture.db);
  await stops.activate('admin', { scope: 'AGENT', agent_id: 'A07', reason: 'Synthetic stop for commissioning tests' });
  await stops.activate('adminB', { scope: 'GLOBAL', reason: 'Tenant B synthetic global stop' });
  // A synthetic non-read grant: still reported, and material actions remain BLOCKED.
  await pg.query(`INSERT INTO ai_agent_permissions(agent_id,resource,action,permission_state,conditions) VALUES('A34','workflow.case','UPDATE','CONDITIONAL','{"synthetic":true}')
    ON CONFLICT (agent_id,resource,action) DO UPDATE SET permission_state='CONDITIONAL', conditions='{"synthetic":true}'`);
  const plane = new GovernanceControlPlane(fixtureAuthority, new SqlGovernanceStore(fixture.db));
  const app = express(); app.use(express.json());
  app.use('/api/ai-governance', createAiGovernanceRouter(() => plane, () => stops, () => service));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 60000);
afterAll(async () => { await new Promise(resolve => server?.close(resolve)); await pg?.close(); });

describe('commissioning records (C7)', () => {
  it('reports every registered agent from live data and commissions none', async () => {
    const r = await service.commissioning('admin');
    expect(r).toMatchObject({ source: 'LIVE_GOVERNANCE_TABLES', global_stop: false, material_actions: 'BLOCKED' });
    expect(r.agents).toHaveLength(61);
    expect(r.agents.every(a => a.commissioning_record === null && a.material_actions === 'BLOCKED' && a.commissioning_state !== 'COMMISSIONED')).toBe(true);
  });
  it('keeps DRAFT agents DRAFT and reports a stopped agent as STOPPED', async () => {
    const r = await service.commissioning('admin');
    const by = Object.fromEntries(r.agents.map(a => [a.agent_id, a]));
    const drafts = (await pg.query<{ agent_id: string }>(`SELECT agent_id FROM ai_agents WHERE status='DRAFT'`)).rows.map(x => x.agent_id).filter(id => id !== 'A07');
    expect(drafts.length).toBeGreaterThan(0);
    for (const id of drafts) expect(by[id].commissioning_state, id).toBe('DRAFT');
    expect(by.A07).toMatchObject({ stopped: true, commissioning_state: 'STOPPED' });
  });
  it('shows the configured model, prompt and grants of an active agent but never commissions it', async () => {
    const a34 = (await service.commissioning('admin')).agents.find(a => a.agent_id === 'A34')!;
    expect(a34).toMatchObject({ registry_status: 'ACTIVE', commissioning_state: 'NOT_COMMISSIONED', model: { configured: true }, prompt: { configured: true }, material_actions: 'BLOCKED' });
    expect(a34.grants.non_read).toBeGreaterThanOrEqual(1);
  });
  it('applies only the caller tenant\'s stops', async () => {
    const b = await service.commissioning('adminB');
    expect(b.global_stop).toBe(true);
    expect(b.agents.every(a => a.stopped && a.commissioning_state === 'STOPPED')).toBe(true);
    expect((await service.commissioning('admin')).global_stop).toBe(false);
  });
  it('denies non-governance, inactive and unauthenticated callers', async () => {
    for (const token of ['valid', 'reviewer', 'suspended', 'ghost']) await expect(service.commissioning(token)).rejects.toThrow('AI_CONTROL_CENTER_ROLE_DENIED');
    for (const token of ['', 'unknown']) await expect(service.commissioning(token)).rejects.toThrow('AI_AUTH_REQUIRED');
  });
  it('is read-only over HTTP: no mutation, no enable control, governance data unchanged', async () => {
    const before = await snapshot();
    const res = await fetch(`${origin}/api/ai-governance/control-center/commissioning`, { headers: { authorization: 'Bearer admin' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(((await res.json()) as any).global_stop).toBe(false); // forged tenant B transport identity ignored
    expect((await fetch(`${origin}/api/ai-governance/control-center/commissioning`, { headers: { authorization: 'Bearer valid' } })).status).toBe(403);
    expect((await fetch(`${origin}/api/ai-governance/control-center/commissioning`)).status).toBe(401);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
      expect((await fetch(`${origin}/api/ai-governance/control-center/commissioning`, { method, headers: { authorization: 'Bearer admin' } })).status).toBe(404);
    expect(await snapshot()).toBe(before);
  });
});
