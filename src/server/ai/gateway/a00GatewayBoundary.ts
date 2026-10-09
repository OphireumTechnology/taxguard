import type { AdvisoryHandler } from '../orchestration/contracts';
import { GovernedAIGateway } from './GovernedAIGateway';

/** Token remains in the trusted server closure; a child never receives it. */
export function createA00GatewayHandler(gateway:GovernedAIGateway,token:string):AdvisoryHandler{
  return async(context,signal)=>{
    const result=await gateway.execute(token,context,signal);
    // These are provider's validated advisory codes, never fabricated verified findings/confidence.
    return {operation_id:context.operation_id,agent_id:context.agent_id,status:'ADVISORY',human_review_required:true,action_executed:false,
      evidence_source_ids:[...result.provenance.evidence_source_ids],finding_codes:result.output.finding_codes};
  };
}
