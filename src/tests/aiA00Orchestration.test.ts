import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { A00Orchestrator, RetryableAdvisoryError } from '../server/ai/orchestration/A00Orchestrator';
import { SqlOrchestrationLedger } from '../server/ai/orchestration/SqlOrchestrationLedger';
import { routeTask } from '../server/ai/orchestration/canonicalRouting';
import { GovernanceControlPlane } from '../server/ai/governance/GovernanceControlPlane';
import { SqlGovernanceStore, type TransactionalSql } from '../server/ai/governance/SqlGovernanceStore';
import type { AdvisoryHandler, ChildContext, OrchestrationLedger, OrchestrationRequest } from '../server/ai/orchestration/contracts';

const cid='11111111-1111-4111-8111-111111111111',did='22222222-2222-4222-8222-222222222222',eid='33333333-3333-4333-8333-333333333333',hash='a'.repeat(64);
let pg:PGlite,plane:GovernanceControlPlane,ledger:SqlOrchestrationLedger;
const request=():OrchestrationRequest=>({request_id:randomUUID(),scope:{tenant_id:'tenantA',client_id:'clientA',tax_case_id:'caseA',tax_year:2025},tasks:['IDENTIFY_REVIEW_QUESTIONS'],evidence_source_ids:[eid]});
const result=(c:ChildContext)=>({operation_id:c.operation_id,agent_id:c.agent_id,status:'ADVISORY',human_review_required:true,action_executed:false,evidence_source_ids:[eid],finding_codes:['REVIEW_REQUIRED']});
const handler=vi.fn<AdvisoryHandler>(async c=>result(c));
const runner=(h:AdvisoryHandler=handler,l:OrchestrationLedger=ledger,timeout_ms=1000,maximum_retries=1)=>new A00Orchestrator(plane,l,{handlers:{IDENTIFY_REVIEW_QUESTIONS:h,REVIEW_EVIDENCE_COMPLETENESS:h},timeout_ms,maximum_retries});
const denied=async(code:string,r:unknown=request(),token='valid')=>{
  await expect(runner().coordinate(token,r)).rejects.toThrow(code);
  expect(handler).not.toHaveBeenCalled();
};

