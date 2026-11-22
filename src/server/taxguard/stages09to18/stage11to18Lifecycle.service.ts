/**
 * BLOCKS TG-11 through TG-18 — Enterprise Post-Approval Tax Lifecycle Engine
 *
 * Stage 11: Sign (Document eligibility, SHA-256 hashing, HMAC webhook replay guard, fail-closed provider)
 * Stage 12: File (11-point readiness check, 11-state lifecycle, duplicate & auto-retry prevention, fail-closed transmitter)
 * Stage 13: Government Feedback (Signed acknowledgment verification, notice registry + AI shield, disabled transcripts)
 * Stage 14: Resolve (Controlled lifecycle, gov confirmation gate, linked amendments preserving original return immutability)
 * Stage 15: Monitor (Jurisdiction/holiday/relief calendar, exact-decimal projections, idempotent notification outbox)
 * Stage 16: Archive (SHA-256 package manifest, configurable retention policies, legal hold deletion block)
 * Stage 17: Renew (Annual renewal review, conflict/risk check, agreement/consent renewal, fail-closed invite)
 * Stage 18: Repeat (Reviewed carryforwards, prior-year intelligence flags, Stage 01 restart without mutating historical cases)
 */

import { randomUUID } from 'crypto';
import { ExactDecimal } from './exactDecimal';
import {
  BoundedAiAdvisoryOutput,
  BoundedAiAdvisoryShield,
  FilingTransmitterAdapter,
  NotificationDeliveryAdapter,
  sha256Hex,
  SignatureProviderAdapter,
  verifyHmacSha256,
} from './providerBoundary';
import { Stage09PrepareTaxesService } from './stage09PrepareTaxes.service';
import { Stage10ApproveService } from './stage10Approve.service';
import {
  ActorSessionContext,
  AnnualCycleGenerationRecord,
  ArchivePackageRecord,
  CarryforwardCategory,
  CarryforwardItemRecord,
  ComplianceObligationRecord,
  EngagementRenewalRecord,
  FilingAcknowledgmentRecord,
  FilingReadinessCheck,
  FilingReadinessReport,
  FilingTransmissionRecord,
  GovernmentNoticeRecord,
  LegalHoldRecord,
  NotificationOutboxRecord,
  ResolutionCaseRecord,
  ResolutionLifecycleState,
  RetentionPolicyRecord,
  ReturnAmendmentRecord,
  RiskClassification,
  ScopedCaseContext,
  SignatureDocumentType,
  SignatureEnvelopeRecord,
  TaxGuardStageError,
  TranscriptRequestRecord,
} from './types';

function scopeKey(scope: ScopedCaseContext): string {
  return `${scope.tenantId}::${scope.clientId}::${scope.engagementId}::${scope.caseId}::${scope.taxYear}`;
}

/** Documents permitted for electronic signature under IRS/firm policy (representation POA requires wet/IRS-specific flow). */
const ESIGN_ELIGIBILITY_RULES: Record<SignatureDocumentType, { eligible: boolean; reason: string | null }> = {
  ENGAGEMENT_AGREEMENT: { eligible: true, reason: null },
  CONSENT_7216: { eligible: true, reason: null },
  FORM_8879: { eligible: true, reason: null },
  FORM_8879_PE: { eligible: true, reason: null },
  FORM_8879_CORP: { eligible: true, reason: null },
  FORM_8879_S: { eligible: true, reason: null },
  FORM_8879_F: { eligible: true, reason: null },
  FORM_8878: { eligible: true, reason: null },
  ENTITY_AUTHORIZATION: { eligible: true, reason: null },
  REPRESENTATION_AUTHORIZATION: {
    eligible: false,
    reason: 'Form 2848 / 8821 representation authorization requires IRS-specific identity proofing or wet signature upload.',
  },
};

const VALID_RESOLUTION_TRANSITIONS: Record<ResolutionLifecycleState, ResolutionLifecycleState[]> = {
  OPEN: ['TRIAGE', 'ESCALATED', 'CANCELLED'],
  TRIAGE: ['INVESTIGATION', 'ESCALATED', 'CANCELLED'],
  INVESTIGATION: ['EVIDENCE_COLLECTION', 'PROPOSED_ACTION', 'ESCALATED'],
  EVIDENCE_COLLECTION: ['PROPOSED_ACTION', 'INVESTIGATION', 'ESCALATED'],
  PROPOSED_ACTION: ['PROFESSIONAL_REVIEW', 'EVIDENCE_COLLECTION', 'ESCALATED'],
  PROFESSIONAL_REVIEW: ['AUTHORIZED_RESPONSE', 'PROPOSED_ACTION', 'ESCALATED'],
  AUTHORIZED_RESPONSE: ['RESPONSE_PENDING', 'ESCALATED'],
  RESPONSE_PENDING: ['RESOLVED', 'ESCALATED', 'REOPENED'],
  RESOLVED: ['REOPENED'],
  ESCALATED: ['INVESTIGATION', 'PROFESSIONAL_REVIEW', 'CANCELLED'],
  REOPENED: ['TRIAGE', 'INVESTIGATION'],
  CANCELLED: ['REOPENED'],
};

export class Stage11To18LifecycleService {
  // Stage 11
  private readonly envelopes = new Map<string, SignatureEnvelopeRecord[]>();
  private readonly webhookNonces = new Set<string>();
  // Stage 12
  private readonly filings = new Map<string, FilingTransmissionRecord[]>();
  private readonly filingIdempotencyKeys = new Set<string>();
  // Stage 13
  private readonly acknowledgments = new Map<string, FilingAcknowledgmentRecord[]>();
  private readonly externalAckIds = new Set<string>();
  private readonly notices = new Map<string, GovernmentNoticeRecord[]>();
  private readonly transcriptRequests = new Map<string, TranscriptRequestRecord[]>();
  // Stage 14
  private readonly resolutions = new Map<string, ResolutionCaseRecord[]>();
  private readonly amendments = new Map<string, ReturnAmendmentRecord[]>();
  // Stage 15
  private readonly obligations = new Map<string, ComplianceObligationRecord[]>();
  private readonly outbox = new Map<string, NotificationOutboxRecord[]>();
  private readonly notificationDedupeKeys = new Set<string>();
  // Stage 16
  private readonly retentionPolicies = new Map<string, RetentionPolicyRecord>();
  private readonly archives = new Map<string, ArchivePackageRecord[]>();
  private readonly legalHolds = new Map<string, LegalHoldRecord[]>();
  // Stage 17
  private readonly renewals = new Map<string, EngagementRenewalRecord[]>();
  // Stage 18
  private readonly carryforwards = new Map<string, CarryforwardItemRecord[]>();
  private readonly annualGenerations = new Map<string, AnnualCycleGenerationRecord[]>();
  private readonly finalizedHistoricalCases = new Set<string>();

  constructor(
    private readonly stage09: Stage09PrepareTaxesService,
    private readonly stage10: Stage10ApproveService,
    private signatureAdapter: SignatureProviderAdapter,
    private filingAdapter: FilingTransmitterAdapter,
    private notificationAdapter: NotificationDeliveryAdapter
  ) {}

  setAdapters(adapters: {
    signature?: SignatureProviderAdapter;
    filing?: FilingTransmitterAdapter;
    notifications?: NotificationDeliveryAdapter;
  }): void {
    if (adapters.signature) this.signatureAdapter = adapters.signature;
    if (adapters.filing) this.filingAdapter = adapters.filing;
    if (adapters.notifications) this.notificationAdapter = adapters.notifications;
  }

