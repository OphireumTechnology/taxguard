import { Router } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import type { GovernanceControlPlane } from '../ai/governance/GovernanceControlPlane';
import { GovernanceError } from '../ai/governance/contracts';
import { getProductionGovernance } from '../ai/governance/productionGovernance';

/** Policy assessment only; never an execution/approval/kill-switch mutation API. */
export function createAiGovernanceRouter(getPlane:()=>GovernanceControlPlane=getProductionGovernance) {
  const router=Router();
  router.post('/evaluate',authenticateToken,async(req:AuthenticatedRequest,res)=>{
    res.setHeader('Cache-Control','no-store');
    try {
      // Identity is independently re-verified by the control plane; req.body User
      // objects, uid, role, approval flags or policy overrides are never accepted.
      const decision=await getPlane().evaluate(req.token??'',req.body);
      res.json(decision);
    } catch(error) {
      const known=error instanceof GovernanceError;
      res.status(known?error.status:503).json({code:known?error.code:'AI_GOVERNANCE_UNAVAILABLE',action_executed:false,external_submission_allowed:false,requires_human_review:true});
    }
  });
  return router;
}
