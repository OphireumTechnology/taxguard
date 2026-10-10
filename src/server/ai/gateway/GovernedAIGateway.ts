import { GovernanceError } from '../governance/contracts';
import type { ChildContext } from '../orchestration/contracts';
import type { Admission,GatewayResult,GatewayStore,ProviderAdapter,ProviderResponse,ResolvedConfiguration } from './contracts';
import { ProviderNotSentError } from './contracts';
import { ModelPromptResolver,digest } from './ModelPromptResolver';
import { validateStructuredOutput } from './structuredOutput';
import { accountUsage,notSentUsage,unknownUsage } from './usage';

export class GovernedAIGateway {
  private readonly adapters:Readonly<Record<string,ProviderAdapter>>|null;
  /** Transport is entirely unavailable by default; only isolated tests may inject adapters. */
  constructor(private readonly resolver:ModelPromptResolver,private readonly store:GatewayStore,testAdapters?:Record<string,ProviderAdapter>){
    if(testAdapters&&process.env.NODE_ENV!=='test')throw new GovernanceError('AI_TEST_EXECUTION_FORBIDDEN');
    if(testAdapters&&Object.entries(testAdapters).some(([key,a])=>!['TEST','OPENAI'].includes(key)||a.provider!==key))throw new GovernanceError('AI_PROVIDER_UNAPPROVED');
    this.adapters=testAdapters?Object.freeze({...testAdapters}):null;
  }
  async execute(token:string,context:ChildContext,signal?:AbortSignal):Promise<GatewayResult>{
    const c=await this.resolver.resolve(token,context);
    if(c.context.purpose==='DOCUMENT_DUPLICATE_CHECK')throw new GovernanceError('AI_PROVIDER_PURPOSE_UNAVAILABLE',503);
    context=c.context; // Never retain a mutable caller object across asynchronous boundaries.
    if(signal?.aborted)throw new GovernanceError('AI_OPERATION_CANCELLED',409);
    const adapter=this.adapters?.[c.snapshot.model.provider];
    if(process.env.NODE_ENV!=='test'||!adapter)throw new GovernanceError('AI_DISPATCH_UNAVAILABLE',503);
    const admission=await this.persist(()=>this.store.admit(c));
    for(let attempt=0;attempt<=c.maximum_retries;attempt++){
      const attempt_id=await this.persist(()=>this.store.reserveAttempt(admission,attempt,c.decision.decision_id));
      let response:ProviderResponse|null=null,sent=false;
      try{
        const fresh=await this.refresh(token,context,admission);
        if(signal?.aborted)throw new GovernanceError('AI_OPERATION_CANCELLED',409);
        if(process.env.NODE_ENV!=='test')throw new GovernanceError('AI_DISPATCH_UNAVAILABLE',503);
        const request={...fresh.request,max_output_tokens:admission.pricing.output_token_limit};
        // Provider receives no identity/scope/evidence IDs, tools or endpoint override.
        Object.freeze(request.input);Object.freeze(request.schema);Object.freeze(request);
        sent=true;
        response=await this.transport(adapter,request,fresh.timeout_ms,signal);
        const usage=accountUsage(response,admission.pricing);
        if(response.status==='refused')throw new GovernanceError('AI_PROVIDER_REFUSED',503);
        if(response.status!=='completed')throw new GovernanceError('AI_PROVIDER_INCOMPLETE',503);
        if(usage.state==='UNKNOWN')throw new GovernanceError('AI_USAGE_UNKNOWN',503);
        if(usage.input_tokens>admission.pricing.input_token_limit||usage.output_tokens>admission.pricing.output_token_limit)throw new GovernanceError('AI_PROVIDER_BUDGET_EXCEEDED',503);
        const output=validateStructuredOutput(response.text,fresh.request.schema);
        const accepted=await this.refresh(token,context,admission);
        if(signal?.aborted)throw new GovernanceError('AI_OPERATION_CANCELLED',409);
        await this.persist(()=>this.store.finish(admission,{attempt_id,status:'ACCEPTED',terminal:true,transport_state:'RESPONDED',reason_code:'AI_ADVISORY_ACCEPTED',accounting:usage,output_hash:digest(output),decision_id:accepted.decision.decision_id}));
        return {run_id:admission.run_id,attempt_id,root_id:context.root_id,operation_id:context.operation_id,status:'ADVISORY',human_review_required:true,action_executed:false,external_submission_allowed:false,output,usage,
          provenance:{agent_version:c.snapshot.version.version,model:c.snapshot.model.model_id,model_version:c.snapshot.model.model_version,prompt_version:c.snapshot.prompt.version,prompt_hash:c.prompt_hash,schema_hash:c.schema_hash,pricing_id:admission.pricing.pricing_id,evidence_source_ids:[...context.evidence_source_ids]}};
      }catch(error){
        const notSent=error instanceof ProviderNotSentError||!sent;
        const retry=error instanceof ProviderNotSentError&&attempt<c.maximum_retries&&!signal?.aborted;
        const failure=error instanceof GovernanceError?error:new GovernanceError(error instanceof ProviderNotSentError?'AI_PROVIDER_NOT_SENT':'AI_PROVIDER_FAILURE',503);
        if(failure.code==='AI_GATEWAY_AUDIT_UNAVAILABLE')throw failure; // no fabricated successful second outcome
        await this.persist(()=>this.store.finish(admission,{attempt_id,status:error instanceof ProviderNotSentError?'NOT_SENT':failure.code==='AI_OPERATION_CANCELLED'?'CANCELLED':'FAILED',terminal:!retry,
          transport_state:notSent?'NOT_SENT':response?'RESPONDED':'MAY_HAVE_SENT',reason_code:failure.code,
          accounting:notSent?notSentUsage():response?accountUsage(response,admission.pricing):unknownUsage(),output_hash:null,decision_id:null}));
        if(!retry)throw failure;
      }
    }
    throw new GovernanceError('AI_PROVIDER_FAILURE',503);
  }
  private async persist<T>(work:()=>Promise<T>):Promise<T>{try{return await work();}catch(error){if(error instanceof GovernanceError)throw error;throw new GovernanceError('AI_GATEWAY_AUDIT_UNAVAILABLE',503);}}
  private async refresh(token:string,context:ChildContext,a:Admission):Promise<ResolvedConfiguration>{
    const fresh=await this.resolver.resolve(token,context);
    if(fresh.binding_hash!==a.configuration.binding_hash||fresh.identity.uid!==a.configuration.identity.uid||fresh.identity.tenant_id!==a.configuration.identity.tenant_id)throw new GovernanceError('AI_GATEWAY_CONFIGURATION_CHANGED');
    return fresh;
  }
  private async transport(adapter:ProviderAdapter,request:ResolvedConfiguration['request'],timeout:number,outer?:AbortSignal){
    const abort=new AbortController();let timer:ReturnType<typeof setTimeout>,cancel:()=>void;
    const stopped=new Promise<never>((_,reject)=>{
      cancel=()=>{abort.abort();reject(new GovernanceError('AI_OPERATION_CANCELLED',409));};
      outer?.addEventListener('abort',cancel,{once:true});
      timer=setTimeout(()=>{abort.abort();reject(new GovernanceError('AI_PROVIDER_TIMEOUT',504));},timeout);
    });
    try{if(outer?.aborted){cancel();return await stopped;}
      return await Promise.race([Promise.resolve().then(()=>{if(abort.signal.aborted)throw new GovernanceError('AI_OPERATION_CANCELLED',409);return adapter.invoke(request,abort.signal);}),stopped]);
    }finally{clearTimeout(timer);outer?.removeEventListener('abort',cancel);}
  }
}
