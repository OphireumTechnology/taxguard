
import type {
  TaxGuardReturnWorkflowRecord,
  TaxGuardWorkflowContext,
  TaxGuardWorkflowRole,
  TaxGuardWorkflowStage
} from './TaxGuardReturnWorkflow';

import {
  TaxGuardReturnWorkflowEngine
} from './TaxGuardReturnWorkflow';

export type TaxGuardTaxpayerReviewStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'CHANGES_REQUESTED';

export type TaxGuardConsentType =
  | 'RETURN_REVIEW'
  | 'ELECTRONIC_DELIVERY'
  | 'ELECTRONIC_SIGNATURE'
  | 'DISCLOSURE'
  | 'USE'
  | 'FILING_AUTHORIZATION';

export type TaxGuardConsentStatus =
  | 'PENDING'
  | 'GRANTED'
  | 'DECLINED'
  | 'REVOKED'
  | 'SUPERSEDED';

export interface TaxGuardTaxpayerReviewRecord {
  reviewId: string;

  context:
    TaxGuardWorkflowContext;

  returnVersionId: string;

  taxpayerId: string;

  status:
    TaxGuardTaxpayerReviewStatus;

  comments:
    readonly string[];

  reviewedAt: string;

  immutable: true;
}

export interface TaxGuardConsentRecord {
  consentId: string;

  context:
    TaxGuardWorkflowContext;

  consentType:
    TaxGuardConsentType;

  status:
    TaxGuardConsentStatus;

  taxpayerId: string;

  returnVersionId?: string;

  disclosureVersion?: string;

  grantedAt?: string;

  revokedAt?: string;

  recordedBy: string;

  immutable: true;
}

export interface TaxGuardReturnVersionRecord {
  versionId: string;

  context:
    TaxGuardWorkflowContext;

  versionNumber: number;

  contentHash: string;

  preparedReturnId: string;

  supersedesVersionId?: string;

  createdBy: string;

  createdAt: string;

  locked: boolean;

  immutable: true;
}

export interface TaxGuardSignatureRecord {
  signatureId: string;

  context:
    TaxGuardWorkflowContext;

  taxpayerId: string;

  returnVersionId: string;

  consentId: string;

  signedAt: string;

  signatureMethod:
    | 'ELECTRONIC'
    | 'WET_SIGNATURE_RECORDED';

  recordedBy: string;

  immutable: true;
}

export interface TaxGuardReadinessResult {
  ready: boolean;

  reasons:
    readonly string[];
}

function requireText(
  value: string,
  errorCode: string
): string {

  if (!value.trim()) {
    throw new Error(
      errorCode
    );
  }

  return value.trim();
}

function cloneContext(
  context:
    TaxGuardWorkflowContext
):
  TaxGuardWorkflowContext {

  return {
    ...context
  };
}

function sameContext(
  left:
    TaxGuardWorkflowContext,

  right:
    TaxGuardWorkflowContext
): boolean {

  return (
    left.clientId ===
      right.clientId &&
    left.engagementId ===
      right.engagementId &&
    left.taxYear ===
      right.taxYear &&
    left.correlationId ===
      right.correlationId &&
    left.returnId ===
      right.returnId
  );
}

export class TaxGuardTaxpayerReviewRegistry {

  private readonly reviews =
    new Map<
      string,
      TaxGuardTaxpayerReviewRecord
    >();

  record(
    input: {
      reviewId: string;
      context: TaxGuardWorkflowContext;
      returnVersionId: string;
      taxpayerId: string;
      status: TaxGuardTaxpayerReviewStatus;
      comments?: readonly string[];
    }
  ):
    TaxGuardTaxpayerReviewRecord {

    requireText(
      input.reviewId,
      'TG_TAXPAYER_REVIEW_ID_REQUIRED'
    );

    requireText(
      input.returnVersionId,
      'TG_TAXPAYER_REVIEW_VERSION_REQUIRED'
    );

    requireText(
      input.taxpayerId,
      'TG_TAXPAYER_REVIEW_TAXPAYER_REQUIRED'
    );

    if (
      this.reviews.has(
        input.reviewId
      )
    ) {
      throw new Error(
        'TG_TAXPAYER_REVIEW_DUPLICATE'
      );
    }

    const record:
      TaxGuardTaxpayerReviewRecord =
        Object.freeze({
          reviewId:
            input.reviewId,

          context:
            cloneContext(
              input.context
            ),

          returnVersionId:
            input.returnVersionId,

          taxpayerId:
            input.taxpayerId,

          status:
            input.status,

          comments: [
            ...(
              input.comments ??
              []
            )
          ],

          reviewedAt:
            new Date()
              .toISOString(),

          immutable:
            true
        });

    this.reviews.set(
      record.reviewId,
      record
    );

    return {
      ...record,

      context: {
        ...record.context
      },

      comments: [
        ...record.comments
      ]
    };
  }

