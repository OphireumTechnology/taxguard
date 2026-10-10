import type { ChildContext } from '../orchestration/contracts';
import type { ResolvedConfiguration } from '../gateway/contracts';

export type CapabilityId = 'workflow.read' | 'document.read';
export interface CapabilityProposal {
  capability_id: CapabilityId; version: '1'; arguments: Record<string, unknown>;
}
export interface CapabilityRequest {
  context: ChildContext; proposal: CapabilityProposal;
  gateway_correlation?: { run_id: string; attempt_id: string };
}
export interface CapabilityDefinition {
  id: CapabilityId; version: '1'; action: 'READ'; data_class: 'INTERNAL';
  timeout_ms: number; maximum_rows: number; maximum_output_bytes: number;
  input_schema: Readonly<Record<string, unknown>>; output_schema: Readonly<Record<string, unknown>>;
}
export interface EvidenceMetadata {
  source_id: string; document_record_id: string; document_version: number;
  source_hash: string; document_status: 'RELEASED' | 'VERIFIED'; quarantine_status: 'CLEAN';
}
export type CapabilityOutput =
  { capability_id: 'workflow.read'; workflow_version: 'LEGACY_18_V1'; stage: number; status: 'ACTIVE' | 'IN_REVIEW' | 'READY' } |
  { capability_id: 'document.read'; evidence: EvidenceMetadata[] };
export interface CapabilityAdmission {
  invocation_id: string; configuration: ResolvedConfiguration; request: CapabilityRequest;
  definition: CapabilityDefinition; binding_hash: string;
}
export type CapabilityEventStatus = 'ADMITTED' | 'EXECUTING' | 'EXECUTED' | 'DENIED' | 'FAILED' | 'TIMED_OUT' | 'CANCELLED' | 'DISCARDED';
export interface CapabilityEvent {
  status: CapabilityEventStatus; reason_code: string; handler_invoked: boolean;
  output_hash: string | null; decision_id: string;
}
export interface CapabilityStore {
  admit(configuration: ResolvedConfiguration, request: CapabilityRequest, definition: CapabilityDefinition, binding_hash: string): Promise<CapabilityAdmission>;
  append(admission: CapabilityAdmission, event: CapabilityEvent): Promise<void>;
  assertContinuation(admission: CapabilityAdmission): Promise<void>;
}
export interface CapabilityResult {
  invocation_id: string; status: 'ADVISORY'; human_review_required: true;
  authoritative_mutation: false; provider_export_allowed: false; output: CapabilityOutput;
  provenance: { root_id: string; operation_id: string; decision_id: string; agent_version: string;
    capability_version: string; definition_hash: string; input_hash: string; output_hash: string;
    evidence: EvidenceMetadata[]; run_id: string | null; attempt_id: string | null };
}
