import { createHash } from 'node:crypto';
import type { AgentId, AICaseScope, Json } from '../../../ai/types';
import {
  WorkforceError,
  type AuthorizedDocumentEvidence,
  type EvidenceVersionPin,
  type KillSwitchState,
  type SyntheticStagingPermissionConfig,
  type WorkforceActor,
  type WorkforceCaseRecord,
  type WorkforceStaffRole,
} from './contracts';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

/** Patterns that must never appear in workforce job payloads, logs, or unredacted metadata. */
const FORBIDDEN_SECRET_PATTERNS: readonly RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\bghp_[A-Za-z0-9]{30,}\b/,
  /\b\d{3}-\d{2}-\d{4}\b/, // raw SSN pattern
];

const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'raw_document',
  'raw_bytes',
  'file_bytes',
  'file_content',
  'document_body',
  'base64_content',
  'api_key',
  'secret',
  'password',
  'access_token',
  'refresh_token',
  'ssn',
  'tin',
]);

export function sha256Json(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export function validateScope(scope: unknown): AICaseScope {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    throw new WorkforceError('WORKFORCE_INVALID_SCOPE', 400);
  }
  const s = scope as Record<string, unknown>;
  if (
    typeof s.tenant_id !== 'string' ||
    !ID_PATTERN.test(s.tenant_id) ||
    typeof s.client_id !== 'string' ||
    !ID_PATTERN.test(s.client_id) ||
    typeof s.tax_case_id !== 'string' ||
    !ID_PATTERN.test(s.tax_case_id) ||
    !Number.isInteger(s.tax_year) ||
    (s.tax_year as number) < 2000 ||
    (s.tax_year as number) > 2200
  ) {
    throw new WorkforceError('WORKFORCE_INVALID_SCOPE', 400);
  }
  return {
    tenant_id: s.tenant_id,
    client_id: s.client_id,
    tax_case_id: s.tax_case_id,
    tax_year: s.tax_year as number,
  };
}

/**
 * Rejects raw taxpayer documents, secrets, credentials, or oversized payloads before any job
 * is queued or persisted.
 */
export function assertSafeMetadataPayload(
  payload: unknown,
  maxBytes = 16_384,
): Readonly<Record<string, Json>> {
  if (payload === undefined || payload === null) return Object.freeze({});
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    throw new WorkforceError('WORKFORCE_INVALID_PAYLOAD', 400);
  }
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, 'utf8') > maxBytes) {
    throw new WorkforceError('WORKFORCE_PAYLOAD_TOO_LARGE', 400);
  }

  const walk = (node: unknown, depth: number): void => {
    if (depth > 8) throw new WorkforceError('WORKFORCE_PAYLOAD_TOO_DEEP', 400);
    if (typeof node === 'string') {
      for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
        if (pattern.test(node)) {
          throw new WorkforceError('WORKFORCE_SENSITIVE_CONTENT_BLOCKED', 400);
        }
      }
      return;
    }
    if (Array.isArray(node)) {
      if (node.length > 250) throw new WorkforceError('WORKFORCE_PAYLOAD_ARRAY_TOO_LARGE', 400);
      for (const item of node) walk(item, depth + 1);
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (FORBIDDEN_PAYLOAD_KEYS.has(k.toLowerCase())) {
          throw new WorkforceError('WORKFORCE_RAW_CONTENT_OR_SECRET_FORBIDDEN', 400);
        }
        walk(v, depth + 1);
      }
    }
  };

  walk(payload, 0);
  return Object.freeze(structuredClone(payload) as Record<string, Json>);
}

export function assertActiveActor(actor: WorkforceActor | null): asserts actor is WorkforceActor {
  if (!actor) throw new WorkforceError('WORKFORCE_AUTH_REQUIRED', 401);
  if (actor.session_revoked) throw new WorkforceError('WORKFORCE_SESSION_REVOKED', 401);
  if (actor.status !== 'active') throw new WorkforceError('WORKFORCE_ACTOR_INACTIVE', 403);
}

export function assertTenantScope(actor: WorkforceActor, scope: AICaseScope): void {
  if (actor.tenant_id !== scope.tenant_id) {
    throw new WorkforceError('WORKFORCE_CROSS_TENANT_DENIED', 403);
  }
}

export function assertRoleAllowed(
  actor: WorkforceActor,
  allowedRoles: readonly WorkforceStaffRole[],
): void {
  if (!allowedRoles.includes(actor.role)) {
    throw new WorkforceError('WORKFORCE_ROLE_DENIED', 403);
  }
}

