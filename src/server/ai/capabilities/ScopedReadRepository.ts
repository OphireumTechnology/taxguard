import { randomUUID } from 'node:crypto';
import { GovernanceError, type GovernanceRequest } from '../governance/contracts';
import { evaluateGovernancePolicy } from '../governance/GovernanceControlPlane';
import { SqlGovernanceStore, type TransactionalSql } from '../governance/SqlGovernanceStore';
import type { ResolvedConfiguration } from '../gateway/contracts';
import type { CapabilityRequest, CapabilityOutput, EvidenceMetadata } from './contracts';

/** Server-owned SQL projections only. No generic query or storage-content capability exists. */
export class ScopedReadRepository {
  constructor(private readonly db: TransactionalSql) {}
  async read(c: ResolvedConfiguration,r: CapabilityRequest,signal: AbortSignal): Promise<CapabilityOutput> {
    return this.db.transaction(async sql => {
      if(signal.aborted) throw new GovernanceError('AI_OPERATION_CANCELLED',409);
      // Reuse AI-2 policy and authority inside the same read transaction; no cached parent permit.
      const request: GovernanceRequest={request_id:randomUUID(),agent_id:c.context.agent_id,scope:c.context.scope,workflow_stage:c.context.workflow_stage,intent:'ADVISORY',purpose:c.context.purpose,
        capabilities:[{tool_id:r.proposal.capability_id,action:'READ'}],data_classes:['INTERNAL'],evidence_source_ids:[...c.context.evidence_source_ids],confidence:0,financial_amount:0,risk_level:'MATERIAL'};
      const snapshot=await new SqlGovernanceStore({transaction:work=>work(sql)}).transaction(tx=>tx.load(c.identity,request));
      evaluateGovernancePolicy(request,snapshot,Date.now());
      if(signal.aborted) throw new GovernanceError('AI_OPERATION_CANCELLED',409);
      const scope=c.context.scope;
      switch(r.proposal.capability_id) {
        case 'workflow.read': {
          const rows=(await sql.query<{stage:number;status:'ACTIVE'|'IN_REVIEW'|'READY'}>(`SELECT active_stage AS stage,status FROM taxguard_cases WHERE id=$1 AND tenant_id=$2 AND client_id=$3 AND case_id=$4 AND tax_year=$5 LIMIT 1`,[snapshot.case.id,c.identity.tenant_id,scope.client_id,scope.tax_case_id,scope.tax_year])).rows;
          if(rows.length!==1) throw new GovernanceError('AI_CASE_ACCESS_DENIED');
          return {capability_id:'workflow.read',workflow_version:'LEGACY_18_V1',...rows[0]};
        }
        case 'document.read': {
          const ids=r.proposal.arguments.source_ids as string[];
          const rows=(await sql.query<EvidenceMetadata>(`SELECT e.source_id,e.document_record_id,e.document_version,e.source_hash,d.status AS document_status,d.quarantine_status
            FROM ai_evidence_sources e JOIN taxguard_documents d ON d.id=e.document_record_id
            WHERE e.source_id=ANY($1::uuid[]) AND e.tenant_id=$2 AND e.client_id=$3 AND e.tax_case_id=$4 AND e.tax_year=$5 AND e.case_record_id=$6
            AND d.tenant_id=e.tenant_id AND d.client_id=e.client_id AND d.case_id=e.tax_case_id AND d.tax_year=e.tax_year
            AND d.version=e.document_version AND d.hash=e.source_hash AND d.status IN ('RELEASED','VERIFIED') AND d.quarantine_status='CLEAN'
            ORDER BY e.source_id LIMIT 10`,[ids,c.identity.tenant_id,scope.client_id,scope.tax_case_id,scope.tax_year,snapshot.case.id])).rows;
          if(rows.length!==ids.length) throw new GovernanceError('AI_CAPABILITY_EVIDENCE_DENIED');
          return {capability_id:'document.read',evidence:rows};
        }
        default: throw new GovernanceError('AI_CAPABILITY_UNAVAILABLE');
      }
    });
  }
}
