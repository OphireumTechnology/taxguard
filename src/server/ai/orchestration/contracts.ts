/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AICaseScope, AgentId } from '../../../ai/types';

export type ReviewTask =
  | 'DOCUMENT_DUPLICATE_CHECK'
  | 'IDENTIFY_REVIEW_QUESTIONS'
  | 'REVIEW_EVIDENCE_COMPLETENESS';

export interface OrchestrationRequest {
  request_id: string;
  scope: AICaseScope;
  tasks: ReviewTask[];
  evidence_source_ids: string[];
}

export interface ChildContext {
  root_id?: string;
  operation_id: string;
  attempt?: number;
  agent_id: AgentId;
  scope?: AICaseScope;
  workflow_stage?: number;
  purpose?: string;
  evidence_source_ids: readonly string[] | string[];
  decision_id?: string;
}

export interface AdvisoryResult {
  operation_id: string;
  agent_id: string;
  status: 'ADVISORY';
  human_review_required: boolean;
  action_executed: boolean;
  evidence_source_ids: string[];
  finding_codes: string[];
}

export type AdvisoryHandler = (ctx: ChildContext, signal?: AbortSignal) => Promise<AdvisoryResult>;

export interface CaseReadiness {
  status: 'READY' | 'NOT_READY' | 'NOT_DIAGNOSED' | 'UNAVAILABLE';
  blocking: number | null;
  errors: number | null;
  diagnosed_at: string | null;
}

export interface CaseReadinessGate {
  read(tenantId: string, taxCaseId: string): Promise<any>;
}

export interface OperationEvent {
  operation_id: string | null;
  agent_id: string;
  attempt: number;
  status: 'PLANNED' | 'AUTHORIZED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRY_SCHEDULED' | 'RESULT_RECORDED' | 'RETRY_REQUIRED' | 'TIMED_OUT' | 'CANCELLED' | 'UNAVAILABLE' | 'DENIED' | string;
  purpose: string | null;
  decision_id: string | null;
  reason_code: string;
  output_hash: string | null;
}

export interface RootRecord {
  root_id: string;
  identity: { uid: string; tenant_id: string; [key: string]: any };
  scope: AICaseScope;
  case_record_id: string;
  workflow_stage: number;
  request_key: string;
  input_hash: string;
  coordinator_decision_id: string;
}

export interface OrchestrationResult {
  root_id: string;
  status: string;
  children: any[];
  human_review_required?: boolean;
  action_executed?: boolean;
  external_submission_allowed?: boolean;
  case_readiness?: CaseReadiness;
  readiness?: CaseReadiness;
  results?: AdvisoryResult[];
}

export interface OrchestrationLedger {
  begin(root: RootRecord): Promise<void>;
  append(root: RootRecord, event: OperationEvent): Promise<void>;
  record?(event: OperationEvent): Promise<void>;
  getRootRecord?(requestId: string): Promise<RootRecord | null>;
}
