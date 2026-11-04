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
  operation_id: string;
  agent_id: AgentId;
  evidence_source_ids: string[];
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

export type AdvisoryHandler = (ctx: ChildContext) => Promise<AdvisoryResult>;

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
  event_id: string;
  event_type: string;
  payload: any;
  timestamp: string;
}

export interface RootRecord {
  request_id: string;
  tenant_id: string;
  status: string;
}

export interface OrchestrationResult {
  request_id: string;
  status: string;
  readiness: CaseReadiness;
  results: AdvisoryResult[];
}

export interface OrchestrationLedger {
  record(event: OperationEvent): Promise<void>;
  getRootRecord(requestId: string): Promise<RootRecord | null>;
}
