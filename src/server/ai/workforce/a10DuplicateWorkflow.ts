import { randomUUID } from 'node:crypto';
import { inspectSelectedDocumentDuplicates } from '../documents/DocumentDuplicateAdvisory';
import type { EvidenceMetadata } from '../capabilities/contracts';
import {
  assertActiveActor,
  assertCaseScopeMatch,
  assertDecisionAuthority,
  assertKillSwitchClear,
  assertRoleAllowed,
  assertTenantScope,
  buildEvidencePins,
  detectStaleEvidence,
  sha256Json,
  validateScope,
  verifyAuthorizedEvidence,
} from './authority';
import {
  WorkforceError,
  type HumanDecisionAction,
  type WorkforceAdvisoryOutput,
  type WorkforceEnvironment,
  type WorkforceHumanDecisionRecord,
  type WorkforceHumanDecisionRequest,
  type WorkforceJobRecord,
  type WorkforceStaffRole,
  type WorkforceStore,
} from './contracts';

const A10_ALLOWED_ROLES: readonly WorkforceStaffRole[] = [
  'accountant',
  'bookkeeper',
  'reviewer',
  'senior_reviewer',
  'cpa',
  'ea',
];

const A10_PERMITTED_DECISIONS: readonly HumanDecisionAction[] = [
  'ACKNOWLEDGE',
  'ESCALATE',
  'DISMISS',
  'RETURN_FOR_CORRECTION',
];

export interface A10SubmitJobInput {
  readonly request_id: string;
  readonly idempotency_key?: string;
  readonly scope: {
    readonly tenant_id: string;
    readonly client_id: string;
    readonly tax_case_id: string;
    readonly tax_year: number;
  };
  readonly evidence_source_ids: readonly string[];
}

export interface A10CaseAdvisoryInspection {
  readonly advisory: WorkforceAdvisoryOutput;
  readonly decisions: readonly WorkforceHumanDecisionRecord[];
  readonly stale_evidence: boolean;
  readonly stale_reason: string | null;
  readonly live_decision_available: boolean;
  readonly live_decision_block_reason: string | null;
}

/**
 * End-to-End Pilot Workflow for A10 (Duplicate/Fraud Indicator Agent — narrow byte-duplicate check).
 *
 * Reuses `inspectSelectedDocumentDuplicates` from `src/server/ai/documents/DocumentDuplicateAdvisory.ts`.
 * Preserves:
 * - Tenant, client, case, tax year, staff assignment, Stage 3 workflow gate, document version,
 *   RELEASED/VERIFIED status, and CLEAN quarantine checks.
 * - Metadata-only job payloads (never stores raw taxpayer document bytes or secrets).
 * - Idempotency on repeated submissions.
 * - Live authority recheck both at worker start and at human decision recording.
 * - Atomic concurrent decision conflict protection and stale-evidence rejection.
 * - Live production decision action stays unavailable until owner approves A10's pending reviewer role;
 *   explicit synthetic staging permission enables full end-to-end staging/test validation.
 * - Never auto-declares fraud, deletes documents, or alters tax records.
 */
