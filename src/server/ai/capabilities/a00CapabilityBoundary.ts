import type { AdvisoryHandler } from '../orchestration/contracts';
import type { CapabilityProposal } from './contracts';
import { GovernedCapabilityExecutor } from './GovernedCapabilityExecutor';

/** Server closure retains identity. Metadata never reaches the model; no new provider profile or tool call. */
export function createA00CapabilityHandler(executor:GovernedCapabilityExecutor,token:string,proposal:CapabilityProposal):AdvisoryHandler {
  const fixed=structuredClone(proposal);
  return async(context,signal)=>{
    await executor.execute(token,{context,proposal:fixed},signal);
    return {operation_id:context.operation_id,agent_id:context.agent_id,status:'ADVISORY',human_review_required:true,action_executed:false,
      evidence_source_ids:[...context.evidence_source_ids],finding_codes:['REVIEW_REQUIRED']};
  };
}
