import type { AICaseScope } from '../../../ai/types';
import { GovernanceError } from '../governance/contracts';

/** Design artifacts only. No record writer, attestation verifier, grants or activation switch. */
export interface MaterialActionDraft {
  state: 'DRAFT';
  policy_id: string;
  policy_version: number;
  action_service: string;
  target_record_type: string;
  target_fields: string[];
  workflow_version: 'LEGACY_18_V1';
  workflow_stage: number;
  scope: AICaseScope;
  evidence: { source_id: string; source_hash: string; document_version: number }[];
  attestation_requirements: readonly ['PREPARER', 'REVIEWER', 'CPA_EA'];
  distinct_professional_reviewer: 'UNRESOLVED' | 'REQUIRED';
}

function object(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== keys.sort().join(',')) {
    throw new GovernanceError('AI_INVALID_MATERIAL_DRAFT', 400);
  }
}
const id = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const uniqueIds = (value: unknown, max: number): value is string[] => Array.isArray(value) &&
  value.length > 0 && value.length <= max && value.every(id) && new Set(value).size === value.length;

export function parseMaterialActionDraft(raw: unknown): Readonly<MaterialActionDraft> {
  object(raw, ['state', 'policy_id', 'policy_version', 'action_service', 'target_record_type', 'target_fields',
    'workflow_version', 'workflow_stage', 'scope', 'evidence', 'attestation_requirements', 'distinct_professional_reviewer']);
  object(raw.scope, ['tenant_id', 'client_id', 'tax_case_id', 'tax_year']);
  const s = raw.scope;
  if (raw.state !== 'DRAFT' || !id(raw.policy_id) || !Number.isSafeInteger(raw.policy_version) || Number(raw.policy_version) < 1 ||
      !id(raw.action_service) || !id(raw.target_record_type) || !uniqueIds(raw.target_fields, 50) ||
      raw.workflow_version !== 'LEGACY_18_V1' || !Number.isInteger(raw.workflow_stage) || Number(raw.workflow_stage) < 1 || Number(raw.workflow_stage) > 18 ||
      ![s.tenant_id, s.client_id, s.tax_case_id].every(id) || !Number.isInteger(s.tax_year) || Number(s.tax_year) < 2000 || Number(s.tax_year) > 2200 ||
      !Array.isArray(raw.attestation_requirements) || raw.attestation_requirements.join(',') !== 'PREPARER,REVIEWER,CPA_EA' ||
      !['UNRESOLVED', 'REQUIRED'].includes(String(raw.distinct_professional_reviewer)) ||
      !Array.isArray(raw.evidence) || raw.evidence.length === 0 || raw.evidence.length > 50) {
    throw new GovernanceError('AI_INVALID_MATERIAL_DRAFT', 400);
  }
  const evidenceIds = new Set<string>();
  for (const entry of raw.evidence) {
    object(entry, ['source_id', 'source_hash', 'document_version']);
    if (!id(entry.source_id) || evidenceIds.has(entry.source_id) || typeof entry.source_hash !== 'string' ||
        !/^[a-f0-9]{64}$/.test(entry.source_hash) || !Number.isSafeInteger(entry.document_version) || Number(entry.document_version) < 1) {
      throw new GovernanceError('AI_INVALID_MATERIAL_DRAFT', 400);
    }
    evidenceIds.add(entry.source_id);
  }
  const draft = structuredClone(raw) as unknown as MaterialActionDraft;
  Object.freeze(draft.scope);
  draft.evidence.forEach(Object.freeze);
  Object.freeze(draft.evidence);
  Object.freeze(draft.target_fields);
  Object.freeze(draft.attestation_requirements);
  return Object.freeze(draft);
}

export const MATERIAL_ACTION_BLOCKERS = Object.freeze([
  'AUTHORITATIVE_ACTION_POLICY_REQUIRED',
  'SERVER_OWNED_TARGET_ADAPTER_REQUIRED',
  'INDEPENDENT_ATTESTATION_SOURCES_REQUIRED',
  'CPA_EA_SEPARATION_POLICY_REQUIRED',
  'DURABLE_AUDIT_AND_IDEMPOTENCY_REQUIRED',
  'AUTHORIZED_CUTOVER_REQUIRED',
] as const);

/** Structural validity never confers authority, including in tests or with an apparent full chain. */
export function assessMaterialActionPreparation(raw: unknown) {
  parseMaterialActionDraft(raw);
  return Object.freeze({
    validation_status: 'STRUCTURALLY_VALID_ONLY' as const,
    authorization: 'DENIED' as const,
    action_executed: false as const,
    blockers: MATERIAL_ACTION_BLOCKERS,
  });
}