  acceptedForVersion(
    context:
      TaxGuardWorkflowContext,

    returnVersionId: string
  ):
    boolean {

    return [
      ...this.reviews.values()
    ].some(
      review =>
        sameContext(
          review.context,
          context
        ) &&
        review.returnVersionId ===
          returnVersionId &&
        review.status ===
          'ACCEPTED'
    );
  }
}

export class TaxGuardConsentRegistry {

  private readonly consents =
    new Map<
      string,
      TaxGuardConsentRecord
    >();

  record(
    input: {
      consentId: string;
      context: TaxGuardWorkflowContext;
      consentType: TaxGuardConsentType;
      status: TaxGuardConsentStatus;
      taxpayerId: string;
      returnVersionId?: string;
      disclosureVersion?: string;
      recordedBy: string;
    }
  ):
    TaxGuardConsentRecord {

    requireText(
      input.consentId,
      'TG_CONSENT_ID_REQUIRED'
    );

    requireText(
      input.taxpayerId,
      'TG_CONSENT_TAXPAYER_REQUIRED'
    );

    requireText(
      input.recordedBy,
      'TG_CONSENT_RECORDER_REQUIRED'
    );

    if (
      this.consents.has(
        input.consentId
      )
    ) {
      throw new Error(
        'TG_CONSENT_DUPLICATE'
      );
    }

    const timestamp =
      new Date()
        .toISOString();

    const record:
      TaxGuardConsentRecord =
        Object.freeze({
          consentId:
            input.consentId,

          context:
            cloneContext(
              input.context
            ),

          consentType:
            input.consentType,

          status:
            input.status,

          taxpayerId:
            input.taxpayerId,

          returnVersionId:
            input.returnVersionId,

          disclosureVersion:
            input.disclosureVersion,

          grantedAt:
            input.status ===
              'GRANTED'
              ? timestamp
              : undefined,

          revokedAt:
            input.status ===
              'REVOKED'
              ? timestamp
              : undefined,

          recordedBy:
            input.recordedBy,

          immutable:
            true
        });

    this.consents.set(
      record.consentId,
      record
    );

    return {
      ...record,

      context: {
        ...record.context
      }
    };
  }

  hasGrantedConsent(
    context:
      TaxGuardWorkflowContext,

    consentType:
      TaxGuardConsentType,

    returnVersionId?:
      string
  ):
    boolean {

    return [
      ...this.consents.values()
    ].some(
      consent =>
        sameContext(
          consent.context,
          context
        ) &&
        consent.consentType ===
          consentType &&
        consent.status ===
          'GRANTED' &&
        (
          !returnVersionId ||
          consent.returnVersionId ===
            returnVersionId
        )
    );
  }
}

export class TaxGuardReturnVersionRegistry {

  private readonly versions =
    new Map<
      string,
      TaxGuardReturnVersionRecord
    >();

