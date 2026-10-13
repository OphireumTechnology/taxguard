import { Router } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../auth';
import type { GovernanceControlPlane } from '../ai/governance/GovernanceControlPlane';
import type { KillSwitchService } from '../ai/governance/KillSwitchService';
import { GovernanceError } from '../ai/governance/contracts';
import type { ControlCenterReadService } from '../ai/governance/ControlCenterReadService';
import { getProductionControlCenter, getProductionGovernance, getProductionKillSwitches } from '../ai/governance/productionGovernance';

/**
 * Policy assessment plus emergency-stop activation. Never an execution/approval API,
 * and never a kill-switch deactivation API (lifting a stop requires an approved policy).
 */
export function createAiGovernanceRouter(getPlane:()=>GovernanceControlPlane=getProductionGovernance,getKillSwitches:()=>KillSwitchService=getProductionKillSwitches,getControlCenter:()=>ControlCenterReadService=getProductionControlCenter) {
  const router=Router();
  // AI Control Center read-only projections; the service re-verifies role and tenant on every call.
  const readOnly=(handler:(service:ControlCenterReadService,token:string,query:unknown)=>Promise<unknown>)=>async(req:AuthenticatedRequest,res:any)=>{
    res.setHeader('Cache-Control','no-store');
    try { res.json(await handler(getControlCenter(),req.token??'',req.query)); }
    catch(error) { const known=error instanceof GovernanceError; res.status(known?error.status:503).json({code:known?error.code:'AI_CONTROL_CENTER_UNAVAILABLE'}); }
  };
  router.get('/control-center/registry',authenticateToken,readOnly((s,t)=>s.registry(t)));
  router.get('/control-center/runs',authenticateToken,readOnly((s,t,q)=>s.runs(t,q)));
  router.get('/control-center/decisions',authenticateToken,readOnly((s,t,q)=>s.decisions(t,q)));
  router.get('/control-center/security-events',authenticateToken,readOnly((s,t,q)=>s.securityEvents(t,q)));
  router.get('/control-center/usage',authenticateToken,readOnly((s,t,q)=>s.usage(t,q)));
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
  const killSwitchFailure=(res:any,error:unknown)=>{
    const known=error instanceof GovernanceError;
    res.status(known?error.status:503).json({code:known?error.code:'AI_KILL_SWITCH_UNAVAILABLE'});
  };
  router.get('/kill-switches',authenticateToken,async(req:AuthenticatedRequest,res)=>{
    res.setHeader('Cache-Control','no-store');
    try { res.json({kill_switches:await getKillSwitches().list(req.token??'')}); } catch(error) { killSwitchFailure(res,error); }
  });
  router.post('/kill-switches',authenticateToken,async(req:AuthenticatedRequest,res)=>{
    res.setHeader('Cache-Control','no-store');
    // Identity, role and tenant are re-verified by the service; body carries only scope/agent/reason.
    try { res.status(201).json(await getKillSwitches().activate(req.token??'',req.body)); } catch(error) { killSwitchFailure(res,error); }
  });
  return router;
}
