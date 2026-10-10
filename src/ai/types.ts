/** Canonical AI-1 database row contracts. UUIDs/timestamps are strings; PostgreSQL
 * numeric costs may be returned as strings. These types grant no authority. */
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type AgentId = `A${'0' | '1' | '2' | '3' | '4' | '5'}${Digit}` | 'A60';
export type RegistryStatus = 'DRAFT' | 'ACTIVE' | 'RESTRICTED' | 'DISABLED' | 'OFFLINE' | 'RETIRED';
export type RiskLevel = 'LOW' | 'MATERIAL' | 'HIGH' | 'CRITICAL';
export type PermissionState = 'ALLOW' | 'DENY' | 'CONDITIONAL';
export type AIAction = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXECUTE' | 'APPROVE' | 'EXPORT' | 'TRANSMIT';
export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'CLIENT_PII' | 'TAX_DATA' | 'FINANCIAL_DATA' | 'DOCUMENT_CONTENT' | 'AUTHENTICATION_DATA' | 'AUDIT_DATA' | 'SYSTEM_SECRET';
export type AgentCategory = 'SUPERVISOR' | 'CLIENT_SERVICES' | 'DOCUMENT_INTELLIGENCE' | 'ACCOUNTING' | 'TAX_INTELLIGENCE' | 'RISK_QC' | 'SIGN_FILE_RESOLVE' | 'PRACTICE_OPERATIONS' | 'GOVERNANCE_SECURITY_PLATFORM';
export type RunStatus = 'QUEUED' | 'RUNNING' | 'PROPOSED' | 'VERIFYING' | 'REVIEW_REQUIRED' | 'APPROVED' | 'REJECTED' | 'FAILED' | 'CANCELLED';
export type WorkflowVersion = 'LEGACY_18_V1';
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Decimal = number | string;
export interface Timestamps { created_at: string; updated_at: string }
export interface AgentVersion extends Timestamps {
  agent_id: AgentId; version: string; status: RegistryStatus; risk_class: RiskLevel;
  default_model: string | null; default_model_version: string | null; prompt_id: string | null; prompt_version: string | null;
  schema_version: string; confidence_threshold: Decimal; human_review_threshold: Decimal;
  maximum_execution_time: number; maximum_retries: number; token_budget: number; cost_budget: Decimal;
}
export interface Agent extends AgentVersion { agent_name: string; category: AgentCategory; description: string }
export interface AgentPermission {
  agent_id: AgentId; resource: string; action: AIAction; permission_state: PermissionState;
  conditions: Record<string, Json>; risk_level: RiskLevel; human_approval_required: boolean;
}
export interface AIModel extends Timestamps {
  provider: string; model_id: string; model_version: string; status: RegistryStatus;
  approved_use_cases: string[]; prohibited_use_cases: string[]; data_classification_limit: DataClassification;
  token_limit: number; cost_limit: Decimal; fallback_model: string | null; fallback_model_version: string | null; effective_date: string;
}
export interface AIPrompt extends Timestamps {
  prompt_id: string; agent_id: AgentId; version: string; status: RegistryStatus; system_instructions: string;
  required_inputs: Json[]; expected_output_schema: Record<string, Json>; risk_class: RiskLevel; effective_date: string;
}
export interface AITool extends Timestamps {
  tool_id: string; name: string; description: string; risk_class: RiskLevel; status: RegistryStatus; requires_human_approval: boolean;
}
export interface AIDataClassification { data_classification: DataClassification; description: string }
export interface AIDataPermission { agent_id: AgentId; data_classification: DataClassification; permission_state: PermissionState; conditions: Record<string, Json> }
export interface AIWorkflowStage { workflow_version: WorkflowVersion; stage: number; name: string }
export interface AIStagePermission { agent_id: AgentId; workflow_version: WorkflowVersion; stage: number; permission_state: PermissionState; conditions: Record<string, Json> }
export interface AIHumanApprovalPolicy extends Timestamps {
  policy_id: string; tenant_id: string; agent_id: AgentId; action: AIAction; risk_level: RiskLevel;
  confidence_below: Decimal | null; workflow_version: WorkflowVersion | null; workflow_stage: number | null;
  data_classification: DataClassification | null; materiality: 'ROUTINE' | 'MATERIAL' | 'CRITICAL'; financial_threshold: Decimal | null;
  required_roles: ['PREPARER', 'REVIEWER', 'CPA_EA']; separation_required: true; status: RegistryStatus;
}
export interface AICaseScope { tenant_id: string; client_id: string; tax_case_id: string; tax_year: number }
export interface AIRun extends AICaseScope {
  run_id: string; agent_id: AgentId; agent_version: string; model_id: string; model_provider: string; model_version: string;
  prompt_id: string; prompt_version: string; case_record_id: string; workflow_version: WorkflowVersion; workflow_stage: number;
  request_id: string; requested_by: string; input_hash: string; output_hash: string | null; confidence: Decimal | null;
  risk_level: RiskLevel; proposed_action: Json; human_review_required: true; reviewer: string | null;
  review_decision: 'APPROVED' | 'REJECTED' | 'RETURNED' | null; execution_time: number | null; token_usage: number | null; estimated_cost: Decimal | null;
  status: RunStatus; created_at: string; started_at: string | null; completed_at: string | null; audit_event_id: string | null;
}
export interface AIEvidenceSource extends AICaseScope {
  source_id: string; case_record_id: string; evidence_type: 'DOCUMENT' | 'AUTHORITY' | 'CALCULATION' | 'RULE';
  document_record_id: string | null; document_version: number | null; source_reference: string; source_hash: string; created_at: string;
}
export interface AIEvidence extends AICaseScope {
  evidence_id: string; run_id: string; source_id: string; page: number | null; field: string | null;
  extracted_value: Json; extracted_value_hash: string | null; authority: string | null; calculation: string | null; rule: string | null; timestamp: string;
}
export interface AIProposal extends AICaseScope {
  proposal_id: string; run_id: string; status: 'PROPOSED' | 'REVIEW_REQUIRED' | 'APPROVED' | 'REJECTED';
  structured_output: Record<string, Json>; output_hash: string; is_ai_proposed_only: true; created_at: string;
}
export interface AIVerification extends AICaseScope {
  verification_id: string; run_id: string; proposal_id: string; verifier_agent_id: AgentId; verifier_agent_version: string;
  outcome: 'PASS' | 'REVIEW_REQUIRED' | 'EVIDENCE_REQUIRED' | 'BLOCKED' | 'ESCALATE'; findings: Json[]; created_at: string;
}
export interface AIVerificationEvidence { verification_id: string; evidence_id: string; run_id: string }
export interface AIHumanReview extends AICaseScope {
  review_id: string; run_id: string; proposal_id: string; reviewer_user_id: string; reviewer_role: 'reviewer' | 'senior_reviewer' | 'cpa' | 'ea';
  decision: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED'; reason: string | null; created_at: string; completed_at: string | null;
}
export interface AIAuthoritativeAction extends AICaseScope {
  action_id: string; run_id: string; proposal_id: string; review_id: string; action: AIAction; action_service: string;
  status: 'BLOCKED' | 'AUTHORIZED' | 'EXECUTED' | 'FAILED'; authorized_by: string; audit_event_id: string; created_at: string; executed_at: string | null; result_hash: string | null;
}
export type AIEventType = 'AUTHORIZATION_DENIAL' | 'PERMISSION_VIOLATION' | 'CROSS_CLIENT_ATTEMPT' | 'CROSS_TENANT_ATTEMPT' | 'TOOL_DENIAL' | 'POLICY_VIOLATION' | 'PROMPT_INJECTION' | 'KILL_SWITCH' | 'MODEL_VIOLATION' | 'HUMAN_APPROVAL_VIOLATION';
export interface AISecurityEvent {
  event_id: string; tenant_id: string; client_id: string | null; tax_case_id: string | null; tax_year: number | null; case_record_id: string | null;
  run_id: string | null; agent_id: AgentId | null; event_type: AIEventType; actor_uid: string | null; severity: RiskLevel; details: Record<string, Json>; created_at: string;
}
export type AIPolicyEvent = AISecurityEvent;
export interface AIKillSwitch {
  switch_id: string; tenant_id: string; scope: 'GLOBAL' | 'AGENT' | 'MODEL' | 'TOOL' | 'WORKFLOW'; target: string;
  agent_id: AgentId | null; model_id: string | null; model_version: string | null; tool_id: string | null; workflow_version: WorkflowVersion | null; workflow_stage: number | null;
  enabled: boolean; reason: string; activated_by: string; activated_at: string; deactivated_by: string | null; deactivated_at: string | null;
}

/** Immutable governance assessment record; never a dispatched run or execution receipt. */
export interface AIGovernanceDecisionRecord {
  decision_id: string; tenant_id: string; actor_uid: string; request_key: string; input_hash: string;
  policy_hash: string | null; policy_snapshot: Record<string, Json>; agent_id: AgentId | null;
  case_record_id: string | null; client_id: string | null; tax_case_id: string | null; tax_year: number | null;
  outcome: 'ADVISORY_ALLOWED' | 'REVIEW_REQUIRED' | 'DENIED'; reason_code: string;
  action_state: 'ADVISORY_ONLY' | 'PROPOSED_ACTION' | 'BLOCKED'; human_review_required: true;
  action_executed: false; replay_of: string | null; created_at: string;
}