  create(
    input: {
      versionId: string;
      context: TaxGuardWorkflowContext;
      versionNumber: number;
      contentHash: string;
      preparedReturnId: string;
      supersedesVersionId?: string;
      createdBy: string;
    }
  ):
    TaxGuardReturnVersionRecord {

    requireText(
      input.versionId,
      'TG_RETURN_VERSION_ID_REQUIRED'
    );

    requireText(
      input.contentHash,
      'TG_RETURN_VERSION_HASH_REQUIRED'
    );

    requireText(
      input.preparedReturnId,
      'TG_PREPARED_RETURN_ID_REQUIRED'
    );

    requireText(
      input.createdBy,
      'TG_RETURN_VERSION_CREATOR_REQUIRED'
    );

    if (
      !Number.isInteger(
        input.versionNumber
      ) ||
      input.versionNumber < 1
    ) {
      throw new Error(
        'TG_RETURN_VERSION_NUMBER_INVALID'
      );
    }

    if (
      this.versions.has(
        input.versionId
      )
    ) {
      throw new Error(
        'TG_RETURN_VERSION_DUPLICATE'
      );
    }

    if (
      input.supersedesVersionId &&
      !this.versions.has(
        input.supersedesVersionId
      )
    ) {
      throw new Error(
        'TG_RETURN_SUPERSEDED_VERSION_NOT_FOUND'
      );
    }

    const duplicateNumber =
      [
        ...this.versions.values()
      ].some(
        version =>
          sameContext(
            version.context,
            input.context
          ) &&
          version.versionNumber ===
            input.versionNumber
      );

    if (duplicateNumber) {
      throw new Error(
        'TG_RETURN_VERSION_NUMBER_DUPLICATE'
      );
    }

    const record:
      TaxGuardReturnVersionRecord =
        Object.freeze({
          versionId:
            input.versionId,

          context:
            cloneContext(
              input.context
            ),

          versionNumber:
            input.versionNumber,

          contentHash:
            input.contentHash,

          preparedReturnId:
            input.preparedReturnId,

          supersedesVersionId:
            input.supersedesVersionId,

          createdBy:
            input.createdBy,

          createdAt:
            new Date()
              .toISOString(),

          locked:
            true,

          immutable:
            true
        });

    this.versions.set(
      record.versionId,
      record
    );

    return {
      ...record,

      context: {
        ...record.context
      }
    };
  }

  get(
    versionId: string
  ):
    TaxGuardReturnVersionRecord {

    const version =
      this.versions.get(
        versionId
      );

    if (!version) {
      throw new Error(
        'TG_RETURN_VERSION_NOT_FOUND'
      );
    }

    return {
      ...version,

      context: {
        ...version.context
      }
    };
  }

  latest(
    context:
      TaxGuardWorkflowContext
  ):
    TaxGuardReturnVersionRecord {

    const matches =
      [
        ...this.versions.values()
      ]
        .filter(
          version =>
            sameContext(
              version.context,
              context
            )
        )
        .sort(
          (a, b) =>
            b.versionNumber -
            a.versionNumber
        );

    if (
      matches.length === 0
    ) {
      throw new Error(
        'TG_RETURN_VERSION_NOT_FOUND'
      );
    }

    return this.get(
      matches[0].versionId
    );
  }
}

export class TaxGuardSignatureRegistry {

  private readonly signatures =
    new Map<
      string,
      TaxGuardSignatureRecord
    >();

  record(
    input: {
      signatureId: string;
      context: TaxGuardWorkflowContext;
      taxpayerId: string;
      returnVersionId: string;
      consentId: string;
      signatureMethod:
        'ELECTRONIC' |
        'WET_SIGNATURE_RECORDED';
      recordedBy: string;
    }
  ):
    TaxGuardSignatureRecord {

    requireText(
      input.signatureId,
      'TG_SIGNATURE_ID_REQUIRED'
    );

    requireText(
      input.taxpayerId,
      'TG_SIGNATURE_TAXPAYER_REQUIRED'
    );

    requireText(
      input.returnVersionId,
      'TG_SIGNATURE_VERSION_REQUIRED'
    );

    requireText(
      input.consentId,
      'TG_SIGNATURE_CONSENT_REQUIRED'
    );

    requireText(
      input.recordedBy,
      'TG_SIGNATURE_RECORDER_REQUIRED'
    );

    if (
      this.signatures.has(
        input.signatureId
      )
    ) {
      throw new Error(
        'TG_SIGNATURE_DUPLICATE'
      );
    }

    const record:
      TaxGuardSignatureRecord =
        Object.freeze({
          signatureId:
            input.signatureId,

          context:
            cloneContext(
              input.context
            ),

          taxpayerId:
            input.taxpayerId,

          returnVersionId:
            input.returnVersionId,

          consentId:
            input.consentId,

          signedAt:
            new Date()
              .toISOString(),

          signatureMethod:
            input.signatureMethod,

          recordedBy:
            input.recordedBy,

          immutable:
            true
        });

    this.signatures.set(
      record.signatureId,
      record
    );

    return {
      ...record,

      context: {
        ...record.context
      }
    };
  }

  existsForVersion(
    context:
      TaxGuardWorkflowContext,

    returnVersionId: string
  ):
    boolean {

    return [
      ...this.signatures.values()
    ].some(
      signature =>
        sameContext(
          signature.context,
          context
        ) &&
        signature.returnVersionId ===
          returnVersionId
    );
  }
}

export class TaxGuardWorkflowStageGuard {

