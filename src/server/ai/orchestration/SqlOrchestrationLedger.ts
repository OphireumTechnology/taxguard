import type { TransactionalSql } from '../governance/SqlGovernanceStore';
import { GovernanceError } from '../governance/contracts';
import type { OperationEvent, OrchestrationLedger, RootRecord } from './contracts';

/** Durable append-only orchestration history; not a provider ai_run or tax action ledger. */
export class SqlOrchestrationLedger implements OrchestrationLedger {
  constructor(private readonly db: TransactionalSql) {}
  async begin(r: RootRecord) {
    try {
      const replay=await this.db.transaction(async sql=>{
        await sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`A00:${r.identity.tenant_id}:${r.identity.uid}:${r.request_key}`]);
        const previous=await sql.query<{input_hash:string}>('SELECT input_hash FROM ai_orchestration_roots WHERE tenant_id=$1 AND actor_uid=$2 AND request_key=$3',[r.identity.tenant_id,r.identity.uid,r.request_key]);
        if(previous.rows.length)return previous.rows[0].input_hash===r.input_hash?'AI_REPLAY_DENIED':'AI_REPLAY_MISMATCH';
        await sql.query(`INSERT INTO ai_orchestration_roots(root_id,tenant_id,actor_uid,request_key,input_hash,case_record_id,client_id,tax_case_id,tax_year,workflow_stage,coordinator_decision_id)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[r.root_id,r.identity.tenant_id,r.identity.uid,r.request_key,r.input_hash,r.case_record_id,r.scope.client_id,r.scope.tax_case_id,r.scope.tax_year,r.workflow_stage,r.coordinator_decision_id]);
        return null;
      });
      if(replay)throw new GovernanceError(replay,409);
    }catch(error){if(error instanceof GovernanceError)throw error;throw new GovernanceError('AI_ORCHESTRATION_AUDIT_UNAVAILABLE',503);}
  }
  async append(r: RootRecord,e: OperationEvent) {
    try {
      await this.db.transaction(async sql=>{
        await sql.query(`INSERT INTO ai_orchestration_events(root_id,tenant_id,actor_uid,operation_id,agent_id,attempt,status,decision_id,reason_code,output_hash,purpose)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[r.root_id,r.identity.tenant_id,r.identity.uid,e.operation_id,e.agent_id,e.attempt,e.status,e.decision_id,e.reason_code,e.output_hash,e.purpose]);
      });
    }catch{throw new GovernanceError('AI_ORCHESTRATION_AUDIT_UNAVAILABLE',503);}
  }
}
