import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { GovernanceControlPlane } from '../server/ai/governance/GovernanceControlPlane';
import { SqlGovernanceStore } from '../server/ai/governance/SqlGovernanceStore';
import { KillSwitchService } from '../server/ai/governance/KillSwitchService';
import { ControlCenterReadService, parsePageQuery } from '../server/ai/governance/ControlCenterReadService';
import type { GovernanceRequest } from '../server/ai/governance/contracts';
import { CASE_A, CASE_B, EVIDENCE_A, createGovernanceFixture, fixtureAuthority } from './aiGovernanceFixture';

vi.mock('../server/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/auth')>();
  return { ...actual, authenticateToken: (req: any, res: any, next: any) => {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!token) return res.status(401).json({ code: 'AUTH_REQUIRED' });
    req.token = token; req.user = { id: 'browser-claimed', tenantId: 'tenantB', role: 'administrator' }; next();
  } };
});
import { createAiGovernanceRouter } from '../server/routes/ai-governance.routes';

let pg: PGlite, service: ControlCenterReadService, plane: GovernanceControlPlane, stops: KillSwitchService, server: Server, origin: string;
const request = (patch: Partial<GovernanceRequest> = {}): GovernanceRequest => ({ request_id: randomUUID(), agent_id: 'A34', scope: { tenant_id: 'tenantA', client_id: 'clientA', tax_case_id: 'caseA', tax_year: 2025 }, workflow_stage: 3, intent: 'ADVISORY', purpose: 'IDENTIFY_REVIEW_QUESTIONS', capabilities: [{ tool_id: 'workflow.read', action: 'READ' }], data_classes: ['INTERNAL'], evidence_source_ids: [EVIDENCE_A], confidence: 0.99, financial_amount: 0, risk_level: 'LOW', ...patch });
// Runs are inserted QUEUED and advanced only through transitions the database trigger permits.
const run = async (tenant: string, client: string, caseId: string, caseRecord: string, requestedBy: string, status: 'FAILED' | 'REVIEW_REQUIRED', minutesAgo: number, proposed = '{"field":"synthetic sensitive value"}') => {
  const { rows } = await pg.query<{ run_id: string }>(`INSERT INTO ai_runs(agent_id,agent_version,model_id,model_provider,model_version,prompt_id,prompt_version,tenant_id,client_id,tax_case_id,case_record_id,tax_year,workflow_stage,request_id,requested_by,input_hash,status,proposed_action,created_at,token_usage,estimated_cost)
   VALUES('A34','1.0.0','isolated-model','TEST','1','isolated-prompt','1',$1,$2,$3,$4,2025,3,$5,$6,$7,'QUEUED',$8::jsonb,now()-($9||' minutes')::interval,120,0.0025) RETURNING run_id`,
   [tenant, client, caseId, caseRecord, randomUUID(), requestedBy, 'b'.repeat(64), proposed, String(minutesAgo)]);
  const path = status === 'FAILED' ? ['FAILED'] : ['RUNNING', 'REVIEW_REQUIRED'];
  for (const next of path) await pg.query('UPDATE ai_runs SET status=$2 WHERE run_id=$1', [rows[0].run_id, next]);
};

