import { randomUUID } from 'node:crypto';
import { GovernanceError } from '../governance/contracts';
import type { TransactionalSql,SqlConnection } from '../governance/SqlGovernanceStore';
import type { ResolvedConfiguration } from '../gateway/contracts';
import { digest } from '../gateway/ModelPromptResolver';
import type { CapabilityAdmission,CapabilityDefinition,CapabilityRequest,CapabilityStore,CapabilityEvent } from './contracts';

export class SqlCapabilityStore implements CapabilityStore {
  constructor(private readonly db:TransactionalSql) {}
  async admit(c:ResolvedConfiguration,r:CapabilityRequest,d:CapabilityDefinition,binding_hash:string):Promise<CapabilityAdmission> {
    try {return await this.db.transaction(async sql=>{
      const key=`AI5:${c.identity.tenant_id}:${c.identity.uid}:${r.context.operation_id}:${d.id}`;
      await sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
      const prior=(await sql.query<{input_hash:string}>(`SELECT input_hash FROM ai_capability_admissions WHERE tenant_id=$1 AND actor_uid=$2 AND operation_id=$3 AND capability_id=$4`,[c.identity.tenant_id,c.identity.uid,r.context.operation_id,d.id])).rows;
      if(prior.length) throw new GovernanceError(prior[0].input_hash===digest(r.proposal.arguments)?'AI_CAPABILITY_REPLAY_DENIED':'AI_CAPABILITY_REPLAY_MISMATCH',409);
      const admission:CapabilityAdmission={invocation_id:randomUUID(),configuration:c,request:r,definition:d,binding_hash};
      await this.check(sql,admission);
      await sql.query(`INSERT INTO ai_capability_admissions(invocation_id,tenant_id,actor_uid,case_record_id,client_id,tax_case_id,tax_year,root_id,operation_id,agent_id,agent_version,capability_id,capability_version,workflow_stage,decision_id,run_id,attempt_id,binding_hash,definition_hash,input_hash,input_schema_hash,output_schema_hash,evidence_hash)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [admission.invocation_id,c.identity.tenant_id,c.identity.uid,c.snapshot.case.id,r.context.scope.client_id,r.context.scope.tax_case_id,r.context.scope.tax_year,r.context.root_id,r.context.operation_id,r.context.agent_id,c.snapshot.version.version,d.id,d.version,r.context.workflow_stage,c.decision.decision_id,r.gateway_correlation?.run_id??null,r.gateway_correlation?.attempt_id??null,binding_hash,digest(d),digest(r.proposal.arguments),digest(d.input_schema),digest(d.output_schema),digest(c.snapshot.evidence.map(e=>({id:e.source_id,hash:e.source_hash,version:e.document_version})).sort((a,b)=>a.id.localeCompare(b.id)))]);
      await this.event(sql,admission,{status:'ADMITTED',reason_code:'AI_CAPABILITY_ADMITTED',handler_invoked:false,output_hash:null,decision_id:c.decision.decision_id});
      return admission;
    });} catch(error) {
      if(error instanceof GovernanceError) {
        try {await this.db.transaction(async sql=>{await sql.query("INSERT INTO ai_policy_events(tenant_id,agent_id,event_type,actor_uid,severity,details) VALUES($1,$2,'POLICY_VIOLATION',$3,'MATERIAL',$4)",[c.identity.tenant_id,c.context.agent_id,c.identity.uid,JSON.stringify({code:error.code})]);});}
        catch {throw new GovernanceError('AI_CAPABILITY_AUDIT_UNAVAILABLE',503);}
        throw error;
      }
      throw new GovernanceError('AI_CAPABILITY_AUDIT_UNAVAILABLE',503);
    }
  }
  append(a:CapabilityAdmission,e:CapabilityEvent):Promise<void> {return this.db.transaction(sql=>this.event(sql,a,e));}
  assertContinuation(a:CapabilityAdmission):Promise<void> {return this.db.transaction(sql=>this.check(sql,a));}
  private async event(sql:SqlConnection,a:CapabilityAdmission,e:CapabilityEvent) {
    await sql.query(`INSERT INTO ai_capability_events(invocation_id,tenant_id,actor_uid,status,reason_code,handler_invoked,output_hash,decision_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [a.invocation_id,a.configuration.identity.tenant_id,a.configuration.identity.uid,e.status,e.reason_code,e.handler_invoked,e.output_hash,e.decision_id]);
  }
  private async check(sql:SqlConnection,a:CapabilityAdmission) {
    const c=a.configuration,r=a.request;
    const root=(await sql.query<{case_record_id:string;workflow_stage:number}>(`SELECT case_record_id,workflow_stage FROM ai_orchestration_roots WHERE root_id=$1 AND tenant_id=$2 AND actor_uid=$3 AND client_id=$4 AND tax_case_id=$5 AND tax_year=$6`,[r.context.root_id,c.identity.tenant_id,c.identity.uid,r.context.scope.client_id,r.context.scope.tax_case_id,r.context.scope.tax_year])).rows[0];
    if(!root || root.case_record_id!==c.snapshot.case.id || root.workflow_stage!==r.context.workflow_stage) throw new GovernanceError('AI_CAPABILITY_CORRELATION_DENIED');
    const child=(await sql.query(`SELECT event_id FROM ai_orchestration_events WHERE root_id=$1 AND operation_id=$2 AND agent_id=$3 AND purpose=$4 AND attempt=$5 AND status='RUNNING'`,[r.context.root_id,r.context.operation_id,r.context.agent_id,r.context.purpose,r.context.attempt])).rows;
    const stopped=(await sql.query(`SELECT event_id FROM ai_orchestration_events WHERE root_id=$1 AND ((operation_id IS NULL AND status IN ('COMPLETED','FAILED')) OR (operation_id=$2 AND status IN ('FAILED','DENIED','TIMED_OUT','CANCELLED','RESULT_RECORDED'))) LIMIT 1`,[r.context.root_id,r.context.operation_id])).rows;
    if(child.length!==1 || stopped.length) throw new GovernanceError('AI_CAPABILITY_CORRELATION_DENIED');
    const decision=(await sql.query(`SELECT decision_id FROM ai_governance_decisions WHERE decision_id=$1 AND tenant_id=$2 AND actor_uid=$3 AND case_record_id=$4 AND agent_id=$5 AND outcome IN ('ADVISORY_ALLOWED','REVIEW_REQUIRED')`,[r.context.decision_id,c.identity.tenant_id,c.identity.uid,c.snapshot.case.id,r.context.agent_id])).rows;
    if(decision.length!==1) throw new GovernanceError('AI_CAPABILITY_CORRELATION_DENIED');
    const priorGateway=(await sql.query('SELECT run_id FROM ai_gateway_admissions WHERE operation_id=$1',[r.context.operation_id])).rows;
    if(priorGateway.length && !r.gateway_correlation) throw new GovernanceError('AI_CAPABILITY_GATEWAY_DENIED');
    if(r.gateway_correlation) {
      const gateway=(await sql.query(`SELECT g.run_id FROM ai_gateway_admissions g JOIN ai_gateway_outcomes o ON o.run_id=g.run_id
        WHERE g.run_id=$1 AND o.attempt_id=$2 AND o.status='ACCEPTED' AND o.terminal AND g.root_id=$3 AND g.operation_id=$4 AND g.tenant_id=$5 AND g.actor_uid=$6`,
        [r.gateway_correlation.run_id,r.gateway_correlation.attempt_id,r.context.root_id,r.context.operation_id,c.identity.tenant_id,c.identity.uid])).rows;
      if(gateway.length!==1) throw new GovernanceError('AI_CAPABILITY_GATEWAY_DENIED');
    }
  }
}
