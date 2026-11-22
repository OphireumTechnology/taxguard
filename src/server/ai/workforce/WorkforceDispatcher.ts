import { randomUUID } from 'node:crypto';
import { findCanonicalAgent } from '../../../ai/registry';
import type { AgentId } from '../../../ai/types';
import {
  assertActiveActor,
  assertCaseScopeMatch,
  assertDecisionAuthority,
  assertKillSwitchClear,
  assertRoleAllowed,
  assertSafeMetadataPayload,
  assertTenantScope,
  buildEvidencePins,
  detectStaleEvidence,
  sha256Json,
  validateScope,
  verifyAuthorizedEvidence,
} from './authority';
import {
  WorkforceError,
  type WorkforceAdvisoryOutput,
  type WorkforceAgentSpec,
  type WorkforceEnvironment,
  type WorkforceExecutionInput,
  type WorkforceHumanDecisionRecord,
  type WorkforceHumanDecisionRequest,
  type WorkforceStore,
} from './contracts';
import { BATCH_1_AGENT_SPECS } from './batches/batch1FoundationCollection';
import { BATCH_2_AGENT_SPECS } from './batches/batch2Accounting';
import { BATCH_3_AGENT_SPECS } from './batches/batch3TaxPreparation';
import { BATCH_4_AGENT_SPECS } from './batches/batch4ReviewRelease';
import { BATCH_5_AGENT_SPECS } from './batches/batch5PracticeOperations';
import { BATCH_6_AGENT_SPECS } from './batches/batch6AdminGovernance';

/**
 * Complete static server-owned catalog of all 61 TaxGuard application agents (A00–A60).
 * No caller or model can ever select arbitrary handlers outside this frozen map.
 */
export const ALL_WORKFORCE_AGENT_SPECS: readonly WorkforceAgentSpec[] = Object.freeze([
  ...BATCH_1_AGENT_SPECS,
  ...BATCH_2_AGENT_SPECS,
  ...BATCH_3_AGENT_SPECS,
  ...BATCH_4_AGENT_SPECS,
  ...BATCH_5_AGENT_SPECS,
  ...BATCH_6_AGENT_SPECS,
]);

const SPEC_BY_ID: ReadonlyMap<AgentId, WorkforceAgentSpec> = new Map(
  ALL_WORKFORCE_AGENT_SPECS.map(spec => [spec.agent_id, spec]),
);

export function getWorkforceAgentSpec(agentId: string): WorkforceAgentSpec {
  const canonical = findCanonicalAgent(agentId);
  const spec = SPEC_BY_ID.get(canonical.agent_id);
  if (!spec) throw new WorkforceError('WORKFORCE_AGENT_SPEC_MISSING', 503);
  return spec;
}

/**
 * Unified server-side dispatcher for all 61 TaxGuard application agents (A00–A60).
 *
 * Enforces on every invocation:
 * 1. Verified active actor & tenant scope.
 * 2. Reserved agent fail-closed guard (A39).
 * 3. Staff role check + live kill-switch check.
 * 4. Case scope, workflow stage, maker-checker, and staff assignment checks (for case-scoped agents).
 * 5. Metadata-only payload sanitization (blocks raw document bytes, secrets, SSNs).
 * 6. Authorized clean/released/verified evidence pin validation (when evidence supplied or required).
 * 7. Bounded deterministic domain execution + immutable advisory persistence.
 * 8. Human decision recording bound to advisory ID + evidence version fingerprint with live authority recheck.
 */