  getAdapters() {
    return {
      signature: this.signatureAdapter,
      filing: this.filingAdapter,
      notifications: this.notificationAdapter,
    };
  }

  // ==========================================================================
  // STAGE 11 — SIGN
  // ==========================================================================

  createSignatureEnvelope(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      returnVersionId: string;
      documentType: SignatureDocumentType;
      signerEmail: string;
      signerName: string;
      expiresInDays?: number;
      expiresAtOverride?: string;
    }
  ): SignatureEnvelopeRecord {
    const ret = this.stage09.getReturnVersionOrThrow(scope, input.returnVersionId);
    const activeApproval = this.stage10.getActiveApprovalForReturn(scope, ret.returnVersionId);
    if (!activeApproval) {
      throw new TaxGuardStageError(
        422,
        'ACTIVE_STAGE10_APPROVAL_REQUIRED',
        'Cannot create Stage 11 signature package: no current, non-invalidated Stage 10 approval matches this return version hash.'
      );
    }

    const eligibility = ESIGN_ELIGIBILITY_RULES[input.documentType];
    if (!eligibility) {
      throw new TaxGuardStageError(400, 'UNSUPPORTED_SIGNATURE_DOCUMENT', `Unknown signature document type ${input.documentType}.`);
    }

    const expiresAt =
      input.expiresAtOverride ||
      new Date(Date.now() + (input.expiresInDays ?? 14) * 24 * 60 * 60 * 1000).toISOString();

    const documentSha256 = sha256Hex({
      scope,
      returnVersionId: ret.returnVersionId,
      returnContentSha256: ret.contentSha256,
      approvalId: activeApproval.approvalId,
      documentType: input.documentType,
      signerEmail: input.signerEmail.toLowerCase().trim(),
    });

    const envelope: SignatureEnvelopeRecord = {
      envelopeId: `sig_${randomUUID()}`,
      scope: { ...scope },
      returnVersionId: ret.returnVersionId,
      returnContentSha256: ret.contentSha256,
      approvalId: activeApproval.approvalId,
      documentType: input.documentType,
      documentSha256,
      eSignatureEligible: eligibility.eligible,
      ineligibilityReason: eligibility.reason,
      signerEmail: input.signerEmail.toLowerCase().trim(),
      signerName: input.signerName.trim(),
      providerName: this.signatureAdapter.providerName,
      providerEnvelopeId: null,
      status: eligibility.eligible ? 'READY_FOR_DISPATCH' : 'DRAFT',
      expiresAt,
      signedAt: null,
      revokedAt: null,
      remindersSent: 0,
      evidenceHash: null,
      createdBy: actor.userId,
      createdAt: new Date().toISOString(),
    };

    const key = scopeKey(scope);
    const list = this.envelopes.get(key) || [];
    list.push(envelope);
    this.envelopes.set(key, list);
    return envelope;
  }

  dispatchSignatureEnvelope(scope: ScopedCaseContext, envelopeId: string): SignatureEnvelopeRecord {
    const env = this.getEnvelopeOrThrow(scope, envelopeId);
    if (!env.eSignatureEligible) {
      throw new TaxGuardStageError(
        422,
        'DOCUMENT_NOT_ESIGN_ELIGIBLE',
        env.ineligibilityReason || 'This document type is not eligible for electronic signature.'
      );
    }
    // Re-verify Stage 10 approval is still current and return has not been materially modified
    const activeApproval = this.stage10.getActiveApprovalForReturn(scope, env.returnVersionId);
    if (!activeApproval || activeApproval.returnContentSha256 !== env.returnContentSha256) {
      env.status = 'REVOKED';
      env.revokedAt = new Date().toISOString();
      throw new TaxGuardStageError(
        409,
        'APPROVAL_INVALIDATED_BY_MATERIAL_CHANGE',
        'Signature dispatch blocked: underlying return version was modified or approval was invalidated.'
      );
    }

    try {
      const dispatch = this.signatureAdapter.dispatchEnvelope({
        envelopeId: env.envelopeId,
        documentSha256: env.documentSha256,
        signerEmail: env.signerEmail,
        signerName: env.signerName,
        expiresAt: env.expiresAt,
      });
      env.providerName = dispatch.providerName;
      env.providerEnvelopeId = dispatch.providerEnvelopeId;
      env.status = 'SENT';
      return env;
    } catch (err) {
      if (err instanceof TaxGuardStageError && err.code === 'SIGNATURE_PROVIDER_NOT_CONFIGURED') {
        env.status = 'BLOCKED_PROVIDER_UNCONFIGURED';
      }
      throw err;
    }
  }

  processSignatureWebhook(params: {
    scope: ScopedCaseContext;
    envelopeId: string;
    nonceId: string;
    eventType: 'SIGNED' | 'DECLINED' | 'EXPIRED' | 'VOIDED';
    rawPayload: string;
    signatureHeader: string;
    webhookSecret: string;
  }): SignatureEnvelopeRecord {
    if (!verifyHmacSha256(params.rawPayload, params.signatureHeader, params.webhookSecret)) {
      throw new TaxGuardStageError(
        401,
        'INVALID_WEBHOOK_SIGNATURE',
        'Signature webhook rejected: HMAC-SHA256 verification failed.'
      );
    }

    const nonceKey = `${params.scope.tenantId}::${params.nonceId}`;
    if (this.webhookNonces.has(nonceKey)) {
      throw new TaxGuardStageError(
        409,
        'WEBHOOK_REPLAY_DETECTED',
        `Signature webhook rejected: nonce "${params.nonceId}" was already processed.`
      );
    }

    const env = this.getEnvelopeOrThrow(params.scope, params.envelopeId);
    if (Date.now() > Date.parse(env.expiresAt) && params.eventType === 'SIGNED') {
      env.status = 'EXPIRED';
      throw new TaxGuardStageError(422, 'SIGNATURE_ENVELOPE_EXPIRED', 'Cannot record signature: envelope has expired.');
    }

    this.webhookNonces.add(nonceKey);

    if (params.eventType === 'SIGNED') {
      env.status = 'SIGNED';
      env.signedAt = new Date().toISOString();
      env.evidenceHash = sha256Hex({
        envelopeId: env.envelopeId,
        documentSha256: env.documentSha256,
        nonceId: params.nonceId,
        signedAt: env.signedAt,
      });
    } else if (params.eventType === 'DECLINED') {
      env.status = 'DECLINED';
    } else if (params.eventType === 'EXPIRED') {
      env.status = 'EXPIRED';
    } else if (params.eventType === 'VOIDED') {
      env.status = 'REVOKED';
      env.revokedAt = new Date().toISOString();
    }

    return env;
  }

  revokeSignatureEnvelope(scope: ScopedCaseContext, envelopeId: string): SignatureEnvelopeRecord {
    const env = this.getEnvelopeOrThrow(scope, envelopeId);
    env.status = 'REVOKED';
    env.revokedAt = new Date().toISOString();
    return env;
  }

  revokeEnvelopesForReturn(scope: ScopedCaseContext, returnVersionId: string): number {
    const list = this.envelopes.get(scopeKey(scope)) || [];
    let count = 0;
    const now = new Date().toISOString();
    for (const env of list) {
      if (env.returnVersionId === returnVersionId && !['REVOKED', 'EXPIRED'].includes(env.status)) {
        env.status = 'REVOKED';
        env.revokedAt = now;
        count += 1;
      }
    }
    return count;
  }

  listSignatureEnvelopes(scope: ScopedCaseContext): SignatureEnvelopeRecord[] {
    return [...(this.envelopes.get(scopeKey(scope)) || [])];
  }

  private getEnvelopeOrThrow(scope: ScopedCaseContext, envelopeId: string): SignatureEnvelopeRecord {
    const list = this.envelopes.get(scopeKey(scope)) || [];
    const found = list.find(e => e.envelopeId === envelopeId);
    if (!found) {
      throw new TaxGuardStageError(404, 'SIGNATURE_ENVELOPE_NOT_FOUND', `Signature envelope ${envelopeId} not found.`);
    }
    return found;
  }

  // ==========================================================================
  // STAGE 12 — FILE
  // ==========================================================================

  evaluateFilingReadiness(
    scope: ScopedCaseContext,
    input: {
      returnVersionId: string;
      signatureEnvelopeId: string;
      jurisdictionCode: string;
      schemaVersion: string;
      taxpayerIdPresent: boolean;
      preparerPtinPresent: boolean;
    }
  ): FilingReadinessReport {
    const ret = this.stage09.getReturnVersionOrThrow(scope, input.returnVersionId);
    const activeApproval = this.stage10.getActiveApprovalForReturn(scope, ret.returnVersionId);
    const env = (this.envelopes.get(scopeKey(scope)) || []).find(e => e.envelopeId === input.signatureEnvelopeId) || null;
    const now = Date.now();
    const sigValid = Boolean(
      env &&
      env.returnVersionId === ret.returnVersionId &&
      env.returnContentSha256 === ret.contentSha256 &&
      env.status === 'SIGNED' &&
      now <= Date.parse(env.expiresAt)
    );

    const existingActiveFiling = (this.filings.get(scopeKey(scope)) || []).find(
      f =>
        f.jurisdictionCode === input.jurisdictionCode.toUpperCase() &&
        !['REJECTED', 'CORRECTION_REQUIRED', 'CANCELLED'].includes(f.lifecycleState)
    );

    const providerOperational =
      this.filingAdapter.commissioningStatus === 'PRODUCTION_VERIFIED' ||
      this.filingAdapter.commissioningStatus === 'SANDBOX_VERIFIED';

    const checks: FilingReadinessCheck[] = [
      {
        checkCode: 'APPROVED_RETURN_VERSION',
        label: 'Approved return version matches content hash',
        passed: Boolean(activeApproval),
        blockingReason: activeApproval ? null : 'No valid non-invalidated Stage 10 approval exists for this return version.',
      },
      {
        checkCode: 'VALID_UNEXPIRED_SIGNATURE',
        label: 'Valid, unexpired taxpayer signature authorization (Form 8879/8878)',
        passed: sigValid,
        blockingReason: !env
          ? 'Signature authorization envelope is missing.'
          : env.status !== 'SIGNED'
            ? `Signature envelope status is ${env.status} (SIGNED required).`
            : now > Date.parse(env.expiresAt)
              ? 'Signature authorization envelope is expired.'
              : 'Signature envelope hash does not match current return version.',
      },
      {
        checkCode: 'TAXPAYER_IDENTIFIERS',
        label: 'Taxpayer identifiers verified',
        passed: input.taxpayerIdPresent,
        blockingReason: input.taxpayerIdPresent ? null : 'Required taxpayer TIN/SSN/EIN is missing.',
      },
      {
        checkCode: 'FORM_COMPLETENESS',
        label: 'Form fields & evidence lineage complete',
        passed: ret.formFields.length > 0 && ret.lineage.every(l => l.evidenceStatus === 'VERIFIED'),
        blockingReason: ret.formFields.length > 0 ? null : 'Return version has incomplete form fields or lineage.',
      },
      {
        checkCode: 'JURISDICTION_ELIGIBILITY',
        label: 'Jurisdiction code matches return version',
        passed: ret.jurisdictionCode === input.jurisdictionCode.toUpperCase(),
        blockingReason:
          ret.jurisdictionCode === input.jurisdictionCode.toUpperCase()
            ? null
            : `Jurisdiction mismatch (${input.jurisdictionCode} vs ${ret.jurisdictionCode}).`,
      },
      {
        checkCode: 'SCHEMA_VERSION',
        label: 'IRS / State e-file schema version specified',
        passed: Boolean(input.schemaVersion && input.schemaVersion.trim().length >= 4),
        blockingReason: input.schemaVersion ? null : 'Missing e-file schema version.',
      },
      {
        checkCode: 'FILING_YEAR',
        label: 'Tax year within supported e-file window',
        passed: scope.taxYear >= 2022 && scope.taxYear <= 2026,
        blockingReason: scope.taxYear >= 2022 && scope.taxYear <= 2026 ? null : `Tax year ${scope.taxYear} outside supported window.`,
      },
      {
        checkCode: 'PREPARER_PTIN_EFIN',
        label: 'Preparer PTIN & EFIN transmitter configuration',
        passed: input.preparerPtinPresent && this.filingAdapter.efinConfigured,
        blockingReason: !input.preparerPtinPresent
          ? 'Preparer PTIN configuration missing.'
          : this.filingAdapter.efinConfigured
            ? null
            : 'Firm EFIN transmitter is not configured.',
      },
      {
        checkCode: 'FILING_PROVIDER_AVAILABLE',
        label: 'Commissioned e-file transmitter provider available',
        passed: providerOperational,
        blockingReason: providerOperational ? null : 'FILING_PROVIDER_NOT_COMMISSIONED',
      },
      {
        checkCode: 'NO_DUPLICATE_FILING',
        label: 'No duplicate active filing for this case/year/jurisdiction',
        passed: !existingActiveFiling,
        blockingReason: existingActiveFiling
          ? `Active filing ${existingActiveFiling.filingId} already exists (${existingActiveFiling.lifecycleState}).`
          : null,
      },
    ];

    return {
      ready: checks.every(c => c.passed),
      checks,
      evaluatedAt: new Date().toISOString(),
    };
  }

  authorizeAndTransmitFiling(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      returnVersionId: string;
      signatureEnvelopeId: string;
      jurisdiction: 'FEDERAL' | 'STATE';
      jurisdictionCode: string;
      schemaVersion: string;
      idempotencyKey: string;
      taxpayerIdPresent: boolean;
      preparerPtinPresent: boolean;
    }
  ): FilingTransmissionRecord {
    if (!['reviewer', 'senior_reviewer', 'approver'].includes(actor.role)) {
      throw new TaxGuardStageError(403, 'FILING_AUTHORIZATION_ROLE_REQUIRED', 'Authorized reviewer/approver required to authorize transmission.');
    }
    if (actor.mfaAssuranceLevel !== 'aal2') {
      throw new TaxGuardStageError(403, 'STAFF_MFA_REQUIRED', 'MFA AAL2 is required for filing authorization.');
    }

    const dedupeKey = `${scope.tenantId}::${input.idempotencyKey}`;
    if (this.filingIdempotencyKeys.has(dedupeKey)) {
      throw new TaxGuardStageError(409, 'DUPLICATE_FILING_BLOCKED', `Duplicate filing blocked for idempotency key "${input.idempotencyKey}".`);
    }

    const readiness = this.evaluateFilingReadiness(scope, input);
    const dupCheck = readiness.checks.find(c => c.checkCode === 'NO_DUPLICATE_FILING');
    if (dupCheck && !dupCheck.passed) {
      throw new TaxGuardStageError(409, 'DUPLICATE_FILING_BLOCKED', dupCheck.blockingReason || 'Duplicate filing blocked.');
    }
    const approvalCheck = readiness.checks.find(c => c.checkCode === 'APPROVED_RETURN_VERSION');
    if (approvalCheck && !approvalCheck.passed) {
      throw new TaxGuardStageError(422, 'UNAPPROVED_RETURN_FILING_BLOCKED', approvalCheck.blockingReason || 'Return version is not approved.');
    }
    const sigCheck = readiness.checks.find(c => c.checkCode === 'VALID_UNEXPIRED_SIGNATURE');
    if (sigCheck && !sigCheck.passed) {
      throw new TaxGuardStageError(422, 'SIGNATURE_REQUIRED_OR_EXPIRED', sigCheck.blockingReason || 'Valid unexpired signature required.');
    }
    const providerCheck = readiness.checks.find(c => c.checkCode === 'FILING_PROVIDER_AVAILABLE');
    if (providerCheck && !providerCheck.passed) {
      throw new TaxGuardStageError(
        503,
        'FILING_PROVIDER_NOT_COMMISSIONED',
        'Live e-file transmission is disabled until an authorized IRS/state transmitter is commissioned.'
      );
    }
    if (!readiness.ready) {
      const failed = readiness.checks.filter(c => !c.passed).map(c => c.checkCode);
      throw new TaxGuardStageError(422, 'FILING_NOT_READY', `Filing readiness checks failed: ${failed.join(', ')}.`, { failed });
    }

    const ret = this.stage09.getReturnVersionOrThrow(scope, input.returnVersionId);
    const filing: FilingTransmissionRecord = {
      filingId: `fil_${randomUUID()}`,
      scope: { ...scope },
      returnVersionId: ret.returnVersionId,
      returnContentSha256: ret.contentSha256,
      signatureEnvelopeId: input.signatureEnvelopeId,
      jurisdiction: input.jurisdiction,
      jurisdictionCode: input.jurisdictionCode.toUpperCase(),
      schemaVersion: input.schemaVersion,
      idempotencyKey: input.idempotencyKey,
      lifecycleState: 'AUTHORIZED_FOR_TRANSMISSION',
      providerName: this.filingAdapter.providerName,
      providerSubmissionId: null,
      autoRetryProhibited: true,
      authorizedBy: actor.userId,
      authorizedAt: new Date().toISOString(),
      transmittedAt: null,
      version: 1,
    };

    const result = this.filingAdapter.transmitReturn({
      filingId: filing.filingId,
      idempotencyKey: filing.idempotencyKey,
      returnContentSha256: filing.returnContentSha256,
      jurisdictionCode: filing.jurisdictionCode,
      schemaVersion: filing.schemaVersion,
    });

    filing.providerSubmissionId = result.providerSubmissionId;
    filing.transmittedAt = result.transmittedAt;
    filing.lifecycleState = result.outcome === 'UNKNOWN_OUTCOME' ? 'UNKNOWN_OUTCOME' : 'ACKNOWLEDGMENT_PENDING';
    filing.version += 1;

    this.filingIdempotencyKeys.add(dedupeKey);
    const key = scopeKey(scope);
    const list = this.filings.get(key) || [];
    list.push(filing);
    this.filings.set(key, list);

    // Lock original return version as immutable once transmitted
    this.stage09.markReturnStatus(scope, ret.returnVersionId, 'APPROVED', true);
    return filing;
  }

  attemptAutoRetryFiling(scope: ScopedCaseContext, filingId: string): never {
    const filing = this.getFilingOrThrow(scope, filingId);
    if (filing.lifecycleState === 'UNKNOWN_OUTCOME' || filing.autoRetryProhibited) {
      throw new TaxGuardStageError(
        409,
        'AUTO_RETRY_PROHIBITED_UNKNOWN_OUTCOME',
        `Automatic retry is strictly prohibited for filing ${filingId} (${filing.lifecycleState}) to prevent duplicate government filings. Perform manual transmitter reconciliation first.`
      );
    }
    throw new TaxGuardStageError(409, 'AUTO_RETRY_PROHIBITED', 'Automatic filing retries are prohibited.');
  }

  listFilings(scope: ScopedCaseContext): FilingTransmissionRecord[] {
    return [...(this.filings.get(scopeKey(scope)) || [])];
  }

  private getFilingOrThrow(scope: ScopedCaseContext, filingId: string): FilingTransmissionRecord {
    const found = (this.filings.get(scopeKey(scope)) || []).find(f => f.filingId === filingId);
    if (!found) {
      throw new TaxGuardStageError(404, 'FILING_NOT_FOUND', `Filing transmission ${filingId} not found.`);
    }
    return found;
  }

  // ==========================================================================
  // STAGE 13 — GOVERNMENT FEEDBACK
  // ==========================================================================

  ingestFilingAcknowledgment(params: {
    scope: ScopedCaseContext;
    filingId: string;
    externalAckId: string;
    jurisdictionCode: string;
    status: 'ACCEPTED' | 'REJECTED' | 'PENDING';
    errorCodes?: Array<{ code: string; category: string; message: string }>;
    rawPayload: string;
    signatureHeader: string;
    providerWebhookSecret: string;
  }): FilingAcknowledgmentRecord {
    if (!verifyHmacSha256(params.rawPayload, params.signatureHeader, params.providerWebhookSecret)) {
      throw new TaxGuardStageError(
        401,
        'FORGED_ACKNOWLEDGMENT_REJECTED',
        'Government filing acknowledgment rejected: cryptographic provider authenticity signature failed.'
      );
    }

    const ackKey = `${params.scope.tenantId}::${params.externalAckId}`;
    if (this.externalAckIds.has(ackKey)) {
      throw new TaxGuardStageError(
        409,
        'DUPLICATE_ACKNOWLEDGMENT_DETECTED',
        `Acknowledgment "${params.externalAckId}" was already ingested.`
      );
    }

    const filing = this.getFilingOrThrow(params.scope, params.filingId);
    if (filing.jurisdictionCode !== params.jurisdictionCode.toUpperCase()) {
      throw new TaxGuardStageError(
        422,
        'ACKNOWLEDGMENT_JURISDICTION_MISMATCH',
        'Acknowledgment jurisdiction does not match the linked filing transmission.'
      );
    }

    const ack: FilingAcknowledgmentRecord = {
      ackId: `ack_${randomUUID()}`,
      externalAckId: params.externalAckId,
      scope: { ...params.scope },
      filingId: filing.filingId,
      jurisdictionCode: params.jurisdictionCode.toUpperCase(),
      status: params.status,
      errorCodes: params.errorCodes || [],
      payloadSha256: sha256Hex(params.rawPayload),
      signatureVerified: true,
      receivedAt: new Date().toISOString(),
    };

    this.externalAckIds.add(ackKey);
    const key = scopeKey(params.scope);
    const list = this.acknowledgments.get(key) || [];
    list.push(ack);
    this.acknowledgments.set(key, list);

    if (params.status === 'ACCEPTED') {
      filing.lifecycleState = 'ACCEPTED';
      filing.version += 1;
    } else if (params.status === 'REJECTED') {
      filing.lifecycleState = 'REJECTED';
      filing.version += 1;
    }

    return ack;
  }

  registerGovernmentNotice(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      issuingAgency: string;
      noticeCode: string;
      noticeDate: string;
      responseDeadline?: string | null;
      proposedAmount?: string | null;
      rawNoticeText: string;
      requestAiAdvisorySummary?: boolean;
    }
  ): { notice: GovernmentNoticeRecord; advisory: BoundedAiAdvisoryOutput | null } {
    // Sanitize untrusted external government notice text & block prompt injections
    const sanitizedSummary = BoundedAiAdvisoryShield.sanitizeUntrustedText(input.rawNoticeText);
    const advisory = input.requestAiAdvisorySummary
      ? BoundedAiAdvisoryShield.generateAdvisory({
          agentCode: 'A28_NOTICE_TRIAGE_ADVISOR',
          untrustedInput: sanitizedSummary,
          contextLabel: `${input.issuingAgency} ${input.noticeCode}`,
        })
      : null;

    const proposedAmount = input.proposedAmount
      ? ExactDecimal.fromString(input.proposedAmount).toMoneyString()
      : null;

    const notice: GovernmentNoticeRecord = {
      noticeId: `ntc_${randomUUID()}`,
      scope: { ...scope },
      issuingAgency: input.issuingAgency.trim(),
      noticeCode: input.noticeCode.trim().toUpperCase(),
      noticeDate: input.noticeDate,
      responseDeadline: input.responseDeadline || null,
      proposedAmount,
      sanitizedSummary,
      aiAdvisorySummary: advisory?.summary || null,
      aiIsAuthoritative: false,
      status: 'RECEIVED',
      createdBy: actor.userId,
      createdAt: new Date().toISOString(),
    };

    const key = scopeKey(scope);
    const list = this.notices.get(key) || [];
    list.push(notice);
    this.notices.set(key, list);
    return { notice, advisory };
  }

  requestGovernmentTranscript(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      transcriptType: TranscriptRequestRecord['transcriptType'];
      taxpayerConsentVerified: boolean;
      representationAuthorityId: string | null;
    }
  ): never {
    const req: TranscriptRequestRecord = {
      requestId: `trn_${randomUUID()}`,
      scope: { ...scope },
      transcriptType: input.transcriptType,
      taxpayerConsentVerified: input.taxpayerConsentVerified,
      representationAuthorityId: input.representationAuthorityId,
      providerStatus: 'DISABLED',
      status: !input.taxpayerConsentVerified
        ? 'BLOCKED_MISSING_CONSENT'
        : !input.representationAuthorityId
          ? 'BLOCKED_MISSING_AUTHORITY'
          : 'BLOCKED_PROVIDER_UNCOMMISSIONED',
      requestedBy: actor.userId,
      requestedAt: new Date().toISOString(),
    };
    const key = scopeKey(scope);
    const list = this.transcriptRequests.get(key) || [];
    list.push(req);
    this.transcriptRequests.set(key, list);

    if (!input.taxpayerConsentVerified) {
      throw new TaxGuardStageError(422, 'TAXPAYER_CONSENT_REQUIRED', 'Transcript retrieval requires verified taxpayer consent.');
    }
    if (!input.representationAuthorityId) {
      throw new TaxGuardStageError(422, 'REPRESENTATION_AUTHORITY_REQUIRED', 'Transcript retrieval requires verified Form 2848 / 8821 representation authority.');
    }
    throw new TaxGuardStageError(
      503,
      'TRANSCRIPT_PROVIDER_NOT_COMMISSIONED',
      'Live IRS/state transcript retrieval is disabled until an authorized transcript provider is commissioned.'
    );
  }

  listAcknowledgments(scope: ScopedCaseContext): FilingAcknowledgmentRecord[] {
    return [...(this.acknowledgments.get(scopeKey(scope)) || [])];
  }

  listNotices(scope: ScopedCaseContext): GovernmentNoticeRecord[] {
    return [...(this.notices.get(scopeKey(scope)) || [])];
  }

  // ==========================================================================
  // STAGE 14 — RESOLVE
  // ==========================================================================

  openResolutionCase(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      originatingNoticeId?: string | null;
      originatingAckId?: string | null;
      summary: string;
      assignedOwnerId?: string;
    }
  ): ResolutionCaseRecord {
    const now = new Date().toISOString();
    const rec: ResolutionCaseRecord = {
      resolutionId: `res_${randomUUID()}`,
      scope: { ...scope },
      originatingNoticeId: input.originatingNoticeId || null,
      originatingAckId: input.originatingAckId || null,
      lifecycleState: 'OPEN',
      summary: input.summary.trim(),
      assignedOwnerId: input.assignedOwnerId || actor.userId,
      governmentConfirmationReceived: false,
      evidenceIds: [],
      actions: [],
      amendedReturnVersionId: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    const key = scopeKey(scope);
    const list = this.resolutions.get(key) || [];
    list.push(rec);
    this.resolutions.set(key, list);
    return rec;
  }

  transitionResolutionCase(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      resolutionId: string;
      toState: ResolutionLifecycleState;
      note: string;
      governmentConfirmationReceived?: boolean;
      expectedVersion?: number;
    }
  ): ResolutionCaseRecord {
    const list = this.resolutions.get(scopeKey(scope)) || [];
    const rec = list.find(r => r.resolutionId === input.resolutionId);
    if (!rec) {
      throw new TaxGuardStageError(404, 'RESOLUTION_CASE_NOT_FOUND', `Resolution case ${input.resolutionId} not found.`);
    }
    if (input.expectedVersion !== undefined && rec.version !== input.expectedVersion) {
      throw new TaxGuardStageError(409, 'CONCURRENCY_CONFLICT', 'Resolution case modified concurrently.');
    }

    const allowed = VALID_RESOLUTION_TRANSITIONS[rec.lifecycleState] || [];
    if (!allowed.includes(input.toState)) {
      throw new TaxGuardStageError(
        409,
        'INVALID_RESOLUTION_TRANSITION',
        `Cannot transition resolution case from ${rec.lifecycleState} to ${input.toState}.`
      );
    }

    if (input.governmentConfirmationReceived === true) {
      rec.governmentConfirmationReceived = true;
    }

    // Strict guard: NEVER mark RESOLVED while government confirmation is pending
    if (input.toState === 'RESOLVED' && !rec.governmentConfirmationReceived) {
      throw new TaxGuardStageError(
        422,
        'GOVERNMENT_CONFIRMATION_PENDING',
        'Cannot mark resolution case RESOLVED until government confirmation is recorded.'
      );
    }

    if (input.toState === 'AUTHORIZED_RESPONSE' && !['reviewer', 'senior_reviewer', 'approver'].includes(actor.role)) {
      throw new TaxGuardStageError(403, 'PROFESSIONAL_APPROVAL_REQUIRED', 'Authorized reviewer/approver required to authorize government response.');
    }

    const now = new Date().toISOString();
    rec.actions.push({
      actionId: `act_${randomUUID().slice(0, 8)}`,
      fromState: rec.lifecycleState,
      toState: input.toState,
      note: input.note.trim(),
      actorId: actor.userId,
      timestamp: now,
    });
    rec.lifecycleState = input.toState;
    rec.version += 1;
    rec.updatedAt = now;
    return rec;
  }

  createLinkedAmendment(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      resolutionId?: string | null;
      originalReturnVersionId: string;
      newCalculationRunId: string;
      reasonForAmendment: string;
      netTaxDelta: string;
    }
  ): { amendment: ReturnAmendmentRecord; amendedReturn: ReturnType<Stage09PrepareTaxesService['assembleReturnVersion']> } {
    const original = this.stage09.getReturnVersionOrThrow(scope, input.originalReturnVersionId);
    // Lock original as immutable — NEVER overwrite original filed return
    this.stage09.markReturnStatus(scope, original.returnVersionId, original.status, true);

    const amendedReturn = this.stage09.assembleReturnVersion(scope, actor, {
      calculationRunId: input.newCalculationRunId,
      returnKind: 'AMENDED',
      parentReturnVersionId: original.returnVersionId,
    });

    const amendment: ReturnAmendmentRecord = {
      amendmentId: `amd_${randomUUID()}`,
      scope: { ...scope },
      resolutionId: input.resolutionId || null,
      originalReturnVersionId: original.returnVersionId,
      amendedReturnVersionId: amendedReturn.returnVersionId,
      amendmentFormCode: amendedReturn.formCode,
      reasonForAmendment: input.reasonForAmendment.trim(),
      netTaxDelta: ExactDecimal.fromString(input.netTaxDelta).toMoneyString(),
      status: 'DRAFT',
      createdBy: actor.userId,
      createdAt: new Date().toISOString(),
    };

    const key = scopeKey(scope);
    const list = this.amendments.get(key) || [];
    list.push(amendment);
    this.amendments.set(key, list);

    if (input.resolutionId) {
      const res = (this.resolutions.get(key) || []).find(r => r.resolutionId === input.resolutionId);
      if (res) res.amendedReturnVersionId = amendedReturn.returnVersionId;
    }

    return { amendment, amendedReturn };
  }

  listResolutions(scope: ScopedCaseContext): ResolutionCaseRecord[] {
    return [...(this.resolutions.get(scopeKey(scope)) || [])];
  }

  listAmendments(scope: ScopedCaseContext): ReturnAmendmentRecord[] {
    return [...(this.amendments.get(scopeKey(scope)) || [])];
  }

  // ==========================================================================
  // STAGE 15 — MONITOR
  // ==========================================================================

  scheduleComplianceObligation(
    scope: ScopedCaseContext,
    input: {
      jurisdictionCode: string;
      obligationType: ComplianceObligationRecord['obligationType'];
      statutoryDueDate: string;
      holidayOrReliefShiftDays?: number;
      holidayOrReliefLabel?: string | null;
      ruleBasis: string;
      projectedAmount?: string | null;
    }
  ): ComplianceObligationRecord {
    const baseMs = Date.parse(input.statutoryDueDate);
    if (!Number.isFinite(baseMs)) {
      throw new TaxGuardStageError(400, 'INVALID_DUE_DATE', `Invalid statutory due date: ${input.statutoryDueDate}`);
    }
    const shiftDays = Math.max(0, Math.trunc(input.holidayOrReliefShiftDays || 0));
    const adjustedDueDate = new Date(baseMs + shiftDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const record: ComplianceObligationRecord = {
      obligationId: `obl_${randomUUID()}`,
      scope: { ...scope },
      jurisdictionCode: input.jurisdictionCode.toUpperCase(),
      obligationType: input.obligationType,
      statutoryDueDate: input.statutoryDueDate.slice(0, 10),
      adjustedDueDate,
      ruleBasis: input.ruleBasis.trim(),
      holidayOrReliefApplied: input.holidayOrReliefLabel || null,
      projectedAmount: input.projectedAmount ? ExactDecimal.fromString(input.projectedAmount).toMoneyString() : null,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    };

    const key = scopeKey(scope);
    const list = this.obligations.get(key) || [];
    list.push(record);
    this.obligations.set(key, list);
    return record;
  }

  enqueueNotification(
    scope: ScopedCaseContext,
    input: {
      idempotencyKey: string;
      channel: 'IN_APP' | 'EMAIL' | 'SMS';
      recipientRef: string;
      subject: string;
    }
  ): NotificationOutboxRecord {
    const dedupeKey = `${scope.tenantId}::${input.idempotencyKey}`;
    if (this.notificationDedupeKeys.has(dedupeKey)) {
      throw new TaxGuardStageError(
        409,
        'DUPLICATE_NOTIFICATION_PREVENTED',
        `Notification with idempotency key "${input.idempotencyKey}" already exists.`
      );
    }

    let deliveryStatus: NotificationOutboxRecord['deliveryStatus'] = 'PENDING';
    let lastErrorCode: string | null = null;
    let attemptCount = 0;

    if (input.channel === 'IN_APP') {
      deliveryStatus = 'DELIVERED';
      attemptCount = 1;
    } else {
      attemptCount = 1;
      const attempt = this.notificationAdapter.sendExternal({
        channel: input.channel,
        recipientRef: input.recipientRef,
        subject: input.subject,
        idempotencyKey: input.idempotencyKey,
      });
      if (attempt.delivered) {
        deliveryStatus = 'DELIVERED';
      } else {
        deliveryStatus = 'BLOCKED_PROVIDER_UNCOMMISSIONED';
        lastErrorCode = attempt.errorCode || 'NOTIFICATION_PROVIDER_NOT_COMMISSIONED';
      }
    }

    const rec: NotificationOutboxRecord = {
      notificationId: `ntf_${randomUUID()}`,
      scope: { ...scope },
      idempotencyKey: input.idempotencyKey,
      channel: input.channel,
      recipientRef: input.recipientRef,
      subject: input.subject.trim(),
      deliveryStatus,
      attemptCount,
      maxAttempts: 5,
      lastErrorCode,
      createdAt: new Date().toISOString(),
    };

    this.notificationDedupeKeys.add(dedupeKey);
    const key = scopeKey(scope);
    const list = this.outbox.get(key) || [];
    list.push(rec);
    this.outbox.set(key, list);
    return rec;
  }

  listObligations(scope: ScopedCaseContext): ComplianceObligationRecord[] {
    return [...(this.obligations.get(scopeKey(scope)) || [])];
  }

  listNotifications(scope: ScopedCaseContext): NotificationOutboxRecord[] {
    return [...(this.outbox.get(scopeKey(scope)) || [])];
  }

  // ==========================================================================
  // STAGE 16 — ARCHIVE & LEGAL HOLD
  // ==========================================================================

  defineRetentionPolicy(input: {
    tenantId: string;
    documentClass: string;
    jurisdictionCode: string;
    engagementType: string;
    retentionYears: number;
    policyAuthority: string;
  }): RetentionPolicyRecord {
    const policyId = `retpol_${input.jurisdictionCode.toUpperCase()}_${input.documentClass.toUpperCase()}_${input.engagementType.toUpperCase()}`;
    const policy: RetentionPolicyRecord = {
      policyId,
      tenantId: input.tenantId,
      documentClass: input.documentClass.toUpperCase(),
      jurisdictionCode: input.jurisdictionCode.toUpperCase(),
      engagementType: input.engagementType.toUpperCase(),
      retentionYears: Math.max(1, Math.trunc(input.retentionYears)),
      policyAuthority: input.policyAuthority,
    };
    this.retentionPolicies.set(`${input.tenantId}::${policyId}`, policy);
    return policy;
  }

  sealArchivePackage(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      retentionPolicyId: string;
      auditEventCount: number;
      auditDigestSha256: string;
    }
  ): ArchivePackageRecord {
    const policy = this.retentionPolicies.get(`${scope.tenantId}::${input.retentionPolicyId}`);
    if (!policy) {
      throw new TaxGuardStageError(
        404,
        'RETENTION_POLICY_NOT_FOUND',
        `Configurable retention policy "${input.retentionPolicyId}" must be defined before sealing an archive.`
      );
    }

    const manifest = {
      returnVersionIds: this.stage09.listReturnVersions(scope).map(r => r.returnVersionId),
      evidenceIds: this.stage09.listSourceEvidence(scope).map(e => e.evidenceId),
      approvalIds: this.stage10.listApprovals(scope).map(a => a.approvalId),
      signatureEnvelopeIds: this.listSignatureEnvelopes(scope).map(s => s.envelopeId),
      filingIds: this.listFilings(scope).map(f => f.filingId),
      acknowledgmentIds: this.listAcknowledgments(scope).map(a => a.ackId),
      noticeIds: this.listNotices(scope).map(n => n.noticeId),
      resolutionIds: this.listResolutions(scope).map(r => r.resolutionId),
      auditEventCount: input.auditEventCount,
      auditDigestSha256: input.auditDigestSha256,
    };

    const sealedAt = new Date().toISOString();
    const eligibleDate = new Date();
    eligibleDate.setUTCFullYear(eligibleDate.getUTCFullYear() + policy.retentionYears);

    const integritySha256 = sha256Hex({ scope, manifest, policyId: policy.policyId, sealedAt });
    const pkg: ArchivePackageRecord = {
      archiveId: `arc_${randomUUID()}`,
      scope: { ...scope },
      retentionPolicyId: policy.policyId,
      eligibleForDispositionDate: eligibleDate.toISOString().slice(0, 10),
      manifest,
      integritySha256,
      status: 'SEALED',
      sealedBy: actor.userId,
      sealedAt,
    };

    const key = scopeKey(scope);
    const list = this.archives.get(key) || [];
    list.push(pkg);
    this.archives.set(key, list);

    // Mark historical case as finalized/immutable for Stage 18 protection
    this.finalizedHistoricalCases.add(`${scope.tenantId}::${scope.caseId}::${scope.taxYear}`);
    return pkg;
  }

  placeLegalHold(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: { archiveId: string; reason: string }
  ): LegalHoldRecord {
    const pkg = this.getArchiveOrThrow(scope, input.archiveId);
    const hold: LegalHoldRecord = {
      holdId: `hold_${randomUUID()}`,
      scope: { ...scope },
      archiveId: pkg.archiveId,
      reason: input.reason.trim(),
      status: 'ACTIVE',
      placedBy: actor.userId,
      placedAt: new Date().toISOString(),
      releasedBy: null,
      releasedAt: null,
      releaseNote: null,
    };
    pkg.status = 'UNDER_LEGAL_HOLD';

    const key = scopeKey(scope);
    const list = this.legalHolds.get(key) || [];
    list.push(hold);
    this.legalHolds.set(key, list);
    return hold;
  }

  releaseLegalHold(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: { holdId: string; releaseNote: string }
  ): LegalHoldRecord {
    if (!['admin', 'administrator', 'super_admin', 'super_administrator', 'senior_reviewer'].includes(actor.role)) {
      throw new TaxGuardStageError(403, 'LEGAL_HOLD_RELEASE_UNAUTHORIZED', 'Authorized compliance/admin officer required to release a legal hold.');
    }
    const list = this.legalHolds.get(scopeKey(scope)) || [];
    const hold = list.find(h => h.holdId === input.holdId);
    if (!hold) {
      throw new TaxGuardStageError(404, 'LEGAL_HOLD_NOT_FOUND', `Legal hold ${input.holdId} not found.`);
    }
    hold.status = 'RELEASED';
    hold.releasedBy = actor.userId;
    hold.releasedAt = new Date().toISOString();
    hold.releaseNote = input.releaseNote.trim();

    const activeRemaining = list.some(h => h.archiveId === hold.archiveId && h.status === 'ACTIVE');
    if (!activeRemaining) {
      const pkg = this.getArchiveOrThrow(scope, hold.archiveId);
      pkg.status = 'SEALED';
    }
    return hold;
  }

  attemptArchiveDisposition(scope: ScopedCaseContext, archiveId: string): ArchivePackageRecord {
    const pkg = this.getArchiveOrThrow(scope, archiveId);
    const holds = this.legalHolds.get(scopeKey(scope)) || [];
    const activeHold = holds.find(h => h.archiveId === archiveId && h.status === 'ACTIVE');
    if (activeHold || pkg.status === 'UNDER_LEGAL_HOLD') {
      throw new TaxGuardStageError(
        423,
        'LEGAL_HOLD_ACTIVE_DELETION_BLOCKED',
        `Archive disposition/deletion strictly prohibited while legal hold ${activeHold?.holdId || 'ACTIVE'} is in effect.`
      );
    }
    const today = new Date().toISOString().slice(0, 10);
    if (today < pkg.eligibleForDispositionDate) {
      throw new TaxGuardStageError(
        422,
        'RETENTION_PERIOD_ACTIVE',
        `Archive cannot be disposed before retention eligibility date ${pkg.eligibleForDispositionDate}.`
      );
    }
    pkg.status = 'DISPOSED';
    return pkg;
  }

  listArchives(scope: ScopedCaseContext): ArchivePackageRecord[] {
    return [...(this.archives.get(scopeKey(scope)) || [])];
  }

  listLegalHolds(scope: ScopedCaseContext): LegalHoldRecord[] {
    return [...(this.legalHolds.get(scopeKey(scope)) || [])];
  }

  private getArchiveOrThrow(scope: ScopedCaseContext, archiveId: string): ArchivePackageRecord {
    const found = (this.archives.get(scopeKey(scope)) || []).find(a => a.archiveId === archiveId);
    if (!found) {
      throw new TaxGuardStageError(404, 'ARCHIVE_NOT_FOUND', `Archive package ${archiveId} not found.`);
    }
    return found;
  }

  // ==========================================================================
  // STAGE 17 — RENEW
  // ==========================================================================

  createRenewalProposal(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      proposedFee: string;
      scopeSummary: string;
      conflictCheckPassed: boolean;
      riskClassification: RiskClassification;
      agreementRenewed: boolean;
      consentRenewed: boolean;
    }
  ): EngagementRenewalRecord {
    const rec: EngagementRenewalRecord = {
      renewalId: `ren_${randomUUID()}`,
      scope: { ...scope },
      priorTaxYear: scope.taxYear,
      nextTaxYear: scope.taxYear + 1,
      proposedFee: ExactDecimal.fromString(input.proposedFee).toMoneyString(),
      scopeSummary: input.scopeSummary.trim(),
      conflictCheckPassed: input.conflictCheckPassed,
      riskClassification: input.riskClassification,
      agreementRenewed: input.agreementRenewed,
      consentRenewed: input.consentRenewed,
      status:
        input.conflictCheckPassed && input.agreementRenewed && input.consentRenewed
          ? 'READY_TO_ACTIVATE'
          : 'PENDING_CLIENT',
      activatedBy: null,
      activatedAt: null,
      createdBy: actor.userId,
      createdAt: new Date().toISOString(),
    };

    const key = scopeKey(scope);
    const list = this.renewals.get(key) || [];
    list.push(rec);
    this.renewals.set(key, list);
    return rec;
  }

  activateRenewal(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    renewalId: string
  ): EngagementRenewalRecord {
    if (!['reviewer', 'senior_reviewer', 'approver', 'practice_manager', 'admin', 'administrator'].includes(actor.role)) {
      throw new TaxGuardStageError(403, 'UNAUTHORIZED_RENEWAL_ACTIVATION', 'Only authorized firm leadership may activate an engagement renewal.');
    }
    const list = this.renewals.get(scopeKey(scope)) || [];
    const rec = list.find(r => r.renewalId === renewalId);
    if (!rec) {
      throw new TaxGuardStageError(404, 'RENEWAL_NOT_FOUND', `Engagement renewal ${renewalId} not found.`);
    }
    if (!rec.conflictCheckPassed) {
      throw new TaxGuardStageError(422, 'CONFLICT_CHECK_REQUIRED', 'Renewal activation blocked: conflict check has not passed.');
    }
    if (!rec.agreementRenewed || !rec.consentRenewed) {
      throw new TaxGuardStageError(422, 'RENEWAL_AGREEMENT_AND_CONSENT_REQUIRED', 'Renewal activation requires renewed engagement agreement and client consent.');
    }
    rec.status = 'ACTIVATED';
    rec.activatedBy = actor.userId;
    rec.activatedAt = new Date().toISOString();
    return rec;
  }

  listRenewals(scope: ScopedCaseContext): EngagementRenewalRecord[] {
    return [...(this.renewals.get(scopeKey(scope)) || [])];
  }

  // ==========================================================================
  // STAGE 18 — REPEAT (MULTI-YEAR CONTINUITY)
  // ==========================================================================

  registerCarryforwardCandidate(
    scope: ScopedCaseContext,
    input: {
      category: CarryforwardCategory;
      description: string;
      amount: string;
      eligibilityRuleRef: string;
    }
  ): CarryforwardItemRecord {
    const rec: CarryforwardItemRecord = {
      carryforwardId: `cf_${randomUUID()}`,
      scope: { ...scope },
      sourceTaxYear: scope.taxYear,
      targetTaxYear: scope.taxYear + 1,
      category: input.category,
      description: input.description.trim(),
      amount: ExactDecimal.fromString(input.amount).toMoneyString(),
      eligibilityRuleRef: input.eligibilityRuleRef.trim(),
      reviewStatus: 'CANDIDATE',
      reviewedBy: null,
      reviewedAt: null,
    };
    const key = scopeKey(scope);
    const list = this.carryforwards.get(key) || [];
    list.push(rec);
    this.carryforwards.set(key, list);
    return rec;
  }

  reviewCarryforwardItem(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: { carryforwardId: string; decision: 'REVIEWED_APPROVED' | 'REJECTED' }
  ): CarryforwardItemRecord {
    if (!['reviewer', 'senior_reviewer', 'approver', 'accountant'].includes(actor.role)) {
      throw new TaxGuardStageError(403, 'CARRYFORWARD_REVIEW_UNAUTHORIZED', 'Authorized tax practitioner required to review carryforwards.');
    }
    const list = this.carryforwards.get(scopeKey(scope)) || [];
    const item = list.find(c => c.carryforwardId === input.carryforwardId);
    if (!item) {
      throw new TaxGuardStageError(404, 'CARRYFORWARD_NOT_FOUND', `Carryforward item ${input.carryforwardId} not found.`);
    }
    item.reviewStatus = input.decision;
    item.reviewedBy = actor.userId;
    item.reviewedAt = new Date().toISOString();
    return item;
  }

  generateNextTaxYearCycle(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      renewalId: string;
      carryforwardIds: string[];
      detectedNewEntityHint?: string;
      detectedNewIncomeSourceHint?: string;
    }
  ): AnnualCycleGenerationRecord {
    const renewal = (this.renewals.get(scopeKey(scope)) || []).find(r => r.renewalId === input.renewalId);
    if (!renewal || renewal.status !== 'ACTIVATED') {
      throw new TaxGuardStageError(
        422,
        'ACTIVATED_RENEWAL_REQUIRED',
        'Cannot generate next tax-year cycle: an ACTIVATED Stage 17 engagement renewal is required.'
      );
    }

    const cfList = this.carryforwards.get(scopeKey(scope)) || [];
    for (const cfId of input.carryforwardIds) {
      const item = cfList.find(c => c.carryforwardId === cfId);
      if (!item) {
        throw new TaxGuardStageError(404, 'CARRYFORWARD_NOT_FOUND', `Carryforward ${cfId} not found in prior-year scope.`);
      }
      if (item.reviewStatus !== 'REVIEWED_APPROVED') {
        throw new TaxGuardStageError(
          422,
          'UNREVIEWED_CARRYFORWARD_BLOCKED',
          `Carryforward "${item.description}" (${item.carryforwardId}) is ${item.reviewStatus}; only REVIEWED_APPROVED carryforwards may transfer to the new tax year.`
        );
      }
    }

    const intelligenceFlags: AnnualCycleGenerationRecord['intelligenceFlags'] = [];
    if (input.detectedNewEntityHint) {
      intelligenceFlags.push({
        code: 'POTENTIAL_NEW_ENTITY',
        detail: BoundedAiAdvisoryShield.sanitizeUntrustedText(input.detectedNewEntityHint),
        advisoryOnly: true,
      });
    }
    if (input.detectedNewIncomeSourceHint) {
      intelligenceFlags.push({
        code: 'POTENTIAL_NEW_INCOME_SOURCE',
        detail: BoundedAiAdvisoryShield.sanitizeUntrustedText(input.detectedNewIncomeSourceHint),
        advisoryOnly: true,
      });
    }

    const nextTaxYear = scope.taxYear + 1;
    const generation: AnnualCycleGenerationRecord = {
      generationId: `cyc_${randomUUID()}`,
      tenantId: scope.tenantId,
      clientId: scope.clientId,
      priorCaseId: scope.caseId,
      priorTaxYear: scope.taxYear,
      newCaseId: `case_${scope.clientId}_${nextTaxYear}_${randomUUID().slice(0, 6)}`,
      newEngagementId: `eng_${scope.clientId}_${nextTaxYear}_${randomUUID().slice(0, 6)}`,
      newTaxYear: nextTaxYear,
      renewalId: renewal.renewalId,
      newCaseInitialStage: 1,
      approvedCarryforwardIds: [...input.carryforwardIds],
      intelligenceFlags,
      priorCaseMutated: false,
      generatedBy: actor.userId,
      generatedAt: new Date().toISOString(),
    };

    // Explicitly lock historical prior-year case against mutation/reopening
    this.finalizedHistoricalCases.add(`${scope.tenantId}::${scope.caseId}::${scope.taxYear}`);

    const key = scopeKey(scope);
    const list = this.annualGenerations.get(key) || [];
    list.push(generation);
    this.annualGenerations.set(key, list);
    return generation;
  }

  assertHistoricalCaseNotFinalized(scope: ScopedCaseContext): void {
    if (this.finalizedHistoricalCases.has(`${scope.tenantId}::${scope.caseId}::${scope.taxYear}`)) {
      throw new TaxGuardStageError(
        409,
        'HISTORICAL_CASE_IMMUTABLE',
        `Historical case ${scope.caseId} (${scope.taxYear}) is finalized/archived and cannot be mutated or reset.`
      );
    }
  }

  listCarryforwards(scope: ScopedCaseContext): CarryforwardItemRecord[] {
    return [...(this.carryforwards.get(scopeKey(scope)) || [])];
  }

  listAnnualGenerations(scope: ScopedCaseContext): AnnualCycleGenerationRecord[] {
    return [...(this.annualGenerations.get(scopeKey(scope)) || [])];
  }
}
