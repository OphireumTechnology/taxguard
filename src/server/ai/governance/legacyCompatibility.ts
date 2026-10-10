import { GovernanceError } from './contracts';
import { getProductionGovernance } from './productionGovernance';
import type { GovernanceControlPlane } from './GovernanceControlPlane';
import type { TaxGuardAuthorityRepository, CaseScope } from '../../taxguard/authority.repository';

/** Canonical classification of the existing counts-only provider's purposes.
 * This does not activate A34 or claim the legacy provider implements A34. */
export const LEGACY_ADVISORY_AGENT = Object.freeze({
  REVIEW_EVIDENCE_COMPLETENESS: 'A34', IDENTIFY_REVIEW_QUESTIONS: 'A34',
} as const);

export async function assessLegacyCaseReview(repository:TaxGuardAuthorityRepository,scope:CaseScope,uid:string,token:string,input:unknown,plane:GovernanceControlPlane=getProductionGovernance()):Promise<never> {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new GovernanceError('AI_INVALID_REQUEST',400);
  const value=input as Record<string,unknown>;
  if(Object.keys(value).some(key=>!['evidenceId','purpose','revision','operationId'].includes(key))||typeof value.purpose!=='string'||!Object.hasOwn(LEGACY_ADVISORY_AGENT,value.purpose))throw new GovernanceError('AI_INVALID_REQUEST',400);
  // Use the existing repository's authoritative membership/case/evidence checks;
  // caller-supplied IDs remain selectors, never an authorization identity.
  const current=await repository.getCase(scope,uid);
  await repository.getEvidence(scope,uid,value.evidenceId as string);
  // Legacy evidence IDs do not prove ai_evidence_sources provenance. A UUID ID may
  // be evaluated as a durable source only by the new scoped SQL store.
  if(typeof value.evidenceId!=='string'||!/^[0-9a-f-]{36}$/i.test(value.evidenceId))throw new GovernanceError('AI_LEGACY_EVIDENCE_MAPPING_REQUIRED',503);
  await plane.evaluate(token,{request_id:value.operationId,agent_id:LEGACY_ADVISORY_AGENT[value.purpose as keyof typeof LEGACY_ADVISORY_AGENT],
    scope:{tenant_id:scope.tenantId,client_id:scope.clientId,tax_case_id:current.caseId,tax_year:scope.taxYear},workflow_stage:current.activeStage,
    intent:'ADVISORY',purpose:value.purpose,capabilities:[{tool_id:'workflow.read',action:'READ'}],data_classes:['INTERNAL'],
    evidence_source_ids:[value.evidenceId],confidence:0,financial_amount:0,risk_level:'MATERIAL'});
  // AI-2 evaluates governance, never dispatches or pretends the memory-backed
  // request/trace services are a durable canonical ai_run execution.
  throw new GovernanceError('AI_LEGACY_CUTOVER_REQUIRED',503);
}
