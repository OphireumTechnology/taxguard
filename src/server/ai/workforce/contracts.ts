import type { AgentCategory, AgentId, AICaseScope, DataClassification, Json, RiskLevel } from '../../../ai/types';
import type { ApprovalRole } from '../../../ai/architectureOverview';
import { GovernanceError } from '../governance/contracts';

/**
 * Shared contracts for TaxGuard's 61 application agents (A00–A60).
 *
 * Security invariants enforced by every contract here:
 * - Every agent output is strictly advisory (human_review_required: true, authoritative_mutation: false,
 *   external_submission_allowed: false).
 * - Raw taxpayer documents, SSNs/TINs, credentials, and secrets are never accepted into queue payloads
 *   or persisted in job/audit rows.
 * - Live production mutations, e-filing, signing, external communications, payments, and permission
 *   changes stay exclusively with authorized humans.
 */

export type WorkforceBatchId =
  | 'BATCH_1_FOUNDATION_COLLECTION'
  | 'BATCH_2_ACCOUNTING'
  | 'BATCH_3_TAX_PREPARATION'
  | 'BATCH_4_REVIEW_RELEASE'
  | 'BATCH_5_PRACTICE_OPERATIONS'
  | 'BATCH_6_ADMIN_GOVERNANCE';

export type WorkforceAudience =
  | 'STAFF_PREPARER'
  | 'STAFF_REVIEWER'
  | 'ACCOUNTANT'
  | 'CPA_EA'
  | 'OPERATIONS_STAFF'
  | 'PRACTICE_MANAGER'
  | 'COMPLIANCE_SECURITY_ADMIN'
  | 'CLIENT_DRAFT_FOR_STAFF_APPROVAL';

export type HumanDecisionAction =
  | 'ACKNOWLEDGE'
  | 'ESCALATE'
  | 'DISMISS'
  | 'RETURN_FOR_CORRECTION'
  | 'APPROVE_PROPOSAL'
  | 'REJECT_PROPOSAL';

export type WorkforceJobStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'DENIED'
  | 'STALE';

export type WorkforceAdvisoryStatus =
  | 'ADVISORY'
  | 'REVIEW_REQUIRED'
  | 'EVIDENCE_REQUIRED'
  | 'UNAVAILABLE_HUMAN_REVIEW_REQUIRED'
  | 'RESERVED';

export type WorkforceStaffRole =
  | 'accountant'
  | 'bookkeeper'
  | 'reviewer'
  | 'senior_reviewer'
  | 'cpa'
  | 'ea'
  | 'operations'
  | 'practice_manager'
  | 'compliance'
  | 'admin'
  | 'super_admin';

export interface WorkforceActor {
  readonly uid: string;
  readonly tenant_id: string;
  readonly role: WorkforceStaffRole;
  readonly status: 'active' | 'inactive' | 'suspended';
  readonly assigned_case_ids?: readonly string[];
  readonly assigned_engagements?: readonly {
    readonly client_id: string;
    readonly tax_year: number;
    readonly role: string;
    readonly active: boolean;
  }[];
  readonly credential_verified?: boolean;
  readonly session_revoked?: boolean;
}

export interface WorkforceCaseRecord extends AICaseScope {
  readonly case_record_id: string;
  readonly engagement_id: string;
  readonly active_stage: number;
  readonly status: 'ACTIVE' | 'IN_REVIEW' | 'READY' | 'ON_HOLD' | 'CLOSED' | 'FILED';
  readonly preparer_uid: string;
  readonly reviewer_uid: string;
  readonly client_uid: string;
}

export interface AuthorizedDocumentEvidence {
  readonly source_id: string;
  readonly document_record_id: string;
  readonly document_version: number;
  readonly source_hash: string;
  readonly document_status: 'RELEASED' | 'VERIFIED' | 'DRAFT' | 'SUPERSEDED' | 'ARCHIVED' | 'DELETED';
  readonly quarantine_status: 'CLEAN' | 'PENDING' | 'QUARANTINED' | 'INFECTED';
  readonly tenant_id: string;
  readonly client_id: string;
  readonly tax_case_id: string;
  readonly tax_year: number;
  readonly document_type?: string;
  readonly file_extension?: string;
  readonly page_count?: number;
}

