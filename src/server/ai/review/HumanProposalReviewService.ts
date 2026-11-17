import { createHash, randomUUID } from 'node:crypto';
import type { AICaseScope } from '../../../ai/types';
import { GovernanceError, type GovernanceRequest, type SessionAuthority } from '../governance/contracts';
import { SqlGovernanceStore, type TransactionalSql } from '../governance/SqlGovernanceStore';
import { digest } from '../gateway/ModelPromptResolver';
import { COUNTS_REVIEW_SCHEMA, validateStructuredOutput } from '../gateway/structuredOutput';

interface HumanReviewRequest {
  request_id:string; scope:AICaseScope; run_id:string; proposal_id:string;
  decision:'RETURNED'|'REJECTED'|'APPROVED'; reason:string;
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function parse(raw:unknown):HumanReviewRequest {
  const r=raw as HumanReviewRequest;
  if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).sort().join(',')!=='decision,proposal_id,reason,request_id,run_id,scope'||
    ![r.request_id,r.run_id,r.proposal_id].every(id=>typeof id==='string'&&uuid.test(id))||
    !r.scope||typeof r.scope!=='object'||Object.keys(r.scope).sort().join(',')!=='client_id,tax_case_id,tax_year,tenant_id'||
    ![r.scope.tenant_id,r.scope.client_id,r.scope.tax_case_id].every(id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(id))||
    !Number.isInteger(r.scope.tax_year)||r.scope.tax_year<2000||r.scope.tax_year>2200||
    !['RETURNED','REJECTED','APPROVED'].includes(r.decision)||typeof r.reason!=='string'||r.reason.trim().length<10||r.reason.length>2000)
    throw new GovernanceError('AI_INVALID_HUMAN_REVIEW',400);
  return structuredClone(r);
}