beforeAll(async()=>{
  pg=new PGlite();
  await pg.exec(`CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS 'SELECT current_user::text'; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;`);
  for(const name of fs.readdirSync(path.resolve('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort())await pg.exec(fs.readFileSync(path.resolve('supabase/migrations',name),'utf8').replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"[^"]+";/gi,''));
  await pg.exec(`INSERT INTO taxguard_tenants(id,name)VALUES('tenantA','Test A'),('tenantB','Test B');
    INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid)VALUES('tenantA','clientA','owner'),('tenantA','clientB','other');
    INSERT INTO taxguard_members(tenant_id,uid,role)VALUES('tenantA','preparer','accountant'),('tenantA','reviewer','reviewer');
    INSERT INTO taxguard_cases(id,case_id,tenant_id,client_id,engagement_id,tax_year,active_stage,client_uid,preparer_uid,reviewer_uid,created_by,updated_by)VALUES('${cid}','caseA','tenantA','clientA','engA',2025,3,'owner','preparer','reviewer','preparer','preparer');
    INSERT INTO taxguard_case_assignments(case_id,tenant_id,uid,role)VALUES('caseA','tenantA','preparer','preparer');
    INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,engagement_id,tax_year,role,user_id,assigned_by)VALUES('prep','tenantA','clientA','engA',2025,'preparer','preparer','test');
    INSERT INTO taxguard_documents(id,document_id,tenant_id,client_id,engagement_id,tax_year,case_id,hash,mime_type,created_by,status,quarantine_status)VALUES('${did}','docA','tenantA','clientA','engA',2025,'caseA','${hash}','application/pdf','preparer','RELEASED','CLEAN');
    INSERT INTO ai_evidence_sources(source_id,tenant_id,client_id,tax_case_id,tax_year,case_record_id,evidence_type,document_record_id,document_version,source_reference,source_hash)VALUES('${eid}','tenantA','clientA','caseA',2025,'${cid}','DOCUMENT','${did}',1,'private source','${hash}');
    INSERT INTO ai_models(model_id,model_version,provider,effective_date,approved_use_cases)VALUES('test-model','1','TEST',now(),ARRAY['COORDINATE_REVIEW','IDENTIFY_REVIEW_QUESTIONS','REVIEW_EVIDENCE_COMPLETENESS']);
    INSERT INTO ai_prompts(agent_id,prompt_id,version,system_instructions,expected_output_schema,effective_date) SELECT a,'test-'||a,'1','Synthetic isolated tests only','{"type":"object"}',now() FROM unnest(ARRAY['A00','A34']) a;
    INSERT INTO ai_human_approval_policies(tenant_id,agent_id,action,materiality) SELECT 'tenantA',a,'READ','MATERIAL' FROM unnest(ARRAY['A00','A34']) a;`);
  const db:TransactionalSql={transaction:callback=>pg.transaction(async tx=>callback({query:async(sql,params)=>{const r=await tx.query(sql,params);return {rows:JSON.parse(JSON.stringify(r.rows))};}}))};
  plane=new GovernanceControlPlane({verify:async token=>token==='valid'?{uid:'preparer',tenant_id:'tenantA'}:null},new SqlGovernanceStore(db));
  ledger=new SqlOrchestrationLedger(db);
},30000);
beforeEach(async()=>{
  handler.mockReset();handler.mockImplementation(async c=>result(c));
  await pg.exec(`UPDATE ai_agents SET status='ACTIVE',risk_class='LOW',default_model='test-model',default_model_version='1',prompt_id='test-'||agent_id,prompt_version='1' WHERE agent_id IN ('A00','A34');
    UPDATE ai_agent_versions SET status='ACTIVE',risk_class='LOW',default_model='test-model',default_model_version='1',prompt_id='test-'||agent_id,prompt_version='1',token_budget=1000,cost_budget=1,maximum_retries=1,maximum_execution_time=1 WHERE agent_id IN ('A00','A34');
    UPDATE ai_models SET status='ACTIVE',data_classification_limit='INTERNAL',token_limit=1000,cost_limit=1;
    UPDATE ai_prompts SET status='ACTIVE',risk_class='LOW'; UPDATE ai_tools SET status='ACTIVE',risk_class='LOW',requires_human_approval=false;
    UPDATE ai_agent_permissions SET permission_state='ALLOW',risk_level='LOW',human_approval_required=false,conditions='{}' WHERE agent_id IN ('A00','A34') AND resource='workflow.read' AND action='READ';
    UPDATE ai_agent_data_permissions SET permission_state='ALLOW',conditions='{}' WHERE agent_id IN ('A00','A34') AND data_classification='INTERNAL';
    UPDATE ai_stage_permissions SET permission_state='ALLOW',conditions='{}' WHERE agent_id IN ('A00','A34');
    UPDATE ai_human_approval_policies SET status='ACTIVE'; DELETE FROM ai_kill_switches;
    UPDATE taxguard_members SET role='accountant',status='active' WHERE uid='preparer';
    UPDATE taxguard_cases SET active_stage=3,status='ACTIVE',reviewer_uid='reviewer';
    UPDATE taxguard_case_assignments SET active=true,assigned_at=now(),role='preparer';
    UPDATE taxguard_staff_assignments SET status='ACTIVE',tax_year=2025,effective_from=now(),effective_to=null,role='preparer';
    UPDATE taxguard_documents SET hash='${hash}',version=1,status='RELEASED',quarantine_status='CLEAN';`);
});
afterAll(async()=>{await pg?.close();});

describe('A00 identity, authority and scope: denied operations never invoke handlers',()=>{
  it.each(['','invalid','browser-identity'])('rejects token %s',async token=>denied('AI_AUTH_REQUIRED',request(),token));
  it.each(['client','admin','super_admin','operations','practice_manager','bookkeeper'])('does not elevate %s to A34',async role=>{
    await pg.query("UPDATE taxguard_members SET role=$1 WHERE uid='preparer'",[role]);
    if(['operations','practice_manager','bookkeeper'].includes(role)){
      await pg.query('UPDATE taxguard_case_assignments SET role=$1',[role]);
      await pg.query('UPDATE taxguard_staff_assignments SET role=$1',[role]);
    }
    await denied('AI_ROLE_DENIED');
  });
  it.each(['tenant_id','client_id','tax_case_id','tax_year'])('isolates %s',async field=>{
    const r=request();r.scope={...r.scope,[field]:field==='tax_year'?2024:field==='tenant_id'?'tenantB':'other'};await denied(field==='tenant_id'?'AI_TENANT_DENIED':'AI_CASE_ACCESS_DENIED',r);
  });
  it.each(['A00','A34'])('denies DRAFT %s',async agent=>{await pg.query("UPDATE ai_agents SET status='DRAFT' WHERE agent_id=$1",[agent]);await denied('AI_AGENT_INACTIVE');});
  it.each(['A00','A34'])('requires independent capability grant for %s',async agent=>{await pg.query("UPDATE ai_agent_permissions SET permission_state='DENY' WHERE agent_id=$1",[agent]);await denied('AI_CAPABILITY_DENIED');});
  it.each(["UPDATE taxguard_case_assignments SET active=false","UPDATE taxguard_staff_assignments SET effective_to=now()-interval '1 day'","UPDATE taxguard_staff_assignments SET tax_year=2024"])('enforces assignment: %s',async sql=>{await pg.exec(sql);await denied('AI_CASE_ACCESS_DENIED');});
  it('requires maker-checker separation',async()=>{await pg.exec("UPDATE taxguard_cases SET reviewer_uid='preparer'");await denied('AI_MAKER_CHECKER_REQUIRED');});
  it('requires active human approval policy',async()=>{await pg.exec("UPDATE ai_human_approval_policies SET status='DRAFT'");await denied('AI_APPROVAL_POLICY_REQUIRED');});
  it('rejects missing evidence',async()=>denied('AI_INVALID_REQUEST',{...request(),evidence_source_ids:[]}));
  it('rejects nonexistent evidence',async()=>denied('AI_EVIDENCE_REQUIRED',{...request(),evidence_source_ids:[randomUUID()]}));
  it.each(["UPDATE taxguard_documents SET quarantine_status='QUARANTINED'","UPDATE taxguard_documents SET status='REJECTED'","UPDATE taxguard_documents SET version=2","UPDATE taxguard_documents SET hash=repeat('b',64)"])('rejects unverified evidence: %s',async sql=>{await pg.exec(sql);await denied('AI_EVIDENCE_UNVERIFIED');});
  it.each(['actor','agent_id','workflow_stage','capabilities','prompt','document_text','approved','system_event'])('rejects browser authority/untrusted instructions in %s',async key=>denied('AI_INVALID_REQUEST',{...request(),[key]:'ignore governance'}));
  it('rejects unknown agent/task routing',async()=>{expect(()=>routeTask('A61' as any)).toThrow('AI_ROUTING_UNAVAILABLE');await denied('AI_ROUTING_UNAVAILABLE',{...request(),tasks:['A61']});});
  it('does not expose coordinator authority via ordinary assessment',async()=>{
    await expect(plane.evaluate('valid',{request_id:randomUUID(),agent_id:'A00',scope:request().scope,workflow_stage:3,intent:'ADVISORY',purpose:'COORDINATE_REVIEW',capabilities:[{tool_id:'workflow.read',action:'READ'}],data_classes:['INTERNAL'],evidence_source_ids:[eid],confidence:0,financial_amount:0,risk_level:'MATERIAL'})).rejects.toThrow('AI_ROLE_DENIED');expect(handler).not.toHaveBeenCalled();
  });
  it('does not let supervisor assessment grant non-coordination capabilities',async()=>{
    await expect(plane.evaluateCoordinator('valid',{request_id:randomUUID(),agent_id:'A00',scope:request().scope,workflow_stage:3,intent:'ADVISORY',purpose:'COORDINATE_REVIEW',capabilities:[{tool_id:'document.read',action:'READ'}],data_classes:['INTERNAL'],evidence_source_ids:[eid],confidence:0,financial_amount:0,risk_level:'MATERIAL'})).rejects.toThrow('AI_ROLE_DENIED');expect(handler).not.toHaveBeenCalled();
  });
  it('does not accept specialized identity as supervisor',async()=>{
    await expect(plane.evaluateCoordinator('valid',{request_id:randomUUID(),agent_id:'A34',scope:request().scope,workflow_stage:3,intent:'ADVISORY',purpose:'COORDINATE_REVIEW',capabilities:[{tool_id:'workflow.read',action:'READ'}],data_classes:['INTERNAL'],evidence_source_ids:[eid],confidence:0,financial_amount:0,risk_level:'MATERIAL'})).rejects.toThrow('AI_COORDINATOR_IDENTITY_DENIED');expect(handler).not.toHaveBeenCalled();
  });
});

describe('A00 orchestration and reliability',()=>{
  it('uses canonical routes, authoritative stage, distinct child IDs and minimum context',async()=>{
    const r=request();r.tasks.push('REVIEW_EVIDENCE_COMPLETENESS');const out=await runner().coordinate('valid',r);
    expect(out.children).toHaveLength(2);expect(new Set(out.children.map(c=>c.operation_id)).size).toBe(2);
    expect(out).toMatchObject({human_review_required:true,action_executed:false,external_submission_allowed:false});
    for(const [c] of handler.mock.calls){expect(c.agent_id).toBe('A34');expect(c.workflow_stage).toBe(3);expect(c.root_id).toBe(out.root_id);expect(Object.isFrozen(c.scope)).toBe(true);expect(c).not.toHaveProperty('token');expect(c).not.toHaveProperty('document_text');}
    expect(out.children.every(c=>c.decision.required_human_roles.join(',')==='PREPARER,REVIEWER,CPA_EA')).toBe(true);
  });
  it('records scope resolution failure without dispatch rather than using memory',async()=>{
    const r=request();r.scope.tax_case_id='memory-only';await denied('AI_CASE_ACCESS_DENIED',r);
  });
  it('has no default production handler path even with eligible fixtures',async()=>{
    await expect(new A00Orchestrator(plane,ledger).coordinate('valid',request())).rejects.toThrow('AI_DISPATCH_UNAVAILABLE');expect(handler).not.toHaveBeenCalled();
  });
  it('forbids installing test handlers outside test runtime',()=>{
    const previous=process.env.NODE_ENV;try{process.env.NODE_ENV='production';expect(()=>runner()).toThrow('AI_TEST_EXECUTION_FORBIDDEN');}finally{process.env.NODE_ENV=previous;}
  });
  it('rejects identical and changed root replay',async()=>{
    const r=request();await runner().coordinate('valid',r);await expect(runner().coordinate('valid',r)).rejects.toThrow('AI_REPLAY_DENIED');
    await expect(runner().coordinate('valid',{...r,tasks:['REVIEW_EVIDENCE_COMPLETENESS']})).rejects.toThrow('AI_REPLAY_MISMATCH');expect(handler).toHaveBeenCalledTimes(1);
  });
  it('prevents concurrent duplicate root execution',async()=>{
    const r=request();const outcomes=await Promise.allSettled([runner().coordinate('valid',r),runner().coordinate('valid',r)]);
    expect(outcomes.filter(o=>o.status==='fulfilled')).toHaveLength(1);expect(handler).toHaveBeenCalledTimes(1);
  });
  it('records dependency errors without exposing error contents',async()=>{
    const h=vi.fn(async()=>{throw new Error('private taxpayer/provider detail');});await expect(runner(h).coordinate('valid',request())).rejects.toThrow('AI_DEPENDENCY_FAILED');expect(h).toHaveBeenCalledTimes(1);
    const rows=await pg.query("SELECT reason_code FROM ai_orchestration_events WHERE reason_code='AI_DEPENDENCY_FAILED'");expect(rows.rows.length).toBeGreaterThan(0);
  });
  it('bounds retry and rechecks governance with stable operation identity',async()=>{
    const h=vi.fn<AdvisoryHandler>(async c=>{if(c.attempt===0)throw new RetryableAdvisoryError();return result(c);});await runner(h).coordinate('valid',request());
    expect(h).toHaveBeenCalledTimes(2);expect(h.mock.calls[0][0].operation_id).toBe(h.mock.calls[1][0].operation_id);expect(h.mock.calls[1][0].attempt).toBe(1);
  });
  it('stops persistent failure at retry limit',async()=>{
    const h=vi.fn<AdvisoryHandler>(async()=>{throw new RetryableAdvisoryError();});await expect(runner(h).coordinate('valid',request())).rejects.toThrow('AI_DEPENDENCY_FAILED');expect(h).toHaveBeenCalledTimes(2);
  });
  it('honors zero authoritative retries',async()=>{
    await pg.exec("UPDATE ai_agent_versions SET maximum_retries=0 WHERE agent_id='A34'");const h=vi.fn<AdvisoryHandler>(async()=>{throw new RetryableAdvisoryError();});await expect(runner(h).coordinate('valid',request())).rejects.toThrow('AI_DEPENDENCY_FAILED');expect(h).toHaveBeenCalledTimes(1);
  });
  it('times out without retrying or accepting late output',async()=>{
    const h=vi.fn<AdvisoryHandler>((c,signal)=>new Promise(resolve=>{signal.addEventListener('abort',()=>setTimeout(()=>resolve(result(c)),10));}));
    await expect(runner(h,ledger,10).coordinate('valid',request())).rejects.toThrow('AI_OPERATION_TIMED_OUT');expect(h).toHaveBeenCalledTimes(1);
  });
  it('pre-cancelled work never invokes handler',async()=>{const abort=new AbortController();abort.abort();await expect(runner().coordinate('valid',request(),abort.signal)).rejects.toThrow('AI_OPERATION_CANCELLED');expect(handler).not.toHaveBeenCalled();});
  it('propagates cancellation to an active handler',async()=>{
    const abort=new AbortController();const h=vi.fn<AdvisoryHandler>((_c,signal)=>new Promise(()=>{expect(signal.aborted).toBe(false);abort.abort();}));await expect(runner(h).coordinate('valid',request(),abort.signal)).rejects.toThrow('AI_OPERATION_CANCELLED');expect(h).toHaveBeenCalledTimes(1);
  });
  it.each(['GLOBAL','AGENT','MODEL','TOOL','WORKFLOW'])('honors %s kill switch before dispatch',async scope=>{
    const columns=scope==='AGENT'?",agent_id":scope==='MODEL'?",model_id,model_version":scope==='TOOL'?",tool_id":scope==='WORKFLOW'?",workflow_version,workflow_stage":'';
    const values=scope==='AGENT'?",'A34'":scope==='MODEL'?",'test-model','1'":scope==='TOOL'?",'workflow.read'":scope==='WORKFLOW'?",'LEGACY_18_V1',3":'';
    const target=scope==='GLOBAL'?'GLOBAL':scope==='AGENT'?'A34':scope==='MODEL'?'test-model@1':scope==='TOOL'?'workflow.read':'LEGACY_18_V1:3';
    await pg.exec(`INSERT INTO ai_kill_switches(tenant_id,scope,target,enabled,reason,activated_by,activated_at${columns})VALUES('tenantA','${scope}','${target}',true,'Isolated safety test','preparer',now()${values})`);await denied('AI_KILL_SWITCH_ACTIVE');
  });
  it('blocks acceptance and downstream dispatch when kill switch changes mid-operation',async()=>{
    const h=vi.fn<AdvisoryHandler>(async c=>{await pg.exec("INSERT INTO ai_kill_switches(tenant_id,scope,target,enabled,reason,activated_by,activated_at)VALUES('tenantA','GLOBAL','GLOBAL',true,'Isolated safety test','preparer',now())");return result(c);});
    const r=request();r.tasks.push('REVIEW_EVIDENCE_COMPLETENESS');await expect(runner(h).coordinate('valid',r)).rejects.toThrow('AI_KILL_SWITCH_ACTIVE');expect(h).toHaveBeenCalledTimes(1);
  });
  it('does not inherit a parent or sibling authorization',async()=>{
    const h=vi.fn<AdvisoryHandler>(async c=>{await pg.exec("UPDATE ai_agent_permissions SET permission_state='DENY' WHERE agent_id='A34'");return result(c);});
    await expect(runner(h).coordinate('valid',request())).rejects.toThrow('AI_CAPABILITY_DENIED');expect(h).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["INSERT INTO ai_kill_switches(tenant_id,scope,target,enabled,reason,activated_by,activated_at)VALUES('tenantA','GLOBAL','GLOBAL',true,'Isolated safety test','preparer',now())",'AI_KILL_SWITCH_ACTIVE'],
    ["UPDATE taxguard_case_assignments SET active=false",'AI_CASE_ACCESS_DENIED'],
    ["UPDATE taxguard_cases SET active_stage=4",'AI_WORKFLOW_MISMATCH'],
    ["UPDATE ai_agent_permissions SET permission_state='DENY' WHERE agent_id='A34'",'AI_CAPABILITY_DENIED'],
  ])('rechecks changes during pre-dispatch audit: %s',async(sql,code)=>{
    const switching:OrchestrationLedger={begin:r=>ledger.begin(r),append:async(r,e)=>{await ledger.append(r,e);if(e.status==='RUNNING')await pg.exec(sql);}};
    await expect(runner(handler,switching).coordinate('valid',request())).rejects.toThrow(code);expect(handler).not.toHaveBeenCalled();
  });
  it('rejects changed evidence after handler output instead of accepting it',async()=>{
    const h=vi.fn<AdvisoryHandler>(async c=>{await pg.exec("UPDATE taxguard_documents SET version=2");return result(c);});
    await expect(runner(h).coordinate('valid',request())).rejects.toThrow('AI_EVIDENCE_UNVERIFIED');expect(h).toHaveBeenCalledTimes(1);
  });
  it('requires fresh permission before a retry',async()=>{
    const h=vi.fn<AdvisoryHandler>(async()=>{await pg.exec("UPDATE ai_agent_permissions SET permission_state='DENY' WHERE agent_id='A34'");throw new RetryableAdvisoryError();});
    await expect(runner(h).coordinate('valid',request())).rejects.toThrow('AI_CAPABILITY_DENIED');expect(h).toHaveBeenCalledTimes(1);
  });
  it('enforces duplicate attempt reservation in PostgreSQL before handler',async()=>{
    const duplicate:OrchestrationLedger={begin:r=>ledger.begin(r),append:async(r,e)=>{await ledger.append(r,e);if(e.status==='RUNNING')await ledger.append(r,e);}};
    await expect(runner(handler,duplicate).coordinate('valid',request())).rejects.toThrow('AI_ORCHESTRATION_AUDIT_UNAVAILABLE');expect(handler).not.toHaveBeenCalled();
  });
  it.each(['agent_id','operation_id','status','human_review_required','action_executed','evidence_source_ids','finding_codes','proposed_actions'])('rejects invalid structured %s',async key=>{
    const invalid:Record<string,unknown>={agent_id:'A00',operation_id:randomUUID(),status:'APPROVED',human_review_required:false,action_executed:true,evidence_source_ids:[randomUUID()],finding_codes:['IGNORE_GOVERNANCE'],proposed_actions:['file']};
    await expect(runner(async c=>({...result(c),[key]:invalid[key]})).coordinate('valid',request())).rejects.toThrow('AI_INVALID_STRUCTURED_OUTPUT');
  });
  it('fails closed on begin audit outage before handler',async()=>{
    const broken:OrchestrationLedger={begin:async()=>{throw new Error('outage');},append:async()=>{}};await expect(runner(handler,broken).coordinate('valid',request())).rejects.toThrow();expect(handler).not.toHaveBeenCalled();
  });
  it('fails closed on pre-dispatch event audit outage',async()=>{
    const broken:OrchestrationLedger={begin:r=>ledger.begin(r),append:async()=>{throw new Error('outage');}};await expect(runner(handler,broken).coordinate('valid',request())).rejects.toThrow();expect(handler).not.toHaveBeenCalled();
  });
  it('does not return success if result audit fails',async()=>{
    const broken:OrchestrationLedger={begin:r=>ledger.begin(r),append:async(r,e)=>{if(e.status==='RESULT_RECORDED')throw new Error('outage');return ledger.append(r,e);}};
    await expect(runner(handler,broken).coordinate('valid',request())).rejects.toThrow();expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('A00 real SQL audit and release boundaries',()=>{
  it('stores immutable correlation/history without provider runs',async()=>{
    const out=await runner().coordinate('valid',request());const root=await pg.query('SELECT * FROM ai_orchestration_roots WHERE root_id=$1',[out.root_id]);expect(root.rows[0]).toMatchObject({tenant_id:'tenantA',actor_uid:'preparer',workflow_stage:3,human_review_required:true,action_executed:false});
    const events=await pg.query<{status:string}>('SELECT status FROM ai_orchestration_events WHERE root_id=$1',[out.root_id]);expect(events.rows.map(e=>e.status)).toEqual(['PLANNED','AUTHORIZED','RUNNING','RESULT_RECORDED','COMPLETED']);
    await expect(pg.query('DELETE FROM ai_orchestration_roots WHERE root_id=$1',[out.root_id])).rejects.toThrow();await expect(pg.query("UPDATE ai_orchestration_events SET reason_code='AI_CHANGED' WHERE root_id=$1",[out.root_id])).rejects.toThrow();
    expect((await pg.query<{n:number}>('SELECT count(*)::int AS n FROM ai_runs')).rows[0].n).toBe(0);
  });
  it('rejects cross-actor/orphan event linkage and terminal history additions',async()=>{
    const out=await runner().coordinate('valid',request());
    await expect(pg.query("INSERT INTO ai_orchestration_events(root_id,tenant_id,actor_uid,agent_id,attempt,status,reason_code)VALUES($1,'tenantA','reviewer','A00',0,'FAILED','AI_TEST')",[out.root_id])).rejects.toThrow();
    await expect(pg.query("INSERT INTO ai_orchestration_events(root_id,tenant_id,actor_uid,agent_id,attempt,status,reason_code)VALUES($1,'tenantA','preparer','A00',0,'FAILED','AI_TEST')",[randomUUID()])).rejects.toThrow();
  });
  it('records denied scope against trusted tenant without foreign client claims',async()=>{
    const r=request();r.scope.tenant_id='tenantB';await denied('AI_TENANT_DENIED',r);
    const rows=await pg.query<{tenant_id:string;actor_uid:string;client_id:string|null;case_record_id:string|null}>("SELECT tenant_id,actor_uid,client_id,case_record_id FROM ai_governance_decisions WHERE reason_code='AI_TENANT_DENIED'");expect(rows.rows.length).toBeGreaterThan(0);expect(rows.rows.every(r=>r.tenant_id==='tenantA'&&r.actor_uid==='preparer'&&r.client_id===null&&r.case_record_id===null)).toBe(true);
  });
  it('enables/forces RLS and denies end-user access even with temporary table grants',async()=>{
    const tables=await pg.query<{relname:string;relrowsecurity:boolean;relforcerowsecurity:boolean}>("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname IN ('ai_orchestration_roots','ai_orchestration_events')");expect(tables.rows).toHaveLength(2);expect(tables.rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity)).toBe(true);
    await pg.exec('GRANT SELECT ON ai_orchestration_roots,ai_orchestration_events TO authenticated; SET ROLE authenticated;');
    try{expect((await pg.query('SELECT * FROM ai_orchestration_roots')).rows).toEqual([]);await expect(pg.query('DELETE FROM ai_orchestration_events')).rejects.toThrow();}finally{await pg.exec('RESET ROLE; REVOKE SELECT ON ai_orchestration_roots,ai_orchestration_events FROM authenticated;');}
  });
  it('preserves DRAFT seeds and legacy cutover refusal',()=>{
    const sql=fs.readFileSync('supabase/migrations/20261008020000_taxguard_ai_orchestration_history.sql','utf8');expect(sql).not.toMatch(/UPDATE ai_agents|INSERT INTO ai_runs|INSERT INTO ai_models|INSERT INTO ai_prompts/);
    const legacy=fs.readFileSync('src/server/ai/governance/legacyCompatibility.ts','utf8');expect(legacy).toContain('AI_LEGACY_CUTOVER_REQUIRED');expect(legacy).toContain('AI_LEGACY_EVIDENCE_MAPPING_REQUIRED');
  });
  it.each(['A01','A02','A03','A04','A12','A13','A14','A15','A16','A18','A19','A28','A30','A31',...Array.from({length:25},(_,i)=>`A${i+36}`),'SIGN_RETURN','FILE_RETURN','TRANSMIT_PAYMENT','CONTACT_CLIENT','DISABLE_GOVERNANCE','FEDERAL_TAX_ANALYSIS','STATE_TAX_ANALYSIS','CALCULATION_VERIFICATION','FORM_MAPPING','TAX_DIAGNOSTICS','CLIENT_ONBOARDING','CLIENT_VERIFICATION','CLIENT_ENGAGEMENT','CLIENT_COMMUNICATION'])('refuses unmapped routing %s before any handler',async task=>{
    await expect(runner().coordinate('valid',{...request(),tasks:[task]})).rejects.toThrow('AI_ROUTING_UNAVAILABLE');
    expect(handler).not.toHaveBeenCalled();
    expect((await pg.query<{n:number}>('SELECT count(*)::int AS n FROM ai_runs')).rows[0].n).toBe(0);
  });
});