export class WorkforceDispatcher {
  constructor(
    private readonly env: WorkforceEnvironment,
    private readonly store: WorkforceStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async executeAgent(
    token: string,
    rawInput: WorkforceExecutionInput,
  ): Promise<WorkforceAdvisoryOutput> {
    if (!rawInput || typeof rawInput !== 'object') {
      throw new WorkforceError('WORKFORCE_INVALID_REQUEST', 400);
    }
    if (!rawInput.request_id || typeof rawInput.request_id !== 'string' || rawInput.request_id.length > 128) {
      throw new WorkforceError('WORKFORCE_INVALID_REQUEST_ID', 400);
    }

    let spec: WorkforceAgentSpec;
    try {
      spec = getWorkforceAgentSpec(rawInput.agent_id);
    } catch {
      throw new WorkforceError('WORKFORCE_UNKNOWN_AGENT', 404);
    }

    const scope = validateScope(rawInput.scope);
    const safePayload = assertSafeMetadataPayload(rawInput.payload);

    const actor = await this.env.verifyActor(token);
    assertActiveActor(actor);
    assertTenantScope(actor, scope);

    if (spec.agent_id === 'A39') {
      throw new WorkforceError('AI_AGENT_RESERVED_PENDING_OWNER_DEFINITION', 503, {
        agent_id: 'A39',
        owner_decision: 'OV-01',
      });
    }

    assertRoleAllowed(actor, spec.allowed_roles);

    const killSwitches = await this.env.getKillSwitches(actor.tenant_id);
    assertKillSwitchClear(killSwitches, spec.agent_id, rawInput.workflow_stage, spec.authorized_tools);

    let caseRecord = null;
    if (spec.requires_case_scope) {
      caseRecord = await this.env.loadCase(actor.tenant_id, scope);
      assertCaseScopeMatch(caseRecord, scope, spec.workflow_stages);
      const assigned = await this.env.isStaffAssigned(actor, caseRecord);
      if (!assigned) {
        throw new WorkforceError('WORKFORCE_STAFF_ASSIGNMENT_REQUIRED', 403);
      }
    }

    const sourceIds = Array.isArray(rawInput.evidence_source_ids) ? rawInput.evidence_source_ids : [];
    let verifiedEvidence = [] as readonly import('./contracts').AuthorizedDocumentEvidence[];
    if (spec.requires_evidence || sourceIds.length > 0) {
      const loaded = await this.env.loadEvidence(actor.tenant_id, scope, sourceIds);
      verifiedEvidence = verifyAuthorizedEvidence(sourceIds, loaded, scope, spec.agent_id === 'A10' ? 10 : 50);
    }

    const { pins, fingerprint } = buildEvidencePins(verifiedEvidence);
    const effectiveFingerprint =
      pins.length > 0
        ? fingerprint
        : sha256Json({ scope, agent_id: spec.agent_id, payload: safePayload });

    const domainResult = await spec.handler(
      {
        actor,
        caseRecord,
        evidence: verifiedEvidence,
        scope,
        workflow_stage: caseRecord?.active_stage ?? rawInput.workflow_stage,
        request_id: rawInput.request_id,
        ocrConfig: this.env.getOcrProviderConfig(),
        gatewayConfigured: this.env.isLlmGatewayConfigured(),
      },
      safePayload,
    );

    const advisory: WorkforceAdvisoryOutput = {
      advisory_id: randomUUID(),
      job_id: null,
      agent_id: spec.agent_id,
      agent_name: spec.overview_name,
      batch_id: spec.batch_id,
      workflow_stage: caseRecord?.active_stage ?? rawInput.workflow_stage,
      scope,
      status: domainResult.status,
      summary: domainResult.summary,
      findings: domainResult.findings,
      structured_data: domainResult.structured_data,
      evidence_pins: pins,
      evidence_fingerprint: effectiveFingerprint,
      authority_citations: domainResult.authority_citations ?? [],
      required_reviewer_role: spec.required_reviewer_role,
      permitted_decisions: spec.permitted_decisions,
      output_audience: spec.output_audience,
      human_review_required: true,
      authoritative_mutation: false,
      external_submission_allowed: false,
      created_at: this.now(),
      requested_by: actor.uid,
    };

    return this.store.saveAdvisory(advisory);
  }

  async recordHumanDecision(
    token: string,
    rawRequest: WorkforceHumanDecisionRequest,
  ): Promise<WorkforceHumanDecisionRecord> {
    const scope = validateScope(rawRequest?.scope);
    if (
      !rawRequest?.request_id ||
      !rawRequest?.advisory_id ||
      !rawRequest?.expected_evidence_fingerprint ||
      typeof rawRequest.rationale !== 'string' ||
      rawRequest.rationale.trim().length < 10 ||
      rawRequest.rationale.length > 2000
    ) {
      throw new WorkforceError('WORKFORCE_INVALID_DECISION_REQUEST', 400);
    }

    const actor = await this.env.verifyActor(token);
    assertActiveActor(actor);
    assertTenantScope(actor, scope);

    const advisory = await this.store.getAdvisory(actor.tenant_id, rawRequest.advisory_id);
    if (!advisory) throw new WorkforceError('WORKFORCE_ADVISORY_NOT_FOUND', 404);
    if (
      advisory.scope.tenant_id !== scope.tenant_id ||
      advisory.scope.client_id !== scope.client_id ||
      advisory.scope.tax_case_id !== scope.tax_case_id ||
      advisory.scope.tax_year !== scope.tax_year
    ) {
      throw new WorkforceError('WORKFORCE_ADVISORY_SCOPE_MISMATCH', 403);
    }

    const spec = getWorkforceAgentSpec(advisory.agent_id);
    if (!spec.permitted_decisions.includes(rawRequest.decision)) {
      throw new WorkforceError('WORKFORCE_DECISION_NOT_PERMITTED', 400);
    }

    const killSwitches = await this.env.getKillSwitches(actor.tenant_id);
    assertKillSwitchClear(killSwitches, spec.agent_id, advisory.workflow_stage, spec.authorized_tools);

    let caseRecord = null;
    if (spec.requires_case_scope) {
      caseRecord = await this.env.loadCase(actor.tenant_id, scope);
      assertCaseScopeMatch(caseRecord, scope);
      const assigned = await this.env.isStaffAssigned(actor, caseRecord);
      if (!assigned) throw new WorkforceError('WORKFORCE_STAFF_ASSIGNMENT_REQUIRED', 403);
    }

    if (advisory.evidence_fingerprint !== rawRequest.expected_evidence_fingerprint) {
      throw new WorkforceError('STALE_EVIDENCE_CONFLICT', 409);
    }

    if (advisory.evidence_pins.length > 0) {
      const liveEvidence = await this.env.loadEvidence(
        actor.tenant_id,
        scope,
        advisory.evidence_pins.map(p => p.source_id),
      );
      const staleness = detectStaleEvidence(advisory.evidence_pins, liveEvidence, scope);
      if (staleness.stale) {
        throw new WorkforceError('STALE_EVIDENCE_CONFLICT', 409, { reason: staleness.reason });
      }
    }

    const { syntheticUsed } = assertDecisionAuthority({
      agentId: advisory.agent_id,
      actor,
      requestedBy: advisory.requested_by,
      caseRecord,
      requiredReviewerRole: advisory.required_reviewer_role,
      syntheticStaging: this.env.getSyntheticStagingConfig(),
    });

    const freshActor = await this.env.verifyActor(token);
    assertActiveActor(freshActor);
    if (freshActor.uid !== actor.uid || freshActor.tenant_id !== actor.tenant_id) {
      throw new WorkforceError('WORKFORCE_AUTHORITY_CHANGED', 403);
    }

    return this.store.recordDecisionAtomic({
      decision_id: randomUUID(),
      advisory_id: advisory.advisory_id,
      tenant_id: scope.tenant_id,
      client_id: scope.client_id,
      tax_case_id: scope.tax_case_id,
      tax_year: scope.tax_year,
      agent_id: advisory.agent_id,
      bound_evidence_fingerprint: advisory.evidence_fingerprint,
      bound_evidence_versions: advisory.evidence_pins,
      reviewer_uid: freshActor.uid,
      reviewer_role: freshActor.role,
      decision: rawRequest.decision,
      rationale: rawRequest.rationale.trim(),
      synthetic_staging_gate_used: syntheticUsed,
      authoritative_mutation: false,
      recorded_at: this.now(),
    });
  }
}