/** Human-only correction/rejection of bounded advisory proposals. No approval or final-action authority. */
export class HumanProposalReviewService {
  constructor(private readonly sessions:SessionAuthority,private readonly db:TransactionalSql) {}
  async decide(token:string,raw:unknown) {
    const r=parse(raw);
    let identity;
    try {identity=await this.sessions.verify(token);}catch {throw new GovernanceError('AI_AUTH_UNAVAILABLE',503);}
    if(!identity)throw new GovernanceError('AI_AUTH_REQUIRED',401);
    if(identity.tenant_id!==r.scope.tenant_id)throw new GovernanceError('AI_TENANT_DENIED');
    try {
      return await this.db.transaction(async sql=>{
        const run=(await sql.query<{agent_id:string;status:string;case_record_id:string;requested_by:string;workflow_stage:number;output_hash:string;model_id:string;model_version:string}>(
          'SELECT agent_id,status,case_record_id,requested_by,workflow_stage,output_hash,model_id,model_version FROM ai_runs WHERE run_id=$1 AND tenant_id=$2 AND client_id=$3 AND tax_case_id=$4 AND tax_year=$5 FOR UPDATE',
          [r.run_id,identity.tenant_id,r.scope.client_id,r.scope.tax_case_id,r.scope.tax_year])).rows[0];
        if(!run)throw new GovernanceError('AI_REVIEW_SCOPE_DENIED');
        // Lock effective authority records: concurrent revocation either precedes this check or waits for commit.
        await sql.query('SELECT uid FROM taxguard_members WHERE tenant_id=$1 AND uid=$2 FOR SHARE',[identity.tenant_id,identity.uid]);
        await sql.query('SELECT id FROM taxguard_cases WHERE id=$1 FOR SHARE',[run.case_record_id]);
        await sql.query('SELECT id FROM taxguard_case_assignments WHERE tenant_id=$1 AND case_id=$2 AND uid=$3 FOR SHARE',[identity.tenant_id,r.scope.tax_case_id,identity.uid]);
        await sql.query('SELECT id FROM taxguard_staff_assignments WHERE tenant_id=$1 AND client_id=$2 AND tax_year=$3 AND user_id=$4 FOR SHARE',[identity.tenant_id,r.scope.client_id,r.scope.tax_year,identity.uid]);
        const evidence=(await sql.query<{source_id:string}>('SELECT source_id FROM ai_run_evidence WHERE run_id=$1 ORDER BY source_id LIMIT 51',[r.run_id])).rows.map(row=>row.source_id);
        if(!evidence.length||evidence.length>50)throw new GovernanceError('AI_EVIDENCE_REQUIRED');
        const request:GovernanceRequest={request_id:randomUUID(),agent_id:run.agent_id,scope:r.scope,workflow_stage:run.workflow_stage,intent:'ADVISORY',purpose:'IDENTIFY_REVIEW_QUESTIONS',capabilities:[{tool_id:'workflow.read',action:'READ'}],data_classes:['INTERNAL'],evidence_source_ids:evidence,confidence:0,financial_amount:0,risk_level:'MATERIAL'};
        const snapshot=await new SqlGovernanceStore({transaction:work=>work(sql)}).transaction(tx=>tx.load(identity,request));
        if(!snapshot.member||!['reviewer','senior_reviewer'].includes(snapshot.member.role)||snapshot.member.status!=='active')throw new GovernanceError('AI_REVIEW_ROLE_DENIED');
        if(!snapshot.assigned||!snapshot.case||snapshot.case.id!==run.case_record_id||snapshot.case.reviewer_uid!==identity.uid)throw new GovernanceError('AI_REVIEW_ASSIGNMENT_DENIED');
        if(identity.uid===run.requested_by||identity.uid===snapshot.case.preparer_uid)throw new GovernanceError('AI_MAKER_CHECKER_REQUIRED');
        if(snapshot.case.active_stage!==run.workflow_stage||!['ACTIVE','IN_REVIEW','READY'].includes(snapshot.case.status))throw new GovernanceError('AI_WORKFLOW_MISMATCH');
        // This human service is not an agent invocation: inactive historical agents confer no execution rights.
        for(const source of evidence) {
          const e=snapshot.evidence.find(item=>item.source_id===source);
          if(!e||e.evidence_type!=='DOCUMENT'||e.case_record_id!==run.case_record_id||e.document_tenant_id!==r.scope.tenant_id||e.document_client_id!==r.scope.client_id||e.document_case_id!==r.scope.tax_case_id||e.document_tax_year!==r.scope.tax_year||
            e.document_version!==e.actual_document_version||e.source_hash!==e.document_hash||!['RELEASED','VERIFIED'].includes(e.document_status??'')||e.quarantine_status!=='CLEAN')throw new GovernanceError('AI_EVIDENCE_UNVERIFIED');
        }
        if(snapshot.kill_switches.some(sw=>sw.enabled&&(sw.scope==='GLOBAL'||sw.scope==='AGENT'&&sw.agent_id===run.agent_id||sw.scope==='MODEL'&&sw.model_id===run.model_id&&sw.model_version===run.model_version||sw.scope==='TOOL'&&sw.tool_id==='workflow.read'||sw.scope==='WORKFLOW'&&sw.workflow_version==='LEGACY_18_V1'&&sw.workflow_stage===run.workflow_stage)))throw new GovernanceError('AI_KILL_SWITCH_ACTIVE');
        if(r.decision==='APPROVED')throw new GovernanceError('AI_HUMAN_APPROVAL_CHAIN_UNAVAILABLE',503);
        if(run.agent_id!=='A34'||run.status!=='REVIEW_REQUIRED')throw new GovernanceError('AI_REVIEW_STATE_DENIED');
        const proposal=(await sql.query<{structured_output:unknown;output_hash:string;status:string}>("SELECT structured_output,output_hash,status FROM ai_proposals WHERE proposal_id=$1 AND run_id=$2 AND tenant_id=$3 AND client_id=$4 AND tax_case_id=$5 AND tax_year=$6",[r.proposal_id,r.run_id,identity.tenant_id,r.scope.client_id,r.scope.tax_case_id,r.scope.tax_year])).rows[0];
        if(!proposal||!['PROPOSED','REVIEW_REQUIRED'].includes(proposal.status)||proposal.output_hash!==run.output_hash||proposal.output_hash!==digest(proposal.structured_output))throw new GovernanceError('AI_REVIEW_PROPOSAL_DENIED');
        validateStructuredOutput(JSON.stringify(proposal.structured_output),COUNTS_REVIEW_SCHEMA);
        const fresh=await this.sessions.verify(token);
        if(!fresh||fresh.uid!==identity.uid||fresh.tenant_id!==identity.tenant_id)throw new GovernanceError('AI_AUTHORITY_CHANGED');
        if(process.env.NODE_ENV!=='test')throw new GovernanceError('AI_HUMAN_REVIEW_CUTOVER_UNAVAILABLE',503);
        const key=createHash('sha256').update(JSON.stringify([identity.tenant_id,identity.uid,r.request_id])).digest('hex');
        const reviewId=`${key.slice(0,8)}-${key.slice(8,12)}-5${key.slice(13,16)}-a${key.slice(17,20)}-${key.slice(20,32)}`;
        if((await sql.query('SELECT review_id FROM ai_human_reviews WHERE review_id=$1',[reviewId])).rows.length)throw new GovernanceError('AI_REPLAY_DENIED',409);
        await sql.query('INSERT INTO ai_human_reviews(review_id,run_id,proposal_id,tenant_id,client_id,tax_case_id,tax_year,reviewer_user_id,reviewer_role,decision,reason,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())',
          [reviewId,r.run_id,r.proposal_id,identity.tenant_id,r.scope.client_id,r.scope.tax_case_id,r.scope.tax_year,identity.uid,snapshot.member.role,r.decision,r.reason.trim()]);
        await sql.query('UPDATE ai_runs SET status=$2,reviewer=$3,review_decision=$4 WHERE run_id=$1',[r.run_id,r.decision==='REJECTED'?'REJECTED':'REVIEW_REQUIRED',identity.uid,r.decision]);
        return {review_id:reviewId,run_id:r.run_id,proposal_id:r.proposal_id,decision:r.decision,authoritative_mutation:false as const,workflow_advanced:false as const};
      });
    }catch(error) {if(error instanceof GovernanceError)throw error;throw new GovernanceError('AI_HUMAN_REVIEW_UNAVAILABLE',503);}
  }
}
