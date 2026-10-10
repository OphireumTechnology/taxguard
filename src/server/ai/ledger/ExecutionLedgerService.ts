import { randomUUID } from 'node:crypto';
import { GovernanceError } from '../governance/contracts';
import { GovernanceControlPlane } from '../governance/GovernanceControlPlane';
import type { AICaseScope } from '../../../ai/types';
import { SqlGovernanceStore,type TransactionalSql,type SqlConnection } from '../governance/SqlGovernanceStore';
import { isUuid } from '../capabilities/capabilityValidation';

export interface UsageReceipt {input_tokens:number;output_tokens:number;authority_reference:string;evidence_hash:string}
/** A trusted provider receipt verifier, never model output. Default is unavailable. */
export interface UsageAuthority {verify(run_id:string,attempt_id:string):Promise<UsageReceipt|null>}
export interface RecoveryLease {run_id:string;lease_owner:string;fence:number;expires_at:string}
export class ExecutionLedgerService {
  constructor(private readonly governance:GovernanceControlPlane,private readonly db:TransactionalSql,private readonly authority?:UsageAuthority) {
    if(authority&&process.env.NODE_ENV!=='test')throw new GovernanceError('AI_USAGE_AUTHORITY_UNCOMMISSIONED',503);
  }
  private async scope(token:string,scope:AICaseScope) {
    return this.governance.resolveScope(token,{request_id:randomUUID(),agent_id:'A34',scope,workflow_stage:1,intent:'ADVISORY',purpose:'MONITOR_HISTORY',capabilities:[{tool_id:'workflow.read',action:'READ'}],data_classes:['INTERNAL'],evidence_source_ids:[randomUUID()],confidence:0,financial_amount:0,risk_level:'MATERIAL'});
  }
  private async guard(sql:SqlConnection,trusted:Awaited<ReturnType<ExecutionLedgerService['scope']>>,scope:AICaseScope) {
    const snapshot=await new SqlGovernanceStore({transaction:work=>work(sql)}).transaction(tx=>tx.load(trusted.identity,{request_id:randomUUID(),agent_id:'A34',scope,workflow_stage:trusted.workflow_stage,intent:'ADVISORY',purpose:'MONITOR_HISTORY',capabilities:[{tool_id:'workflow.read',action:'READ'}],data_classes:['INTERNAL'],evidence_source_ids:[],confidence:0,financial_amount:0,risk_level:'MATERIAL'}));
    if(!snapshot.member||snapshot.member.status!=='active'||!['accountant','reviewer','senior_reviewer','bookkeeper','operations','practice_manager'].includes(snapshot.member.role)||!snapshot.assigned||snapshot.case?.id!==trusted.case_record_id)throw new GovernanceError('AI_EXECUTION_SCOPE_DENIED');
  }
  /** Own-case metadata only. Monitoring is not an agent execution authorization or tenant-wide role grant. */
  async history(token:string,scope:AICaseScope,limit=100) {
    if(!Number.isInteger(limit)||limit<1||limit>200)throw new GovernanceError('AI_INVALID_HISTORY_LIMIT',400);
    const trusted=await this.scope(token,scope);
    const rows=await this.safe(()=>this.db.transaction(async sql=>{await this.guard(sql,trusted,scope);return (await sql.query(`SELECT source_type,source_id,root_id,operation_id,decision_id,run_id,attempt_id,invocation_id,status,created_at FROM ai_execution_correlated_history WHERE tenant_id=$1 AND actor_uid=$2 AND case_record_id=$3 ORDER BY created_at,source_type,source_id LIMIT $4`,[trusted.identity.tenant_id,trusted.identity.uid,trusted.case_record_id,limit])).rows;}));
    const fresh=await this.scope(token,scope);if(fresh.identity.uid!==trusted.identity.uid||fresh.case_record_id!==trusted.case_record_id)throw new GovernanceError('AI_EXECUTION_SCOPE_DENIED');return rows;
  }
  async claim(token:string,scope:AICaseScope,run_id:string,seconds=60):Promise<RecoveryLease> {
    if(!isUuid(run_id)||!Number.isInteger(seconds)||seconds<1||seconds>300)throw new GovernanceError('AI_INVALID_RECOVERY_REQUEST',400);
    const trusted=await this.scope(token,scope);
    return this.safe(()=>this.db.transaction(async sql=>{
      await sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`AI6:${run_id}`]);
      await this.guard(sql,trusted,scope);
      const run=(await sql.query(`SELECT run_id FROM ai_runs WHERE run_id=$1 AND tenant_id=$2 AND requested_by=$3 AND case_record_id=$4 AND status IN ('QUEUED','RUNNING','PROPOSED','VERIFYING','REVIEW_REQUIRED')`,[run_id,trusted.identity.tenant_id,trusted.identity.uid,trusted.case_record_id])).rows;
      if(!run.length)throw new GovernanceError('AI_RECOVERY_SCOPE_DENIED');
      const prior=(await sql.query<{fence:number;status:string;lease_owner:string;expires_at:string;expired:boolean}>(`SELECT fence,status,lease_owner,expires_at,expires_at<=now() AS expired FROM ai_execution_recovery WHERE run_id=$1 ORDER BY fence DESC,created_at DESC LIMIT 1`,[run_id])).rows[0];
      if(prior?.status==='CLAIMED') {
        if(!prior.expired)throw new GovernanceError('AI_RECOVERY_ALREADY_LEASED',409);
        await sql.query(`INSERT INTO ai_execution_recovery(run_id,tenant_id,actor_uid,lease_owner,fence,status,expires_at,reason_code) VALUES($1,$2,$3,$4,$5,'EXPIRED',$6,'AI_LEASE_EXPIRED')`,[run_id,trusted.identity.tenant_id,trusted.identity.uid,prior.lease_owner,prior.fence,prior.expires_at]);
      }
      const owner=randomUUID(),fence=Number(prior?.fence??0)+1;
      const result=(await sql.query<{expires_at:string}>(`INSERT INTO ai_execution_recovery(run_id,tenant_id,actor_uid,lease_owner,fence,status,expires_at,reason_code) VALUES($1,$2,$3,$4,$5,'CLAIMED',now()+$6*interval '1 second','AI_RECOVERY_CLAIMED') RETURNING expires_at`,[run_id,trusted.identity.tenant_id,trusted.identity.uid,owner,fence,seconds])).rows[0];
      return {run_id,lease_owner:owner,fence,expires_at:result.expires_at};
    }));
  }
  /** Recovery records uncertainty for human inspection. It never retries a provider/handler or rewrites original outcomes. */
  async close(token:string,scope:AICaseScope,lease:RecoveryLease) {
    if(!lease||Object.keys(lease).sort().join(',')!=='expires_at,fence,lease_owner,run_id'||!isUuid(lease.run_id)||!isUuid(lease.lease_owner)||!Number.isSafeInteger(lease.fence)||lease.fence<1)throw new GovernanceError('AI_INVALID_RECOVERY_REQUEST',400);
    const trusted=await this.scope(token,scope);
    return this.safe(()=>this.db.transaction(async sql=>{
      await sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`AI6:${lease.run_id}`]);
      await this.guard(sql,trusted,scope);
      const run=(await sql.query('SELECT run_id FROM ai_runs WHERE run_id=$1 AND tenant_id=$2 AND requested_by=$3 AND case_record_id=$4',[lease.run_id,trusted.identity.tenant_id,trusted.identity.uid,trusted.case_record_id])).rows;
      if(!run.length)throw new GovernanceError('AI_RECOVERY_SCOPE_DENIED');
      await sql.query(`INSERT INTO ai_execution_recovery(run_id,tenant_id,actor_uid,lease_owner,fence,status,expires_at,reason_code) VALUES($1,$2,$3,$4,$5,'REVIEW_REQUIRED',$6,'AI_RECOVERY_REVIEW_REQUIRED')`,[lease.run_id,trusted.identity.tenant_id,trusted.identity.uid,lease.lease_owner,lease.fence,lease.expires_at]);
      return {status:'REVIEW_REQUIRED' as const,redispatched:false as const};
    }));
  }
  async reconcile(token:string,scope:AICaseScope,run_id:string) {
    if(!isUuid(run_id))throw new GovernanceError('AI_INVALID_RECONCILIATION',400);
    const trusted=await this.scope(token,scope);
    if(!this.authority||process.env.NODE_ENV!=='test')throw new GovernanceError('AI_USAGE_AUTHORITY_UNAVAILABLE',503);
    const pending=await this.safe(()=>this.db.transaction(async sql=>(await sql.query<{attempt_id:string}>(`SELECT o.attempt_id FROM ai_gateway_outcomes o JOIN ai_runs r USING(run_id) WHERE o.run_id=$1 AND o.terminal AND o.usage_state='UNKNOWN' AND r.tenant_id=$2 AND r.requested_by=$3 AND r.case_record_id=$4`,[run_id,trusted.identity.tenant_id,trusted.identity.uid,trusted.case_record_id])).rows[0]));
    if(!pending)throw new GovernanceError('AI_RECONCILIATION_SCOPE_DENIED');
    let receipt:UsageReceipt|null;
    try{receipt=await this.authority.verify(run_id,pending.attempt_id);}catch{throw new GovernanceError('AI_USAGE_AUTHORITY_UNAVAILABLE',503);}
    if(!receipt||Object.keys(receipt).sort().join(',')!=='authority_reference,evidence_hash,input_tokens,output_tokens'||![receipt.input_tokens,receipt.output_tokens].every(v=>Number.isSafeInteger(v)&&v>=0&&v<=1000000)||typeof receipt.authority_reference!=='string'||receipt.authority_reference.length<10||receipt.authority_reference.length>200||!/^[a-f0-9]{64}$/.test(receipt.evidence_hash))throw new GovernanceError('AI_USAGE_UNVERIFIED');
    const fresh=await this.scope(token,scope);
    if(fresh.identity.uid!==trusted.identity.uid||fresh.case_record_id!==trusted.case_record_id)throw new GovernanceError('AI_RECONCILIATION_SCOPE_DENIED');
    return this.safe(()=>this.db.transaction(async sql=>{
      await sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`AI4_BUDGET:${trusted.identity.tenant_id}`]);
      await this.guard(sql,trusted,scope);
      await sql.query(`INSERT INTO ai_usage_reconciliations(run_id,tenant_id,actor_uid,attempt_id,input_tokens,output_tokens,total_tokens,cost_nanos,authority_reference,evidence_hash)
        SELECT g.run_id,$2,$3,$4,$5,$6,$5::integer+$6::integer,$5::bigint*p.input_nanos_per_token+$6::bigint*p.output_nanos_per_token,$7,$8 FROM ai_gateway_admissions g JOIN ai_model_pricing p USING(pricing_id) WHERE g.run_id=$1`,[run_id,trusted.identity.tenant_id,trusted.identity.uid,pending.attempt_id,receipt.input_tokens,receipt.output_tokens,receipt.authority_reference,receipt.evidence_hash]);
      return {status:'KNOWN' as const,run_id,original_history_unchanged:true as const};
    }));
  }
  private async safe<T>(work:()=>Promise<T>):Promise<T> {try{return await work();}catch(error){if(error instanceof GovernanceError)throw error;throw new GovernanceError('AI_EXECUTION_LEDGER_UNAVAILABLE',503);}}
}
