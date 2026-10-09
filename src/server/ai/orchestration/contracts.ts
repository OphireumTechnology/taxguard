import type { AICaseScope, AgentId } from '../../../ai/types';
import type { GovernanceDecision, VerifiedIdentity } from '../governance/contracts';

export type ReviewTask = 'IDENTIFY_REVIEW_QUESTIONS' | 'REVIEW_EVIDENCE_COMPLETENESS' | 'DOCUMENT_DUPLICATE_CHECK';
export interface OrchestrationRequest {
  request_id: string;
  scope: AICaseScope;
  tasks: ReviewTask[];
  evidence_source_ids: string[];
}
export interface RootRecord {
  root_id: string; identity: VerifiedIdentity; request_key: string; input_hash: string;
  case_record_id: string; scope: AICaseScope; workflow_stage: number; coordinator_decision_id: string;
}
export type OperationStatus = 'PLANNED' | 'AUTHORIZED' | 'RUNNING' | 'RESULT_RECORDED' | 'DENIED' | 'FAILED' | 'TIMED_OUT' | 'CANCELLED' | 'RETRY_REQUIRED' | 'COMPLETED' | 'UNAVAILABLE';
export interface OperationEvent {
  operation_id: string | null; agent_id: AgentId; attempt: number; status: OperationStatus;
  purpose: ReviewTask | null;
  decision_id: string | null; reason_code: string; output_hash: string | null;
}
export interface OrchestrationLedger {
  begin(root: RootRecord): Promise<void>;
  append(root: RootRecord, event: OperationEvent): Promise<void>;
}
/** Handler receives metadata only: no token, raw document, prompt or database capability. */
export interface ChildContext {
  root_id: string; operation_id: string; attempt: number; agent_id: AgentId;
  scope: Readonly<AICaseScope>; workflow_stage: number; purpose: ReviewTask;
  evidence_source_ids: readonly string[]; decision_id: string;
}
export interface AdvisoryResult {
  operation_id: string; agent_id: AgentId; status: 'ADVISORY';
  human_review_required: true; action_executed: false;
  evidence_source_ids: string[]; finding_codes: string[];
}
export type AdvisoryHandler = (context: Readonly<ChildContext>, signal: AbortSignal) => Promise<unknown>;
export interface OrchestrationResult {
  root_id: string; status: 'COMPLETED'; human_review_required: true;
  action_executed: false; external_submission_allowed: false;
  children: { operation_id: string; decision: GovernanceDecision; result: AdvisoryResult }[];
}
