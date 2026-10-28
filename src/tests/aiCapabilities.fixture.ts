import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { GovernanceControlPlane } from '../server/ai/governance/GovernanceControlPlane';
import { SqlGovernanceStore,type TransactionalSql } from '../server/ai/governance/SqlGovernanceStore';
import { SqlOrchestrationLedger } from '../server/ai/orchestration/SqlOrchestrationLedger';
import { ModelPromptResolver } from '../server/ai/gateway/ModelPromptResolver';
import { COUNTS_REVIEW_SCHEMA } from '../server/ai/gateway/structuredOutput';
import type { ChildContext } from '../server/ai/orchestration/contracts';

export const caseId='11111111-1111-4111-8111-111111111111',documentId='22222222-2222-4222-8222-222222222222',sourceId='33333333-3333-4333-8333-333333333333',sourceHash='a'.repeat(64);
export const scope={tenant_id:'tenantA',client_id:'clientA',tax_case_id:'caseA',tax_year:2025};
export async function capabilityFixture(createDatabase:()=>PGlite=()=>new PGlite()) {
  const pg=createDatabase();
  try {
  await pg.exec(`CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS 'SELECT current_user::text'; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;`);
  for(const name of fs.readdirSync(path.resolve('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort()) await pg.exec(fs.readFileSync(path.resolve('supabase/migrations',name),'utf8').replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"[^"]+";/gi,''));
  await pg.exec(`INSERT INTO taxguard_tenants(id,name) VALUES('tenantA','Synthetic A'),('tenantB','Synthetic B');
    INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid) VALUES('tenantA','clientA','owner'),('tenantA','clientB','other');
    INSERT INTO taxguard_members(tenant_id,uid,role) VALUES('tenantA','preparer','accountant'),('tenantA','reviewer','reviewer');
    INSERT INTO taxguard_cases(id,case_id,tenant_id,client_id,engagement_id,tax_year,active_stage,client_uid,preparer_uid,reviewer_uid,created_by,updated_by) VALUES('${caseId}','caseA','tenantA','clientA','engA',2025,3,'owner','preparer','reviewer','preparer','preparer');
    INSERT INTO taxguard_case_assignments(case_id,tenant_id,uid,role) VALUES('caseA','tenantA','preparer','preparer');
    INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,engagement_id,tax_year,role,user_id,assigned_by) VALUES('prep','tenantA','clientA','engA',2025,'preparer','preparer','test');
    INSERT INTO taxguard_documents(id,document_id,tenant_id,client_id,engagement_id,tax_year,case_id,hash,mime_type,created_by,status,quarantine_status) VALUES('${documentId}','docA','tenantA','clientA','engA',2025,'caseA','${sourceHash}','application/pdf','preparer','RELEASED','CLEAN');
    INSERT INTO ai_evidence_sources(source_id,tenant_id,client_id,tax_case_id,tax_year,case_record_id,evidence_type,document_record_id,document_version,source_reference,source_hash) VALUES('${sourceId}','tenantA','clientA','caseA',2025,'${caseId}','DOCUMENT','${documentId}',1,'private test source','${sourceHash}');
    INSERT INTO ai_human_approval_policies(tenant_id,agent_id,action,materiality) SELECT 'tenantA',a,'READ','MATERIAL' FROM unnest(ARRAY['A00','A34']) a;`);
  const db:TransactionalSql={transaction:callback=>pg.transaction(async tx=>callback({query:async(sql,params)=>{const r=await tx.query(sql,params);return {rows:JSON.parse(JSON.stringify(r.rows))};}}))};
  const plane=new GovernanceControlPlane({verify:async token=>token==='valid'?{uid:'preparer',tenant_id:'tenantA'}:null},new SqlGovernanceStore(db));
  const resolver=new ModelPromptResolver(plane),ledger=new SqlOrchestrationLedger(db);
  let index=0,modelId='',version='';
  const req=(agent='A34',purpose='IDENTIFY_REVIEW_QUESTIONS')=>({request_id:randomUUID(),agent_id:agent,scope:{...scope},workflow_stage:3,intent:'ADVISORY' as const,purpose,capabilities:[{tool_id:'workflow.read',action:'READ' as const}],data_classes:['INTERNAL' as const],evidence_source_ids:[sourceId],confidence:0,financial_amount:0,risk_level:'MATERIAL' as const});
  async function reset() {
    index++;modelId=`capability-model-${index}`;version=`capability-${index}`;
    await pg.exec(`INSERT INTO ai_models(model_id,model_version,provider,status,effective_date,approved_use_cases,data_classification_limit,token_limit,cost_limit) VALUES('${modelId}','1','TEST','ACTIVE',now(),ARRAY['COORDINATE_REVIEW','IDENTIFY_REVIEW_QUESTIONS','REVIEW_EVIDENCE_COMPLETENESS'],'INTERNAL',100000,1);
      INSERT INTO ai_prompts(agent_id,prompt_id,version,status,system_instructions,expected_output_schema,effective_date) SELECT a,'cap-'||a||'-${index}','1','ACTIVE','Synthetic isolated instructions','${JSON.stringify(COUNTS_REVIEW_SCHEMA)}',now() FROM unnest(ARRAY['A00','A34']) a;
      INSERT INTO ai_agent_versions(agent_id,version,status,risk_class,default_model,default_model_version,prompt_id,prompt_version,schema_version,token_budget,cost_budget,maximum_retries,maximum_execution_time) SELECT a,'${version}','ACTIVE','LOW','${modelId}','1','cap-'||a||'-${index}','1','1',100000,1,1,1 FROM unnest(ARRAY['A00','A34']) a;
      UPDATE ai_agents SET status='ACTIVE',risk_class='LOW',version='${version}',default_model='${modelId}',default_model_version='1',prompt_id='cap-'||agent_id||'-${index}',prompt_version='1' WHERE agent_id IN ('A00','A34');
      UPDATE ai_tools SET status='ACTIVE',risk_class='LOW',requires_human_approval=false;
      UPDATE ai_agent_permissions SET permission_state='ALLOW',risk_level='LOW',human_approval_required=false,conditions='{}' WHERE agent_id IN ('A00','A34') AND resource IN ('workflow.read','document.read') AND action='READ';
      UPDATE ai_agent_data_permissions SET permission_state='ALLOW',conditions='{}' WHERE agent_id IN ('A00','A34') AND data_classification='INTERNAL';
      UPDATE ai_stage_permissions SET permission_state='ALLOW',conditions='{}' WHERE agent_id IN ('A00','A34');
      UPDATE ai_human_approval_policies SET status='ACTIVE'; DELETE FROM ai_kill_switches;
      UPDATE taxguard_members SET role='accountant',status='active' WHERE uid='preparer';
      UPDATE taxguard_cases SET active_stage=3,status='ACTIVE',reviewer_uid='reviewer';
      UPDATE taxguard_case_assignments SET active=true,assigned_at=now(),role='preparer';
      UPDATE taxguard_staff_assignments SET status='ACTIVE',tax_year=2025,effective_from=now(),effective_to=null,role='preparer';
      UPDATE taxguard_documents SET hash='${sourceHash}',version=1,status='RELEASED',quarantine_status='CLEAN' WHERE id='${documentId}';
      INSERT INTO ai_model_pricing(model_id,model_version,version,status,input_nanos_per_token,output_nanos_per_token,input_token_limit,output_token_limit,authority_reference,effective_date) VALUES('${modelId}','1','synthetic','ACTIVE',2,3,4096,1024,'SYNTHETIC TEST RATES ONLY',now());`);
  }
  async function context():Promise<ChildContext> {
    const parent=await plane.evaluateCoordinator('valid',req('A00','COORDINATE_REVIEW')),child=await plane.evaluate('valid',req());
    const root={root_id:randomUUID(),identity:{uid:'preparer',tenant_id:'tenantA'},scope:{...scope},case_record_id:caseId,workflow_stage:3,request_key:randomUUID().replaceAll('-','').padEnd(64,'a'),input_hash:sourceHash,coordinator_decision_id:parent.decision_id};
    const operation_id=randomUUID();await ledger.begin(root);
    await ledger.append(root,{operation_id:null,agent_id:'A00',attempt:0,status:'PLANNED',purpose:null,decision_id:null,reason_code:'AI_ISOLATED_FIXTURE',output_hash:null});
    await ledger.append(root,{operation_id,agent_id:'A34',attempt:0,status:'RUNNING',purpose:'IDENTIFY_REVIEW_QUESTIONS',decision_id:child.decision_id,reason_code:'AI_ISOLATED_FIXTURE',output_hash:null});
    return {root_id:root.root_id,operation_id,agent_id:'A34',attempt:0,decision_id:child.decision_id,scope:{...scope},workflow_stage:3,purpose:'IDENTIFY_REVIEW_QUESTIONS',evidence_source_ids:[sourceId]};
  }
  async function kill(kind:string,tool='workflow.read') {
    await pg.query(`INSERT INTO ai_kill_switches(tenant_id,scope,target,enabled,reason,activated_by,activated_at,agent_id,model_id,model_version,tool_id,workflow_version,workflow_stage) VALUES('tenantA',$1,$2,true,'Synthetic controlled stop','preparer',now(),$3,$4,$5,$6,$7,$8)`,
      [kind,kind==='GLOBAL'?'GLOBAL':kind==='AGENT'?'A34':kind==='MODEL'?`${modelId}@1`:kind==='TOOL'?tool:'LEGACY_18_V1:3',kind==='AGENT'?'A34':null,kind==='MODEL'?modelId:null,kind==='MODEL'?'1':null,kind==='TOOL'?tool:null,kind==='WORKFLOW'?'LEGACY_18_V1':null,kind==='WORKFLOW'?3:null]);
  }
  return {pg,db,plane,resolver,ledger,reset,context,req,kill};
  } catch(error) {
    // beforeAll cannot transfer ownership to afterAll if initialization fails.
    // Close the allocated database here; do not leave a failed fixture's resources alive.
    try {await pg.close();}catch(cleanupError) {throw new AggregateError([error,cleanupError],'AI fixture initialization and cleanup failed');}
    throw error;
  }
}
