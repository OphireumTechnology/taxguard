import type { GovernanceDecision, GovernanceSnapshot, VerifiedIdentity } from '../governance/contracts';
import type { ChildContext, ReviewTask } from '../orchestration/contracts';

export interface ProviderRequest {
  model: string; instructions: string; schema: Record<string,unknown>;
  input: {purpose:ReviewTask;taxYear:number;evidenceCount:number}; max_output_tokens:number;
}
export interface ProviderResponse {
  status:'completed'|'refused'|'incomplete'; text:string;
  usage: {input_tokens:number;output_tokens:number;total_tokens:number}|null;
}
/** No tools, endpoints, credentials or database are present in this contract. */
export interface ProviderAdapter { readonly provider:string; invoke(request:Readonly<ProviderRequest>,signal:AbortSignal):Promise<ProviderResponse> }
/** Adapter may use this ONLY when transport was conclusively not sent. */
export class ProviderNotSentError extends Error { constructor(){super('AI_PROVIDER_NOT_SENT');} }
export interface ResolvedConfiguration {
  identity:VerifiedIdentity; snapshot:GovernanceSnapshot; decision:GovernanceDecision;
  context:ChildContext; binding_hash:string; input_hash:string; prompt_hash:string; schema_hash:string;
  request:ProviderRequest; maximum_retries:number; timeout_ms:number;
}
export interface Pricing {
  pricing_id:string; model_id:string; model_version:string; input_nanos_per_token:string; output_nanos_per_token:string;
  input_token_limit:number; output_token_limit:number; effective_date:string; configuration_hash:string;
}
export interface Admission { run_id:string; configuration:ResolvedConfiguration; pricing:Pricing; reserved_tokens:number; reserved_nanos:string }
export interface UsageAccounting { input_tokens:number|null;output_tokens:number|null;total_tokens:number|null;cost_nanos:string|null;state:'KNOWN'|'UNKNOWN' }
export interface AttemptOutcome {
  attempt_id:string; status:'NOT_SENT'|'ACCEPTED'|'FAILED'|'CANCELLED'; terminal:boolean;
  reason_code:string; transport_state:'NOT_SENT'|'MAY_HAVE_SENT'|'RESPONDED';
  accounting:UsageAccounting; output_hash:string|null; decision_id:string|null;
}
export interface GatewayStore {
  admit(configuration:ResolvedConfiguration):Promise<Admission>;
  reserveAttempt(admission:Admission,attempt:number,decision_id:string):Promise<string>;
  finish(admission:Admission,outcome:AttemptOutcome):Promise<void>;
}
export interface CountsReviewOutput { status:'ADVISORY'; confidence:'UNVERIFIED'; finding_codes:('REVIEW_REQUIRED'|'EVIDENCE_REQUIRED')[] }
export interface GatewayResult {
  run_id:string;attempt_id:string;root_id:string;operation_id:string;status:'ADVISORY';
  human_review_required:true;action_executed:false;external_submission_allowed:false;
  output:CountsReviewOutput;usage:UsageAccounting;
  provenance:{agent_version:string;model:string;model_version:string;prompt_version:string;prompt_hash:string;schema_hash:string;pricing_id:string;evidence_source_ids:readonly string[]};
}
