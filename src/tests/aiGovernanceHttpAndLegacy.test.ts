import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { GovernanceError } from '../server/ai/governance/contracts';
import type { GovernanceControlPlane } from '../server/ai/governance/GovernanceControlPlane';

// HTTP authentication transport is isolated; direct governance tests verify
// independent session authority plus actual persisted membership/assignments.
vi.mock('../server/auth',async importOriginal=>{
 const actual=await importOriginal<typeof import('../server/auth')>();
 return {...actual,authenticateToken:(req:any,res:any,next:any)=>{
  if(req.headers.authorization!=='Bearer verified')return res.status(401).json({code:'AUTH_REQUIRED'});
  req.token='server-verified-session';req.user={id:'trusted-user',tenantId:'tenantA',role:'accountant'};next();
 }};
});
import { createAiGovernanceRouter } from '../server/routes/ai-governance.routes';
import { assessLegacyCaseReview, LEGACY_ADVISORY_AGENT } from '../server/ai/governance/legacyCompatibility';
import { createProductionApp } from '../server/productionApp';
const evaluate=vi.fn();
let server:Server,origin:string;
beforeAll(async()=>{
 const app=express();app.use(express.json());app.use('/api/ai-governance',createAiGovernanceRouter(()=>({evaluate} as unknown as GovernanceControlPlane)));
 server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(()=>{evaluate.mockReset();vi.unstubAllEnvs();});
afterAll(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
const post=(body:unknown,authenticated=true)=>fetch(`${origin}/api/ai-governance/evaluate`,{method:'POST',headers:{'Content-Type':'application/json',...(authenticated?{Authorization:'Bearer verified'}:{})},body:JSON.stringify(body)});

describe('AI-2 HTTP authentication and honest errors',()=>{
 it('rejects unauthenticated assessment without calling policy code',async()=>{expect((await post({},false)).status).toBe(401);expect(evaluate).not.toHaveBeenCalled();});
 it('passes only the server verified token, not the body identity, to the control plane',async()=>{
  evaluate.mockRejectedValue(new GovernanceError('AI_INVALID_REQUEST',400));const body={uid:'forged',role:'super_admin',token:'stolen'};const response=await post(body);expect(response.status).toBe(400);expect(evaluate).toHaveBeenCalledWith('server-verified-session',body);
 });
 it('does not expose private persistence errors or invent success',async()=>{
  evaluate.mockRejectedValue(new Error('PRIVATE DATABASE PASSWORD'));const response=await post({});expect(response.status).toBe(503);expect(await response.json()).toEqual({code:'AI_GOVERNANCE_UNAVAILABLE',action_executed:false,external_submission_allowed:false,requires_human_review:true});
 });
 it('returns advisory policy result without an execution action',async()=>{
  evaluate.mockResolvedValue({outcome:'REVIEW_REQUIRED',action_state:'PROPOSED_ACTION',action_executed:false});const response=await post({});expect(response.headers.get('cache-control')).toBe('no-store');expect(await response.json()).toMatchObject({outcome:'REVIEW_REQUIRED',action_executed:false});
 });
 it('returns unavailable when production schema/configuration is not commissioned',async()=>{
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('TAXGUARD_AI_GOVERNANCE_ENABLED','false');const s=createServer(createProductionApp());await new Promise<void>(resolve=>s.listen(0,'127.0.0.1',resolve));
  try {const response=await fetch(`http://127.0.0.1:${(s.address() as AddressInfo).port}/api/ai-governance/evaluate`,{method:'POST',headers:{Authorization:'Bearer verified','Content-Type':'application/json'},body:'{}'});expect(response.status).toBe(503);expect(await response.json()).toMatchObject({code:'AI_GOVERNANCE_UNAVAILABLE',action_executed:false});}finally{s.closeAllConnections();await new Promise<void>(resolve=>s.close(()=>resolve()));}
 });
});

describe('AI-2 legacy compatibility restrictions',()=>{
 const evidenceId='33333333-3333-4333-8333-333333333333';
 const repo={getCase:vi.fn(async()=>({caseId:'caseA',activeStage:3})),getEvidence:vi.fn(async()=>({}))};
 const scope={tenantId:'tenantA',clientId:'clientA',engagementId:'engA',taxYear:2025};
 const input={operationId:'operation',evidenceId,purpose:'IDENTIFY_REVIEW_QUESTIONS',revision:1};
 const plane={evaluate:vi.fn(async()=>({action_state:'ADVISORY_ONLY',action_executed:false}))};
 it('maps supported legacy advisory purposes to canonical A34',()=>{expect(Object.values(LEGACY_ADVISORY_AGENT)).toEqual(['A34','A34']);});
 it('never dispatches legacy provider after policy assessment; cutover remains blocked',async()=>{
  await expect(assessLegacyCaseReview(repo as any,scope,'preparer','trusted-token',input,plane as any)).rejects.toThrow('AI_LEGACY_CUTOVER_REQUIRED');expect(plane.evaluate).toHaveBeenCalledWith('trusted-token',expect.objectContaining({agent_id:'A34',workflow_stage:3,scope:{tenant_id:'tenantA',client_id:'clientA',tax_case_id:'caseA',tax_year:2025}}));
 });
 it('requires durable evidence mapping instead of relabeling memory IDs',async()=>{await expect(assessLegacyCaseReview(repo as any,scope,'preparer','trusted-token',{...input,evidenceId:'ev1'},plane as any)).rejects.toThrow('AI_LEGACY_EVIDENCE_MAPPING_REQUIRED');});
 it('retains existing case/evidence authorization rejection',async()=>{
  const denied={...repo,getCase:async()=>{throw new Error('CASE_ACCESS_DENIED');}};await expect(assessLegacyCaseReview(denied as any,scope,'other','trusted-token',input,plane as any)).rejects.toThrow('CASE_ACCESS_DENIED');
 });
 it('rejects browser identity override in legacy input',async()=>{await expect(assessLegacyCaseReview(repo as any,scope,'preparer','trusted-token',{...input,actor:'forged'},plane as any)).rejects.toThrow('AI_INVALID_REQUEST');});
 it('rejects unknown purpose instead of inventing a specialized agent',async()=>{await expect(assessLegacyCaseReview(repo as any,scope,'preparer','trusted-token',{...input,purpose:'AUTONOMOUS_FILE'},plane as any)).rejects.toThrow('AI_INVALID_REQUEST');});
});
