import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { findCanonicalAgent } from '../../../ai/registry';
import type { AICaseScope } from '../../../ai/types';
import { GovernanceError, type GovernanceStore, type GovernanceTransaction, type GovernanceSnapshot, type GovernanceRequest, type VerifiedIdentity, type GovernanceDecision } from './contracts';

export interface SqlConnection { query<T = Record<string, unknown>>(sql:string,params?:unknown[]):Promise<{rows:T[]}> }
export interface TransactionalSql { transaction<T>(callback:(sql:SqlConnection)=>Promise<T>):Promise<T> }
/** Uses real server PostgreSQL transactions. No in-memory production fallback. */
export class PgGovernanceDatabase implements TransactionalSql {
  constructor(private readonly pool:Pool) {}
  async transaction<T>(work:(sql:SqlConnection)=>Promise<T>):Promise<T> {
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      await client.query("SET LOCAL statement_timeout='5000'");
      const connection:SqlConnection={query:async(sql,params)=>{const result=await client.query(sql,params);return {rows:JSON.parse(JSON.stringify(result.rows))};}};
      const result=await work(connection);await client.query('COMMIT');return result;
    } catch(error) {await client.query('ROLLBACK').catch(()=>{});throw error;}
    finally {client.release();}
  }
}
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export class SqlGovernanceStore implements GovernanceStore {
  constructor(private readonly db:TransactionalSql) {}
  transaction<T>(work:(tx:GovernanceTransaction)=>Promise<T>):Promise<T> {
    return this.db.transaction(async sql=>{
      let replayOf:string|null=null;
      return work({
        link:async(identity,decision_id,root_id,operation_id)=>{
          // Correlation never legitimizes caller IDs. Admission still owns their refusal semantics.
          const valid=(await sql.query(`SELECT d.decision_id FROM ai_governance_decisions d JOIN ai_orchestration_roots r ON r.case_record_id=d.case_record_id AND r.tenant_id=d.tenant_id AND r.actor_uid=d.actor_uid
            WHERE d.decision_id=$1 AND r.root_id=$2 AND d.tenant_id=$3 AND d.actor_uid=$4 AND EXISTS(SELECT 1 FROM ai_orchestration_events e WHERE e.root_id=r.root_id AND e.operation_id=$5 AND e.status='RUNNING' AND (e.agent_id=d.agent_id OR d.agent_id='A00'))`,[decision_id,root_id,identity.tenant_id,identity.uid,operation_id])).rows;
          if(!valid.length)return;
          const prior=(await sql.query<{root_id:string;operation_id:string}>(`SELECT root_id,operation_id FROM ai_execution_links WHERE decision_id=$1`,[decision_id])).rows[0];
          if(prior){if(prior.root_id!==root_id||prior.operation_id!==operation_id)throw new GovernanceError('AI_EXECUTION_LINK_CONFLICT');return;}
          await sql.query('INSERT INTO ai_execution_links(decision_id,root_id,operation_id,tenant_id,actor_uid) VALUES($1,$2,$3,$4,$5)',[decision_id,root_id,operation_id,identity.tenant_id,identity.uid]);
        },
        claim:async(identity,r,fingerprint)=>{
          const key=digest(r.request_id);
          await sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${identity.tenant_id}:${identity.uid}:${key}`]);
          const prior=await sql.query<{decision_id:string;input_hash:string}>('SELECT decision_id,input_hash FROM ai_governance_decisions WHERE tenant_id=$1 AND actor_uid=$2 AND request_key=$3 AND replay_of IS NULL',[identity.tenant_id,identity.uid,key]);
          if(prior.rows[0]) { replayOf=prior.rows[0].decision_id;throw new GovernanceError(prior.rows[0].input_hash===fingerprint?'AI_REPLAY_DENIED':'AI_REPLAY_MISMATCH',409); }
        },
        load:async(identity,r)=>this.load(sql,identity,r),
        append:async(identity,r,fingerprint,snapshot,code,decision)=>{
          // A session identity must still resolve to a current persisted member. Unknown
          // identities fail closed, without inventing an audit tenant or actor.
          const member=await sql.query('SELECT uid FROM taxguard_members WHERE tenant_id=$1 AND uid=$2',[identity.tenant_id,identity.uid]);
          if(!member.rows.length)throw new GovernanceError('AI_AUTH_REQUIRED',401);
          const c=snapshot?.case;
          const trustedScope=c&&snapshot?.assigned&&c.tenant_id===identity.tenant_id?c:null;
          let agentId:string|null=null;try{agentId=findCanonicalAgent(r.agent_id).agent_id;}catch{}
          const policySnapshot=snapshot?{
            agent:snapshot.agent,version:snapshot.version,model:snapshot.model,
            prompt:snapshot.prompt?{agent_id:snapshot.prompt.agent_id,prompt_id:snapshot.prompt.prompt_id,version:snapshot.prompt.version,status:snapshot.prompt.status,risk_class:snapshot.prompt.risk_class,system_hash:digest(snapshot.prompt.system_instructions),schema_hash:digest(JSON.stringify(snapshot.prompt.expected_output_schema))}:null,
            tools:snapshot.tools,permissions:snapshot.permissions,data_permissions:snapshot.data_permissions,stage_permission:snapshot.stage_permission,
            policies:snapshot.policies,kill_switches:snapshot.kill_switches.map(k=>({switch_id:k.switch_id,scope:k.scope,target:k.target,enabled:k.enabled})),
            evidence:snapshot.evidence.map(e=>({source_id:e.source_id,source_hash:e.source_hash,document_record_id:e.document_record_id,document_version:e.document_version,document_hash:e.document_hash,document_status:e.document_status,quarantine_status:e.quarantine_status}))
          }:{};
          await sql.query(`INSERT INTO ai_governance_decisions(decision_id,tenant_id,actor_uid,request_key,input_hash,agent_id,case_record_id,client_id,tax_case_id,tax_year,outcome,reason_code,action_state,replay_of,policy_hash,policy_snapshot)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
            [decision?.decision_id??randomUUID(),identity.tenant_id,identity.uid,digest(r.request_id),fingerprint,agentId,trustedScope?.id??null,trustedScope?.client_id??null,trustedScope?.tax_case_id??null,trustedScope?.tax_year??null,decision?.outcome??'DENIED',code,decision?.action_state??'BLOCKED',replayOf,snapshot?digest(JSON.stringify(policySnapshot)):null,JSON.stringify(policySnapshot)]);
        },
      });
    });
  }
  private async load(sql:SqlConnection,identity:VerifiedIdentity,r:GovernanceRequest):Promise<GovernanceSnapshot> {
    const one=async<T>(query:string,params:unknown[]) => { const rows=(await sql.query<T>(query,params)).rows; if(rows.length>1)throw new GovernanceError('AI_AMBIGUOUS_SCOPE'); return rows[0]??null; };
    const member=await one<GovernanceSnapshot['member']>('SELECT uid,tenant_id,role,status,credential_verified,credential_type,credential_expires_at FROM taxguard_members WHERE tenant_id=$1 AND uid=$2',[identity.tenant_id,identity.uid]);
    const scope=r.scope;
    const c=await one<GovernanceSnapshot['case']>('SELECT id,tenant_id,client_id,case_id AS tax_case_id,tax_year,engagement_id,active_stage,status,preparer_uid,reviewer_uid,client_uid FROM taxguard_cases WHERE tenant_id=$1 AND client_id=$2 AND case_id=$3 AND tax_year=$4',[identity.tenant_id,scope.client_id,scope.tax_case_id,scope.tax_year]);
    let assigned=false;
    if(c&&member&&member.status==='active') {
      const caseRole=member.role==='accountant'?'preparer':['reviewer','senior_reviewer'].includes(member.role)?'reviewer':member.role;
      const expectedIdentity=caseRole==='preparer'?c.preparer_uid===identity.uid:caseRole==='reviewer'?c.reviewer_uid===identity.uid:true;
      const grants=await sql.query(`SELECT a.id FROM taxguard_case_assignments a JOIN taxguard_staff_assignments s
        ON s.tenant_id=a.tenant_id AND s.user_id=a.uid
        JOIN taxguard_clients cl ON cl.tenant_id=s.tenant_id AND cl.client_id=s.client_id
        WHERE a.tenant_id=$1 AND a.case_id=$2 AND a.uid=$3 AND a.role=$4 AND a.active AND a.assigned_at<=now()
        AND s.client_id=$5 AND s.engagement_id=$6 AND s.tax_year=$7 AND s.role IN ($4,$8)
        AND s.status='ACTIVE' AND s.effective_from<=now() AND (s.effective_to IS NULL OR s.effective_to>now()) AND cl.status='active'`,
        [identity.tenant_id,c.tax_case_id,identity.uid,caseRole,c.client_id,c.engagement_id,c.tax_year,member.role]);
      assigned=expectedIdentity&&grants.rows.length>0;
    }
    const agent=await one<GovernanceSnapshot['agent']>('SELECT * FROM ai_agents WHERE agent_id=$1',[r.agent_id]);
    const version=agent?await one<GovernanceSnapshot['version']>('SELECT * FROM ai_agent_versions WHERE agent_id=$1 AND version=$2',[agent.agent_id,agent.version]):null;
    const model=version?await one<GovernanceSnapshot['model']>('SELECT * FROM ai_models WHERE model_id=$1 AND model_version=$2',[version.default_model,version.default_model_version]):null;
    const prompt=version?await one<GovernanceSnapshot['prompt']>('SELECT * FROM ai_prompts WHERE agent_id=$1 AND prompt_id=$2 AND version=$3',[version.agent_id,version.prompt_id,version.prompt_version]):null;
    const tools=(await sql.query<GovernanceSnapshot['tools'][number]>('SELECT * FROM ai_tools WHERE tool_id=ANY($1)',[r.capabilities.map(c=>c.tool_id)])).rows;
    const permissions=(await sql.query<GovernanceSnapshot['permissions'][number]>('SELECT * FROM ai_agent_permissions WHERE agent_id=$1',[r.agent_id])).rows;
    const data_permissions=(await sql.query<GovernanceSnapshot['data_permissions'][number]>('SELECT * FROM ai_agent_data_permissions WHERE agent_id=$1',[r.agent_id])).rows;
    const stage_permission=await one<GovernanceSnapshot['stage_permission']>("SELECT * FROM ai_stage_permissions WHERE agent_id=$1 AND workflow_version='LEGACY_18_V1' AND stage=$2",[r.agent_id,r.workflow_stage]);
    const policies=(await sql.query<GovernanceSnapshot['policies'][number]>('SELECT * FROM ai_human_approval_policies WHERE tenant_id=$1 AND agent_id=$2',[identity.tenant_id,r.agent_id])).rows;
    const kill_switches=(await sql.query<GovernanceSnapshot['kill_switches'][number]>('SELECT * FROM ai_kill_switches WHERE tenant_id=$1 AND enabled',[identity.tenant_id])).rows;
    const evidence=assigned?(await sql.query<GovernanceSnapshot['evidence'][number]>(`SELECT e.*,d.hash AS document_hash,d.status AS document_status,d.quarantine_status,d.tenant_id AS document_tenant_id,d.client_id AS document_client_id,d.case_id AS document_case_id,d.tax_year AS document_tax_year,d.version AS actual_document_version
      FROM ai_evidence_sources e LEFT JOIN taxguard_documents d ON d.id=e.document_record_id
      WHERE e.source_id=ANY($1::uuid[]) AND e.tenant_id=$2 AND e.client_id=$3 AND e.tax_case_id=$4 AND e.tax_year=$5`,[r.evidence_source_ids,identity.tenant_id,scope.client_id,scope.tax_case_id,scope.tax_year])).rows:[];
    return {member,case:c,assigned,agent,version,model,prompt,tools,permissions,data_permissions,stage_permission,policies,kill_switches,evidence};
  }
}