beforeAll(async () => {
  const fixture = await createGovernanceFixture();
  pg = fixture.pg;
  await fixture.activateA34();
  plane = new GovernanceControlPlane(fixtureAuthority, new SqlGovernanceStore(fixture.db));
  stops = new KillSwitchService(fixtureAuthority, fixture.db);
  service = new ControlCenterReadService(fixtureAuthority, fixture.db);
  // Synthetic history: 30 tenant A runs, 2 tenant B runs; real governance decisions and security events.
  for (let i = 0; i < 30; i++) await run('tenantA', 'clientA', 'caseA', CASE_A, 'preparer', i % 3 === 0 ? 'FAILED' : 'REVIEW_REQUIRED', i);
  await run('tenantB', 'clientB', 'caseB', CASE_B, 'preparerB', 'FAILED', 1);
  await run('tenantB', 'clientB', 'caseB', CASE_B, 'preparerB', 'FAILED', 2);
  await plane.evaluate('valid', request());
  await expect(plane.evaluate('valid', request({ agent_id: 'A07' }))).rejects.toThrow();
  await stops.activate('admin', { scope: 'AGENT', agent_id: 'A07', reason: 'Synthetic stop for control-center tests' });
  await expect(stops.activate('valid', { scope: 'GLOBAL', reason: 'Unauthorized synthetic attempt' })).rejects.toThrow();
  await stops.activate('adminB', { scope: 'GLOBAL', reason: 'Tenant B synthetic global stop' });
  const app = express(); app.use(express.json());
  app.use('/api/ai-governance', createAiGovernanceRouter(() => plane, () => stops, () => service));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 60000);
afterAll(async () => { await new Promise(resolve => server?.close(resolve)); await pg?.close(); });

describe('query parsing', () => {
  const allowed = { status: (v: string) => ['FAILED'].includes(v) };
  it('defaults to 25 and accepts bounded limits and listed filters', () => {
    expect(parsePageQuery({}, allowed)).toEqual({ limit: 25, cursor: null, filters: {} });
    expect(parsePageQuery({ limit: '100', status: 'FAILED' }, allowed)).toMatchObject({ limit: 100, filters: { status: 'FAILED' } });
  });
  it.each([[{ limit: '0' }], [{ limit: '101' }], [{ limit: '2.5' }], [{ status: 'DROP TABLE' }], [{ tenant_id: 'tenantB' }], [{ cursor: 'not-base64-json' }],
    [{ cursor: Buffer.from(JSON.stringify({ t: 'x', id: 'y' })).toString('base64url') }], [{ status: ['FAILED', 'RUNNING'] }]])('refuses %j', raw => {
    expect(() => parsePageQuery(raw, allowed)).toThrow('AI_CONTROL_CENTER_INVALID_QUERY');
  });
});

describe('authorization', () => {
  it.each(['', 'unknown'])('requires authentication (%j)', async token => {
    await expect(service.registry(token)).rejects.toThrow('AI_AUTH_REQUIRED');
  });
  it.each(['valid', 'reviewer', 'suspended', 'ghost'])('denies non-governance or inactive member %s on every view', async token => {
    for (const call of [() => service.registry(token), () => service.runs(token, {}), () => service.decisions(token, {}), () => service.securityEvents(token, {})])
      await expect(call()).rejects.toThrow('AI_CONTROL_CENTER_ROLE_DENIED');
  });
});

describe('registry view', () => {
  it('returns all 61 agents with per-tenant stop state', async () => {
    const a = await service.registry('compliance');
    expect(a.agents).toHaveLength(61);
    expect(a.global_stop).toBe(false);
    expect(a.agents.find(x => x.agent_id === 'A07')!.stopped).toBe(true);
    expect(a.agents.find(x => x.agent_id === 'A34')).toMatchObject({ status: 'ACTIVE', stopped: false });
    expect(a.agents.find(x => x.agent_id === 'A38')).toMatchObject({ status: 'DRAFT' });
  });
  it('reflects only the caller tenant\'s stops (tenant B has a global stop)', async () => {
    const b = await service.registry('adminB');
    expect(b.global_stop).toBe(true);
    expect(b.agents.every(x => x.stopped)).toBe(true);
  });
});

describe('execution history', () => {
  it('pages tenant A runs newest-first with no overlap and no tenant B rows', async () => {
    const seen: string[] = []; let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await service.runs('admin', { limit: '7', ...(cursor ? { cursor } : {}) });
      seen.push(...page.items.map((r: any) => r.run_id));
      for (const r of page.items as any[]) expect(r.client_id).toBe('clientA');
      cursor = page.next_cursor ?? undefined; pages++;
    } while (cursor);
    expect(pages).toBe(5);
    expect(seen).toHaveLength(30);
    expect(new Set(seen).size).toBe(30);
  });
  it('filters by status and never returns the proposed-action payload', async () => {
    const page = await service.runs('admin', { status: 'FAILED', limit: '100' });
    expect(page.items).toHaveLength(10);
    for (const r of page.items as any[]) { expect(r.status).toBe('FAILED'); expect(r.has_proposed_action).toBe(true); expect(r).not.toHaveProperty('proposed_action'); }
    expect(JSON.stringify(page)).not.toContain('synthetic sensitive value');
  });
  it('tenant B sees only its own two runs', async () => {
    const page = await service.runs('adminB', {});
    expect(page.items.map((r: any) => r.client_id)).toEqual(['clientB', 'clientB']);
    expect(page.next_cursor).toBeNull();
  });
});

