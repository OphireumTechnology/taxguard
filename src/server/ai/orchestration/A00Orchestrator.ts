import { createHash, randomUUID } from 'node:crypto';
import { GovernanceError, type GovernanceRequest } from '../governance/contracts';
import { GovernanceControlPlane } from '../governance/GovernanceControlPlane';
import { parseOrchestrationRequest, routeTask } from './canonicalRouting';
import type { AdvisoryHandler, AdvisoryResult, ChildContext, OperationEvent, OrchestrationLedger, OrchestrationResult, RootRecord, ReviewTask } from './contracts';

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Only explicit transient failures from read-only, idempotent handlers may be retried. */
export class RetryableAdvisoryError extends Error {}
type TestExecution = { handlers: Partial<Record<ReviewTask,AdvisoryHandler>>; timeout_ms: number; maximum_retries: number };

function validateResult(raw:unknown,c:ChildContext):AdvisoryResult {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new GovernanceError('AI_INVALID_STRUCTURED_OUTPUT');
  const r=raw as AdvisoryResult;
  if(Object.keys(r).sort().join(',')!=='action_executed,agent_id,evidence_source_ids,finding_codes,human_review_required,operation_id,status'||
    r.operation_id!==c.operation_id||r.agent_id!==c.agent_id||r.status!=='ADVISORY'||r.human_review_required!==true||r.action_executed!==false||
    !Array.isArray(r.evidence_source_ids)||!r.evidence_source_ids.length||new Set(r.evidence_source_ids).size!==r.evidence_source_ids.length||r.evidence_source_ids.some(id=>!c.evidence_source_ids.includes(id))||
    !Array.isArray(r.finding_codes)||r.finding_codes.length>20||r.finding_codes.some(code=>!['REVIEW_REQUIRED','EVIDENCE_REQUIRED','NO_FINDING'].includes(code)))throw new GovernanceError('AI_INVALID_STRUCTURED_OUTPUT');
  return structuredClone(r);
}