export interface EvidenceVersionPin {
  readonly source_id: string;
  readonly document_record_id: string;
  readonly document_version: number;
  readonly source_hash: string;
}

export interface KillSwitchState {
  readonly global_stop: boolean;
  readonly stopped_agents: readonly AgentId[];
  readonly stopped_stages: readonly number[];
  readonly stopped_tools: readonly string[];
}

export interface SyntheticStagingPermissionConfig {
  /**
   * Explicit staging/test-only gate for A10 decision recording while A10's production
   * reviewer role awaits owner approval (OV-01 / pending A10 reviewer policy).
   * Never enabled implicitly in production.
   */
  readonly allow_a10_synthetic_staging_decisions: boolean;
  readonly synthetic_reviewer_roles?: readonly WorkforceStaffRole[];
  readonly approval_ticket_ref?: string;
}

export interface OcrProviderConfig {
  readonly configured: boolean;
  readonly approved_provider_id: string | null;
  readonly provider_version: string | null;
  readonly lineage_signing_enabled: boolean;
}

export interface WorkforceExecutionInput {
  readonly request_id: string;
  readonly idempotency_key?: string;
  readonly agent_id: AgentId;
  readonly scope: AICaseScope;
  readonly workflow_stage: number;
  readonly evidence_source_ids: readonly string[];
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface WorkforceFinding {
  readonly code: string;
  readonly severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  readonly summary: string;
  readonly evidence_source_ids: readonly string[];
  readonly authority_citations?: readonly string[];
  readonly recommended_human_action: string;
}

export interface WorkforceAdvisoryOutput {
  readonly advisory_id: string;
  readonly job_id: string | null;
  readonly agent_id: AgentId;
  readonly agent_name: string;
  readonly batch_id: WorkforceBatchId;
  readonly workflow_stage: number;
  readonly scope: AICaseScope;
  readonly status: WorkforceAdvisoryStatus;
  readonly summary: string;
  readonly findings: readonly WorkforceFinding[];
  readonly structured_data: Readonly<Record<string, Json>>;
  readonly evidence_pins: readonly EvidenceVersionPin[];
  readonly evidence_fingerprint: string;
  readonly authority_citations: readonly string[];
  readonly required_reviewer_role: ApprovalRole | 'PENDING_OWNER_APPROVAL' | 'UNASSIGNED';
  readonly permitted_decisions: readonly HumanDecisionAction[];
  readonly output_audience: WorkforceAudience;
  readonly human_review_required: true;
  readonly authoritative_mutation: false;
  readonly external_submission_allowed: false;
  readonly created_at: string;
  readonly requested_by: string;
}

export interface WorkforceJobRecord {
  readonly job_id: string;
  readonly idempotency_key: string;
  readonly tenant_id: string;
  readonly client_id: string;
  readonly tax_case_id: string;
  readonly tax_year: number;
  readonly case_record_id: string;
  readonly agent_id: AgentId;
  readonly workflow_stage: number;
  readonly requested_by: string;
  readonly evidence_source_ids: readonly string[];
  /** Metadata-only sanitized parameters; never raw document bytes or secrets. */
  readonly metadata_payload: Readonly<Record<string, Json>>;
  readonly status: WorkforceJobStatus;
  readonly advisory_id: string | null;
  readonly error_code: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface WorkforceHumanDecisionRecord {
  readonly decision_id: string;
  readonly advisory_id: string;
  readonly tenant_id: string;
  readonly client_id: string;
  readonly tax_case_id: string;
  readonly tax_year: number;
  readonly agent_id: AgentId;
  readonly bound_evidence_fingerprint: string;
  readonly bound_evidence_versions: readonly EvidenceVersionPin[];
  readonly reviewer_uid: string;
  readonly reviewer_role: WorkforceStaffRole;
  readonly decision: HumanDecisionAction;
  readonly rationale: string;
  readonly synthetic_staging_gate_used: boolean;
  readonly authoritative_mutation: false;
  readonly recorded_at: string;
}

export interface WorkforceHumanDecisionRequest {
  readonly request_id: string;
  readonly advisory_id: string;
  readonly scope: AICaseScope;
  readonly expected_evidence_fingerprint: string;
  readonly decision: HumanDecisionAction;
  readonly rationale: string;
}

export interface WorkforceAgentContext {
  readonly actor: WorkforceActor;
  readonly caseRecord: WorkforceCaseRecord | null;
  readonly evidence: readonly AuthorizedDocumentEvidence[];
  readonly scope: AICaseScope;
  readonly workflow_stage: number;
  readonly request_id: string;
  readonly ocrConfig: OcrProviderConfig;
  readonly gatewayConfigured: boolean;
}

export interface WorkforceDomainHandlerResult {
  readonly status: WorkforceAdvisoryStatus;
  readonly summary: string;
  readonly findings: readonly WorkforceFinding[];
  readonly structured_data: Readonly<Record<string, Json>>;
  readonly authority_citations?: readonly string[];
}

export type WorkforceDomainHandler = (
  ctx: WorkforceAgentContext,
  payload: Readonly<Record<string, unknown>>,
) => Promise<WorkforceDomainHandlerResult> | WorkforceDomainHandlerResult;

export interface WorkforceAgentSpec {
  readonly agent_id: AgentId;
  readonly batch_id: WorkforceBatchId;
  readonly category: AgentCategory;
  readonly overview_name: string;
  readonly workflow_stages: readonly number[];
  readonly allowed_roles: readonly WorkforceStaffRole[];
  readonly required_reviewer_role: ApprovalRole | 'PENDING_OWNER_APPROVAL' | 'UNASSIGNED';
  readonly permitted_decisions: readonly HumanDecisionAction[];
  readonly authorized_inputs: readonly string[];
  readonly authorized_tools: readonly string[];
  readonly data_classes: readonly DataClassification[];
  readonly output_audience: WorkforceAudience;
  readonly risk_level: RiskLevel;
  readonly requires_case_scope: boolean;
  readonly requires_evidence: boolean;
  readonly source_path: string;
  readonly handler_name: string;
  readonly handler: WorkforceDomainHandler;
}

export class WorkforceError extends GovernanceError {
  constructor(code: string, status = 403, public readonly details?: Record<string, Json>) {
    super(code, status);
    this.name = 'WorkforceError';
  }
}

export interface WorkforceStore {
  createOrGetJob(job: Omit<WorkforceJobRecord, 'created_at' | 'updated_at'>): Promise<{ job: WorkforceJobRecord; created: boolean }>;
  getJob(tenantId: string, jobId: string): Promise<WorkforceJobRecord | null>;
  updateJobStatus(
    tenantId: string,
    jobId: string,
    status: WorkforceJobStatus,
    patch?: { advisory_id?: string | null; error_code?: string | null },
  ): Promise<WorkforceJobRecord>;
  completeA10Job(advisory: WorkforceAdvisoryOutput & { job_id: string }): Promise<WorkforceJobRecord>;
  saveAdvisory(advisory: WorkforceAdvisoryOutput): Promise<WorkforceAdvisoryOutput>;
  getAdvisory(tenantId: string, advisoryId: string): Promise<WorkforceAdvisoryOutput | null>;
  listCaseAdvisories(tenantId: string, taxCaseId: string, agentId?: AgentId): Promise<readonly WorkforceAdvisoryOutput[]>;
  recordDecisionAtomic(
    decision: WorkforceHumanDecisionRecord,
  ): Promise<WorkforceHumanDecisionRecord>;
  listAdvisoryDecisions(tenantId: string, advisoryId: string): Promise<readonly WorkforceHumanDecisionRecord[]>;
}

export interface WorkforceEnvironment {
  verifyActor(token: string): Promise<WorkforceActor | null>;
  loadCase(tenantId: string, scope: AICaseScope): Promise<WorkforceCaseRecord | null>;
  isStaffAssigned(actor: WorkforceActor, caseRecord: WorkforceCaseRecord): Promise<boolean>;
  loadEvidence(
    tenantId: string,
    scope: AICaseScope,
    sourceIds: readonly string[],
  ): Promise<readonly AuthorizedDocumentEvidence[]>;
  getKillSwitches(tenantId: string): Promise<KillSwitchState>;
  getOcrProviderConfig(): OcrProviderConfig;
  getSyntheticStagingConfig(): SyntheticStagingPermissionConfig;
  isLlmGatewayConfigured(): boolean;
}
