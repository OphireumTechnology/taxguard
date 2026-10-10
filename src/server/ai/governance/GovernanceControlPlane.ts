import { createHash, randomUUID } from 'node:crypto';
import { findCanonicalAgent } from '../../../ai/registry';
import { hasUnmappedAgentAuthority } from '../../../ai/architectureMapping';
import type { AIAction, DataClassification, Json, RiskLevel } from '../../../ai/types';
import { GovernanceError, type GovernanceDecision, type GovernanceRequest, type GovernanceSnapshot, type GovernanceStore, type SessionAuthority } from './contracts';

const id = /^[A-Za-z0-9_-]{1,128}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions: AIAction[] = ['READ','CREATE','UPDATE','DELETE','EXECUTE','APPROVE','EXPORT','TRANSMIT'];
const data: DataClassification[] = ['PUBLIC','INTERNAL','CLIENT_PII','TAX_DATA','FINANCIAL_DATA','DOCUMENT_CONTENT','AUTHENTICATION_DATA','AUDIT_DATA','SYSTEM_SECRET'];
const risks: RiskLevel[] = ['LOW','MATERIAL','HIGH','CRITICAL'];
const roleCategories: Record<string, readonly string[]> = {
  accountant: ['CLIENT_SERVICES','DOCUMENT_INTELLIGENCE','ACCOUNTING','TAX_INTELLIGENCE','RISK_QC'],
  reviewer: ['DOCUMENT_INTELLIGENCE','TAX_INTELLIGENCE','RISK_QC'],
  senior_reviewer: ['DOCUMENT_INTELLIGENCE','TAX_INTELLIGENCE','RISK_QC'],
  bookkeeper: ['DOCUMENT_INTELLIGENCE','ACCOUNTING'],
  operations: ['CLIENT_SERVICES','PRACTICE_OPERATIONS'],
  practice_manager: ['PRACTICE_OPERATIONS'],
};
const deny = (code: string, status = 403): never => { throw new GovernanceError(code, status); };

/** Reject authority claims, prompts, document text and arbitrary payload keys. */
export function parseGovernanceRequest(raw: unknown): GovernanceRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) deny('AI_INVALID_REQUEST',400);
  const r = raw as GovernanceRequest;
  const allowed=['request_id','agent_id','scope','workflow_stage','intent','purpose','capabilities','data_classes','evidence_source_ids','confidence','financial_amount','risk_level'];
  if (Object.keys(r).some(key=>!allowed.includes(key)) || typeof r.request_id!=='string' || !id.test(r.request_id) || typeof r.agent_id!=='string' ||
      !r.scope || Array.isArray(r.scope) || Object.keys(r.scope).sort().join(',')!=='client_id,tax_case_id,tax_year,tenant_id' ||
      ![r.scope.tenant_id,r.scope.client_id,r.scope.tax_case_id].every(v=>typeof v==='string'&&id.test(v)) ||
      !Number.isInteger(r.scope.tax_year) || r.scope.tax_year<2000 || r.scope.tax_year>2200 ||
      !Number.isInteger(r.workflow_stage) || r.workflow_stage<1 || r.workflow_stage>18 ||
      !['ADVISORY','PROPOSE_ACTION'].includes(r.intent) || typeof r.purpose!=='string' || !/^[A-Z_]{1,80}$/.test(r.purpose) ||
      !risks.includes(r.risk_level) || !Number.isFinite(r.confidence) || r.confidence<0 || r.confidence>1 ||
      !Number.isFinite(r.financial_amount) || r.financial_amount<0 ||
      !Array.isArray(r.capabilities) || !r.capabilities.length || r.capabilities.length>11 ||
      !Array.isArray(r.data_classes) || !r.data_classes.length || r.data_classes.length>9 || r.data_classes.some(v=>!data.includes(v)) ||
      !Array.isArray(r.evidence_source_ids) || !r.evidence_source_ids.length || r.evidence_source_ids.length>50 || r.evidence_source_ids.some(v=>typeof v!=='string'||!uuid.test(v))) deny('AI_INVALID_REQUEST',400);
  if (new Set(r.data_classes).size!==r.data_classes.length || new Set(r.evidence_source_ids).size!==r.evidence_source_ids.length) deny('AI_INVALID_REQUEST',400);
  for (const c of r.capabilities) {
    if (!c || Object.keys(c).sort().join(',')!=='action,tool_id' || typeof c.tool_id!=='string' || !/^[a-z_]+[.][a-z_]+$/.test(c.tool_id) || !actions.includes(c.action)) deny('AI_INVALID_REQUEST',400);
  }
  if(new Set(r.capabilities.map(c=>`${c.tool_id}:${c.action}`)).size!==r.capabilities.length) deny('AI_INVALID_REQUEST',400);
  return structuredClone(r);
}