export function assertKillSwitchClear(
  killSwitches: KillSwitchState,
  agentId: AgentId,
  workflowStage: number,
  tools: readonly string[],
): void {
  if (killSwitches.global_stop) {
    throw new WorkforceError('WORKFORCE_KILL_SWITCH_ACTIVE', 403);
  }
  if (killSwitches.stopped_agents.includes(agentId)) {
    throw new WorkforceError('WORKFORCE_KILL_SWITCH_ACTIVE', 403);
  }
  if (killSwitches.stopped_stages.includes(workflowStage)) {
    throw new WorkforceError('WORKFORCE_KILL_SWITCH_ACTIVE', 403);
  }
  if (tools.some(t => killSwitches.stopped_tools.includes(t))) {
    throw new WorkforceError('WORKFORCE_KILL_SWITCH_ACTIVE', 403);
  }
}

export function assertCaseScopeMatch(
  caseRecord: WorkforceCaseRecord | null,
  scope: AICaseScope,
  allowedStages?: readonly number[],
): asserts caseRecord is WorkforceCaseRecord {
  if (!caseRecord) throw new WorkforceError('WORKFORCE_CASE_NOT_FOUND', 403);
  if (
    caseRecord.tenant_id !== scope.tenant_id ||
    caseRecord.client_id !== scope.client_id ||
    caseRecord.tax_case_id !== scope.tax_case_id ||
    caseRecord.tax_year !== scope.tax_year
  ) {
    throw new WorkforceError('WORKFORCE_CASE_SCOPE_MISMATCH', 403);
  }
  if (caseRecord.preparer_uid === caseRecord.reviewer_uid) {
    throw new WorkforceError('WORKFORCE_MAKER_CHECKER_VIOLATION', 403);
  }
  if (!['ACTIVE', 'IN_REVIEW', 'READY'].includes(caseRecord.status)) {
    throw new WorkforceError('WORKFORCE_CASE_NOT_OPEN', 403);
  }
  if (allowedStages && allowedStages.length > 0 && !allowedStages.includes(caseRecord.active_stage)) {
    throw new WorkforceError('WORKFORCE_STAGE_MISMATCH', 403);
  }
}

/**
 * Validates that every requested evidence source belongs to the exact tenant, client, case,
 * and tax year, is CLEAN of quarantine, has status RELEASED or VERIFIED, has valid SHA-256
 * hash, and has a valid integer document_version >= 1.
 */
export function verifyAuthorizedEvidence(
  requestedSourceIds: readonly string[],
  loadedEvidence: readonly AuthorizedDocumentEvidence[],
  scope: AICaseScope,
  maxItems = 50,
): readonly AuthorizedDocumentEvidence[] {
  if (!Array.isArray(requestedSourceIds) || requestedSourceIds.length === 0 || requestedSourceIds.length > maxItems) {
    throw new WorkforceError('WORKFORCE_INVALID_EVIDENCE_SELECTION', 400);
  }
  if (new Set(requestedSourceIds).size !== requestedSourceIds.length) {
    throw new WorkforceError('WORKFORCE_DUPLICATE_EVIDENCE_IDS', 400);
  }
  for (const id of requestedSourceIds) {
    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
      throw new WorkforceError('WORKFORCE_INVALID_EVIDENCE_ID', 400);
    }
  }
  const byId = new Map(loadedEvidence.map(item => [item.source_id, item]));
  const verified: AuthorizedDocumentEvidence[] = [];

  for (const sourceId of requestedSourceIds) {
    const item = byId.get(sourceId);
    if (!item) {
      throw new WorkforceError('WORKFORCE_EVIDENCE_NOT_AUTHORIZED', 403);
    }
    if (
      item.tenant_id !== scope.tenant_id ||
      item.client_id !== scope.client_id ||
      item.tax_case_id !== scope.tax_case_id ||
      item.tax_year !== scope.tax_year
    ) {
      throw new WorkforceError('WORKFORCE_EVIDENCE_SCOPE_MISMATCH', 403);
    }
    if (item.quarantine_status !== 'CLEAN') {
      throw new WorkforceError('WORKFORCE_EVIDENCE_QUARANTINED', 403);
    }
    if (item.document_status === 'SUPERSEDED') {
      throw new WorkforceError('WORKFORCE_EVIDENCE_SUPERSEDED', 409);
    }
    if (!['RELEASED', 'VERIFIED'].includes(item.document_status)) {
      throw new WorkforceError('WORKFORCE_EVIDENCE_NOT_RELEASED', 403);
    }
    if (!Number.isInteger(item.document_version) || item.document_version < 1 || !SHA256_PATTERN.test(item.source_hash)) {
      throw new WorkforceError('WORKFORCE_EVIDENCE_METADATA_INVALID', 400);
    }
    verified.push(item);
  }

  return Object.freeze(verified);
}

