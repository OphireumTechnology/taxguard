import { afterAll,beforeAll,beforeEach,describe,it,expect,vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { capabilityFixture,scope } from './aiCapabilities.fixture';
import { SqlGatewayStore } from '../server/ai/gateway/SqlGatewayStore';
import { digest } from '../server/ai/gateway/ModelPromptResolver';
import { HumanProposalReviewService } from '../server/ai/review/HumanProposalReviewService';
import type { SessionAuthority } from '../server/ai/governance/contracts';
let f:Awaited<ReturnType<typeof capabilityFixture>>,service:HumanProposalReviewService;
const sessions:SessionAuthority={verify:async token=>token==='reviewer'?{uid:'reviewer',tenant_id:'tenantA'}:token==='valid'?{uid:'preparer',tenant_id:'tenantA'}:null};
const output={status:'ADVISORY',confidence:'UNVERIFIED',finding_codes:['REVIEW_REQUIRED']};
async function request() {
  const c=await f.resolver.resolve('valid',await f.context());
  const admitted=await new SqlGatewayStore(f.db).admit(c);
  await f.pg.query("UPDATE ai_runs SET status='RUNNING' WHERE run_id=$1",[admitted.run_id]);
  await f.pg.query("UPDATE ai_runs SET status='REVIEW_REQUIRED',output_hash=$2 WHERE run_id=$1",[admitted.run_id,digest(output)]);
  const proposalId=randomUUID();
  await f.pg.query("INSERT INTO ai_proposals(proposal_id,run_id,tenant_id,client_id,tax_case_id,tax_year,structured_output,output_hash) VALUES($1,$2,'tenantA','clientA','caseA',2025,$3,$4)",[proposalId,admitted.run_id,output,digest(output)]);
  return {request_id:randomUUID(),scope:{...scope},run_id:admitted.run_id,proposal_id:proposalId,decision:'RETURNED' as const,reason:'Please inspect the supporting evidence and resolve the flagged review question.'};
}
beforeAll(async()=>{
  f=await capabilityFixture();
},30000);
beforeEach(async()=>{
  vi.unstubAllEnvs();
  // Existing capability reset normalizes all fixture assignments to preparer; add the independent reviewer afterwards.
  await f.pg.exec("DELETE FROM taxguard_staff_assignments WHERE id='review-human'; DELETE FROM taxguard_case_assignments WHERE uid='reviewer';");
  await f.reset();
  await f.pg.exec("INSERT INTO taxguard_case_assignments(case_id,tenant_id,uid,role) VALUES('caseA','tenantA','reviewer','reviewer'); INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,engagement_id,tax_year,role,user_id,assigned_by) VALUES('review-human','tenantA','clientA','engA',2025,'reviewer','reviewer','test');");
  service=new HumanProposalReviewService(sessions,f.db);
});
afterAll(async()=>{vi.unstubAllEnvs();await f?.pg.close();});
describe('human-controlled proposal correction/rejection',()=>{
  it('returns a bounded advisory proposal with immutable identity and reason, without tax/workflow action',async()=>{
    const r=await request(),result=await service.decide('reviewer',r);
    expect(result).toMatchObject({decision:'RETURNED',authoritative_mutation:false,workflow_advanced:false});
    const review=(await f.pg.query<{reviewer_user_id:string;reason:string;decision:string}>('SELECT reviewer_user_id,reason,decision FROM ai_human_reviews WHERE review_id=$1',[result.review_id])).rows[0];
    expect(review).toEqual({reviewer_user_id:'reviewer',reason:r.reason,decision:'RETURNED'});
    await expect(f.pg.query('DELETE FROM ai_human_reviews WHERE review_id=$1',[result.review_id])).rejects.toThrow('AI_IMMUTABLE_HISTORY');
    expect((await f.pg.query('SELECT active_stage FROM taxguard_cases WHERE case_id=\'caseA\'')).rows).toEqual([{active_stage:3}]);
    expect((await f.pg.query('SELECT count(*)::int AS n FROM ai_authoritative_actions')).rows).toEqual([{n:0}]);
  });
  it('rejects a proposal as an independent human and records the terminal run transition atomically',async()=>{
    const r=await request();await service.decide('reviewer',{...r,decision:'REJECTED'});
    expect((await f.pg.query('SELECT status FROM ai_runs WHERE run_id=$1',[r.run_id])).rows).toEqual([{status:'REJECTED'}]);
    expect((await f.pg.query('SELECT status FROM ai_run_transitions WHERE run_id=$1 ORDER BY sequence DESC LIMIT 1',[r.run_id])).rows).toEqual([{status:'REJECTED'}]);
  });
  it.each(['','forged','preparer-browser-id'])('denies unauthenticated %s',async token=>{
    const r=await request();await expect(service.decide(token,r)).rejects.toThrow('AI_AUTH_REQUIRED');expect((await f.pg.query('SELECT count(*)::int AS n FROM ai_human_reviews WHERE run_id=$1',[r.run_id])).rows).toEqual([{n:0}]);
  });
  it.each(['tenant_id','client_id','tax_case_id','tax_year'])('denies cross-%s scope',async field=>{
    const r=await request();r.scope={...r.scope,[field]:field==='tax_year'?2024:'foreign'};
    await expect(service.decide('reviewer',r)).rejects.toThrow(/AI_TENANT_DENIED|AI_REVIEW_SCOPE_DENIED/);
  });
  it('denies the initiating preparer rather than deriving reviewer identity from payload',async()=>{
    await expect(service.decide('valid',await request())).rejects.toThrow('AI_REVIEW_ROLE_DENIED');
  });
  it.each(['client','accountant','operations','administrator'])('does not give %s reviewer authority',async role=>{
    const r=await request();await f.pg.query("UPDATE taxguard_members SET role=$1 WHERE uid='reviewer'",[role]);
    try{await expect(service.decide('reviewer',r)).rejects.toThrow('AI_REVIEW_ROLE_DENIED');}finally{await f.pg.exec("UPDATE taxguard_members SET role='reviewer' WHERE uid='reviewer'");}
  });
  it.each([
    "UPDATE taxguard_case_assignments SET active=false WHERE uid='reviewer'",
    "UPDATE taxguard_staff_assignments SET status='REVOKED' WHERE user_id='reviewer'",
    "UPDATE taxguard_staff_assignments SET tax_year=2024 WHERE user_id='reviewer'",
    "UPDATE taxguard_staff_assignments SET effective_to=now()-interval '1 day' WHERE user_id='reviewer'",
  ])('denies stale/revoked/out-of-year assignment: %s',async sql=>{
    const r=await request();await f.pg.exec(sql);await expect(service.decide('reviewer',r)).rejects.toThrow('AI_REVIEW_ASSIGNMENT_DENIED');
  });
  it('rejects missing evidence and does not trust a proposal hash as source authority',async()=>{
    const r=await request();await f.pg.exec("UPDATE taxguard_documents SET quarantine_status='QUARANTINED'");
    await expect(service.decide('reviewer',r)).rejects.toThrow('AI_EVIDENCE_UNVERIFIED');
  });
  it('rejects changed authoritative workflow stage',async()=>{
    const r=await request();await f.pg.exec('UPDATE taxguard_cases SET active_stage=4');await expect(service.decide('reviewer',r)).rejects.toThrow('AI_WORKFLOW_MISMATCH');
  });
  it('requires a meaningful bounded reason',async()=>{
    const r=await request();await expect(service.decide('reviewer',{...r,reason:'bad'})).rejects.toThrow('AI_INVALID_HUMAN_REVIEW');await expect(service.decide('reviewer',{...r,reason:'x'.repeat(2001)})).rejects.toThrow('AI_INVALID_HUMAN_REVIEW');
  });
  it.each(['reviewer_user_id','role','handler','approved','evidence_override'])('rejects browser authority override %s',async field=>{
    await expect(service.decide('reviewer',{...await request(),[field]:'privileged'})).rejects.toThrow('AI_INVALID_HUMAN_REVIEW');
  });
  it('keeps approval unavailable until the full human chain is enforceable',async()=>{
    await expect(service.decide('reviewer',{...await request(),decision:'APPROVED'})).rejects.toThrow('AI_HUMAN_APPROVAL_CHAIN_UNAVAILABLE');
  });
  it('enforces a global kill switch without recording a successful human review',async()=>{
    const r=await request();await f.kill('GLOBAL');await expect(service.decide('reviewer',r)).rejects.toThrow('AI_KILL_SWITCH_ACTIVE');
  });
  it('prevents repeated requests from duplicating immutable review history',async()=>{
    const r=await request();await service.decide('reviewer',r);await expect(service.decide('reviewer',r)).rejects.toThrow('AI_REPLAY_DENIED');
    expect((await f.pg.query('SELECT review_id FROM ai_human_reviews WHERE run_id=$1',[r.run_id])).rows).toHaveLength(1);
  });
  it('has one winner for concurrent duplicate human decisions',async()=>{
    const r=await request();const results=await Promise.allSettled([service.decide('reviewer',r),service.decide('reviewer',r)]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
  });
  it('fails closed on audit persistence outage',async()=>{
    const r=await request();const unavailable=new HumanProposalReviewService(sessions,{transaction:async()=>{throw new Error('private database detail');}});
    await expect(unavailable.decide('reviewer',r)).rejects.toThrow('AI_HUMAN_REVIEW_UNAVAILABLE');
  });
  it('does not commission production human-review cutover',async()=>{
    const r=await request();vi.stubEnv('NODE_ENV','production');await expect(service.decide('reviewer',r)).rejects.toThrow('AI_HUMAN_REVIEW_CUTOVER_UNAVAILABLE');vi.unstubAllEnvs();
  });
});