  static assertStage(
    workflow:
      TaxGuardReturnWorkflowRecord,

    expected:
      TaxGuardWorkflowStage
  ):
    true {

    if (
      workflow.currentStage !==
        expected
    ) {
      throw new Error(
        'TG_WORKFLOW_STAGE_MISMATCH:' +
        expected
      );
    }

    return true;
  }

  static assertActorRole(
    role:
      TaxGuardWorkflowRole,

    allowed:
      readonly TaxGuardWorkflowRole[]
  ):
    true {

    if (
      !allowed.includes(
        role
      )
    ) {
      throw new Error(
        'TG_WORKFLOW_ROLE_NOT_AUTHORIZED'
      );
    }

    return true;
  }
}

export class TaxGuardWorkflowReadinessGuard {

  static evaluate(
    input: {
      workflow:
        TaxGuardReturnWorkflowRecord;

      latestVersion:
        TaxGuardReturnVersionRecord;

      taxpayerReviewAccepted:
        boolean;

      filingAuthorizationGranted:
        boolean;

      signatureConsentGranted:
        boolean;

      signatureExists:
        boolean;

      unresolvedExceptionIds:
        readonly string[];

      provenanceApproved:
        boolean;

      professionalReviewApproved:
        boolean;
    }
  ):
    TaxGuardReadinessResult {

    const reasons:
      string[] = [];

    if (
      input.latestVersion.context.returnId !==
        input.workflow.context.returnId
    ) {
      reasons.push(
        'RETURN_VERSION_CONTEXT_MISMATCH'
      );
    }

    if (
      !input.taxpayerReviewAccepted
    ) {
      reasons.push(
        'TAXPAYER_REVIEW_REQUIRED'
      );
    }

    if (
      !input.filingAuthorizationGranted
    ) {
      reasons.push(
        'FILING_AUTHORIZATION_REQUIRED'
      );
    }

    if (
      !input.signatureConsentGranted
    ) {
      reasons.push(
        'SIGNATURE_CONSENT_REQUIRED'
      );
    }

    if (
      !input.signatureExists
    ) {
      reasons.push(
        'SIGNATURE_REQUIRED'
      );
    }

    if (
      input.unresolvedExceptionIds
        .length > 0
    ) {
      reasons.push(
        'UNRESOLVED_EXCEPTIONS'
      );
    }

    if (
      !input.provenanceApproved
    ) {
      reasons.push(
        'PROVENANCE_APPROVAL_REQUIRED'
      );
    }

    if (
      !input.professionalReviewApproved
    ) {
      reasons.push(
        'PROFESSIONAL_REVIEW_REQUIRED'
      );
    }

    return {
      ready:
        reasons.length === 0,

      reasons: [
        ...new Set(
          reasons
        )
      ]
    };
  }

  static assertReady(
    input: Parameters<
      typeof TaxGuardWorkflowReadinessGuard.evaluate
    >[0]
  ):
    true {

    const result =
      this.evaluate(
        input
      );

    if (!result.ready) {
      throw new Error(
        'TG_WORKFLOW_READINESS_BLOCKED:' +
        result.reasons.join(',')
      );
    }

    return true;
  }
}

export class TaxGuardControlledWorkflowService {

  constructor(
    private readonly workflows:
      TaxGuardReturnWorkflowEngine
  ) {}

  advance(
    workflowId: string,

    input: {
      expectedStage:
        TaxGuardWorkflowStage;

      actorId: string;

      actorRole:
        TaxGuardWorkflowRole;

      allowedRoles:
        readonly TaxGuardWorkflowRole[];

      evidenceIds?:
        readonly string[];

      provenanceDecisionIds?:
        readonly string[];

      exceptionIds?:
        readonly string[];

      notes?:
        readonly string[];
    }
  ):
    TaxGuardReturnWorkflowRecord {

    const workflow =
      this.workflows.get(
        workflowId
      );

    TaxGuardWorkflowStageGuard
      .assertStage(
        workflow,
        input.expectedStage
      );

    TaxGuardWorkflowStageGuard
      .assertActorRole(
        input.actorRole,
        input.allowedRoles
      );

    return this.workflows
      .completeCurrentStage(
        workflowId,
        {
          actorId:
            input.actorId,

          actorRole:
            input.actorRole,

          evidenceIds:
            input.evidenceIds,

          provenanceDecisionIds:
            input.provenanceDecisionIds,

          exceptionIds:
            input.exceptionIds,

          notes:
            input.notes
        }
      );
  }
}
