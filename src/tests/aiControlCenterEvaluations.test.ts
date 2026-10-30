import fs from 'node:fs';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ControlCenterReadService } from '../server/ai/governance/ControlCenterReadService';
import { GovernanceControlPlane } from '../server/ai/governance/GovernanceControlPlane';
import { KillSwitchService } from '../server/ai/governance/KillSwitchService';
import { SqlGovernanceStore } from '../server/ai/governance/SqlGovernanceStore';
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

// Block 76: the Control Center's read-only view of AI evaluation records (proposal 20261018140000, review only), on
// disposable PGlite with synthetic governance state. Before the proposal is applied nothing can pass the gate; after it,
// suites, runs and coverage are read for the verified tenant only, and the gate mirrors the database trigger. Nothing is
// evaluated, approved or activated by the read.
const PROPOSAL = 'docs/proposed-migrations/20261018140000_taxguard_ai_agent_evaluation.sql';
let fx: Awaited<ReturnType<typeof createGovernanceFixture>>; let service: ControlCenterReadService; let server: Server; let origin = '';
let version = ''; let dimensions: string[] = [];
const q = (sql: string, params: unknown[] = []) => fx.pg.query<any>(sql, params);

beforeAll(async () => {
  fx = await createGovernanceFixture();
  service = new ControlCenterReadService(fixtureAuthority, fx.db);
  version = (await q(`SELECT version FROM ai_agent_versions WHERE agent_id='A34'`)).rows[0].version;
  const app = express(); app.use(express.json());
  app.use('/api/ai-governance', createAiGovernanceRouter(() => new GovernanceControlPlane(fixtureAuthority, new SqlGovernanceStore(fx.db)),
    () => new KillSwitchService(fixtureAuthority, fx.db), () => service));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 60000);
afterAll(async () => { await new Promise(resolve => server?.close(resolve)); await fx?.pg.close(); });

const suite = async (tenant: string, approvedBy: string | null, dims = dimensions) => (await q(
  `INSERT INTO ai_evaluation_suites(tenant_id,agent_id,name,required_dimensions,minimum_cases_per_dimension,created_by,approved_by,approved_at)
   VALUES($1,'A34','Synthetic A34 suite',$2,1,'compliance',$3,CASE WHEN $3::text IS NULL THEN NULL ELSE now() END) RETURNING suite_id`,
  [tenant, dims, approvedBy])).rows[0].suite_id as string;
const run = async (tenant: string, suiteId: string, outcomes: Record<string, 'PASS' | 'FAIL'>) => {
  const e = (await q(`INSERT INTO ai_evaluation_runs(tenant_id,suite_id,agent_id,agent_version,model_id,model_version,prompt_id,prompt_version,started_by)
    VALUES($1,$2,'A34',$3,'isolated-model','1','isolated-prompt','1','compliance') RETURNING evaluation_id`, [tenant, suiteId, version])).rows[0].evaluation_id as string;
  for (const [d, outcome] of Object.entries(outcomes))
    await q(`INSERT INTO ai_evaluation_results(evaluation_id,case_key,dimension,outcome,evidence_sha256,latency_ms) VALUES($1,$2,$3,$4,$5,100)`,
      [e, `synthetic-case-${d}`, d, outcome, 'e'.repeat(64)]);
  return { e, outcome: (await q('SELECT ai_evaluation_complete($1) AS o', [e])).rows[0].o as string };
};
const a34 = (r: any) => r.agents.find((a: any) => a.agent_id === 'A34');

describe('Block 76: AI evaluation records in the Control Center', () => {
  it('before the evaluation proposal is applied, reports NOT_APPLIED and no version can pass', async () => {
    const r = await service.evaluations('admin');
    expect(r).toMatchObject({ source: 'LIVE_GOVERNANCE_TABLES', framework: 'NOT_APPLIED', activation: 'NOT_PERFORMED_HERE', dimensions: [], suites: [], runs: [] });
    expect(r.agents.length).toBeGreaterThan(50);
    expect(r.agents.every((a: any) => a.activation_gate === 'NOT_PASSED' && a.reason === 'EVALUATION_FRAMEWORK_NOT_APPLIED')).toBe(true);
  });

  it('reads suites, runs and coverage of the verified tenant; the gate mirrors the trigger; nothing is activated', async () => {
    await fx.pg.exec(fs.readFileSync(PROPOSAL, 'utf8'));
    dimensions = (await q('SELECT dimension FROM ai_evaluation_dimensions ORDER BY dimension')).rows.map((x: any) => x.dimension);
    let r = await service.evaluations('admin');
    expect(r.framework).toBe('APPLIED');
    expect(a34(r)).toMatchObject({ activation_gate: 'NOT_PASSED', reason: 'MODEL_OR_PROMPT_NOT_CONFIGURED' });
    await q(`UPDATE ai_agent_versions SET default_model='isolated-model',default_model_version='1',prompt_id='isolated-prompt',prompt_version='1'
      WHERE agent_id='A34' AND version=$1`, [version]);
    // An unapproved suite, and a failing run against an approved one, do not open the gate.
    const draft = await suite('tenantA', null);
    expect((await run('tenantA', draft, Object.fromEntries(dimensions.map(d => [d, 'PASS'])))).outcome).toBe('PASS');
    const approved = await suite('tenantA', 'admin');
    const failing = await run('tenantA', approved, { ...Object.fromEntries(dimensions.map(d => [d, 'PASS'])), HALLUCINATION: 'FAIL' });
    expect(failing.outcome).toBe('FAIL');
    r = await service.evaluations('admin');
    expect(a34(r)).toMatchObject({ activation_gate: 'NOT_PASSED', reason: 'NO_PASSING_EVALUATION' });
    const failed = r.runs.find((x: any) => x.evaluation_id === failing.e);
    expect(failed.coverage.find((c: any) => c.dimension === 'HALLUCINATION')).toEqual({ dimension: 'HALLUCINATION', required: true, cases: 1, failed: 1, met: false });
    expect(r.suites.map((s: any) => [s.approved, s.covers_all_dimensions])).toEqual(expect.arrayContaining([[false, true], [true, true]]));
    // A partial suite cannot open the gate, even with a passing run.
    const partial = await suite('tenantA', 'admin', ['CORRECTNESS']);
    expect((await run('tenantA', partial, { CORRECTNESS: 'PASS' })).outcome).toBe('PASS');
    expect(a34(await service.evaluations('admin')).activation_gate).toBe('NOT_PASSED');
    // A passing run against an approved suite that requires every dimension: the gate would pass.
    const passing = await run('tenantA', approved, Object.fromEntries(dimensions.map(d => [d, 'PASS'])));
    expect(passing.outcome).toBe('PASS');
    r = await service.evaluations('admin');
    expect(a34(r)).toMatchObject({ activation_gate: 'PASSED', reason: null, version_status: 'DRAFT' });
    expect(r.runs[0]).toMatchObject({ evaluation_id: passing.e, status: 'PASS', agent_id: 'A34', started_by: 'compliance' });
    expect(r.runs[0].coverage.every((c: any) => c.met && c.cases === 1)).toBe(true);
    // Nothing is returned that the read must not disclose, and the read activated nothing.
    const text = JSON.stringify(r);
    expect(text).not.toContain('synthetic-case-');
    expect(text).not.toContain('e'.repeat(64));
    expect((await q(`SELECT count(*)::int AS n FROM ai_agent_versions WHERE status='ACTIVE'`)).rows[0].n).toBe(0);
  });

  it('is tenant-scoped and for governance roles only', async () => {
    const other = await suite('tenantB', 'adminB');
    await run('tenantB', other, { CORRECTNESS: 'PASS' });
    const a = await service.evaluations('admin');
    const b = await service.evaluations('adminB');
    expect(a.suites.some((s: any) => s.suite_id === other)).toBe(false);
    expect(b.suites.map((s: any) => s.suite_id)).toEqual([other]);
    expect(b.runs).toHaveLength(1);
    await expect(service.evaluations('valid')).rejects.toThrow('AI_CONTROL_CENTER_ROLE_DENIED');
  });

  it('is served read-only over HTTP with no-store caching', async () => {
    const res = await fetch(`${origin}/api/ai-governance/control-center/evaluations`, { headers: { authorization: 'Bearer admin' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.json()).framework).toBe('APPLIED');
    expect((await fetch(`${origin}/api/ai-governance/control-center/evaluations`, { headers: { authorization: 'Bearer valid' } })).status).toBe(403);
    for (const method of ['POST', 'PUT', 'DELETE'])
      expect((await fetch(`${origin}/api/ai-governance/control-center/evaluations`, { method, headers: { authorization: 'Bearer admin' } })).status).toBe(404);
  });
});