export class A00Orchestrator {
  /** Default has no handler path. Tests must opt into the explicit, runtime-checked boundary. */
  constructor(private readonly governance:GovernanceControlPlane,private readonly ledger:OrchestrationLedger,private readonly testExecution?:TestExecution) {
    if(testExecution&&process.env.NODE_ENV!=='test')throw new GovernanceError('AI_TEST_EXECUTION_FORBIDDEN');
    if(testExecution&&(!Number.isInteger(testExecution.timeout_ms)||testExecution.timeout_ms<1||testExecution.timeout_ms>5000||!Number.isInteger(testExecution.maximum_retries)||testExecution.maximum_retries<0||testExecution.maximum_retries>2))throw new GovernanceError('AI_INVALID_EXECUTION_POLICY');
    if(testExecution)this.testExecution={...testExecution,handlers:{...testExecution.handlers}};
  }
  async coordinate(token:string,raw:unknown,signal?:AbortSignal):Promise<OrchestrationResult> {
    const request=parseOrchestrationRequest(raw);
    const rootId=randomUUID();
    const base={scope:request.scope,workflow_stage:1,intent:'ADVISORY' as const,data_classes:['INTERNAL' as const],evidence_source_ids:request.evidence_source_ids,confidence:0,financial_amount:0,risk_level:'MATERIAL' as const};
    const coordinatorRequest=():GovernanceRequest=>({...base,request_id:randomUUID(),agent_id:'A00',purpose:'COORDINATE_REVIEW',capabilities:[{tool_id:'workflow.read',action:'READ'}]});
    const resolved=await this.governance.resolveScope(token,coordinatorRequest());
    base.workflow_stage=resolved.workflow_stage;
    const parent=await this.governance.evaluateCoordinator(token,coordinatorRequest());
    const root:RootRecord={root_id:rootId,identity:resolved.identity,scope:request.scope,case_record_id:resolved.case_record_id,workflow_stage:resolved.workflow_stage,request_key:hash(request.request_id),input_hash:hash(request),coordinator_decision_id:parent.decision_id};
    await this.ledger.begin(root);
    const record=async(event:OperationEvent)=>this.ledger.append(root,event);
    const rootEvent=(status:OperationEvent['status'],reason_code:string):OperationEvent=>({operation_id:null,agent_id:'A00',attempt:0,status,purpose:null,decision_id:null,reason_code,output_hash:null});
    try {
      await record(rootEvent('PLANNED','AI_PLAN_CREATED'));
      const children:OrchestrationResult['children']=[];
      for(const task of request.tasks) {
        const route=routeTask(task),operationId=randomUUID();
        let attempt=0;
        while(true) {
          let decisionId:string|null=null;
          const event=(status:OperationEvent['status'],reason_code:string,output_hash:string|null=null):OperationEvent=>({operation_id:operationId,agent_id:route.agent.agent_id,attempt,status,purpose:task,decision_id:decisionId,reason_code,output_hash});
          try {
            if(signal?.aborted)throw new GovernanceError('AI_OPERATION_CANCELLED',409);
            // Parent identity grants no inherited child capability. Both policies are fresh.
            await this.governance.evaluateCoordinator(token,coordinatorRequest());
            const childRequest:GovernanceRequest={...base,request_id:randomUUID(),agent_id:route.agent.agent_id,purpose:task,capabilities:route.capabilities,data_classes:route.data_classes};
            const limits=await this.governance.resolveScope(token,childRequest);
            if(limits.identity.uid!==root.identity.uid||limits.identity.tenant_id!==root.identity.tenant_id||limits.case_record_id!==root.case_record_id)throw new GovernanceError('AI_AUTHORITY_CHANGED');
            let decision=await this.governance.evaluate(token,childRequest);
            decisionId=decision.decision_id;
            await record(event('AUTHORIZED','AI_CHILD_AUTHORIZED'));
            const execution=this.testExecution;
            if(!execution||process.env.NODE_ENV!=='test'||!execution.handlers[task])throw new GovernanceError('AI_DISPATCH_UNAVAILABLE',503);
            if(signal?.aborted)throw new GovernanceError('AI_OPERATION_CANCELLED',409);
            await record(event('RUNNING','AI_ATTEMPT_RESERVED'));
            // Audit I/O is an asynchronous boundary too: changes during it must not dispatch.
            await this.governance.evaluateCoordinator(token,coordinatorRequest());
            decision=await this.governance.evaluate(token,{...childRequest,request_id:randomUUID()});
            decisionId=decision.decision_id;
            if(signal?.aborted)throw new GovernanceError('AI_OPERATION_CANCELLED',409);
            const context:ChildContext=Object.freeze({root_id:rootId,operation_id:operationId,attempt,agent_id:route.agent.agent_id,scope:Object.freeze({...request.scope}),workflow_stage:base.workflow_stage,purpose:task,evidence_source_ids:Object.freeze([...request.evidence_source_ids]),decision_id:decision.decision_id});
            const output=await this.invoke(execution.handlers[task],context,Math.min(execution.timeout_ms,limits.maximum_execution_time*1000),signal);
            const result=validateResult(output,context);
            // Changed evidence, assignments, policy or kill switches invalidate acceptance too.
            await this.governance.evaluateCoordinator(token,coordinatorRequest());
            const accepted=await this.governance.evaluate(token,{...childRequest,request_id:randomUUID()});
            decisionId=accepted.decision_id;
            await record(event('RESULT_RECORDED','AI_ADVISORY_RESULT_RECORDED',hash(result)));
            children.push({operation_id:operationId,decision:accepted,result});
            break;
          } catch(error) {
            if(error instanceof RetryableAdvisoryError) {
              // Re-load authoritative retry limit. Never retry ambiguous timeout/cancellation.
              const limits=await this.governance.resolveScope(token,{...base,request_id:randomUUID(),agent_id:route.agent.agent_id,purpose:task,capabilities:route.capabilities,data_classes:route.data_classes});
              if(attempt<Math.min(this.testExecution?.maximum_retries??0,limits.maximum_retries)) {
                await record(event('RETRY_REQUIRED','AI_TRANSIENT_DEPENDENCY_FAILURE'));attempt++;continue;
              }
            }
            const failure=error instanceof GovernanceError?error:new GovernanceError('AI_DEPENDENCY_FAILED',503);
            const status=failure.code==='AI_OPERATION_TIMED_OUT'?'TIMED_OUT':failure.code==='AI_OPERATION_CANCELLED'?'CANCELLED':failure.code==='AI_DISPATCH_UNAVAILABLE'?'UNAVAILABLE':failure.status===403?'DENIED':'FAILED';
            await record(event(status,failure.code));throw failure;
          }
        }
      }
      if(signal?.aborted)throw new GovernanceError('AI_OPERATION_CANCELLED',409);
      await record(rootEvent('COMPLETED','AI_TEST_ORCHESTRATION_COMPLETED'));
      return {root_id:rootId,status:'COMPLETED',children,human_review_required:true,action_executed:false,external_submission_allowed:false};
    } catch(error) {
      const failure=error instanceof GovernanceError?error:new GovernanceError('AI_ORCHESTRATION_FAILED',503);
      await record(rootEvent('FAILED',failure.code));throw failure;
    }
  }
  private async invoke(handler:AdvisoryHandler,context:ChildContext,timeout:number,outer?:AbortSignal) {
    if(!Number.isFinite(timeout)||timeout<=0)throw new GovernanceError('AI_BUDGET_UNAVAILABLE');
    const controller=new AbortController();
    let timer:ReturnType<typeof setTimeout>;
    let cancel:()=>void;
    const boundary=new Promise<never>((_,reject)=>{
      cancel=()=>{controller.abort();reject(new GovernanceError('AI_OPERATION_CANCELLED',409));};
      outer?.addEventListener('abort',cancel,{once:true});
      timer=setTimeout(()=>{controller.abort();reject(new GovernanceError('AI_OPERATION_TIMED_OUT',504));},timeout);
    });
    try {
      if(outer?.aborted){cancel();return await boundary;}
      return await Promise.race([Promise.resolve().then(()=>{
        if(controller.signal.aborted)throw new GovernanceError('AI_OPERATION_CANCELLED',409);
        return handler(context,controller.signal);
      }),boundary]);
    } finally {clearTimeout(timer);outer?.removeEventListener('abort',cancel);}
  }
}