export function buildEvidencePins(evidence: readonly AuthorizedDocumentEvidence[]): {
  pins: readonly EvidenceVersionPin[];
  fingerprint: string;
} {
  const pins: EvidenceVersionPin[] = [...evidence]
    .sort((a, b) => a.source_id.localeCompare(b.source_id))
    .map(item => ({
      source_id: item.source_id,
      document_record_id: item.document_record_id,
      document_version: item.document_version,
      source_hash: item.source_hash,
    }));
  return {
    pins: Object.freeze(pins),
    fingerprint: sha256Json(pins),
  };
}

/**
 * Checks whether any underlying document version, status, quarantine status, or hash changed
 * since the advisory was produced.
 */
export function detectStaleEvidence(
  pinned: readonly EvidenceVersionPin[],
  liveEvidence: readonly AuthorizedDocumentEvidence[],
  scope: AICaseScope,
): { stale: boolean; reason: string | null } {
  const byId = new Map(liveEvidence.map(e => [e.source_id, e]));
  for (const pin of pinned) {
    const live = byId.get(pin.source_id);
    if (!live) return { stale: true, reason: `EVIDENCE_MISSING:${pin.source_id}` };
    if (
      live.tenant_id !== scope.tenant_id ||
      live.client_id !== scope.client_id ||
      live.tax_case_id !== scope.tax_case_id ||
      live.tax_year !== scope.tax_year
    ) {
      return { stale: true, reason: `EVIDENCE_SCOPE_CHANGED:${pin.source_id}` };
    }
    if (live.quarantine_status !== 'CLEAN') {
      return { stale: true, reason: `EVIDENCE_QUARANTINED:${pin.source_id}` };
    }
    if (!['RELEASED', 'VERIFIED'].includes(live.document_status)) {
      return { stale: true, reason: `EVIDENCE_STATUS_CHANGED:${pin.source_id}:${live.document_status}` };
    }
    if (live.document_version !== pin.document_version || live.source_hash !== pin.source_hash) {
      return { stale: true, reason: `EVIDENCE_VERSION_CHANGED:${pin.source_id}` };
    }
  }
  return { stale: false, reason: null };
}

/**
 * Enforces owner-approved reviewer authority for human decision recording.
 * For A10 specifically, live decision recording stays UNAVAILABLE until the owner approves
 * A10's pending reviewer role — unless an explicit synthetic staging permission override is
 * enabled for staging/test verification.
 */
export function assertDecisionAuthority(params: {
  agentId: AgentId;
  actor: WorkforceActor;
  requestedBy: string;
  caseRecord: WorkforceCaseRecord | null;
  requiredReviewerRole: 'PREPARER' | 'REVIEWER' | 'CPA_EA' | 'PENDING_OWNER_APPROVAL' | 'UNASSIGNED';
  syntheticStaging: SyntheticStagingPermissionConfig;
}): { syntheticUsed: boolean } {
  const { agentId, actor, requestedBy, caseRecord, requiredReviewerRole, syntheticStaging } = params;

  if (actor.uid === requestedBy) {
    throw new WorkforceError('WORKFORCE_MAKER_CHECKER_SELF_REVIEW_DENIED', 403);
  }
  if (caseRecord && actor.uid === caseRecord.preparer_uid && requiredReviewerRole !== 'PREPARER') {
    throw new WorkforceError('WORKFORCE_MAKER_CHECKER_PREPARER_REVIEW_DENIED', 403);
  }

  if (agentId === 'A39' || requiredReviewerRole === 'UNASSIGNED') {
    throw new WorkforceError('AI_AGENT_RESERVED_PENDING_OWNER_DEFINITION', 503);
  }

  if (agentId === 'A10' || requiredReviewerRole === 'PENDING_OWNER_APPROVAL') {
    if (!syntheticStaging.allow_a10_synthetic_staging_decisions) {
      throw new WorkforceError('A10_LIVE_DECISION_PENDING_OWNER_APPROVAL', 503);
    }
    const allowedSyntheticRoles = syntheticStaging.synthetic_reviewer_roles ?? ['reviewer', 'senior_reviewer', 'cpa', 'ea'];
    if (!allowedSyntheticRoles.includes(actor.role)) {
      throw new WorkforceError('WORKFORCE_REVIEWER_ROLE_DENIED', 403);
    }
    return { syntheticUsed: true };
  }

  const roleMap: Record<'PREPARER' | 'REVIEWER' | 'CPA_EA', readonly WorkforceStaffRole[]> = {
    PREPARER: ['accountant', 'bookkeeper', 'reviewer', 'senior_reviewer', 'cpa', 'ea'],
    REVIEWER: ['reviewer', 'senior_reviewer', 'cpa', 'ea', 'compliance', 'admin', 'super_admin', 'practice_manager'],
    CPA_EA: ['cpa', 'ea', 'senior_reviewer'],
  };

  if (!roleMap[requiredReviewerRole].includes(actor.role)) {
    throw new WorkforceError('WORKFORCE_REVIEWER_ROLE_DENIED', 403);
  }
  return { syntheticUsed: false };
}