function conditions(value: Record<string,Json>, r: GovernanceRequest, s: GovernanceSnapshot): boolean {
  if (!value || Array.isArray(value) || typeof value!=='object') return false;
  // Unknown policy grammar fails closed; no arbitrary JavaScript or document instructions.
  for (const [key,v] of Object.entries(value)) {
    if(key==='roles') { if(!Array.isArray(v)||!v.length||!v.every(role=>typeof role==='string')||!v.includes(s.member!.role))return false; }
    else if(key==='tax_years') { if(!Array.isArray(v)||!v.every(Number.isInteger)||!v.includes(r.scope.tax_year))return false; }
    else return false;
  }
  return true;
}
function permission(p: {permission_state:string;conditions:Record<string,Json>} | null | undefined,r:GovernanceRequest,s:GovernanceSnapshot): boolean {
  return !!p && ['ALLOW','CONDITIONAL'].includes(p.permission_state) &&
    (p.permission_state!=='CONDITIONAL'||Object.keys(p.conditions??{}).length>0) && conditions(p.conditions,r,s);
}

/** Pure policy evaluation. It produces no execution permit or authoritative result. */
export function evaluateGovernancePolicy(r: GovernanceRequest, s: GovernanceSnapshot, now: number, coordinator = false): Omit<GovernanceDecision,'decision_id'|'request_id'|'agent_id'> {
  let canonical;
  try { canonical=findCanonicalAgent(r.agent_id); } catch { deny('AI_UNKNOWN_AGENT'); }
  const coordinating = coordinator && canonical.agent_id==='A00' && r.purpose==='COORDINATE_REVIEW' &&
    r.intent==='ADVISORY' && r.capabilities.length===1 && r.capabilities[0].tool_id==='workflow.read' && r.capabilities[0].action==='READ' &&
    r.data_classes.length===1 && r.data_classes[0]==='INTERNAL';
  if(!s.member||s.member.status!=='active'||!(coordinating ? !!roleCategories[s.member.role] : roleCategories[s.member.role]?.includes(canonical.category)))deny('AI_ROLE_DENIED');
  if(!s.case || ['tenant_id','client_id','tax_case_id','tax_year'].some(k=>s.case![k]!==r.scope[k]) || s.member.tenant_id!==s.case.tenant_id || !s.assigned)deny('AI_CASE_ACCESS_DENIED');
  if(s.case.preparer_uid===s.case.reviewer_uid)deny('AI_MAKER_CHECKER_REQUIRED');
  if(!['ACTIVE','IN_REVIEW','READY'].includes(s.case.status)||s.case.active_stage!==r.workflow_stage)deny('AI_WORKFLOW_MISMATCH');
  if(!s.agent||s.agent.agent_id!==canonical.agent_id||s.agent.category!==canonical.category||!s.version||s.version.agent_id!==canonical.agent_id||s.version.version!==s.agent.version)deny('AI_REGISTRY_MISMATCH');
  if(s.agent.status!=='ACTIVE'||s.version.status!=='ACTIVE')deny('AI_AGENT_INACTIVE');
  if(hasUnmappedAgentAuthority(canonical.agent_id))deny('AI_AGENT_AUTHORITY_UNMAPPED');
  if(canonical.agent_id==='A34' && !['IDENTIFY_REVIEW_QUESTIONS','REVIEW_EVIDENCE_COMPLETENESS'].includes(r.purpose))deny('AI_AGENT_MAPPING_DENIED');
  if(canonical.agent_id==='A10' && (r.workflow_stage!==3 || r.purpose!=='DOCUMENT_DUPLICATE_CHECK' || r.intent!=='ADVISORY' ||
    r.capabilities.length!==1 || r.capabilities[0].tool_id!=='document.read' || r.capabilities[0].action!=='READ' ||
    r.data_classes.length!==1 || r.data_classes[0]!=='INTERNAL' || r.evidence_source_ids.length>10))deny('AI_AGENT_MAPPING_DENIED');
  if(!s.model||s.model.status!=='ACTIVE'||!s.prompt||s.prompt.status!=='ACTIVE')deny('AI_MODEL_PROMPT_UNAVAILABLE');
  if(s.version.default_model!==s.model.model_id || s.version.default_model_version!==s.model.model_version ||
    s.version.prompt_id!==s.prompt.prompt_id || s.version.prompt_version!==s.prompt.version || s.prompt.agent_id!==canonical.agent_id ||
    s.agent.default_model!==s.version.default_model || s.agent.default_model_version!==s.version.default_model_version || s.agent.prompt_id!==s.version.prompt_id || s.agent.prompt_version!==s.version.prompt_version ||
    !Number.isFinite(Date.parse(s.model.effective_date))||Date.parse(s.model.effective_date)>now||!Number.isFinite(Date.parse(s.prompt.effective_date))||Date.parse(s.prompt.effective_date)>now ||
    !s.model.approved_use_cases.includes(r.purpose)||s.model.prohibited_use_cases.includes(r.purpose))deny('AI_MODEL_PROMPT_DENIED');
  for (const sw of s.kill_switches) {
    if(!sw.enabled||sw.tenant_id!==r.scope.tenant_id)continue;
    if(sw.scope==='GLOBAL'||(sw.scope==='AGENT'&&sw.agent_id===canonical.agent_id)||
      (sw.scope==='MODEL'&&sw.model_id===s.model.model_id&&sw.model_version===s.model.model_version)||
      (sw.scope==='TOOL'&&r.capabilities.some(c=>c.tool_id===sw.tool_id))||
      (sw.scope==='WORKFLOW'&&sw.workflow_version==='LEGACY_18_V1'&&sw.workflow_stage===r.workflow_stage))deny('AI_KILL_SWITCH_ACTIVE');
  }
  if(!s.stage_permission||s.stage_permission.agent_id!==canonical.agent_id||s.stage_permission.stage!==r.workflow_stage||s.stage_permission.workflow_version!=='LEGACY_18_V1'||!permission(s.stage_permission,r,s))deny('AI_STAGE_DENIED');
  if(![s.version.token_budget,Number(s.version.cost_budget),s.model.token_limit,Number(s.model.cost_limit),s.version.maximum_execution_time].every(v=>Number.isFinite(v)&&v>0))deny('AI_BUDGET_UNAVAILABLE');
  // AI-2 never authorizes an agent to approve, alter final records, export or transmit.
  const advisoryTools:Record<string,readonly string[]>={ 'database.read':['READ'],'document.read':['READ'],'ocr.extract':['EXECUTE'],'tax_authority.search':['READ','EXECUTE'],'calculation.execute':['EXECUTE'],'workflow.read':['READ'],'workflow.propose':['CREATE'],'message.draft':['CREATE'],'calendar.read':['READ'],'billing.read':['READ'],'filing.prepare':['CREATE'] };
  for(const c of r.capabilities) {
    if(!advisoryTools[c.tool_id]?.includes(c.action))deny('AI_ACTION_EXECUTION_DISABLED');
    const t=s.tools.find(t=>t.tool_id===c.tool_id);
    if(!t||t.status!=='ACTIVE')deny('AI_TOOL_INACTIVE');
    const p=s.permissions.find(p=>p.agent_id===canonical.agent_id&&p.resource===c.tool_id&&p.action===c.action);
    if(!permission(p,r,s))deny('AI_CAPABILITY_DENIED');
  }
  const maxClasses:Record<string,readonly string[]>={PUBLIC:['PUBLIC'],INTERNAL:['PUBLIC','INTERNAL'],CLIENT_PII:['PUBLIC','INTERNAL','CLIENT_PII'],TAX_DATA:['PUBLIC','INTERNAL','TAX_DATA'],FINANCIAL_DATA:['PUBLIC','INTERNAL','FINANCIAL_DATA'],DOCUMENT_CONTENT:['PUBLIC','INTERNAL','DOCUMENT_CONTENT'],AUDIT_DATA:['PUBLIC','INTERNAL','AUDIT_DATA']};
  for(const cls of r.data_classes) {
    if(['SYSTEM_SECRET','AUTHENTICATION_DATA'].includes(cls))deny('AI_PROTECTED_DATA_DENIED');
    if(!maxClasses[s.model.data_classification_limit]?.includes(cls)||!permission(s.data_permissions.find(p=>p.agent_id===canonical.agent_id&&p.data_classification===cls),r,s))deny('AI_DATA_DENIED');
  }
  for(const sourceId of r.evidence_source_ids) {
    const e=s.evidence.find(e=>e.source_id===sourceId);
    if(!e||e.case_record_id!==s.case.id||['tenant_id','client_id','tax_case_id','tax_year'].some(k=>e[k]!==r.scope[k])||!/^[a-f0-9]{64}$/.test(e.source_hash)||!e.source_reference.trim())deny('AI_EVIDENCE_REQUIRED');
    // Unverified non-document authority is not promoted to verified evidence in AI-2.
    if(e.evidence_type!=='DOCUMENT'||!e.document_record_id||e.document_version!==e.actual_document_version||e.source_hash!==e.document_hash||
      e.document_tenant_id!==r.scope.tenant_id||e.document_client_id!==r.scope.client_id||e.document_case_id!==r.scope.tax_case_id||e.document_tax_year!==r.scope.tax_year||
      !['RELEASED','VERIFIED'].includes(e.document_status??'')||e.quarantine_status!=='CLEAN')deny('AI_EVIDENCE_UNVERIFIED');
  }
  const rank:Record<string,number>={LOW:0,MATERIAL:1,HIGH:2,CRITICAL:3};
  // Select all applicable rules without allowing caller risk/confidence to weaken registry risk.
  const serverApproval=s.tools.some(t=>t.requires_human_approval)||s.permissions.some(p=>r.capabilities.some(c=>c.tool_id===p.resource&&c.action===p.action)&&p.human_approval_required);
  const risk=Math.max(serverApproval||r.intent==='PROPOSE_ACTION'||r.financial_amount>0||r.confidence<Number(s.version.confidence_threshold)||r.confidence<=Number(s.version.human_review_threshold)?1:0,rank[r.risk_level],rank[s.agent.risk_class]??3,rank[s.version.risk_class]??3,rank[s.prompt.risk_class]??3,...s.tools.map(t=>rank[t.risk_class]??3),...s.permissions.filter(p=>r.capabilities.some(c=>c.tool_id===p.resource&&c.action===p.action)).map(p=>rank[p.risk_level]??3));
  const material=r.intent==='PROPOSE_ACTION'||r.financial_amount>0||s.tools.some(t=>t.requires_human_approval)||s.permissions.some(p=>r.capabilities.some(c=>c.tool_id===p.resource&&c.action===p.action)&&p.human_approval_required)||risk>0||r.confidence<Number(s.version.confidence_threshold)||r.confidence<=Number(s.version.human_review_threshold);
  for(const c of r.capabilities) {
    const applicable=s.policies.filter(p=>p.tenant_id===r.scope.tenant_id&&p.agent_id===canonical.agent_id&&p.action===c.action&&p.status==='ACTIVE'&&
      (p.workflow_stage===null||(p.workflow_version==='LEGACY_18_V1'&&p.workflow_stage===r.workflow_stage))&&
      (p.data_classification===null||r.data_classes.includes(p.data_classification))&&
      (rank[p.risk_level]??3)<=risk&&(p.materiality!=='CRITICAL'||risk===3)&&
      (p.confidence_below===null||r.confidence<Number(p.confidence_below))&&
      (p.financial_threshold===null||r.financial_amount>=Number(p.financial_threshold)));
    if(material&&!applicable.length)deny('AI_APPROVAL_POLICY_REQUIRED');
    for(const p of applicable) {
      if(p.separation_required!==true||p.required_roles.join(',')!=='PREPARER,REVIEWER,CPA_EA')deny('AI_APPROVAL_POLICY_INVALID');
      if(p.workflow_stage!==null&&(p.workflow_version!=='LEGACY_18_V1'||p.workflow_stage!==r.workflow_stage))deny('AI_APPROVAL_POLICY_MISMATCH');
      // Policies tighten the review path; no confidence/financial threshold can remove review.
      if(p.data_classification!==null&&!r.data_classes.includes(p.data_classification))deny('AI_APPROVAL_POLICY_MISMATCH');
    }
  }
  return {outcome:material?'REVIEW_REQUIRED':'ADVISORY_ALLOWED',human_review_required:true,
    required_human_roles:['PREPARER','REVIEWER','CPA_EA'],action_state:r.intent==='PROPOSE_ACTION'?'PROPOSED_ACTION':'ADVISORY_ONLY',action_executed:false,external_submission_allowed:false};
}