export class A10DuplicateWorkflowService {
  constructor(
    private readonly env: WorkforceEnvironment,
    private readonly store: WorkforceStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async submitDuplicateCheckJob(
    token: string,
    rawInput: A10SubmitJobInput,
  ): Promise<{ job: WorkforceJobRecord; created: boolean }> {
    const scope = validateScope(rawInput?.scope);
    if (!rawInput?.request_id || typeof rawInput.request_id !== 'string' || rawInput.request_id.length > 128) {
      throw new WorkforceError('WORKFORCE_INVALID_REQUEST_ID', 400);
    }

    const actor = await this.env.verifyActor(token);
    assertActiveActor(actor);
    assertTenantScope(actor, scope);
    assertRoleAllowed(actor, A10_ALLOWED_ROLES);

    const killSwitches = await this.env.getKillSwitches(actor.tenant_id);
    assertKillSwitchClear(killSwitches, 'A10', 3, ['document.read']);

    const caseRecord = await this.env.loadCase(actor.tenant_id, scope);
    assertCaseScopeMatch(caseRecord, scope, [3]);

    const assigned = await this.env.isStaffAssigned(actor, caseRecord);
    if (!assigned) {
      throw new WorkforceError('WORKFORCE_STAFF_ASSIGNMENT_REQUIRED', 403);
    }

    const loadedEvidence = await this.env.loadEvidence(actor.tenant_id, scope, rawInput.evidence_source_ids);
    const verifiedEvidence = verifyAuthorizedEvidence(rawInput.evidence_source_ids, loadedEvidence, scope, 10);
    const { pins, fingerprint } = buildEvidencePins(verifiedEvidence);

    const idempotencyKey =
      rawInput.idempotency_key && rawInput.idempotency_key.trim().length > 0
        ? rawInput.idempotency_key.trim()
        : sha256Json({
            agent_id: 'A10',
            scope,
            evidence_fingerprint: fingerprint,
          });

    return this.store.createOrGetJob({
      job_id: randomUUID(),
      idempotency_key: idempotencyKey,
      tenant_id: scope.tenant_id,
      client_id: scope.client_id,
      tax_case_id: scope.tax_case_id,
      tax_year: scope.tax_year,
      case_record_id: caseRecord.case_record_id,
      agent_id: 'A10',
      workflow_stage: 3,
      requested_by: actor.uid,
      evidence_source_ids: pins.map(p => p.source_id),
      metadata_payload: {
        purpose: 'DOCUMENT_DUPLICATE_CHECK',
        evidence_count: pins.length,
        evidence_fingerprint: fingerprint,
      },
      status: 'QUEUED',
      advisory_id: null,
      error_code: null,
    });
  }

  async processDuplicateCheckJob(
    token: string,
    tenantId: string,
    jobId: string,
  ): Promise<{ job: WorkforceJobRecord; advisory: WorkforceAdvisoryOutput }> {
    const actor = await this.env.verifyActor(token);
    assertActiveActor(actor);
    if (actor.tenant_id !== tenantId) {
      throw new WorkforceError('WORKFORCE_CROSS_TENANT_DENIED', 403);
    }

    const job = await this.store.getJob(actor.tenant_id, jobId);
    if (!job || job.agent_id !== 'A10') {
      throw new WorkforceError('WORKFORCE_JOB_NOT_FOUND', 404);
    }

    const scope = {
      tenant_id: job.tenant_id,
      client_id: job.client_id,
      tax_case_id: job.tax_case_id,
      tax_year: job.tax_year,
    };

    assertRoleAllowed(actor, A10_ALLOWED_ROLES);
    const killSwitches = await this.env.getKillSwitches(actor.tenant_id);
    assertKillSwitchClear(killSwitches, 'A10', 3, ['document.read']);

    const caseRecord = await this.env.loadCase(actor.tenant_id, scope);
    assertCaseScopeMatch(caseRecord, scope, [3]);

    const assigned = await this.env.isStaffAssigned(actor, caseRecord);
    if (!assigned) {
      throw new WorkforceError('WORKFORCE_STAFF_ASSIGNMENT_REQUIRED', 403);
    }

    // Replays require the same current authority as the original processing request.
    if (job.status === 'COMPLETED' && job.advisory_id) {
      const existingAdvisory = await this.store.getAdvisory(actor.tenant_id, job.advisory_id);
      if (existingAdvisory) return { job, advisory: existingAdvisory };
      throw new WorkforceError('WORKFORCE_ADVISORY_NOT_FOUND', 404);
    }

    try {
      await this.store.updateJobStatus(actor.tenant_id, job.job_id, 'PROCESSING');

      // Re-read live evidence metadata and re-verify version, status, and quarantine.
      const loadedEvidence = await this.env.loadEvidence(actor.tenant_id, scope, job.evidence_source_ids);
      const verifiedEvidence = verifyAuthorizedEvidence(job.evidence_source_ids, loadedEvidence, scope, 10);
      const { pins, fingerprint } = buildEvidencePins(verifiedEvidence);

      const expectedFingerprint =
        typeof job.metadata_payload.evidence_fingerprint === 'string'
          ? job.metadata_payload.evidence_fingerprint
          : null;
      if (expectedFingerprint && expectedFingerprint !== fingerprint) {
        await this.store.updateJobStatus(actor.tenant_id, job.job_id, 'STALE', {
          error_code: 'STALE_EVIDENCE_CONFLICT',
        });
        throw new WorkforceError('STALE_EVIDENCE_CONFLICT', 409);
      }

      // Invoke canonical deterministic A10 domain handler (byte-hash duplicate check only).
      const metadataRows: EvidenceMetadata[] = verifiedEvidence.map(e => ({
        source_id: e.source_id,
        document_record_id: e.document_record_id,
        document_version: e.document_version,
        source_hash: e.source_hash,
        document_status: e.document_status as 'RELEASED' | 'VERIFIED',
        quarantine_status: 'CLEAN',
      }));
      const report = inspectSelectedDocumentDuplicates(metadataRows);

      const findings = report.duplicate_groups.length > 0
        ? report.duplicate_groups.map(group => ({
            code: 'EXACT_BYTE_DUPLICATE_DETECTED',
            severity: 'WARNING' as const,
            summary: `Exact SHA-256 byte match across ${group.document_record_ids.length} document records (${group.source_hash.slice(0, 12)}...). Equal hashes indicate equal recorded bytes only, never fraud.`,
            evidence_source_ids: pins
              .filter(p => p.source_hash === group.source_hash)
              .map(p => p.source_id),
            recommended_human_action:
              'Inspect duplicate uploads in Stage Three and record an independent staff disposition without deleting source audit history.',
          }))
        : [
            {
              code: 'NO_EXACT_BYTE_DUPLICATE',
              severity: 'INFO' as const,
              summary: `No exact SHA-256 byte duplicates detected across ${pins.length} selected authorized document(s).`,
              evidence_source_ids: pins.map(p => p.source_id),
              recommended_human_action: 'Review and acknowledge Stage Three duplicate check advisory.',
            },
          ];

      const advisory: WorkforceAdvisoryOutput = {
        advisory_id: randomUUID(),
        job_id: job.job_id,
        agent_id: 'A10',
        agent_name: 'Duplicate / Fraud Indicator Agent (Narrow Byte-Duplicate Check)',
        batch_id: 'BATCH_1_FOUNDATION_COLLECTION',
        workflow_stage: 3,
        scope,
        status: 'ADVISORY',
        summary:
          report.duplicate_groups.length > 0
            ? `Advisory: ${report.duplicate_groups.length} exact byte-duplicate group(s) found among ${pins.length} selected authorized document(s). Fraud is not assessed; human review required.`
            : `Advisory: 0 exact byte-duplicate groups found among ${pins.length} selected authorized document(s). Fraud is not assessed; human review required.`,
        findings,
        structured_data: {
          coverage: report.coverage,
          fraud_assessed: false,
          authoritative_mutation: false,
          document_deletion_performed: false,
          tax_record_altered: false,
          duplicate_group_count: report.duplicate_groups.length,
          duplicate_groups: report.duplicate_groups.map(g => ({
            source_hash: g.source_hash,
            document_record_ids: [...g.document_record_ids],
          })),
        },
        evidence_pins: pins,
        evidence_fingerprint: fingerprint,
        authority_citations: ['TaxGuard OV-01 (Narrow Byte-Duplicate Scope)', 'TaxGuard Stage 3 Document Integrity Gate'],
        required_reviewer_role: 'PENDING_OWNER_APPROVAL',
        permitted_decisions: A10_PERMITTED_DECISIONS,
        output_audience: 'STAFF_REVIEWER',
        human_review_required: true,
        authoritative_mutation: false,
        external_submission_allowed: false,
        created_at: this.now(),
        requested_by: job.requested_by,
      };

      await this.store.saveAdvisory(advisory);
      const completedJob = await this.store.updateJobStatus(actor.tenant_id, job.job_id, 'COMPLETED', {
        advisory_id: advisory.advisory_id,
        error_code: null,
      });

      return { job: completedJob, advisory };
    } catch (error) {
      const code = error instanceof WorkforceError ? error.code : 'WORKFORCE_PROCESSING_FAILED';
      if (job.status !== 'COMPLETED' && code !== 'STALE_EVIDENCE_CONFLICT') {
        await this.store
          .updateJobStatus(actor.tenant_id, job.job_id, error instanceof WorkforceError && error.status === 403 ? 'DENIED' : 'FAILED', {
            error_code: code,
          })
          .catch(() => undefined);
      }
      throw error;
    }
  }

  async getCaseDuplicateAdvisories(
    token: string,
    rawScope: { tenant_id: string; client_id: string; tax_case_id: string; tax_year: number },
  ): Promise<readonly A10CaseAdvisoryInspection[]> {
    const scope = validateScope(rawScope);
    const actor = await this.env.verifyActor(token);
    assertActiveActor(actor);
    assertTenantScope(actor, scope);
    assertRoleAllowed(actor, A10_ALLOWED_ROLES);

    const caseRecord = await this.env.loadCase(actor.tenant_id, scope);
    assertCaseScopeMatch(caseRecord, scope);
    const assigned = await this.env.isStaffAssigned(actor, caseRecord);
    if (!assigned) {
      throw new WorkforceError('WORKFORCE_STAFF_ASSIGNMENT_REQUIRED', 403);
    }

    const advisories = await this.store.listCaseAdvisories(actor.tenant_id, scope.tax_case_id, 'A10');
    const staging = this.env.getSyntheticStagingConfig();
    const results: A10CaseAdvisoryInspection[] = [];

    for (const advisory of advisories) {
      if (
        advisory.agent_id !== 'A10' ||
        advisory.scope.tenant_id !== scope.tenant_id ||
        advisory.scope.client_id !== scope.client_id ||
        advisory.scope.tax_case_id !== scope.tax_case_id ||
        advisory.scope.tax_year !== scope.tax_year
      ) {
        continue;
      }
      const sourceIds = advisory.evidence_pins.map(p => p.source_id);
      const liveEvidence = sourceIds.length
        ? await this.env.loadEvidence(actor.tenant_id, scope, sourceIds)
        : [];
      const staleness = detectStaleEvidence(advisory.evidence_pins, liveEvidence, scope);
      const decisions = await this.store.listAdvisoryDecisions(actor.tenant_id, advisory.advisory_id);

      let decisionBlockReason: string | null = null;
      try {
        assertCaseScopeMatch(caseRecord, scope, [3]);
        assertDecisionAuthority({
          agentId: 'A10', actor, requestedBy: advisory.requested_by, caseRecord,
          requiredReviewerRole: advisory.required_reviewer_role, syntheticStaging: staging,
        });
      } catch (error) {
        if (!(error instanceof WorkforceError)) throw error;
        decisionBlockReason = error.code;
      }

      if (decisionBlockReason === null) {
        if (decisions.length > 0) decisionBlockReason = 'CONCURRENT_DECISION_CONFLICT';
        else if (staleness.stale) decisionBlockReason = 'STALE_EVIDENCE_CONFLICT';
      }

      results.push({
        advisory,
        decisions,
        stale_evidence: staleness.stale,
        stale_reason: staleness.reason,
        live_decision_available: decisionBlockReason === null,
        live_decision_block_reason: decisionBlockReason,
      });
    }

    return results;
  }

  async recordDuplicateDecision(
    token: string,
    rawRequest: WorkforceHumanDecisionRequest,
  ): Promise<WorkforceHumanDecisionRecord> {
    const scope = validateScope(rawRequest?.scope);
    if (
      !rawRequest?.request_id ||
      !rawRequest?.advisory_id ||
      !rawRequest?.expected_evidence_fingerprint ||
      !A10_PERMITTED_DECISIONS.includes(rawRequest.decision) ||
      typeof rawRequest.rationale !== 'string' ||
      rawRequest.rationale.trim().length < 10 ||
      rawRequest.rationale.length > 2000
    ) {
      throw new WorkforceError('WORKFORCE_INVALID_DECISION_REQUEST', 400);
    }

    const actor = await this.env.verifyActor(token);
    assertActiveActor(actor);
    assertTenantScope(actor, scope);

    const killSwitches = await this.env.getKillSwitches(actor.tenant_id);
    assertKillSwitchClear(killSwitches, 'A10', 3, ['document.read']);

    const caseRecord = await this.env.loadCase(actor.tenant_id, scope);
    assertCaseScopeMatch(caseRecord, scope, [3]);

    const assigned = await this.env.isStaffAssigned(actor, caseRecord);
    if (!assigned) {
      throw new WorkforceError('WORKFORCE_STAFF_ASSIGNMENT_REQUIRED', 403);
    }

    const advisory = await this.store.getAdvisory(actor.tenant_id, rawRequest.advisory_id);
    if (!advisory || advisory.agent_id !== 'A10') {
      throw new WorkforceError('WORKFORCE_ADVISORY_NOT_FOUND', 404);
    }
    if (
      advisory.scope.tenant_id !== scope.tenant_id ||
      advisory.scope.client_id !== scope.client_id ||
      advisory.scope.tax_case_id !== scope.tax_case_id ||
      advisory.scope.tax_year !== scope.tax_year
    ) {
      throw new WorkforceError('WORKFORCE_ADVISORY_SCOPE_MISMATCH', 403);
    }

    if (advisory.evidence_fingerprint !== rawRequest.expected_evidence_fingerprint) {
      throw new WorkforceError('STALE_EVIDENCE_CONFLICT', 409);
    }

    // Re-check live evidence version, status, and quarantine before recording decision.
    const liveEvidence = await this.env.loadEvidence(
      actor.tenant_id,
      scope,
      advisory.evidence_pins.map(p => p.source_id),
    );
    const staleness = detectStaleEvidence(advisory.evidence_pins, liveEvidence, scope);
    if (staleness.stale) {
      throw new WorkforceError('STALE_EVIDENCE_CONFLICT', 409, {
        reason: staleness.reason,
      });
    }

    // Final live session recheck right before atomic commit (revocation guard).
    const freshActor = await this.env.verifyActor(token);
    assertActiveActor(freshActor);
    if (freshActor.uid !== actor.uid || freshActor.tenant_id !== actor.tenant_id) {
      throw new WorkforceError('WORKFORCE_AUTHORITY_CHANGED', 403);
    }

    if (!(await this.env.isStaffAssigned(freshActor, caseRecord))) {
      throw new WorkforceError('WORKFORCE_STAFF_ASSIGNMENT_REQUIRED', 403);
    }
    // Enforce pending owner-approval live gate + maker-checker + role authority.
    const { syntheticUsed } = assertDecisionAuthority({
      agentId: 'A10',
      actor: freshActor,
      requestedBy: advisory.requested_by,
      caseRecord,
      requiredReviewerRole: advisory.required_reviewer_role,
      syntheticStaging: this.env.getSyntheticStagingConfig(),
    });

    const record: WorkforceHumanDecisionRecord = {
      decision_id: randomUUID(),
      advisory_id: advisory.advisory_id,
      tenant_id: scope.tenant_id,
      client_id: scope.client_id,
      tax_case_id: scope.tax_case_id,
      tax_year: scope.tax_year,
      agent_id: 'A10',
      bound_evidence_fingerprint: advisory.evidence_fingerprint,
      bound_evidence_versions: advisory.evidence_pins,
      reviewer_uid: freshActor.uid,
      reviewer_role: freshActor.role,
      decision: rawRequest.decision,
      rationale: rawRequest.rationale.trim(),
      synthetic_staging_gate_used: syntheticUsed,
      authoritative_mutation: false,
      recorded_at: this.now(),
    };

    return this.store.recordDecisionAtomic(record);
  }
}
