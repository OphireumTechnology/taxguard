import { randomUUID } from 'node:crypto';
import { GovernanceError } from '../governance/contracts';
import type { SqlConnection,TransactionalSql } from '../governance/SqlGovernanceStore';
import type { Admission,AttemptOutcome,GatewayStore,Pricing,ResolvedConfiguration } from './contracts';
import { digest } from './ModelPromptResolver';
import { dollarsToNanos,nanosToRunCost } from './usage';

export class SqlGatewayStore implements GatewayStore {
  constructor(private readonly db:TransactionalSql){}
  private async lock(sql:SqlConnection,tenant:string){await sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`AI4_BUDGET:${tenant}`]);}
  async admit(c:ResolvedConfiguration):Promise<Admission>{
    try{return await this.db.transaction(async sql=>{
      await this.lock(sql,c.identity.tenant_id);
      const ctx=c.context,s=c.snapshot;
      const prior=await sql.query('SELECT run_id FROM ai_gateway_admissions WHERE operation_id=$1',[ctx.operation_id]);
      if(prior.rows.length)throw new GovernanceError('AI_GATEWAY_REPLAY_DENIED',409);
      const correlated=await sql.query(`SELECT r.root_id FROM ai_orchestration_roots r JOIN ai_orchestration_events e ON e.root_id=r.root_id
        JOIN ai_governance_decisions d ON d.decision_id=$9 AND d.tenant_id=r.tenant_id AND d.actor_uid=r.actor_uid AND d.case_record_id=r.case_record_id AND d.agent_id=$7 AND d.outcome IN ('ADVISORY_ALLOWED','REVIEW_REQUIRED')
        WHERE r.root_id=$1 AND r.tenant_id=$2 AND r.actor_uid=$3 AND r.case_record_id=$4 AND r.workflow_stage=$5
        AND e.operation_id=$6 AND e.agent_id=$7 AND e.purpose=$8 AND e.status='RUNNING'
        AND NOT EXISTS(SELECT 1 FROM ai_orchestration_events t WHERE t.root_id=r.root_id AND t.operation_id IS NULL AND t.status IN ('FAILED','COMPLETED'))`,
        [ctx.root_id,c.identity.tenant_id,c.identity.uid,s.case.id,ctx.workflow_stage,ctx.operation_id,ctx.agent_id,ctx.purpose,ctx.decision_id]);
      if(!correlated.rows.length)throw new GovernanceError('AI_GATEWAY_CORRELATION_REQUIRED');
      const rows=await sql.query<Pricing>(`SELECT pricing_id,model_id,model_version,input_nanos_per_token::text,output_nanos_per_token::text,input_token_limit,output_token_limit,effective_date FROM ai_model_pricing WHERE model_id=$1 AND model_version=$2 AND status='ACTIVE' AND effective_date<=now()`,[s.model.model_id,s.model.model_version]);
      if(rows.rows.length!==1)throw new GovernanceError('AI_PRICING_UNAVAILABLE',503);
      const pricing={...rows.rows[0],configuration_hash:digest(rows.rows[0])};
      const reserved_tokens=pricing.input_token_limit+pricing.output_token_limit;
      const reserved_nanos=(BigInt(pricing.input_token_limit)*BigInt(pricing.input_nanos_per_token)+BigInt(pricing.output_token_limit)*BigInt(pricing.output_nanos_per_token)).toString();
      // Counts-only request and schema must fit a conservative byte bound; actual usage is checked too.
      const wireBytes=Buffer.byteLength(c.request.instructions+JSON.stringify(c.request.schema)+JSON.stringify(c.request.input),'utf8')+1024;
      if(wireBytes>pricing.input_token_limit)throw new GovernanceError('AI_INPUT_BUDGET_EXCEEDED');
      const totals=await sql.query<{agent_tokens:string;model_tokens:string;agent_nanos:string;model_nanos:string;unknown_count:string}>(`
        SELECT coalesce(sum(coalesce(u.total_tokens,o.total_tokens,a.reserved_tokens)) FILTER(WHERE r.agent_id=$2 AND r.agent_version=$3),0)::text AS agent_tokens,
        coalesce(sum(coalesce(u.total_tokens,o.total_tokens,a.reserved_tokens)) FILTER(WHERE r.model_id=$4 AND r.model_version=$5),0)::text AS model_tokens,
        coalesce(sum(coalesce(u.cost_nanos,o.cost_nanos,a.reserved_nanos)) FILTER(WHERE r.agent_id=$2 AND r.agent_version=$3),0)::text AS agent_nanos,
        coalesce(sum(coalesce(u.cost_nanos,o.cost_nanos,a.reserved_nanos)) FILTER(WHERE r.model_id=$4 AND r.model_version=$5),0)::text AS model_nanos,
        count(*) FILTER(WHERE o.usage_state='UNKNOWN' AND u.run_id IS NULL AND r.model_id=$4 AND r.model_version=$5)::text AS unknown_count
        FROM ai_gateway_admissions a JOIN ai_runs r ON r.run_id=a.run_id LEFT JOIN ai_gateway_outcomes o ON o.run_id=a.run_id AND o.terminal LEFT JOIN ai_usage_reconciliations u ON u.run_id=a.run_id WHERE a.tenant_id=$1`,
        [c.identity.tenant_id,s.agent.agent_id,s.version.version,s.model.model_id,s.model.model_version]);
      const t=totals.rows[0];
      if(BigInt(t.unknown_count)>0n)throw new GovernanceError('AI_USAGE_UNRESOLVED',503);
      if(BigInt(t.agent_tokens)+BigInt(reserved_tokens)>BigInt(s.version.token_budget)||BigInt(t.model_tokens)+BigInt(reserved_tokens)>BigInt(s.model.token_limit)||
        BigInt(t.agent_nanos)+BigInt(reserved_nanos)>dollarsToNanos(s.version.cost_budget)||BigInt(t.model_nanos)+BigInt(reserved_nanos)>dollarsToNanos(s.model.cost_limit))throw new GovernanceError('AI_BUDGET_EXHAUSTED',429);
      const run_id=randomUUID();
      await sql.query(`INSERT INTO ai_runs(run_id,agent_id,agent_version,model_id,model_provider,model_version,prompt_id,prompt_version,tenant_id,client_id,tax_case_id,case_record_id,tax_year,workflow_stage,request_id,requested_by,input_hash,status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'QUEUED')`,
        [run_id,s.agent.agent_id,s.version.version,s.model.model_id,s.model.provider,s.model.model_version,s.prompt.prompt_id,s.prompt.version,c.identity.tenant_id,ctx.scope.client_id,ctx.scope.tax_case_id,s.case.id,ctx.scope.tax_year,ctx.workflow_stage,`gateway_${ctx.operation_id}`,c.identity.uid,c.input_hash]);
      await sql.query(`INSERT INTO ai_gateway_admissions(run_id,root_id,operation_id,tenant_id,actor_uid,client_id,tax_case_id,tax_year,decision_id,pricing_id,binding_hash,input_hash,prompt_hash,schema_hash,pricing_hash,reserved_tokens,reserved_nanos)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,[run_id,ctx.root_id,ctx.operation_id,c.identity.tenant_id,c.identity.uid,ctx.scope.client_id,ctx.scope.tax_case_id,ctx.scope.tax_year,c.decision.decision_id,pricing.pricing_id,c.binding_hash,c.input_hash,c.prompt_hash,c.schema_hash,pricing.configuration_hash,reserved_tokens,reserved_nanos]);
      for(const source of ctx.evidence_source_ids)await sql.query('INSERT INTO ai_run_evidence(run_id,tenant_id,client_id,tax_case_id,tax_year,source_id) VALUES($1,$2,$3,$4,$5,$6)',[run_id,c.identity.tenant_id,ctx.scope.client_id,ctx.scope.tax_case_id,ctx.scope.tax_year,source]);
      return {run_id,configuration:c,pricing,reserved_tokens,reserved_nanos};
    });}catch(error){
      if(error instanceof GovernanceError){
        try{await this.db.transaction(async sql=>{await sql.query("INSERT INTO ai_policy_events(tenant_id,agent_id,event_type,actor_uid,severity,details) VALUES($1,$2,'POLICY_VIOLATION',$3,'MATERIAL',$4)",[c.identity.tenant_id,c.snapshot.agent.agent_id,c.identity.uid,JSON.stringify({code:error.code})]);});}catch{throw new GovernanceError('AI_GATEWAY_AUDIT_UNAVAILABLE',503);}
        throw error;
      }
      throw new GovernanceError('AI_GATEWAY_AUDIT_UNAVAILABLE',503);
    }
  }
  async reserveAttempt(a:Admission,attempt:number,decision_id:string):Promise<string>{
    try{return await this.db.transaction(async sql=>{
      await this.lock(sql,a.configuration.identity.tenant_id);
      const attempt_id=randomUUID();
      await sql.query('INSERT INTO ai_gateway_attempts(attempt_id,run_id,tenant_id,actor_uid,attempt,decision_id) VALUES($1,$2,$3,$4,$5,$6)',[attempt_id,a.run_id,a.configuration.identity.tenant_id,a.configuration.identity.uid,attempt,decision_id]);
      await sql.query("UPDATE ai_runs SET status='RUNNING',started_at=coalesce(started_at,now()) WHERE run_id=$1",[a.run_id]);
      return attempt_id;
    });}catch{throw new GovernanceError('AI_GATEWAY_AUDIT_UNAVAILABLE',503);}
  }
  async finish(a:Admission,o:AttemptOutcome){
    try{await this.db.transaction(async sql=>{
      await this.lock(sql,a.configuration.identity.tenant_id);
      await sql.query(`INSERT INTO ai_gateway_outcomes(run_id,attempt_id,status,terminal,transport_state,reason_code,usage_state,input_tokens,output_tokens,total_tokens,cost_nanos,output_hash,decision_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[a.run_id,o.attempt_id,o.status,o.terminal,o.transport_state,o.reason_code,o.accounting.state,o.accounting.input_tokens,o.accounting.output_tokens,o.accounting.total_tokens,o.accounting.cost_nanos,o.output_hash,o.decision_id]);
      if(o.terminal)await sql.query(`UPDATE ai_runs SET status=$2,output_hash=$3,token_usage=$4,estimated_cost=$5,completed_at=now() WHERE run_id=$1`,[a.run_id,o.status==='ACCEPTED'?'REVIEW_REQUIRED':o.status==='CANCELLED'?'CANCELLED':'FAILED',o.output_hash,o.accounting.total_tokens,o.accounting.cost_nanos===null?null:nanosToRunCost(o.accounting.cost_nanos)]);
    });}catch{throw new GovernanceError('AI_GATEWAY_AUDIT_UNAVAILABLE',503);}
  }
}
