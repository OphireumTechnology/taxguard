import { beforeAll,beforeEach,afterAll,describe,it,expect,vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { GovernanceControlPlane } from '../server/ai/governance/GovernanceControlPlane';
import { SqlGovernanceStore,type TransactionalSql } from '../server/ai/governance/SqlGovernanceStore';
import { SqlOrchestrationLedger } from '../server/ai/orchestration/SqlOrchestrationLedger';
import { A00Orchestrator } from '../server/ai/orchestration/A00Orchestrator';
import type { ChildContext,OrchestrationLedger } from '../server/ai/orchestration/contracts';
import { GovernedAIGateway } from '../server/ai/gateway/GovernedAIGateway';
import { ModelPromptResolver } from '../server/ai/gateway/ModelPromptResolver';
import { SqlGatewayStore } from '../server/ai/gateway/SqlGatewayStore';
import { COUNTS_REVIEW_SCHEMA } from '../server/ai/gateway/structuredOutput';
import { createA00GatewayHandler } from '../server/ai/gateway/a00GatewayBoundary';
import { OpenAIProviderAdapter } from '../server/ai/gateway/OpenAIProviderAdapter';
import { ProviderNotSentError,type GatewayStore,type ProviderResponse,type ProviderRequest } from '../server/ai/gateway/contracts';

const cid='11111111-1111-4111-8111-111111111111',did='22222222-2222-4222-8222-222222222222',eid='33333333-3333-4333-8333-333333333333',hash='a'.repeat(64);
const scope={tenant_id:'tenantA',client_id:'clientA',tax_case_id:'caseA',tax_year:2025};
let pg:PGlite,plane:GovernanceControlPlane,resolver:ModelPromptResolver,store:SqlGatewayStore,ledger:SqlOrchestrationLedger,index=0,modelId:string,version:string;
const response=():ProviderResponse=>({status:'completed',text:JSON.stringify({status:'ADVISORY',confidence:'UNVERIFIED',finding_codes:['REVIEW_REQUIRED']}),usage:{input_tokens:100,output_tokens:50,total_tokens:150}});
const provider=vi.fn<(request:Readonly<ProviderRequest>,signal:AbortSignal)=>Promise<ProviderResponse>>(async()=>response()),tools=vi.fn();
const gateway=(s:GatewayStore=store)=>new GovernedAIGateway(resolver,s,{TEST:{provider:'TEST',invoke:provider}});
const req=(agent='A34',purpose='IDENTIFY_REVIEW_QUESTIONS')=>({request_id:randomUUID(),agent_id:agent,scope:{...scope},workflow_stage:3,intent:'ADVISORY' as const,purpose,capabilities:[{tool_id:'workflow.read',action:'READ' as const}],data_classes:['INTERNAL' as const],evidence_source_ids:[eid],confidence:0,financial_amount:0,risk_level:'MATERIAL' as const});
async function context():Promise<ChildContext>{
  const parent=await plane.evaluateCoordinator('valid',req('A00','COORDINATE_REVIEW'));
  const child=await plane.evaluate('valid',req());const root_id=randomUUID(),operation_id=randomUUID();
  const root={root_id,identity:{uid:'preparer',tenant_id:'tenantA'},scope:{...scope},case_record_id:cid,workflow_stage:3,request_key:randomUUID().replaceAll('-','').padEnd(64,'a'),input_hash:hash,coordinator_decision_id:parent.decision_id};
  await ledger.begin(root);
  await ledger.append(root,{operation_id:null,agent_id:'A00',attempt:0,status:'PLANNED',purpose:null,decision_id:null,reason_code:'AI_ISOLATED_FIXTURE',output_hash:null});
  await ledger.append(root,{operation_id,agent_id:'A34',attempt:0,status:'RUNNING',purpose:'IDENTIFY_REVIEW_QUESTIONS',decision_id:child.decision_id,reason_code:'AI_ISOLATED_FIXTURE',output_hash:null});
  return {root_id,operation_id,agent_id:'A34',attempt:0,decision_id:child.decision_id,scope:{...scope},workflow_stage:3,purpose:'IDENTIFY_REVIEW_QUESTIONS',evidence_source_ids:[eid]};
}
const denial=async(c:unknown,code:string,token='valid')=>{await expect(gateway().execute(token,c as ChildContext)).rejects.toThrow(code);expect(provider).not.toHaveBeenCalled();expect(tools).not.toHaveBeenCalled();};

beforeAll(async()=>{
  pg=new PGlite();await pg.exec(`CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
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
    INSERT INTO ai_human_approval_policies(tenant_id,agent_id,action,materiality)SELECT 'tenantA',a,'READ','MATERIAL' FROM unnest(ARRAY['A00','A34']) a;`);
  const db:TransactionalSql={transaction:callback=>pg.transaction(async tx=>callback({query:async(sql,params)=>{const r=await tx.query(sql,params);return {rows:JSON.parse(JSON.stringify(r.rows))};}}))};
  plane=new GovernanceControlPlane({verify:async token=>token==='valid'?{uid:'preparer',tenant_id:'tenantA'}:null},new SqlGovernanceStore(db));resolver=new ModelPromptResolver(plane);store=new SqlGatewayStore(db);ledger=new SqlOrchestrationLedger(db);
},30000);
beforeEach(async()=>{
  provider.mockReset();provider.mockImplementation(async()=>response());tools.mockReset();index++;modelId=`isolated-model-${index}`;version=`isolated-${index}`;
  await pg.exec(`INSERT INTO ai_models(model_id,model_version,provider,status,effective_date,approved_use_cases,data_classification_limit,token_limit,cost_limit)VALUES('${modelId}','1','TEST','ACTIVE',now(),ARRAY['COORDINATE_REVIEW','IDENTIFY_REVIEW_QUESTIONS','REVIEW_EVIDENCE_COMPLETENESS'],'INTERNAL',100000,1);
    INSERT INTO ai_prompts(agent_id,prompt_id,version,status,system_instructions,expected_output_schema,effective_date)SELECT a,'test-'||a||'-${index}','1','ACTIVE','Synthetic isolated instructions','${JSON.stringify(COUNTS_REVIEW_SCHEMA)}',now() FROM unnest(ARRAY['A00','A34']) a;
    INSERT INTO ai_agent_versions(agent_id,version,status,risk_class,default_model,default_model_version,prompt_id,prompt_version,schema_version,token_budget,cost_budget,maximum_retries,maximum_execution_time)SELECT a,'${version}','ACTIVE','LOW','${modelId}','1','test-'||a||'-${index}','1','1',100000,1,1,1 FROM unnest(ARRAY['A00','A34']) a;
    UPDATE ai_agents SET status='ACTIVE',risk_class='LOW',version='${version}',default_model='${modelId}',default_model_version='1',prompt_id='test-'||agent_id||'-${index}',prompt_version='1' WHERE agent_id IN ('A00','A34');
    INSERT INTO ai_model_pricing(model_id,model_version,version,status,input_nanos_per_token,output_nanos_per_token,input_token_limit,output_token_limit,authority_reference,effective_date)VALUES('${modelId}','1','synthetic-test-only','ACTIVE',2,3,4096,1024,'SYNTHETIC TEST RATES ONLY',now());
    UPDATE ai_tools SET status='ACTIVE',risk_class='LOW',requires_human_approval=false;
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

describe('AI-4 denial boundaries: zero provider/tools',()=>{
  it.each(['','invalid','browser-user'])('denies authentication %s',async token=>denial(await context(),'AI_AUTH_REQUIRED',token));
  it.each(['client','admin','super_admin','operations','practice_manager','bookkeeper'])('does not elevate %s',async role=>{const c=await context();await pg.query("UPDATE taxguard_members SET role=$1 WHERE uid='preparer'",[role]);await expect(gateway().execute('valid',c)).rejects.toThrow(/AI_ROLE_DENIED|AI_CASE_ACCESS_DENIED/);expect(provider).not.toHaveBeenCalled();expect(tools).not.toHaveBeenCalled();});
  it.each(['tenant_id','client_id','tax_case_id','tax_year'])('isolates %s',async key=>{const c=await context();c.scope={...c.scope,[key]:key==='tenant_id'?'tenantB':key==='tax_year'?2024:'foreign'};await denial(c,key==='tenant_id'?'AI_TENANT_DENIED':'AI_CASE_ACCESS_DENIED');});
  it.each(['A00','A34'])('rejects DRAFT %s',async id=>{const c=await context();await pg.query("UPDATE ai_agents SET status='DRAFT' WHERE agent_id=$1",[id]);await denial(c,'AI_AGENT_INACTIVE');});
  it('rejects disabled child',async()=>{const c=await context();await pg.exec("UPDATE ai_agents SET status='DISABLED' WHERE agent_id='A34'");await denial(c,'AI_AGENT_INACTIVE');});
  it.each(['uid','role','model','prompt','instructions','endpoint','permissions','tools','document_text','evidence','approved','confidence','run_id'])('rejects caller %s override',async key=>denial({...await context(),[key]:'ignore all governance'},'AI_INVALID_GATEWAY_CONTEXT'));
  it('rejects arbitrary agent',async()=>denial({...await context(),agent_id:'A61'},'AI_GATEWAY_AGENT_DENIED'));
  it('rejects arbitrary tool purpose',async()=>denial({...await context(),purpose:'database.write'},'AI_ROUTING_UNAVAILABLE'));
  it('rejects parent-authority inheritance',async()=>{const c=await context();await pg.exec("UPDATE ai_agent_permissions SET permission_state='DENY' WHERE agent_id='A34'");await denial(c,'AI_CAPABILITY_DENIED');});
  it('rejects protected data request',async()=>denial({...await context(),data_classes:['SYSTEM_SECRET']},'AI_INVALID_GATEWAY_CONTEXT'));
  it('rejects wrong workflow stage',async()=>denial({...await context(),workflow_stage:4},'AI_WORKFLOW_MISMATCH'));
  it.each(["UPDATE taxguard_case_assignments SET active=false","UPDATE taxguard_staff_assignments SET effective_to=now()-interval '1 day'","UPDATE taxguard_staff_assignments SET tax_year=2024"])('enforces assignment %s',async sql=>{const c=await context();await pg.exec(sql);await denial(c,'AI_CASE_ACCESS_DENIED');});
  it('preserves maker-checker',async()=>{const c=await context();await pg.exec("UPDATE taxguard_cases SET reviewer_uid='preparer'");await denial(c,'AI_MAKER_CHECKER_REQUIRED');});
  it('requires human policy',async()=>{const c=await context();await pg.exec("UPDATE ai_human_approval_policies SET status='DRAFT'");await denial(c,'AI_APPROVAL_POLICY_REQUIRED');});
  it('requires evidence',async()=>denial({...await context(),evidence_source_ids:[randomUUID()]},'AI_EVIDENCE_REQUIRED'));
  it.each(["UPDATE taxguard_documents SET version=2","UPDATE taxguard_documents SET quarantine_status='QUARANTINED'","UPDATE taxguard_documents SET status='REJECTED'"])('rejects unsafe evidence %s',async sql=>{const c=await context();await pg.exec(sql);await denial(c,'AI_EVIDENCE_UNVERIFIED');});
  it('denies forged root despite valid governance',async()=>denial({...await context(),root_id:randomUUID()},'AI_GATEWAY_CORRELATION_REQUIRED'));
  it('denies forged child despite valid governance',async()=>denial({...await context(),operation_id:randomUUID()},'AI_GATEWAY_CORRELATION_REQUIRED'));
  it('denies forged assessment identity rather than treating it as a permit',async()=>denial({...await context(),decision_id:randomUUID()},'AI_GATEWAY_CORRELATION_REQUIRED'));
  it('requires pricing authority',async()=>{const c=await context();await pg.query("UPDATE ai_model_pricing SET status='DRAFT' WHERE model_id=$1",[modelId]);await denial(c,'AI_PRICING_UNAVAILABLE');});
  it('rejects future-effective pricing',async()=>{const c=await context();await pg.query("UPDATE ai_model_pricing SET effective_date=now()+interval '1 day' WHERE model_id=$1",[modelId]);await denial(c,'AI_PRICING_UNAVAILABLE');});
  it('rejects denied workflow-stage permission',async()=>{const c=await context();await pg.exec("UPDATE ai_stage_permissions SET permission_state='DENY' WHERE agent_id='A34'");await denial(c,'AI_STAGE_DENIED');});
  it('rejects model configuration needing unapproved taxpayer content',async()=>{const c=await context();await pg.query("UPDATE ai_prompts SET required_inputs='[\"document_text\"]' WHERE prompt_id=$1",[`test-A34-${index}`]);await denial(c,'AI_PROMPT_INPUT_UNSUPPORTED');});
  it('does not admit an outer retry as a new transport run',async()=>denial({...await context(),attempt:1},'AI_INVALID_GATEWAY_CONTEXT'));
  it('rejects unsupported trusted schema before transport',async()=>{const c=await context();await pg.query("UPDATE ai_prompts SET expected_output_schema='{}'::jsonb || '{\"type\":\"object\"}'::jsonb WHERE prompt_id=$1",[`test-A34-${index}`]);await denial(c,'AI_OUTPUT_SCHEMA_UNSUPPORTED');});
  it('rejects zero configuration budgets',async()=>{const c=await context();await pg.query("UPDATE ai_agent_versions SET token_budget=0 WHERE agent_id='A34' AND version=$1",[version]);await denial(c,'AI_BUDGET_UNAVAILABLE');});
  it('denies cost budget exhaustion',async()=>{const c=await context();await pg.query("UPDATE ai_agent_versions SET cost_budget=0.00000001 WHERE agent_id='A34' AND version=$1",[version]);await denial(c,'AI_BUDGET_EXHAUSTED');});
});

describe('AI-4 execution, accounting and reliability',()=>{
  it('commits run/attempt before counts-only transport and preserves provenance',async()=>{
    const c=await context();provider.mockImplementation(async()=>{expect((await pg.query("SELECT run_id FROM ai_runs WHERE request_id=$1 AND status='RUNNING'",[`gateway_${c.operation_id}`])).rows).toHaveLength(1);return response();});
    const out=await gateway().execute('valid',c);expect(out).toMatchObject({status:'ADVISORY',human_review_required:true,action_executed:false,external_submission_allowed:false,usage:{state:'KNOWN',total_tokens:150,cost_nanos:'350'}});
    expect(out.provenance).toMatchObject({model:modelId,model_version:'1',prompt_version:'1',evidence_source_ids:[eid]});
    const sent=provider.mock.calls[0][0] as any;expect(sent.model).toBe(modelId);expect(sent.input).toEqual({purpose:c.purpose,taxYear:2025,evidenceCount:1});expect(sent).not.toHaveProperty('tools');expect(JSON.stringify(sent)).not.toContain(eid);expect(JSON.stringify(sent)).not.toContain('clientA');expect(tools).not.toHaveBeenCalled();
  });
  it('preserves all unknown fields as NULL and blocks further budget admission',async()=>{
    const c=await context(),second=await context();provider.mockImplementation(async()=>({...response(),usage:null}));await expect(gateway().execute('valid',c)).rejects.toThrow('AI_USAGE_UNKNOWN');
    const run=await pg.query<{token_usage:number|null;estimated_cost:string|null}>('SELECT token_usage,estimated_cost FROM ai_runs WHERE request_id=$1',[`gateway_${c.operation_id}`]);expect(run.rows[0]).toEqual({token_usage:null,estimated_cost:null});
    await expect(gateway().execute('valid',second)).rejects.toThrow('AI_USAGE_UNRESOLVED');expect(provider).toHaveBeenCalledTimes(1);expect(tools).not.toHaveBeenCalled();
  });
  it('rejects inconsistent usage instead of fabricating zero',async()=>{provider.mockImplementation(async()=>({...response(),usage:{input_tokens:100,output_tokens:50,total_tokens:1}}));await expect(gateway().execute('valid',await context())).rejects.toThrow('AI_USAGE_UNKNOWN');});
  it('rejects provider budget overrun but preserves measured usage',async()=>{provider.mockImplementation(async()=>({...response(),usage:{input_tokens:5000,output_tokens:10,total_tokens:5010}}));await expect(gateway().execute('valid',await context())).rejects.toThrow('AI_PROVIDER_BUDGET_EXCEEDED');});
  it.each(['refused','incomplete'])('fails on %s',async status=>{provider.mockImplementation(async()=>({...response(),status:status as 'refused'}));await expect(gateway().execute('valid',await context())).rejects.toThrow(status==='refused'?'AI_PROVIDER_REFUSED':'AI_PROVIDER_INCOMPLETE');expect(provider).toHaveBeenCalledTimes(1);});
  it('retains refusal state when provider usage is unknown',async()=>{provider.mockImplementation(async()=>({...response(),status:'refused',usage:null}));await expect(gateway().execute('valid',await context())).rejects.toThrow('AI_PROVIDER_REFUSED');expect(provider).toHaveBeenCalledTimes(1);});
  it('does not silently use a configured fallback after failure',async()=>{
    await pg.query("INSERT INTO ai_models(model_id,model_version,provider,effective_date)VALUES($1,'1','TEST',now())",[`${modelId}-fallback`]);
    await pg.query("UPDATE ai_models SET fallback_model=$2,fallback_model_version='1' WHERE model_id=$1",[modelId,`${modelId}-fallback`]);
    provider.mockImplementation(async()=>{throw new Error('ambiguous');});await expect(gateway().execute('valid',await context())).rejects.toThrow('AI_PROVIDER_FAILURE');expect(provider).toHaveBeenCalledTimes(1);expect(provider.mock.calls[0][0].model).toBe(modelId);
  });
  it.each(['{','null','[]',JSON.stringify({status:'APPROVED',confidence:0.99,finding_codes:['NO_FINDING']}),JSON.stringify({status:'ADVISORY',confidence:'UNVERIFIED',finding_codes:['REVIEW_REQUIRED'],evidence:[eid]}),JSON.stringify({status:'ADVISORY',confidence:'UNVERIFIED',finding_codes:['FILE_RETURN']}),JSON.stringify({status:'ADVISORY',confidence:'UNVERIFIED',finding_codes:['REVIEW_REQUIRED'],authority:'invented IRS rule'})])('rejects malformed/unsafe output %s',async text=>{provider.mockImplementation(async()=>({...response(),text}));await expect(gateway().execute('valid',await context())).rejects.toThrow('AI_INVALID_STRUCTURED_OUTPUT');expect(tools).not.toHaveBeenCalled();});
  it('rejects identical and concurrent replay without a second provider call',async()=>{const c=await context();const results=await Promise.allSettled([gateway().execute('valid',c),gateway().execute('valid',c)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(provider).toHaveBeenCalledTimes(1);expect(tools).not.toHaveBeenCalled();});
  it('reserves model budget across concurrent children',async()=>{
    const c=await context(),second=await context();await pg.query('UPDATE ai_models SET token_limit=5120 WHERE model_id=$1',[modelId]);
    let release:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve;});provider.mockImplementation(async()=>{await blocked;return response();});
    const first=gateway().execute('valid',c);while(provider.mock.calls.length===0)await new Promise(r=>setTimeout(r,1));
    await expect(gateway().execute('valid',second)).rejects.toThrow('AI_BUDGET_EXHAUSTED');release();await first;expect(provider).toHaveBeenCalledTimes(1);expect(tools).not.toHaveBeenCalled();
  });
  it('retries only conclusively not-sent transport with distinct attempt IDs',async()=>{provider.mockImplementationOnce(async()=>{throw new ProviderNotSentError();});const out=await gateway().execute('valid',await context());expect(provider).toHaveBeenCalledTimes(2);const rows=await pg.query<{attempt_id:string}>('SELECT attempt_id FROM ai_gateway_attempts WHERE run_id=$1',[out.run_id]);expect(new Set(rows.rows.map(r=>r.attempt_id)).size).toBe(2);});
  it('bounds persistent not-sent failure',async()=>{provider.mockImplementation(async()=>{throw new ProviderNotSentError();});await expect(gateway().execute('valid',await context())).rejects.toThrow('AI_PROVIDER_NOT_SENT');expect(provider).toHaveBeenCalledTimes(2);});
  it('never retries ambiguous provider failure',async()=>{provider.mockImplementation(async()=>{throw new Error('SECRET provider body');});await expect(gateway().execute('valid',await context())).rejects.toThrow('AI_PROVIDER_FAILURE');expect(provider).toHaveBeenCalledTimes(1);});
  it('times out without accepting late output or retrying',async()=>{const c=await context();provider.mockImplementation(()=>new Promise(()=>{}));await expect(gateway().execute('valid',c)).rejects.toThrow('AI_PROVIDER_TIMEOUT');expect(provider).toHaveBeenCalledTimes(1);});
  it('pre-cancelled work has zero calls',async()=>{const c=await context(),abort=new AbortController();abort.abort();await expect(gateway().execute('valid',c,abort.signal)).rejects.toThrow('AI_OPERATION_CANCELLED');expect(provider).not.toHaveBeenCalled();expect(tools).not.toHaveBeenCalled();});
  it('cancels active transport without retry',async()=>{const c=await context(),abort=new AbortController();provider.mockImplementation(async()=>{abort.abort();return response();});await expect(gateway().execute('valid',c,abort.signal)).rejects.toThrow('AI_OPERATION_CANCELLED');expect(provider).toHaveBeenCalledTimes(1);});
});

describe('AI-4 kills, persistence and A00 boundary',()=>{
  const kill=async(scopeType:string)=>{
    const columns=scopeType==='AGENT'?",agent_id":scopeType==='MODEL'?",model_id,model_version":scopeType==='TOOL'?",tool_id":scopeType==='WORKFLOW'?",workflow_version,workflow_stage":'';
    const values=scopeType==='AGENT'?",'A34'":scopeType==='MODEL'?`, '${modelId}','1'`:scopeType==='TOOL'?",'workflow.read'":scopeType==='WORKFLOW'?",'LEGACY_18_V1',3":'';
    const target=scopeType==='GLOBAL'?'GLOBAL':scopeType==='AGENT'?'A34':scopeType==='MODEL'?`${modelId}@1`:scopeType==='TOOL'?'workflow.read':'LEGACY_18_V1:3';
    await pg.exec(`INSERT INTO ai_kill_switches(tenant_id,scope,target,enabled,reason,activated_by,activated_at${columns})VALUES('tenantA','${scopeType}','${target}',true,'Isolated safety test','preparer',now()${values})`);
  };
  it.each(['GLOBAL','AGENT','MODEL','TOOL','WORKFLOW'])('denies %s kill switch with zero calls',async type=>{const c=await context();await kill(type);await denial(c,'AI_KILL_SWITCH_ACTIVE');});
  it('rechecks kill switch after durable admission before invocation',async()=>{
    const c=await context();const switching:GatewayStore={admit:async cfg=>{const a=await store.admit(cfg);await kill('GLOBAL');return a;},reserveAttempt:(...args)=>store.reserveAttempt(...args),finish:(...args)=>store.finish(...args)};
    await expect(gateway(switching).execute('valid',c)).rejects.toThrow('AI_KILL_SWITCH_ACTIVE');expect(provider).not.toHaveBeenCalled();expect(tools).not.toHaveBeenCalled();
  });
  it.each([
    ["UPDATE taxguard_cases SET active_stage=4",'AI_WORKFLOW_MISMATCH'],
    ["UPDATE taxguard_case_assignments SET active=false",'AI_CASE_ACCESS_DENIED'],
    ["UPDATE taxguard_documents SET version=2",'AI_EVIDENCE_UNVERIFIED'],
  ])('revalidates scope/evidence during admission: %s',async(sql,code)=>{
    const c=await context();const switching:GatewayStore={admit:async cfg=>{const a=await store.admit(cfg);await pg.exec(sql);return a;},reserveAttempt:(...args)=>store.reserveAttempt(...args),finish:(...args)=>store.finish(...args)};
    await expect(gateway(switching).execute('valid',c)).rejects.toThrow(code);expect(provider).not.toHaveBeenCalled();expect(tools).not.toHaveBeenCalled();
  });
  it('does not retain caller context across asynchronous admission',async()=>{
    const c=await context();const switching:GatewayStore={admit:async cfg=>{const a=await store.admit(cfg);(c.scope as {client_id:string}).client_id='foreign';c.purpose='REVIEW_EVIDENCE_COMPLETENESS';return a;},reserveAttempt:(...args)=>store.reserveAttempt(...args),finish:(...args)=>store.finish(...args)};
    const out=await gateway(switching).execute('valid',c);expect(out.status).toBe('ADVISORY');expect(provider.mock.calls[0][0].input.purpose).toBe('IDENTIFY_REVIEW_QUESTIONS');expect(tools).not.toHaveBeenCalled();
  });
  it('blocks output acceptance on kill-switch change during transport',async()=>{provider.mockImplementation(async()=>{await kill('GLOBAL');return response();});await expect(gateway().execute('valid',await context())).rejects.toThrow('AI_KILL_SWITCH_ACTIVE');expect(provider).toHaveBeenCalledTimes(1);expect(tools).not.toHaveBeenCalled();});
  it('rechecks switches before a safe retry',async()=>{provider.mockImplementation(async()=>{await kill('GLOBAL');throw new ProviderNotSentError();});await expect(gateway().execute('valid',await context())).rejects.toThrow('AI_KILL_SWITCH_ACTIVE');expect(provider).toHaveBeenCalledTimes(1);expect(tools).not.toHaveBeenCalled();});
  it.each(['admit','reserveAttempt'])('fails closed on %s audit outage',async method=>{
    const c=await context();const broken:GatewayStore={admit:(...args)=>store.admit(...args),reserveAttempt:(...args)=>store.reserveAttempt(...args),finish:(...args)=>store.finish(...args),[method]:async()=>{throw new Error('private audit failure');}};
    await expect(gateway(broken).execute('valid',c)).rejects.toThrow('AI_GATEWAY_AUDIT_UNAVAILABLE');expect(provider).not.toHaveBeenCalled();expect(tools).not.toHaveBeenCalled();
  });
  it('does not return success on result-persistence failure',async()=>{
    const c=await context();const broken:GatewayStore={admit:(...args)=>store.admit(...args),reserveAttempt:(...args)=>store.reserveAttempt(...args),finish:async()=>{throw new Error('private failure');}};
    await expect(gateway(broken).execute('valid',c)).rejects.toThrow('AI_GATEWAY_AUDIT_UNAVAILABLE');expect(provider).toHaveBeenCalledTimes(1);
  });
  it('preserves immutable price/prompt/model/history once used',async()=>{
    const out=await gateway().execute('valid',await context());
    await expect(pg.query("UPDATE ai_model_pricing SET input_nanos_per_token=0 WHERE pricing_id=$1",[out.provenance.pricing_id])).rejects.toThrow();
    await expect(pg.query("UPDATE ai_models SET model_version='other' WHERE model_id=$1",[modelId])).rejects.toThrow();
    await expect(pg.query("UPDATE ai_prompts SET system_instructions='changed' WHERE prompt_id=$1",[`test-A34-${index}`])).rejects.toThrow();
    await expect(pg.query('DELETE FROM ai_gateway_admissions WHERE run_id=$1',[out.run_id])).rejects.toThrow();
    await expect(pg.query('DELETE FROM ai_gateway_attempts WHERE run_id=$1',[out.run_id])).rejects.toThrow();
    await expect(pg.query('DELETE FROM ai_gateway_outcomes WHERE run_id=$1',[out.run_id])).rejects.toThrow();
    const run=await pg.query<{status:string;token_usage:number;estimated_cost:string;confidence:null}>('SELECT status,token_usage,estimated_cost,confidence FROM ai_runs WHERE run_id=$1',[out.run_id]);expect(run.rows[0]).toMatchObject({status:'REVIEW_REQUIRED',token_usage:150,confidence:null});
    expect((await pg.query('SELECT * FROM ai_authoritative_actions')).rows).toEqual([]);
  });
  it('SQL rejects orphan attempts and falsely known NULL totals',async()=>{
    await expect(pg.query("INSERT INTO ai_gateway_attempts(run_id,tenant_id,actor_uid,attempt,decision_id)VALUES($1,'tenantA','preparer',0,$2)",[randomUUID(),randomUUID()])).rejects.toThrow();
    const cfg=await resolver.resolve('valid',await context()),a=await store.admit(cfg),attempt=await store.reserveAttempt(a,0,cfg.decision.decision_id);
    await expect(pg.query("INSERT INTO ai_gateway_outcomes(run_id,attempt_id,status,terminal,transport_state,reason_code,usage_state,input_tokens,output_tokens,total_tokens,cost_nanos)VALUES($1,$2,'FAILED',true,'RESPONDED','AI_ISOLATED_TEST','KNOWN',1,1,null,1)",[a.run_id,attempt])).rejects.toThrow(/check constraint/);expect(provider).not.toHaveBeenCalled();expect(tools).not.toHaveBeenCalled();
  });
  it('enables/forces RLS and denies end-user gateway visibility',async()=>{
    const tables=await pg.query<{relrowsecurity:boolean;relforcerowsecurity:boolean}>("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname IN ('ai_model_pricing','ai_gateway_admissions','ai_gateway_attempts','ai_gateway_outcomes')");expect(tables.rows).toHaveLength(4);expect(tables.rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity)).toBe(true);
    await pg.exec('GRANT SELECT ON ai_gateway_admissions,ai_gateway_outcomes TO authenticated; SET ROLE authenticated;');
    try{expect((await pg.query('SELECT * FROM ai_gateway_admissions')).rows).toEqual([]);expect((await pg.query('SELECT * FROM ai_gateway_outcomes')).rows).toEqual([]);}finally{await pg.exec('RESET ROLE; REVOKE SELECT ON ai_gateway_admissions,ai_gateway_outcomes FROM authenticated;');}
  });
  it('integrates through A00 without granting verified findings or multiplying retries',async()=>{
    provider.mockImplementationOnce(async()=>{throw new ProviderNotSentError();});
    const h=createA00GatewayHandler(gateway(),'valid');const a00=new A00Orchestrator(plane,ledger,{handlers:{IDENTIFY_REVIEW_QUESTIONS:h},timeout_ms:5000,maximum_retries:2});
    const out=await a00.coordinate('valid',{request_id:randomUUID(),scope:{...scope},tasks:['IDENTIFY_REVIEW_QUESTIONS'],evidence_source_ids:[eid]});
    expect(out.children[0].result.finding_codes).toEqual(['REVIEW_REQUIRED']);expect(provider).toHaveBeenCalledTimes(2);expect(tools).not.toHaveBeenCalled();
  });
  it('does not let A00 retry ambiguous gateway failure',async()=>{
    provider.mockImplementation(async()=>{throw new Error('ambiguous');});const h=createA00GatewayHandler(gateway(),'valid');
    await expect(new A00Orchestrator(plane,ledger,{handlers:{IDENTIFY_REVIEW_QUESTIONS:h},timeout_ms:5000,maximum_retries:2}).coordinate('valid',{request_id:randomUUID(),scope:{...scope},tasks:['IDENTIFY_REVIEW_QUESTIONS'],evidence_source_ids:[eid]})).rejects.toThrow('AI_PROVIDER_FAILURE');expect(provider).toHaveBeenCalledTimes(1);
  });
  it('has no production-default provider path or lifecycle activation',async()=>{
    const c=await context();await expect(new GovernedAIGateway(resolver,store).execute('valid',c)).rejects.toThrow('AI_DISPATCH_UNAVAILABLE');expect(provider).not.toHaveBeenCalled();expect(tools).not.toHaveBeenCalled();
    const previous=process.env.NODE_ENV;try{process.env.NODE_ENV='production';expect(()=>gateway()).toThrow('AI_TEST_EXECUTION_FORBIDDEN');}finally{process.env.NODE_ENV=previous;}
    const sql=fs.readFileSync('supabase/migrations/20261008030000_taxguard_ai_gateway_admission.sql','utf8');expect(sql).not.toMatch(/UPDATE ai_agents|INSERT INTO ai_models|INSERT INTO ai_prompts|INSERT INTO ai_runs/);
    const legacy=fs.readFileSync('src/server/ai/governance/legacyCompatibility.ts','utf8');expect(legacy).toContain('AI_LEGACY_CUTOVER_REQUIRED');
  });
  it('adapts OpenAI via SDK double with governed versions, no tools and no automatic retries',async()=>{
    const c=await context();await pg.query("UPDATE ai_models SET provider='OPENAI' WHERE model_id=$1",[modelId]);
    const create=vi.fn(async(_request:unknown,_options:unknown)=>({status:'completed',output:[],output_text:response().text,usage:response().usage}));
    const adapter=new OpenAIProviderAdapter({responses:{create}} as any);
    const out=await new GovernedAIGateway(resolver,store,{OPENAI:adapter}).execute('valid',c);
    expect(out.status).toBe('ADVISORY');expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({model:modelId,store:false});expect(create.mock.calls[0][1]).toMatchObject({maxRetries:0});expect(create.mock.calls[0][0]).not.toHaveProperty('tools');expect(tools).not.toHaveBeenCalled();
  });
});