export class GovernanceControlPlane {
  constructor(private readonly sessions:SessionAuthority,private readonly store:GovernanceStore,private readonly clock=()=>Date.now()) {}
  /** Correlation is evidence only, never an execution permit. Identity is freshly verified. */
  async correlateExecution(token:string,decision_id:string,root_id:string,operation_id:string):Promise<void> {
    if(![decision_id,root_id,operation_id].every(v=>typeof v==='string'&&uuid.test(v)))deny('AI_INVALID_EXECUTION_LINK',400);
    const identity=await this.verifyIdentity(token);
    try {await this.store.transaction(async tx=>{if(!tx.link)deny('AI_EXECUTION_LEDGER_UNAVAILABLE',503);await tx.link(identity,decision_id,root_id,operation_id);});}
    catch(error){if(error instanceof GovernanceError)throw error;deny('AI_EXECUTION_LEDGER_UNAVAILABLE',503);}
  }
  async evaluate(token:string,raw:unknown):Promise<GovernanceDecision> {
    return (await this.assess(token,raw,false)).decision;
  }
  /** Server-only fresh resolution for gateway admission; IDs are never permits. */
  async inspectForExecution(token:string,raw:unknown) {
    return this.assess(token,raw,false);
  }
  /** Server-only coordinator assessment. Does not confer any child capability. */
  async evaluateCoordinator(token:string,raw:unknown):Promise<GovernanceDecision> {
    const request=parseGovernanceRequest(raw);
    if(request.agent_id!=='A00')deny('AI_COORDINATOR_IDENTITY_DENIED');
    return (await this.assess(token,request,true)).decision;
  }
  /** Resolve only assigned persisted scope; caller stage is not authority. */
  async resolveScope(token:string,raw:unknown) {
    const request=parseGovernanceRequest(raw);
    const identity=await this.verifyIdentity(token);
    try {
      const result=await this.store.transaction(async tx=>{
        let snapshot:GovernanceSnapshot|null=null;
        try {
          if(identity.tenant_id!==request.scope.tenant_id)deny('AI_TENANT_DENIED');
          snapshot=await tx.load(identity,request);
          const c=snapshot.case;
          if(!snapshot.member||snapshot.member.status!=='active'||!roleCategories[snapshot.member.role])deny('AI_ROLE_DENIED');
          if(!c||!snapshot.assigned||['tenant_id','client_id','tax_case_id','tax_year'].some(k=>c[k]!==request.scope[k]))deny('AI_CASE_ACCESS_DENIED');
          return {value:{identity,case_record_id:c.id,workflow_stage:c.active_stage,
            maximum_retries:snapshot.version?.maximum_retries??0,
            maximum_execution_time:snapshot.version?.maximum_execution_time??0},failure:null};
        }catch(error){
          const failure=error instanceof GovernanceError?error:new GovernanceError('AI_GOVERNANCE_UNAVAILABLE',503);
          const fingerprint=createHash('sha256').update(JSON.stringify(request)).digest('hex');
          await tx.claim(identity,request,fingerprint);
          await tx.append(identity,request,fingerprint,snapshot,failure.code,null);
          return {value:null,failure};
        }
      });
      if(result.failure)throw result.failure;
      return result.value!;
    } catch(error) {if(error instanceof GovernanceError)throw error;deny('AI_GOVERNANCE_UNAVAILABLE',503);}
  }
  private async verifyIdentity(token:string) {
    if(typeof token!=='string'||!token.trim())deny('AI_AUTH_REQUIRED',401);
    let identity;
    try { identity=await this.sessions.verify(token); } catch { deny('AI_AUTH_UNAVAILABLE',503); }
    if(!identity||!id.test(identity.uid)||!id.test(identity.tenant_id))deny('AI_AUTH_REQUIRED',401);
    return identity;
  }
  private async assess(token:string,raw:unknown,coordinator:boolean) {
    const identity=await this.verifyIdentity(token);
    const request=parseGovernanceRequest(raw);
    const fingerprint=createHash('sha256').update(JSON.stringify(request)).digest('hex');
    try {
      const result=await this.store.transaction(async tx=>{
        let snapshot:GovernanceSnapshot|null=null;
        let decision:GovernanceDecision|null=null; let failure:GovernanceError|null=null;
        try {
          await tx.claim(identity,request,fingerprint);
          if(identity.tenant_id!==request.scope.tenant_id)deny('AI_TENANT_DENIED');
          snapshot=await tx.load(identity,request);
          const evaluated=evaluateGovernancePolicy(request,snapshot,this.clock(),coordinator);
          decision={...evaluated,decision_id:randomUUID(),request_id:request.request_id,agent_id:findCanonicalAgent(request.agent_id).agent_id};
        } catch(error) { failure=error instanceof GovernanceError?error:new GovernanceError('AI_GOVERNANCE_UNAVAILABLE',503); }
        // Never permit advisory work unless immutable audit recording commits successfully.
        await tx.append(identity,request,fingerprint,snapshot,failure?.code??decision!.outcome,decision);
        return {decision,failure,snapshot};
      });
      if(result.failure)throw result.failure;
      return {decision:result.decision!,identity,snapshot:result.snapshot!};
    } catch(error) { if(error instanceof GovernanceError)throw error; deny('AI_GOVERNANCE_UNAVAILABLE',503); }
  }
}
