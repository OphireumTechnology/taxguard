import type { AICaseScope, Agent, AgentVersion, AIModel, AIPrompt, AITool, AgentPermission, AIDataPermission, AIStagePermission, AIHumanApprovalPolicy, AIKillSwitch, DataClassification, AIAction, RiskLevel, AgentId } from '../../../ai/types';

export interface VerifiedIdentity { uid: string; tenant_id: string }
export interface GovernanceRequest {
  request_id: string; agent_id: string; scope: AICaseScope; workflow_stage: number;
  intent: 'ADVISORY' | 'PROPOSE_ACTION'; purpose: string;
  capabilities: { tool_id: string; action: AIAction }[]; data_classes: DataClassification[];
  evidence_source_ids: string[]; confidence: number; financial_amount: number; risk_level: RiskLevel;
}
export interface Member { uid: string; tenant_id: string; role: string; status: string; credential_verified: boolean; credential_type: string | null; credential_expires_at: string | null }
export interface GovernedCase extends AICaseScope {
  id: string; engagement_id: string; active_stage: number; status: string;
  preparer_uid: string; reviewer_uid: string; client_uid: string;
}
export interface SourceEvidence extends AICaseScope {
  source_id: string; case_record_id: string; evidence_type: string; source_hash: string; source_reference: string;
  document_record_id: string | null; document_version: number | null;
  document_hash: string | null; document_status: string | null; quarantine_status: string | null;
  document_tenant_id: string | null; document_client_id: string | null; document_case_id: string | null; document_tax_year: number | null; actual_document_version: number | null;
}
export interface GovernanceSnapshot {
  member: Member | null; case: GovernedCase | null; assigned: boolean;
  agent: Agent | null; version: AgentVersion | null; model: AIModel | null; prompt: AIPrompt | null;
  tools: AITool[]; permissions: AgentPermission[]; data_permissions: AIDataPermission[];
  stage_permission: AIStagePermission | null; policies: AIHumanApprovalPolicy[];
  kill_switches: AIKillSwitch[]; evidence: SourceEvidence[];
}
export interface GovernanceDecision {
  decision_id: string; request_id: string; agent_id: AgentId;
  outcome: 'ADVISORY_ALLOWED' | 'REVIEW_REQUIRED'; human_review_required: true;
  required_human_roles: readonly ['PREPARER', 'REVIEWER', 'CPA_EA'];
  action_state: 'ADVISORY_ONLY' | 'PROPOSED_ACTION'; action_executed: false;
  external_submission_allowed: false;
}
export interface GovernanceTransaction {
  link?(identity: VerifiedIdentity, decision_id: string, root_id: string, operation_id: string): Promise<void>;
  load(identity: VerifiedIdentity, request: GovernanceRequest): Promise<GovernanceSnapshot>;
  claim(identity: VerifiedIdentity, request: GovernanceRequest, fingerprint: string): Promise<void>;
  append(identity: VerifiedIdentity, request: GovernanceRequest, fingerprint: string, snapshot: GovernanceSnapshot | null, code: string, decision: GovernanceDecision | null): Promise<void>;
}
export interface GovernanceStore { transaction<T>(work: (tx: GovernanceTransaction) => Promise<T>): Promise<T> }
export interface SessionAuthority { verify(token: string): Promise<VerifiedIdentity | null> }
export class GovernanceError extends Error {
  constructor(public readonly code: string, public readonly status = 403) { super(code); }
}
