import { randomUUID } from 'node:crypto';
import { GovernanceError } from '../governance/contracts';
import { GovernanceControlPlane } from '../governance/GovernanceControlPlane';
import { ModelPromptResolver,digest } from '../gateway/ModelPromptResolver';
import type { ResolvedConfiguration } from '../gateway/contracts';
import { ScopedReadRepository } from './ScopedReadRepository';
import { evidenceMetadata,parseCapabilityRequest,validateCapabilityOutput } from './capabilityValidation';
import type { CapabilityAdmission,CapabilityDefinition,CapabilityRequest,CapabilityResult,CapabilityStore,CapabilityEventStatus } from './contracts';

/** No production commissioning, caller handlers, model tools or authoritative mutations. */
export class GovernedCapabilityExecutor {
  constructor(private readonly resolver: ModelPromptResolver,private readonly governance: GovernanceControlPlane,
    private readonly store: CapabilityStore,private readonly reads: ScopedReadRepository) {}
  async execute(token: string,raw: unknown,signal?: AbortSignal): Promise<CapabilityResult> {
    const {request,definition}=parseCapabilityRequest(raw);
    const c=await this.authorize(token,request,definition);
    if(signal?.aborted) throw new GovernanceError('AI_OPERATION_CANCELLED',409);
    // Durable schema and handler tests are isolated. Infrastructure does not commission production capabilities.
    if(process.env.NODE_ENV!=='test') throw new GovernanceError('AI_CAPABILITY_EXECUTION_UNAVAILABLE',503);
    const binding=this.binding(c,definition);
    const admission=await this.persist(()=>this.store.admit(c,request,definition,binding));
    let invoked=false;
    const controller=new AbortController();
    const abort=()=>controller.abort(); signal?.addEventListener('abort',abort,{once:true});
    let timer: ReturnType<typeof setTimeout>|undefined;
    let timedOut=false;
    const checkStopped=()=>{if(controller.signal.aborted || signal?.aborted)throw new GovernanceError(timedOut?'AI_CAPABILITY_TIMED_OUT':'AI_OPERATION_CANCELLED',timedOut?504:409);};
    try {
      await this.fresh(token,admission);
      if(signal?.aborted) throw new GovernanceError('AI_OPERATION_CANCELLED',409);
      await this.persist(()=>this.store.append(admission,{status:'EXECUTING',reason_code:'AI_CAPABILITY_EXECUTING',handler_invoked:false,output_hash:null,decision_id:c.decision.decision_id}));
      // Admission/event I/O can span a revocation: independently assess again after it.
      const executing=await this.fresh(token,admission);
      if(signal?.aborted) throw new GovernanceError('AI_OPERATION_CANCELLED',409);
      if(process.env.NODE_ENV!=='test') throw new GovernanceError('AI_CAPABILITY_EXECUTION_UNAVAILABLE',503);
      const deadline=new Promise<never>((_,reject)=>{
        timer=setTimeout(()=>{timedOut=true;controller.abort();reject(new GovernanceError('AI_CAPABILITY_TIMED_OUT',504));},Math.min(definition.timeout_ms,c.timeout_ms));
        controller.signal.addEventListener('abort',()=>{if(!timedOut)reject(new GovernanceError('AI_OPERATION_CANCELLED',409));},{once:true});
      });
      invoked=true;
      const rawOutput=await Promise.race([this.reads.read(executing,request,controller.signal),deadline]);
      checkStopped();
      const validated=validateCapabilityOutput(rawOutput,definition,executing,request);
      const accepted=await this.fresh(token,admission);
      validateCapabilityOutput(validated,definition,accepted,request);
      checkStopped();
      const outputHash=digest(validated);
      await this.persist(()=>this.store.append(admission,{status:'EXECUTED',reason_code:'AI_CAPABILITY_ADVISORY_RESULT',handler_invoked:true,output_hash:outputHash,decision_id:accepted.decision.decision_id}));
      // Recheck after result persistence too: no capability result authorizes downstream use.
      await this.fresh(token,admission);
      checkStopped();
      return {invocation_id:admission.invocation_id,status:'ADVISORY',human_review_required:true,authoritative_mutation:false,provider_export_allowed:false,output:validated,
        provenance:{root_id:request.context.root_id,operation_id:request.context.operation_id,decision_id:accepted.decision.decision_id,agent_version:c.snapshot.version.version,
          capability_version:definition.version,definition_hash:digest(definition),input_hash:digest(request.proposal.arguments),output_hash:outputHash,evidence:evidenceMetadata(accepted),
          run_id:request.gateway_correlation?.run_id??null,attempt_id:request.gateway_correlation?.attempt_id??null}};
    } catch(error) {
      const failure=error instanceof GovernanceError?error:new GovernanceError('AI_CAPABILITY_FAILURE',503);
      if(failure.code==='AI_CAPABILITY_AUDIT_UNAVAILABLE') throw failure;
      const status:CapabilityEventStatus=failure.code==='AI_CAPABILITY_TIMED_OUT'?'TIMED_OUT':failure.code==='AI_OPERATION_CANCELLED'?'CANCELLED':invoked?(failure.code==='AI_CAPABILITY_FAILURE'?'FAILED':'DISCARDED'):'DENIED';
      await this.persist(()=>this.store.append(admission,{status,reason_code:failure.code,handler_invoked:invoked,output_hash:null,decision_id:c.decision.decision_id}));
      throw failure;
    } finally {clearTimeout(timer);controller.abort();signal?.removeEventListener('abort',abort);}
  }
  private async authorize(token:string,r:CapabilityRequest,d:CapabilityDefinition):Promise<ResolvedConfiguration> {
    const base=await this.resolver.resolve(token,r.context);
    const allowed=await this.governance.inspectForExecution(token,{request_id:randomUUID(),agent_id:r.context.agent_id,scope:r.context.scope,workflow_stage:r.context.workflow_stage,intent:'ADVISORY',purpose:r.context.purpose,
      capabilities:[{tool_id:d.id,action:d.action}],data_classes:[d.data_class],evidence_source_ids:[...r.context.evidence_source_ids],confidence:0,financial_amount:0,risk_level:'MATERIAL'});
    if(allowed.identity.uid!==base.identity.uid || allowed.identity.tenant_id!==base.identity.tenant_id) throw new GovernanceError('AI_CAPABILITY_IDENTITY_CHANGED');
    await this.governance.correlateExecution(token,allowed.decision.decision_id,r.context.root_id,r.context.operation_id);
    return {...base,...allowed};
  }
  private binding(c:ResolvedConfiguration,d:CapabilityDefinition) {
    return digest({base:c.binding_hash,actor:c.identity,definition:d,version:c.snapshot.version,model:c.snapshot.model,prompt_hash:digest(c.snapshot.prompt),evidence:evidenceMetadata(c),permissions:c.snapshot.permissions.filter(p=>p.resource===d.id),tool:c.snapshot.tools,stage:c.snapshot.stage_permission,data:c.snapshot.data_permissions});
  }
  private async fresh(token:string,a:CapabilityAdmission) {
    // Correlation I/O precedes fresh governance so it cannot leave a stale assessment at dispatch.
    await this.persist(()=>this.store.assertContinuation(a));
    const c=await this.authorize(token,a.request,a.definition);
    if(this.binding(c,a.definition)!==a.binding_hash) throw new GovernanceError('AI_CAPABILITY_CONFIGURATION_CHANGED');
    return c;
  }
  private async persist<T>(work:()=>Promise<T>):Promise<T> {
    try {return await work();} catch(error) {if(error instanceof GovernanceError)throw error;throw new GovernanceError('AI_CAPABILITY_AUDIT_UNAVAILABLE',503);}
  }
}
