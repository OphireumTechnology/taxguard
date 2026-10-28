import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CANONICAL_AGENTS, findCanonicalAgent } from '../ai/registry';
import { AI_FOUNDATION_TABLES } from '../ai/schemaManifest';

const migration = fs.readFileSync(path.resolve('supabase/migrations/20261008000000_taxguard_ai_registry_foundation.sql'), 'utf8');
const hash = 'a'.repeat(64);
const caseId = '11111111-1111-4111-8111-111111111111';
const docId = '22222222-2222-4222-8222-222222222222';
const auditId = '33333333-3333-4333-8333-333333333333';
const runId = '44444444-4444-4444-8444-444444444444';
const proposalId = '55555555-5555-4555-8555-555555555555';
const scope = "'tenantA','clientA','caseA',2025";
let pg: PGlite;
const insertRun = (override: Record<string, unknown> = {}) => {
  const values = {run_id: randomUUID(), agent_id:'A07',agent_version:'1.0.0',model_id:'test-model',model_provider:'TEST',model_version:'1',prompt_id:'extract-test',prompt_version:'1',tenant_id:'tenantA',client_id:'clientA',tax_case_id:'caseA',case_record_id:caseId,tax_year:2025,workflow_stage:2,request_id:randomUUID(),requested_by:'preparer',input_hash:hash,...override};
  return pg.query(`INSERT INTO ai_runs(${Object.keys(values).join(',')}) VALUES(${Object.keys(values).map((_,i)=>`$${i+1}`).join(',')}) RETURNING run_id`,Object.values(values));
};

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS 'SELECT current_user::text'; CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;`);
  const core=fs.readFileSync(path.resolve('supabase/migrations/20260928000000_taxguard_core_schema.sql'),'utf8').replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"[^"]+";/gi,'');
  await pg.exec(core);
  // Apply the entire existing migration sequence before the additive AI-1 schema.
  for (const file of fs.readdirSync(path.resolve('supabase/migrations')).filter(file=>file.endsWith('.sql') && file>'20260928000000_taxguard_core_schema.sql' && file<'20261008000000_taxguard_ai_registry_foundation.sql').sort()) {
    await pg.exec(fs.readFileSync(path.resolve('supabase/migrations',file),'utf8').replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"[^"]+";/gi,''));
  }
  await pg.exec(migration);
  await pg.exec(`INSERT INTO taxguard_tenants(id,name) VALUES('tenantA','Test A'),('tenantB','Test B');
    INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid) VALUES('tenantA','clientA','owner'),('tenantA','clientB','ownerB'),('tenantB','clientA','other');
    INSERT INTO taxguard_members(tenant_id,uid,role,credential_verified,credential_type,credential_expires_at) VALUES
      ('tenantA','preparer','accountant',false,null,null),('tenantA','reviewer','reviewer',true,'CPA','2099-01-01'),('tenantA','other','reviewer',true,'EA','2099-01-01');
    INSERT INTO taxguard_cases(id,case_id,tenant_id,client_id,engagement_id,tax_year,client_uid,preparer_uid,reviewer_uid,created_by,updated_by)
      VALUES('${caseId}','caseA','tenantA','clientA','engA',2025,'owner','preparer','reviewer','preparer','preparer');
    INSERT INTO taxguard_documents(id,document_id,tenant_id,client_id,engagement_id,tax_year,case_id,hash,mime_type,created_by)
      VALUES('${docId}','docA','tenantA','clientA','engA',2025,'caseA','${hash}','application/pdf','preparer');
    INSERT INTO taxguard_audit_log(id,tenant_id,case_id,action,actor_uid) VALUES('${auditId}','tenantA','caseA','TEST','reviewer');
    INSERT INTO ai_models(model_id,model_version,provider,effective_date) VALUES('test-model','1','TEST',now());
    INSERT INTO ai_prompts(agent_id,prompt_id,version,system_instructions,expected_output_schema,effective_date)
      VALUES('A07','extract-test','1','Test-only prompt','{"type":"object"}',now());`);
  await insertRun({run_id:runId});
  await pg.exec(`INSERT INTO ai_proposals(proposal_id,run_id,tenant_id,client_id,tax_case_id,tax_year,structured_output,output_hash)
    VALUES('${proposalId}','${runId}',${scope},'{}','${hash}');`);
}, 30000);
afterAll(async () => { await pg?.close(); });

describe('AI-1 canonical inert registry', () => {
  it('contains exactly A00–A60 with one supervisor and immutable metadata', async () => {
    const ids=Array.from({length:61},(_,i)=>`A${String(i).padStart(2,'0')}`);
    expect(CANONICAL_AGENTS.map(a=>a.agent_id)).toEqual(ids);
    expect(new Set(CANONICAL_AGENTS.map(a=>a.agent_id)).size).toBe(61);
    expect(CANONICAL_AGENTS.filter(a=>a.category==='SUPERVISOR').map(a=>a.agent_id)).toEqual(['A00']);
    expect(CANONICAL_AGENTS.every(a=>Object.isFrozen(a)&&a.status==='DRAFT'&&a.token_budget===0&&a.default_model===null)).toBe(true);
    const rows=await pg.query('SELECT agent_id,agent_name,category,description,version,status FROM ai_agents ORDER BY agent_id');
    expect(rows.rows).toEqual(CANONICAL_AGENTS.map(({agent_id,agent_name,category,description,version,status})=>({agent_id,agent_name,category,description,version,status})));
    expect((await pg.query('SELECT count(*)::int AS n FROM ai_agent_versions')).rows).toEqual([{n:61}]);
  });
  it.each(['A61','A99','A-1','A1','A000','a00','unknown'])('rejects unknown registry ID %s', id => expect(()=>findCanonicalAgent(id)).toThrow('UNKNOWN_AI_AGENT'));
  it('has no fake operational history or activated models in migration', () => {
    expect(migration).not.toMatch(/INSERT INTO ai_(runs|proposals|human_reviews|security_events|models|prompts)\b/);
  });
  it('rejects duplicate and invalid agent IDs/categories', async () => {
    await expect(pg.exec("INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A00','Duplicate','SUPERVISOR','test')")).rejects.toThrow();
    await expect(pg.exec("INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A61','Invalid','SUPERVISOR','test')")).rejects.toThrow();
    await expect(pg.exec("UPDATE ai_agents SET category='ACCOUNTING' WHERE agent_id='A00'")).rejects.toThrow();
    await expect(pg.exec("UPDATE ai_agents SET agent_id='A61' WHERE agent_id='A60'")).rejects.toThrow();
  });
});

describe('AI-1 constraints and deny-by-default', () => {
  it('defaults all tool/action, data and stage permissions to DENY', async () => {
    for(const table of ['ai_agent_permissions','ai_agent_data_permissions','ai_stage_permissions']) {
      expect((await pg.query(`SELECT count(*)::int AS n FROM ${table} WHERE permission_state<>'DENY'`)).rows).toEqual([{n:0}]);
    }
    expect((await pg.query('SELECT count(*)::int AS n FROM ai_agent_permissions')).rows).toEqual([{n:61*11*8}]);
  });
  it.each(['ALLOW','CONDITIONAL'])('never grants SYSTEM_SECRET (%s)', async state => {
    await expect(pg.query("UPDATE ai_agent_data_permissions SET permission_state=$1,conditions='{"+'"reason":"test"'+"}' WHERE agent_id='A07' AND data_classification='SYSTEM_SECRET'",[state])).rejects.toThrow();
  });
  it.each(["permission_state='BAD'","action='ALL'","resource='*'","permission_state='CONDITIONAL'"])( 'rejects invalid permission %s', async patch => {
    await expect(pg.exec(`UPDATE ai_agent_permissions SET ${patch} WHERE agent_id='A07' AND resource='document.read' AND action='READ'`)).rejects.toThrow();
  });
  it.each([0,19,-1])('rejects invalid workflow stage %s', async stage => {
    await expect(pg.exec(`INSERT INTO ai_stage_permissions(agent_id,stage) VALUES('A07',${stage})`)).rejects.toThrow();
  });
  it('rejects a competing workflow vocabulary',async()=>{
    await expect(insertRun({workflow_version:'MASTERPLAN_18_V1'})).rejects.toThrow();
  });
  it.each(['SYSTEM_SECRET','AUTHENTICATION_DATA'])('rejects model data limit %s',async classification=>{
    await expect(pg.query("UPDATE ai_models SET data_classification_limit=$1 WHERE model_id='test-model'",[classification])).rejects.toThrow();
  });
  it.each([{model_id:'missing'},{model_provider:'OTHER'},{model_version:'missing'},{agent_id:'A61'},{agent_version:'missing'},{prompt_version:'missing'},{prompt_id:'missing'},{agent_id:'A08'}])('rejects orphan agent/model/prompt run %j',async patch=>{
    await expect(insertRun(patch)).rejects.toThrow();
  });
  it.each(['tenant_id','client_id','tax_case_id','case_record_id','tax_year','requested_by','input_hash'])('requires run field %s',async field=>{
    await expect(insertRun({[field]:null})).rejects.toThrow();
  });
  it.each([{tenant_id:'tenantB'},{client_id:'clientB'},{tax_case_id:'other'},{tax_year:2024},{workflow_stage:19},{input_hash:'not-a-hash'},{status:'SUCCESS'}])('rejects scope or run contract mismatch %j',async patch=>{
    await expect(insertRun(patch)).rejects.toThrow();
  });
  it('rejects malformed prompt output schema',async()=>{
    await expect(pg.exec("INSERT INTO ai_prompts(agent_id,prompt_id,version,system_instructions,expected_output_schema,effective_date) VALUES('A08','bad','1','test','{}',now())")).rejects.toThrow();
  });
  it('freezes prompt/model/agent versions after an audited request uses them',async()=>{
    await expect(pg.exec("UPDATE ai_prompts SET system_instructions='altered' WHERE agent_id='A07'")).rejects.toThrow('AI_PROMPT_VERSION_IN_USE');
    await expect(pg.exec("UPDATE ai_models SET provider='OTHER' WHERE model_id='test-model'")).rejects.toThrow('AI_MODEL_VERSION_IN_USE');
    await expect(pg.exec("UPDATE ai_agent_versions SET token_budget=999 WHERE agent_id='A07'")).rejects.toThrow('AI_AGENT_VERSION_IN_USE');
  });
  it('preserves run identity and prohibits deleting run history',async()=>{
    await expect(pg.exec(`UPDATE ai_runs SET input_hash='${'b'.repeat(64)}' WHERE run_id='${runId}'`)).rejects.toThrow();
    await expect(pg.exec(`DELETE FROM ai_runs WHERE run_id='${runId}'`)).rejects.toThrow();
  });
});

describe('AI-1 evidence/review/action integrity', () => {
  it('rejects orphan and cross-scope evidence',async()=>{
    await expect(pg.exec(`INSERT INTO ai_run_evidence(run_id,tenant_id,client_id,tax_case_id,tax_year,source_id) VALUES('${randomUUID()}',${scope},'${randomUUID()}')`)).rejects.toThrow();
    await expect(pg.exec(`INSERT INTO ai_evidence_sources(tenant_id,client_id,tax_case_id,tax_year,case_record_id,evidence_type,source_reference,source_hash) VALUES('tenantA','clientB','caseA',2025,'${caseId}','RULE','test','${hash}')`)).rejects.toThrow();
  });
  it('requires declared source type and valid document/version',async()=>{
    await expect(pg.exec(`INSERT INTO ai_evidence_sources(tenant_id,client_id,tax_case_id,tax_year,case_record_id,evidence_type,source_reference,source_hash) VALUES(${scope},'${caseId}','DOCUMENT','test','${hash}')`)).rejects.toThrow();
    await expect(pg.exec(`INSERT INTO ai_evidence_sources(tenant_id,client_id,tax_case_id,tax_year,case_record_id,evidence_type,document_record_id,document_version,source_reference,source_hash) VALUES(${scope},'${caseId}','DOCUMENT','${docId}',2,'test','${hash}')`)).rejects.toThrow();
  });
  it('links valid document evidence and preserves it immutably',async()=>{
    const source=await pg.query<{source_id:string}>(`INSERT INTO ai_evidence_sources(tenant_id,client_id,tax_case_id,tax_year,case_record_id,evidence_type,document_record_id,document_version,source_reference,source_hash) VALUES(${scope},'${caseId}','DOCUMENT','${docId}',1,'test','${hash}') RETURNING source_id`);
    await pg.exec(`INSERT INTO ai_run_evidence(run_id,tenant_id,client_id,tax_case_id,tax_year,source_id,page) VALUES('${runId}',${scope},'${source.rows[0].source_id}',1)`);
    await expect(pg.exec('DELETE FROM ai_run_evidence')).rejects.toThrow();
    await expect(pg.exec(`INSERT INTO ai_run_evidence(run_id,tenant_id,client_id,tax_case_id,tax_year,source_id) VALUES('${runId}','tenantA','clientB','caseA',2025,'${source.rows[0].source_id}')`)).rejects.toThrow();
  });
  it.each([{reviewer:'preparer',role:'reviewer',reason:'Meaningful reason'}, {reviewer:'other',role:'reviewer',reason:'Meaningful reason'}, {reviewer:'reviewer',role:'accountant',reason:'Meaningful reason'}, {reviewer:'reviewer',role:'reviewer',reason:null},{reviewer:'reviewer',role:'reviewer',reason:'short'}])('rejects invalid human review %j',async ({reviewer,role,reason})=>{
    await expect(pg.query(`INSERT INTO ai_human_reviews(run_id,proposal_id,tenant_id,client_id,tax_case_id,tax_year,reviewer_user_id,reviewer_role,decision,reason,completed_at) VALUES('${runId}','${proposalId}',${scope},$1,$2,'APPROVED',$3,now())`,[reviewer,role,reason])).rejects.toThrow();
  });
  it('accepts independently credentialed review, records action without modifying tax data',async()=>{
    const review=await pg.query<{review_id:string}>(`INSERT INTO ai_human_reviews(run_id,proposal_id,tenant_id,client_id,tax_case_id,tax_year,reviewer_user_id,reviewer_role,decision,reason,completed_at) VALUES('${runId}','${proposalId}',${scope},'reviewer','reviewer','APPROVED','Verified test evidence',now()) RETURNING review_id`);
    await pg.exec(`INSERT INTO ai_authoritative_actions(run_id,proposal_id,review_id,tenant_id,client_id,tax_case_id,tax_year,action,action_service,authorized_by,audit_event_id) VALUES('${runId}','${proposalId}','${review.rows[0].review_id}',${scope},'UPDATE','test-only','reviewer','${auditId}')`);
    expect((await pg.query('SELECT count(*)::int AS n FROM taxguard_tax_records')).rows).toEqual([{n:0}]);
    await expect(pg.exec('DELETE FROM ai_human_reviews')).rejects.toThrow();
  });
  it('does not authorize action from a pending review',async()=>{
    const review=await pg.query<{review_id:string}>(`INSERT INTO ai_human_reviews(run_id,proposal_id,tenant_id,client_id,tax_case_id,tax_year,reviewer_user_id,reviewer_role,decision) VALUES('${runId}','${proposalId}',${scope},'reviewer','reviewer','PENDING') RETURNING review_id`);
    await expect(pg.exec(`INSERT INTO ai_authoritative_actions(run_id,proposal_id,review_id,tenant_id,client_id,tax_case_id,tax_year,action,action_service,status,authorized_by,audit_event_id) VALUES('${runId}','${proposalId}','${review.rows[0].review_id}',${scope},'UPDATE','test-only','AUTHORIZED','reviewer','${auditId}')`)).rejects.toThrow();
  });
  it('rejects cross-tenant events bound to a run',async()=>{
    await expect(pg.exec(`INSERT INTO ai_security_events(tenant_id,run_id,event_type) VALUES('tenantB','${runId}','CROSS_TENANT_ATTEMPT')`)).rejects.toThrow();
  });
  it('accepts typed global kill switch and rejects unknown targets and incomplete deactivation',async()=>{
    await pg.exec("INSERT INTO ai_kill_switches(tenant_id,scope,target,reason,activated_by) VALUES('tenantA','GLOBAL','GLOBAL','Test emergency switch','reviewer')");
    await expect(pg.exec("INSERT INTO ai_kill_switches(tenant_id,scope,target,agent_id,reason,activated_by) VALUES('tenantA','AGENT','A61','A61','Test emergency switch','reviewer')")).rejects.toThrow();
    await expect(pg.exec("UPDATE ai_kill_switches SET enabled=false WHERE scope='GLOBAL'")).rejects.toThrow();
  });
});

describe('AI-1 PostgreSQL RLS',()=>{
  it('enables and forces RLS for every foundation table with no permissive policies',async()=>{
    const rows=await pg.query<{relname:string;relrowsecurity:boolean;relforcerowsecurity:boolean}>("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname=ANY($1) ORDER BY relname",[[...AI_FOUNDATION_TABLES]]);
    expect(rows.rows.map(r=>r.relname)).toEqual([...AI_FOUNDATION_TABLES].sort());
    expect(rows.rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity)).toBe(true);
    expect((await pg.query("SELECT count(*)::int AS n FROM pg_policies WHERE tablename=ANY($1)",[[...AI_FOUNDATION_TABLES]])).rows).toEqual([{n:0}]);
  });
  it.each(['anon','authenticated'])('denies %s read and write even with table grants (RLS)',async role=>{
    await pg.exec(`GRANT USAGE ON SCHEMA public TO ${role}; GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA public TO ${role}; SET ROLE ${role};`);
    try {
      expect((await pg.query('SELECT * FROM ai_runs')).rows).toEqual([]);
      expect((await pg.query('SELECT * FROM ai_agents')).rows).toEqual([]);
      await expect(pg.exec("INSERT INTO ai_tools(tool_id,name,description) VALUES('bad.tool','bad','test')")).rejects.toThrow();
    } finally { await pg.exec('RESET ROLE'); }
  });
});

 describe('AI-1 additional boundary checks',()=>{
  it('defaults an unseeded resource permission to DENY',async()=>{
    const result=await pg.query("INSERT INTO ai_agent_permissions(agent_id,resource,action) VALUES('A07','custom.read','READ') RETURNING permission_state");
    expect(result.rows).toEqual([{permission_state:'DENY'}]);
  });
  it('rejects orphan permission, evidence-source and verification references',async()=>{
    await expect(pg.exec("INSERT INTO ai_agent_permissions(agent_id,resource,action) VALUES('A61','custom.read','READ')")).rejects.toThrow();
    await expect(pg.exec("INSERT INTO ai_verification_evidence(verification_id,evidence_id,run_id) VALUES('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003')")).rejects.toThrow();
  });
  it('rejects self-review even for the correctly assigned reviewer identity',async()=>{
    const id=randomUUID(); await insertRun({run_id:id,requested_by:'reviewer'});
    const proposal=await pg.query<{proposal_id:string}>(`INSERT INTO ai_proposals(run_id,tenant_id,client_id,tax_case_id,tax_year,structured_output,output_hash) VALUES('${id}',${scope},'{}','${hash}') RETURNING proposal_id`);
    await expect(pg.exec(`INSERT INTO ai_human_reviews(run_id,proposal_id,tenant_id,client_id,tax_case_id,tax_year,reviewer_user_id,reviewer_role,decision) VALUES('${id}','${proposal.rows[0].proposal_id}',${scope},'reviewer','reviewer','PENDING')`)).rejects.toThrow('AI_INDEPENDENT_REVIEWER_REQUIRED');
  });
  it.each(['AGENT','MODEL','TOOL','WORKFLOW'])('accepts a properly referenced %s kill switch',async kind=>{
    const variants={AGENT:"'A07','A07',NULL,NULL,NULL,NULL,NULL",MODEL:"'test-model@1',NULL,'test-model','1',NULL,NULL,NULL",TOOL:"'document.read',NULL,NULL,NULL,'document.read',NULL,NULL",WORKFLOW:"'LEGACY_18_V1:2',NULL,NULL,NULL,NULL,'LEGACY_18_V1',2"};
    await pg.exec(`INSERT INTO ai_kill_switches(tenant_id,scope,target,agent_id,model_id,model_version,tool_id,workflow_version,workflow_stage,reason,activated_by) VALUES('tenantA','${kind}',${variants[kind as keyof typeof variants]},'Verified test emergency','reviewer')`);
  });
  it('rejects deactivation without timestamp',async()=>{
    await expect(pg.exec("UPDATE ai_kill_switches SET enabled=false,deactivated_by='reviewer' WHERE scope='GLOBAL'")).rejects.toThrow();
  });
 });

describe('AI-1 category ranges',()=>{
  it('matches the approved category population for all 61 identities',()=>{
    const counts=Object.fromEntries(['SUPERVISOR','CLIENT_SERVICES','DOCUMENT_INTELLIGENCE','ACCOUNTING','TAX_INTELLIGENCE','RISK_QC','SIGN_FILE_RESOLVE','PRACTICE_OPERATIONS','GOVERNANCE_SECURITY_PLATFORM'].map(category=>[category,CANONICAL_AGENTS.filter(a=>a.category===category).length]));
    expect(counts).toEqual({SUPERVISOR:1,CLIENT_SERVICES:4,DOCUMENT_INTELLIGENCE:7,ACCOUNTING:5,TAX_INTELLIGENCE:15,RISK_QC:4,SIGN_FILE_RESOLVE:7,PRACTICE_OPERATIONS:8,GOVERNANCE_SECURITY_PLATFORM:10});
  });
});
