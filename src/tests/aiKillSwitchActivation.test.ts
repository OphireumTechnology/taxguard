import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import { GovernanceControlPlane } from '../server/ai/governance/GovernanceControlPlane';
import { SqlGovernanceStore, type TransactionalSql } from '../server/ai/governance/SqlGovernanceStore';
import { KillSwitchService, parseKillSwitchActivation } from '../server/ai/governance/KillSwitchService';
import type { GovernanceRequest, SessionAuthority } from '../server/ai/governance/contracts';

// HTTP authentication transport is isolated; the service independently re-verifies identity.
vi.mock('../server/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/auth')>();
  return { ...actual, authenticateToken: (req: any, res: any, next: any) => {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!token) return res.status(401).json({ code: 'AUTH_REQUIRED' });
    req.token = token; req.user = { id: 'browser-claimed', tenantId: 'tenantB', role: 'administrator' }; next();
  } };
});
import { createAiGovernanceRouter } from '../server/routes/ai-governance.routes';

const cid = '11111111-1111-4111-8111-111111111111', did = '22222222-2222-4222-8222-222222222222', eid = '33333333-3333-4333-8333-333333333333';
const hash = 'a'.repeat(64);
const identities: Record<string, { uid: string; tenant_id: string }> = {
  valid: { uid: 'preparer', tenant_id: 'tenantA' },
  admin: { uid: 'admin', tenant_id: 'tenantA' },
  compliance: { uid: 'compliance', tenant_id: 'tenantA' },
  suspended: { uid: 'suspended-admin', tenant_id: 'tenantA' },
  ghost: { uid: 'not-a-member', tenant_id: 'tenantA' },
  adminB: { uid: 'adminB', tenant_id: 'tenantB' },
};
const authority: SessionAuthority = { verify: async token => identities[token] ?? null };
let pg: PGlite, plane: GovernanceControlPlane, service: KillSwitchService, server: Server, origin: string;
const request = (patch: Partial<GovernanceRequest> = {}): GovernanceRequest => ({ request_id: randomUUID(), agent_id: 'A34', scope: { tenant_id: 'tenantA', client_id: 'clientA', tax_case_id: 'caseA', tax_year: 2025 }, workflow_stage: 3, intent: 'ADVISORY', purpose: 'IDENTIFY_REVIEW_QUESTIONS', capabilities: [{ tool_id: 'workflow.read', action: 'READ' }], data_classes: ['INTERNAL'], evidence_source_ids: [eid], confidence: 0.99, financial_amount: 0, risk_level: 'LOW', ...patch });
const reason = 'Synthetic emergency stop for regression testing';
const rows = async (sql: string, params: unknown[] = []) => (await pg.query<any>(sql, params)).rows;
let seen = new Set<string>();
const newEvents = async (where = 'true') => (await rows(`SELECT event_id,event_type,severity,agent_id,actor_uid,details FROM ai_security_events WHERE ${where} ORDER BY created_at`)).filter(r => !seen.has(r.event_id));

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS 'SELECT current_user::text'; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;`);
  for (const name of fs.readdirSync(path.resolve('supabase/migrations')).filter(name => name.endsWith('.sql')).sort()) await pg.exec(fs.readFileSync(path.resolve('supabase/migrations', name), 'utf8').replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"[^"]+";/gi, ''));
  await pg.exec(`INSERT INTO taxguard_tenants(id,name)VALUES('tenantA','Test A'),('tenantB','Test B');
  INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid)VALUES('tenantA','clientA','owner');
  INSERT INTO taxguard_members(tenant_id,uid,role,status,credential_verified,credential_type,credential_expires_at)VALUES
   ('tenantA','preparer','accountant','active',false,null,null),('tenantA','reviewer','reviewer','active',true,'CPA','2099-01-01'),
   ('tenantA','admin','administrator','active',false,null,null),('tenantA','compliance','compliance_officer','active',false,null,null),
   ('tenantA','suspended-admin','administrator','suspended',false,null,null),('tenantB','adminB','administrator','active',false,null,null);
  INSERT INTO taxguard_cases(id,case_id,tenant_id,client_id,engagement_id,tax_year,active_stage,client_uid,preparer_uid,reviewer_uid,created_by,updated_by)VALUES('${cid}','caseA','tenantA','clientA','engA',2025,3,'owner','preparer','reviewer','preparer','preparer');
  INSERT INTO taxguard_case_assignments(case_id,tenant_id,uid,role)VALUES('caseA','tenantA','preparer','preparer'),('caseA','tenantA','reviewer','reviewer');
  INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,engagement_id,tax_year,role,user_id,assigned_by)VALUES('prep','tenantA','clientA','engA',2025,'preparer','preparer','test'),('rev','tenantA','clientA','engA',2025,'reviewer','reviewer','test');
  INSERT INTO taxguard_documents(id,document_id,tenant_id,client_id,engagement_id,tax_year,case_id,hash,mime_type,created_by,status,quarantine_status)VALUES('${did}','docA','tenantA','clientA','engA',2025,'caseA','${hash}','application/pdf','preparer','RELEASED','CLEAN');
  INSERT INTO ai_evidence_sources(source_id,tenant_id,client_id,tax_case_id,tax_year,case_record_id,evidence_type,document_record_id,document_version,source_reference,source_hash)VALUES('${eid}','tenantA','clientA','caseA',2025,'${cid}','DOCUMENT','${did}',1,'private source','${hash}');
  INSERT INTO ai_models(model_id,model_version,provider,effective_date,approved_use_cases)VALUES('isolated-model','1','TEST',now(),ARRAY['IDENTIFY_REVIEW_QUESTIONS']);
  INSERT INTO ai_prompts(agent_id,prompt_id,version,system_instructions,expected_output_schema,effective_date)VALUES('A34','isolated-prompt','1','Synthetic tests only','{"type":"object"}',now());
  INSERT INTO ai_human_approval_policies(tenant_id,agent_id,action,materiality)VALUES('tenantA','A34','READ','MATERIAL');`);
  const db: TransactionalSql = { transaction: callback => pg.transaction(async tx => callback({ query: async (sql, params) => { const result = await tx.query(sql, params); return { rows: JSON.parse(JSON.stringify(result.rows)) }; } })) };
  plane = new GovernanceControlPlane(authority, new SqlGovernanceStore(db));
  service = new KillSwitchService(authority, db);
  const app = express(); app.use(express.json()); app.use('/api/ai-governance', createAiGovernanceRouter(() => plane, () => service));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 30000);

beforeEach(async () => {
  // ACTIVE state exists only inside this disposable PostgreSQL test fixture.
  await pg.exec(`UPDATE ai_agents SET status='ACTIVE',risk_class='LOW',default_model='isolated-model',default_model_version='1',prompt_id='isolated-prompt',prompt_version='1' WHERE agent_id='A34';
  UPDATE ai_agent_versions SET status='ACTIVE',risk_class='LOW',default_model='isolated-model',default_model_version='1',prompt_id='isolated-prompt',prompt_version='1',token_budget=10000,cost_budget=1,confidence_threshold=0.8,human_review_threshold=0.5 WHERE agent_id='A34';
  UPDATE ai_models SET status='ACTIVE',data_classification_limit='INTERNAL',token_limit=10000,cost_limit=1,approved_use_cases=ARRAY['IDENTIFY_REVIEW_QUESTIONS'],prohibited_use_cases='{}',effective_date=now() WHERE model_id='isolated-model';
  UPDATE ai_prompts SET status='ACTIVE',risk_class='LOW',effective_date=now() WHERE agent_id='A34';
  UPDATE ai_tools SET status='ACTIVE',risk_class='LOW',requires_human_approval=false;
  INSERT INTO ai_agent_permissions(agent_id,resource,action) SELECT 'A34',tool_id,x.action::ai_action FROM ai_tools CROSS JOIN unnest(ARRAY['READ','CREATE','UPDATE','DELETE','EXECUTE','APPROVE','EXPORT','TRANSMIT'])x(action) ON CONFLICT DO NOTHING;
  UPDATE ai_agent_permissions SET permission_state='ALLOW',conditions='{}',risk_level='LOW',human_approval_required=false WHERE agent_id='A34';
  UPDATE ai_agent_data_permissions SET permission_state='ALLOW',conditions='{}' WHERE agent_id='A34' AND data_classification IN ('PUBLIC','INTERNAL');
  UPDATE ai_stage_permissions SET permission_state='ALLOW',conditions='{}' WHERE agent_id='A34';
  UPDATE ai_human_approval_policies SET status='ACTIVE' WHERE agent_id='A34';
  DELETE FROM ai_kill_switches;`);
  // ai_security_events is append-only (AI_IMMUTABLE_HISTORY); assert only on events created by each test.
  seen = new Set((await rows('SELECT event_id FROM ai_security_events')).map(r => r.event_id));
});
afterAll(async () => { await new Promise(resolve => server?.close(resolve)); await pg?.close(); });

describe('kill-switch request parsing', () => {
  it('accepts only GLOBAL or a canonical AGENT target with a bounded reason', () => {
    expect(parseKillSwitchActivation({ scope: 'GLOBAL', reason })).toEqual({ scope: 'GLOBAL', reason });
    expect(parseKillSwitchActivation({ scope: 'AGENT', agent_id: 'A07', reason: `  ${reason}  ` })).toEqual({ scope: 'AGENT', agent_id: 'A07', reason });
  });
  it.each([
    [null], [[]], [{ scope: 'GLOBAL' }], [{ scope: 'GLOBAL', reason: 'short' }], [{ scope: 'GLOBAL', reason: 'x'.repeat(501) }],
    [{ scope: 'GLOBAL', reason: 'contains\u0000control characters' }], [{ scope: 'AGENT', reason }], [{ scope: 'AGENT', agent_id: 'A99', reason }],
    [{ scope: 'MODEL', target: 'isolated-model@1', reason }], [{ scope: 'GLOBAL', reason, tenant_id: 'tenantB' }],
    [{ scope: 'GLOBAL', reason, activated_by: 'someone-else' }], [{ scope: 'GLOBAL', reason, enabled: false }],
  ])('refuses malformed or authority-bearing request %#', raw => {
    expect(() => parseKillSwitchActivation(raw)).toThrow(/AI_KILL_SWITCH_(INVALID_REQUEST|REASON_INVALID|UNKNOWN_AGENT)/);
  });
});

describe('kill-switch activation authority', () => {
  it.each(['', 'unknown-token'])('rejects unauthenticated token %j', async token => {
    await expect(service.activate(token, { scope: 'GLOBAL', reason })).rejects.toThrow('AI_AUTH_REQUIRED');
    expect(await rows('SELECT * FROM ai_kill_switches')).toHaveLength(0);
  });

  it.each([['valid', 'accountant'], ['suspended', 'suspended administrator']])('denies %s (%s), records the denial and changes no switch', async token => {
    await expect(service.activate(token, { scope: 'GLOBAL', reason })).rejects.toThrow('AI_KILL_SWITCH_ROLE_DENIED');
    expect(await rows('SELECT * FROM ai_kill_switches')).toHaveLength(0);
    const events = await newEvents();
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('AUTHORIZATION_DENIAL');
    expect(events[0].details.operation).toBe('KILL_SWITCH_ACTIVATE');
  });

  it('records a denial for an authenticated non-member without writing an unbound actor', async () => {
    await expect(service.activate('ghost', { scope: 'GLOBAL', reason })).rejects.toThrow('AI_KILL_SWITCH_ROLE_DENIED');
    const [event] = await newEvents();
    expect(event.actor_uid).toBeNull();
    expect(event.details.actor_uid_sha256).toBe(createHash('sha256').update('not-a-member').digest('hex'));
  });

  it.each(['admin', 'compliance'])('allows %s to engage an agent stop and audits it without the raw reason', async token => {
    const result = await service.activate(token, { scope: 'AGENT', agent_id: 'A34', reason });
    expect(result).toMatchObject({ scope: 'AGENT', target: 'A34', enabled: true, already_active: false, activated_by: identities[token].uid });
    const [sw] = await rows('SELECT tenant_id,scope,target,agent_id,enabled,reason FROM ai_kill_switches');
    expect(sw).toMatchObject({ tenant_id: 'tenantA', scope: 'AGENT', target: 'A34', agent_id: 'A34', enabled: true, reason });
    const [event] = await newEvents();
    expect(event).toMatchObject({ event_type: 'KILL_SWITCH', severity: 'CRITICAL', agent_id: 'A34', actor_uid: identities[token].uid });
    expect(event.details).toMatchObject({ operation: 'ACTIVATE', scope: 'AGENT', target: 'A34', reason_sha256: createHash('sha256').update(reason).digest('hex') });
    expect(JSON.stringify(event.details)).not.toContain(reason);
  });

  it('is idempotent: repeat activation keeps one row and reports already_active', async () => {
    const first = await service.activate('admin', { scope: 'GLOBAL', reason });
    const second = await service.activate('compliance', { scope: 'GLOBAL', reason: 'Second operator confirms the stop' });
    expect(second).toMatchObject({ switch_id: first.switch_id, already_active: true, activated_by: 'admin' });
    expect(await rows('SELECT * FROM ai_kill_switches')).toHaveLength(1);
    expect((await newEvents()).map(r => r.details.operation)).toEqual(['ACTIVATE', 'ACTIVATE_ALREADY_ACTIVE']);
  });

  it('re-engaging a previously lifted stop preserves the prior lifecycle in the audit event', async () => {
    const first = await service.activate('admin', { scope: 'AGENT', agent_id: 'A34', reason });
    await pg.query(`UPDATE ai_kill_switches SET enabled=false,deactivated_by='admin',deactivated_at=now() WHERE switch_id=$1`, [first.switch_id]);
    const again = await service.activate('compliance', { scope: 'AGENT', agent_id: 'A34', reason: 'Re-engaging after renewed anomaly' });
    expect(again).toMatchObject({ switch_id: first.switch_id, already_active: false, activated_by: 'compliance' });
    const [event] = await newEvents(`details->>'operation'='REACTIVATE'`);
    expect(event.details.prior).toMatchObject({ activated_by: 'admin', deactivated_by: 'admin' });
  });

  it('confines a stop to the activator\'s own tenant', async () => {
    await service.activate('adminB', { scope: 'GLOBAL', reason });
    expect((await rows('SELECT tenant_id FROM ai_kill_switches')).map(r => r.tenant_id)).toEqual(['tenantB']);
    await expect(plane.evaluate('valid', request())).resolves.toMatchObject({ agent_id: 'A34' });
  });

  it('lists switches only for authorized governance roles', async () => {
    await service.activate('admin', { scope: 'GLOBAL', reason });
    expect(await service.list('compliance')).toHaveLength(1);
    await expect(service.list('valid')).rejects.toThrow('AI_KILL_SWITCH_ROLE_DENIED');
    expect(await service.list('adminB')).toEqual([]);
  });
});

describe('server-side enforcement after activation', () => {
  it('an AGENT stop blocks subsequent governed assessment for that agent', async () => {
    await expect(plane.evaluate('valid', request())).resolves.toMatchObject({ agent_id: 'A34', action_executed: false });
    await service.activate('admin', { scope: 'AGENT', agent_id: 'A34', reason });
    await expect(plane.evaluate('valid', request())).rejects.toThrow('AI_KILL_SWITCH_ACTIVE');
  });

  it('a stop on a different agent does not block A34', async () => {
    await service.activate('admin', { scope: 'AGENT', agent_id: 'A07', reason });
    await expect(plane.evaluate('valid', request())).resolves.toMatchObject({ agent_id: 'A34' });
  });

  it('a GLOBAL stop blocks governed assessment for every agent', async () => {
    await service.activate('compliance', { scope: 'GLOBAL', reason });
    await expect(plane.evaluate('valid', request())).rejects.toThrow('AI_KILL_SWITCH_ACTIVE');
  });
});

describe('HTTP routes', () => {
  const post = (token: string, body: unknown) => fetch(`${origin}/api/ai-governance/kill-switches`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

  it('activates with 201 using only the server-verified identity, ignoring browser-claimed user fields', async () => {
    const response = await post('admin', { scope: 'GLOBAL', reason });
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ scope: 'GLOBAL', activated_by: 'admin' });
    // The mocked transport attached a tenantB administrator to req.user; it confers nothing.
    expect((await rows('SELECT tenant_id FROM ai_kill_switches')).map(r => r.tenant_id)).toEqual(['tenantA']);
  });

  it('returns 403 for unauthorized roles and 400 for malformed bodies', async () => {
    expect((await post('valid', { scope: 'GLOBAL', reason })).status).toBe(403);
    const bad = await post('admin', { scope: 'GLOBAL', reason, tenant_id: 'tenantB' });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ code: 'AI_KILL_SWITCH_INVALID_REQUEST' });
  });

  it('exposes no deactivation route', async () => {
    for (const method of ['DELETE', 'PATCH', 'PUT']) {
      const response = await fetch(`${origin}/api/ai-governance/kill-switches`, { method, headers: { authorization: 'Bearer admin' } });
      expect(response.status).toBe(404);
    }
  });

  it('lists via GET for authorized roles only', async () => {
    await post('admin', { scope: 'GLOBAL', reason });
    const ok = await fetch(`${origin}/api/ai-governance/kill-switches`, { headers: { authorization: 'Bearer compliance' } });
    expect(ok.status).toBe(200);
    expect((await ok.json()).kill_switches).toHaveLength(1);
    expect((await fetch(`${origin}/api/ai-governance/kill-switches`, { headers: { authorization: 'Bearer valid' } })).status).toBe(403);
  });
});