describe('governance decisions (AI audit log)', () => {
  it('lists real allowed and denied decisions for the tenant, filterable by outcome', async () => {
    const all = await service.decisions('compliance', {});
    expect(all.items.length).toBeGreaterThanOrEqual(2);
    expect(all.items.every((d: any) => d.action_executed === false && d.human_review_required === true)).toBe(true);
    const denied = await service.decisions('compliance', { outcome: 'DENIED' });
    expect(denied.items.length).toBeGreaterThanOrEqual(1);
    expect(denied.items.every((d: any) => d.outcome === 'DENIED' && /^AI_/.test(d.reason_code))).toBe(true);
    expect((await service.decisions('adminB', {})).items).toEqual([]);
  });
});

describe('security events', () => {
  it('shows tenant A stop and denial events with whitelisted details only', async () => {
    const page = await service.securityEvents('admin', {});
    const types = page.items.map((e: any) => e.event_type);
    expect(types).toContain('KILL_SWITCH');
    expect(types).toContain('AUTHORIZATION_DENIAL');
    for (const e of page.items as any[]) for (const key of Object.keys(e.details)) expect(['operation', 'scope', 'target', 'switch_id', 'reason_sha256', 'actor_uid_sha256', 'code']).toContain(key);
    expect(JSON.stringify(page)).not.toContain('Synthetic stop for control-center tests');
    expect(JSON.stringify(page)).not.toContain('Tenant B');
  });
  it('filters by event type and severity', async () => {
    const page = await service.securityEvents('admin', { event_type: 'KILL_SWITCH', severity: 'CRITICAL' });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((e: any) => e.event_type === 'KILL_SWITCH' && e.severity === 'CRITICAL')).toBe(true);
  });
});

describe('usage and review-queue totals', () => {
  it('aggregates only recorded tenant A runs (30 runs x 120 tokens, 10 failed, 20 awaiting review)', async () => {
    const usage = await service.usage('admin', { window: '24h' });
    expect(usage.cost_basis).toBe('RECORDED_RUN_ESTIMATES');
    expect(usage.totals).toEqual({ runs: 30, tokens: 3600, estimated_cost: 0.075, awaiting_review: 20, failed: 10 });
    expect(usage.by_agent).toEqual([expect.objectContaining({ agent_id: 'A34', runs: 30, failed: 10, awaiting_review: 20, approved: 0 })]);
  });
  it('tenant B totals are independent of tenant A', async () => {
    expect((await service.usage('adminB', {})).totals).toMatchObject({ runs: 2, tokens: 240, failed: 2, awaiting_review: 0 });
  });
  it('rejects unknown windows and keys, and denies non-governance roles', async () => {
    await expect(service.usage('admin', { window: '1y' })).rejects.toThrow('AI_CONTROL_CENTER_INVALID_QUERY');
    await expect(service.usage('admin', { window: '24h', tenant_id: 'tenantB' })).rejects.toThrow('AI_CONTROL_CENTER_INVALID_QUERY');
    await expect(service.usage('valid', {})).rejects.toThrow('AI_CONTROL_CENTER_ROLE_DENIED');
  });
});

describe('HTTP routes', () => {
  const get = (path: string, token = 'admin') => fetch(`${origin}/api/ai-governance/control-center/${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  it('serves each view to governance roles with no-store caching, scoped to the verified tenant', async () => {
    for (const path of ['registry', 'runs', 'decisions', 'security-events']) {
      const res = await get(path);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
    // Transport attached a forged tenant B administrator; results remain tenant A.
    expect(((await (await get('runs?limit=100')).json()).items as any[]).every(r => r.client_id === 'clientA')).toBe(true);
  });
  it('returns 403 for accountants, 400 for injected filters, 401 without a token', async () => {
    expect((await get('runs', 'valid')).status).toBe(403);
    const bad = await get('runs?status=FAILED%27%20OR%201%3D1');
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ code: 'AI_CONTROL_CENTER_INVALID_QUERY' });
    expect((await get('runs', '')).status).toBe(401);
  });
  it('exposes no mutation on control-center paths', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
      expect((await fetch(`${origin}/api/ai-governance/control-center/runs`, { method, headers: { authorization: 'Bearer admin' } })).status).toBe(404);
  });
});
