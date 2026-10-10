import { findCanonicalAgent } from '../../../ai/registry';
import { GovernanceError } from '../governance/contracts';
import { parseGovernanceRequest } from '../governance/GovernanceControlPlane';
import type { OrchestrationRequest, ReviewTask } from './contracts';

/** Only legacy purposes whose canonical mapping is already documented are commissioned for planning. */
export function routeTask(task: ReviewTask) {
  if(task==='DOCUMENT_DUPLICATE_CHECK')return {agent:findCanonicalAgent('A10'),capabilities:[{tool_id:'document.read',action:'READ' as const}],data_classes:['INTERNAL' as const]};
  if(!['IDENTIFY_REVIEW_QUESTIONS','REVIEW_EVIDENCE_COMPLETENESS'].includes(task))throw new GovernanceError('AI_ROUTING_UNAVAILABLE',503);
  return {agent:findCanonicalAgent('A34'),capabilities:[{tool_id:'workflow.read',action:'READ' as const}],data_classes:['INTERNAL' as const]};
}
export function parseOrchestrationRequest(raw: unknown): OrchestrationRequest {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new GovernanceError('AI_INVALID_REQUEST',400);
  const r=raw as OrchestrationRequest;
  if(Object.keys(r).sort().join(',')!=='evidence_source_ids,request_id,scope,tasks'||!Array.isArray(r.tasks)||!r.tasks.length||r.tasks.length>2||new Set(r.tasks).size!==r.tasks.length)throw new GovernanceError('AI_INVALID_REQUEST',400);
  for(const task of r.tasks)routeTask(task);
  parseGovernanceRequest({request_id:r.request_id,agent_id:'A00',scope:r.scope,workflow_stage:1,intent:'ADVISORY',purpose:'COORDINATE_REVIEW',capabilities:[{tool_id:'workflow.read',action:'READ'}],data_classes:['INTERNAL'],evidence_source_ids:r.evidence_source_ids,confidence:0,financial_amount:0,risk_level:'MATERIAL'});
  return structuredClone(r);
}
