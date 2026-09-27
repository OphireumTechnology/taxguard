/////////// Ophireum Multimedia Productions
////////// M11 Part 1 of 4 — Workflow Contract + Lifecycle Engine
///// JacaScripts

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function write(rel, content) {
  const target = path.join(ROOT, rel);

  fs.mkdirSync(
    path.dirname(target),
    { recursive: true }
  );

  fs.writeFileSync(
    target,
    content,
    'utf8'
  );

  console.log(
    'WROTE ' + rel
  );
}

write(
  'src/taxguard/workflow/TaxGuardReturnWorkflow.ts',
  String.raw`
export type TaxGuardWorkflowStage =
  | 'PREPARATION'
  | 'EXCEPTION_REVIEW'
  | 'PROFESSIONAL_REVIEW'
  | 'TAXPAYER_REVIEW'
  | 'AUTHORIZATION_CONSENT'
  | 'RETURN_VERSION_REVIEW'
  | 'SIGNATURE_CONSENT'
  | 'READINESS_REVIEW'
  | 'FINAL_INTERNAL_APPROVAL'
  | 'READY_FOR_EXTERNAL_FILING';

export type TaxGuardWorkflowStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'REQUIRES_REVIEW'
  | 'COMPLETED'
  | 'SUPERSEDED';

export type TaxGuardWorkflowRisk =
  | 'routine'
  | 'material'
  | 'critical';

export type TaxGuardWorkflowRole =
  | 'TAXPAYER'
  | 'PREPARER'
  | 'REVIEWER'
  | 'CPA'
  | 'EA'
  | 'SEC_OPS'
  | 'ADMIN';

export interface TaxGuardWorkflowContext {
  clientId: string;
  engagementId: string;
  taxYear: number;
  correlationId: string;
  returnId: string;
}

export interface TaxGuardWorkflowStageRecord {
  stage:
    TaxGuardWorkflowStage;

  status:
    TaxGuardWorkflowStatus;

  context:
    TaxGuardWorkflowContext;

  completedBy?: string;

  completedByRole?:
    TaxGuardWorkflowRole;

  completedAt?: string;

  evidenceIds:
    readonly string[];

  provenanceDecisionIds:
    readonly string[];

  exceptionIds:
    readonly string[];

  notes:
    readonly string[];

  immutable: true;
}

export interface TaxGuardWorkflowTransition {
  transitionId: string;

  context:
    TaxGuardWorkflowContext;

  fromStage:
    TaxGuardWorkflowStage;

  toStage:
    TaxGuardWorkflowStage;

  actorId: string;

  actorRole:
    TaxGuardWorkflowRole;

  occurredAt: string;

  immutable: true;
}

export interface TaxGuardReturnWorkflowRecord {
  workflowId: string;

  context:
    TaxGuardWorkflowContext;

  currentStage:
    TaxGuardWorkflowStage;

  stages:
    readonly TaxGuardWorkflowStageRecord[];

  transitions:
    readonly TaxGuardWorkflowTransition[];

  createdAt: string;

  updatedAt: string;

  externalFilingEnabled:
    false;

  immutable: true;
}

export const TAXGUARD_WORKFLOW_SEQUENCE:
  readonly TaxGuardWorkflowStage[] =
    Object.freeze([
      'PREPARATION',
      'EXCEPTION_REVIEW',
      'PROFESSIONAL_REVIEW',
      'TAXPAYER_REVIEW',
      'AUTHORIZATION_CONSENT',
      'RETURN_VERSION_REVIEW',
      'SIGNATURE_CONSENT',
      'READINESS_REVIEW',
      'FINAL_INTERNAL_APPROVAL',
      'READY_FOR_EXTERNAL_FILING'
    ]);

function now(): string {
  return new Date()
    .toISOString();
}

function requireText(
  value: string,
  errorCode: string
): string {

  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      errorCode
    );
  }

  return normalized;
}

function unique(
  values: readonly string[]
): string[] {

  return [
    ...new Set(
      values
        .map(
          value =>
            value.trim()
        )
        .filter(Boolean)
    )
  ];
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

function cloneStage(
  stage:
    TaxGuardWorkflowStageRecord
):
  TaxGuardWorkflowStageRecord {

  return {
    ...stage,

    context:
      cloneContext(
        stage.context
      ),

    evidenceIds: [
      ...stage.evidenceIds
    ],

    provenanceDecisionIds: [
      ...stage.provenanceDecisionIds
    ],

    exceptionIds: [
      ...stage.exceptionIds
    ],

    notes: [
      ...stage.notes
    ]
  };
}

function cloneTransition(
  transition:
    TaxGuardWorkflowTransition
):
  TaxGuardWorkflowTransition {

  return {
    ...transition,

    context:
      cloneContext(
        transition.context
      )
  };
}

function cloneWorkflow(
  workflow:
    TaxGuardReturnWorkflowRecord
):
  TaxGuardReturnWorkflowRecord {

  return {
    ...workflow,

    context:
      cloneContext(
        workflow.context
      ),

    stages:
      workflow.stages.map(
        cloneStage
      ),

    transitions:
      workflow.transitions.map(
        cloneTransition
      )
  };
}

export class TaxGuardReturnWorkflowEngine {

  private readonly workflows =
    new Map<
      string,
      TaxGuardReturnWorkflowRecord
    >();

  create(
    input: {
      workflowId: string;
      context: TaxGuardWorkflowContext;
      createdBy: string;
      createdByRole: TaxGuardWorkflowRole;
    }
  ):
    TaxGuardReturnWorkflowRecord {

    requireText(
      input.workflowId,
      'TG_WORKFLOW_ID_REQUIRED'
    );

    requireText(
      input.context.clientId,
      'TG_WORKFLOW_CLIENT_REQUIRED'
    );

    requireText(
      input.context.engagementId,
      'TG_WORKFLOW_ENGAGEMENT_REQUIRED'
    );

    requireText(
      input.context.correlationId,
      'TG_WORKFLOW_CORRELATION_REQUIRED'
    );

    requireText(
      input.context.returnId,
      'TG_WORKFLOW_RETURN_REQUIRED'
    );

    requireText(
      input.createdBy,
      'TG_WORKFLOW_CREATOR_REQUIRED'
    );

    if (
      !Number.isInteger(
        input.context.taxYear
      ) ||
      input.context.taxYear < 1900 ||
      input.context.taxYear > 2200
    ) {
      throw new Error(
        'TG_WORKFLOW_INVALID_TAX_YEAR'
      );
    }

    if (
      this.workflows.has(
        input.workflowId
      )
    ) {
      throw new Error(
        'TG_WORKFLOW_DUPLICATE_ID'
      );
    }

    const createdAt =
      now();

    const stages:
      TaxGuardWorkflowStageRecord[] =
        TAXGUARD_WORKFLOW_SEQUENCE.map(
          stage =>
            Object.freeze({
              stage,

              status:
                stage ===
                  'PREPARATION'
                  ? 'IN_PROGRESS'
                  : 'NOT_STARTED',

              context:
                cloneContext(
                  input.context
                ),

              evidenceIds: [],

              provenanceDecisionIds: [],

              exceptionIds: [],

              notes:
                stage ===
                  'PREPARATION'
                  ? [
                      'Workflow initialized.'
                    ]
                  : [],

              immutable:
                true
            })
        );

    const workflow:
      TaxGuardReturnWorkflowRecord =
        Object.freeze({
          workflowId:
            input.workflowId,

          context:
            cloneContext(
              input.context
            ),

          currentStage:
            'PREPARATION',

          stages,

          transitions: [],

          createdAt,

          updatedAt:
            createdAt,

          externalFilingEnabled:
            false,

          immutable:
            true
        });

    this.workflows.set(
      input.workflowId,
      workflow
    );

    return cloneWorkflow(
      workflow
    );
  }

  get(
    workflowId: string
  ):
    TaxGuardReturnWorkflowRecord {

    const workflow =
      this.workflows.get(
        workflowId
      );

    if (!workflow) {
      throw new Error(
        'TG_WORKFLOW_NOT_FOUND'
      );
    }

    return cloneWorkflow(
      workflow
    );
  }

  list():
    readonly TaxGuardReturnWorkflowRecord[] {

    return [
      ...this.workflows.values()
    ].map(
      cloneWorkflow
    );
  }

  completeCurrentStage(
    workflowId: string,

    input: {
      actorId: string;

      actorRole:
        TaxGuardWorkflowRole;

      evidenceIds?: readonly string[];

      provenanceDecisionIds?:
        readonly string[];

      exceptionIds?:
        readonly string[];

      notes?: readonly string[];
    }
  ):
    TaxGuardReturnWorkflowRecord {

    requireText(
      input.actorId,
      'TG_WORKFLOW_ACTOR_REQUIRED'
    );

    const current =
      this.requireInternal(
        workflowId
      );

    if (
      current.currentStage ===
        'READY_FOR_EXTERNAL_FILING'
    ) {
      throw new Error(
        'TG_EXTERNAL_FILING_DISABLED'
      );
    }

    const currentIndex =
      TAXGUARD_WORKFLOW_SEQUENCE
        .indexOf(
          current.currentStage
        );

    if (
      currentIndex < 0
    ) {
      throw new Error(
        'TG_WORKFLOW_INVALID_CURRENT_STAGE'
      );
    }

    const nextStage =
      TAXGUARD_WORKFLOW_SEQUENCE[
        currentIndex + 1
      ];

    if (!nextStage) {
      throw new Error(
        'TG_EXTERNAL_FILING_DISABLED'
      );
    }

    const completedAt =
      now();

    const stages =
      current.stages.map(
        stage => {

          if (
            stage.stage ===
              current.currentStage
          ) {
            return Object.freeze({
              ...stage,

              status:
                'COMPLETED' as const,

              completedBy:
                input.actorId,

              completedByRole:
                input.actorRole,

              completedAt,

              evidenceIds:
                unique(
                  input.evidenceIds ??
                  stage.evidenceIds
                ),

              provenanceDecisionIds:
                unique(
                  input
                    .provenanceDecisionIds ??
                  stage
                    .provenanceDecisionIds
                ),

              exceptionIds:
                unique(
                  input.exceptionIds ??
                  stage.exceptionIds
                ),

              notes:
                unique([
                  ...stage.notes,
                  ...(
                    input.notes ??
                    []
                  )
                ])
            });
          }

          if (
            stage.stage ===
              nextStage
          ) {
            return Object.freeze({
              ...stage,

              status:
                'COMPLETED' as const
            });
          }

          return stage;
        }
      );

    const transition:
      TaxGuardWorkflowTransition =
        Object.freeze({
          transitionId:
            'TG-WF-TRANSITION-' +
            String(
              current.transitions
                .length + 1
            ).padStart(
              8,
              '0'
            ),

          context:
            cloneContext(
              current.context
            ),

          fromStage:
            current.currentStage,

          toStage:
            nextStage,

          actorId:
            input.actorId,

          actorRole:
            input.actorRole,

          occurredAt:
            completedAt,

          immutable:
            true
        });

    const updated:
      TaxGuardReturnWorkflowRecord =
        Object.freeze({
          ...current,

          currentStage:
            nextStage,

          stages,

          transitions: [
            ...current.transitions,
            transition
          ],

          updatedAt:
            completedAt
        });

    this.workflows.set(
      workflowId,
      updated
    );

    return cloneWorkflow(
      updated
    );
  }

  blockCurrentStage(
    workflowId: string,

    input: {
      actorId: string;
      reason: string;
      exceptionIds?: readonly string[];
    }
  ):
    TaxGuardReturnWorkflowRecord {

    requireText(
      input.actorId,
      'TG_WORKFLOW_ACTOR_REQUIRED'
    );

    requireText(
      input.reason,
      'TG_WORKFLOW_BLOCK_REASON_REQUIRED'
    );

    const current =
      this.requireInternal(
        workflowId
      );

    const stages =
      current.stages.map(
        stage =>
          stage.stage ===
            current.currentStage
            ? Object.freeze({
                ...stage,

                status:
                  'BLOCKED' as const,

                exceptionIds:
                  unique([
                    ...stage.exceptionIds,
                    ...(
                      input.exceptionIds ??
                      []
                    )
                  ]),

                notes:
                  unique([
                    ...stage.notes,
                    input.reason
                  ])
              })
            : stage
      );

    const updated:
      TaxGuardReturnWorkflowRecord =
        Object.freeze({
          ...current,

          stages,

          updatedAt:
            now()
        });

    this.workflows.set(
      workflowId,
      updated
    );

    return cloneWorkflow(
      updated
    );
  }

  reopenCurrentStage(
    workflowId: string,

    input: {
      actorId: string;
      actorRole: TaxGuardWorkflowRole;
      reason: string;
    }
  ):
    TaxGuardReturnWorkflowRecord {

    requireText(
      input.actorId,
      'TG_WORKFLOW_ACTOR_REQUIRED'
    );

    requireText(
      input.reason,
      'TG_WORKFLOW_REOPEN_REASON_REQUIRED'
    );

    const current =
      this.requireInternal(
        workflowId
      );

    const stages =
      current.stages.map(
        stage =>
          stage.stage ===
            current.currentStage
            ? Object.freeze({
                ...stage,

                status:
                  'COMPLETED' as const,

                notes:
                  unique([
                    ...stage.notes,
                    input.reason
                  ])
              })
            : stage
      );

    const updated:
      TaxGuardReturnWorkflowRecord =
        Object.freeze({
          ...current,

          stages,

          updatedAt:
            now()
        });

    this.workflows.set(
      workflowId,
      updated
    );

    return cloneWorkflow(
      updated
    );
  }

  currentStage(
    workflowId: string
  ):
    TaxGuardWorkflowStageRecord {

    const workflow =
      this.requireInternal(
        workflowId
      );

    const stage =
      workflow.stages.find(
        item =>
          item.stage ===
            workflow.currentStage
      );

    if (!stage) {
      throw new Error(
        'TG_WORKFLOW_STAGE_NOT_FOUND'
      );
    }

    return cloneStage(
      stage
    );
  }

  private requireInternal(
    workflowId: string
  ):
    TaxGuardReturnWorkflowRecord {

    const workflow =
      this.workflows.get(
        workflowId
      );

    if (!workflow) {
      throw new Error(
        'TG_WORKFLOW_NOT_FOUND'
      );
    }

    return workflow;
  }
}

export class TaxGuardExternalFilingGuard {

  static assertDisabled():
    never {

    throw new Error(
      'TG_EXTERNAL_FILING_DISABLED'
    );
  }

  static submit():
    never {

    throw new Error(
      'TG_EXTERNAL_FILING_DISABLED'
    );
  }
}
`
);


/////PREPARATION
////  ↓
/////EXCEPTION REVIEW
//   ↓
//PROFESSIONAL REVIEW
 //  ↓
//TAXPAYER REVIEW
  // ↓
//AUTHORIZATION / CONSENT
  // ↓
//RETURN VERSION REVIEW
 //  ↓
//SIGNATURE / CONSENT
  // ↓
//READINESS REVIEW
  // ↓
//FINAL INTERNAL APPROVAL
  // ↓
///READY FOR EXTERNAL FILING




write(
  'src/taxguard/workflow/TaxGuardWorkflowControls.ts',
  String.raw`
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
`
);


///////////// M11 Part 3 of 4 — Exception, Provenance,
///////////// Professional Review & Final Approval Gates

write(
  'src/taxguard/workflow/TaxGuardWorkflowGovernance.ts',
  String.raw`
import type {
  TaxGuardReturnWorkflowRecord,
  TaxGuardWorkflowContext,
  TaxGuardWorkflowRole
} from './TaxGuardReturnWorkflow';

import {
  TaxGuardReturnWorkflowEngine
} from './TaxGuardReturnWorkflow';

import {
  TaxGuardWorkflowReadinessGuard
} from './TaxGuardWorkflowControls';

export interface TaxGuardExceptionGateInput {
  unresolvedExceptionIds:
    readonly string[];
}

export interface TaxGuardProfessionalReviewApproval {
  approvalId: string;

  context:
    TaxGuardWorkflowContext;

  returnVersionId: string;

  requestedBy: string;

  approvedBy: string;

  approvedByRole:
    | 'REVIEWER'
    | 'CPA'
    | 'EA';

  provenanceDecisionId: string;

  approvedAt: string;

  immutable: true;
}

export interface TaxGuardFinalInternalApproval {
  approvalId: string;

  context:
    TaxGuardWorkflowContext;

  returnVersionId: string;

  professionalApprovalId: string;

  provenanceDecisionId: string;

  approvedBy: string;

  approvedByRole:
    | 'REVIEWER'
    | 'CPA'
    | 'EA';

  approvedAt: string;

  externalSubmissionAuthorized:
    false;

  immutable: true;
}

export interface TaxGuardWorkflowGovernanceResult {
  allowed: boolean;

  reasons:
    readonly string[];
}

function requireText(
  value: string,
  errorCode: string
): string {

  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      errorCode
    );
  }

  return normalized;
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

export class TaxGuardExceptionWorkflowGate {

  static evaluate(
    input:
      TaxGuardExceptionGateInput
  ):
    TaxGuardWorkflowGovernanceResult {

    if (
      input.unresolvedExceptionIds
        .length > 0
    ) {
      return {
        allowed:
          false,

        reasons: [
          'UNRESOLVED_EXCEPTIONS'
        ]
      };
    }

    return {
      allowed:
        true,

      reasons: []
    };
  }

  static assertClear(
    input:
      TaxGuardExceptionGateInput
  ):
    true {

    const result =
      this.evaluate(
        input
      );

    if (!result.allowed) {
      throw new Error(
        'TG_WORKFLOW_EXCEPTION_GATE_BLOCKED:' +
        result.reasons.join(',')
      );
    }

    return true;
  }
}

export class TaxGuardProfessionalReviewRegistry {

  private readonly approvals =
    new Map<
      string,
      TaxGuardProfessionalReviewApproval
    >();

  approve(
    input: {
      approvalId: string;

      context:
        TaxGuardWorkflowContext;

      returnVersionId: string;

      requestedBy: string;

      approvedBy: string;

      approvedByRole:
        | 'REVIEWER'
        | 'CPA'
        | 'EA';

      provenanceDecisionId: string;
    }
  ):
    TaxGuardProfessionalReviewApproval {

    requireText(
      input.approvalId,
      'TG_PROFESSIONAL_APPROVAL_ID_REQUIRED'
    );

    requireText(
      input.returnVersionId,
      'TG_PROFESSIONAL_RETURN_VERSION_REQUIRED'
    );

    requireText(
      input.requestedBy,
      'TG_PROFESSIONAL_REQUESTER_REQUIRED'
    );

    requireText(
      input.approvedBy,
      'TG_PROFESSIONAL_APPROVER_REQUIRED'
    );

    requireText(
      input.provenanceDecisionId,
      'TG_PROFESSIONAL_PROVENANCE_REQUIRED'
    );

    if (
      input.requestedBy ===
        input.approvedBy
    ) {
      throw new Error(
        'TG_PROFESSIONAL_MAKER_CHECKER_REQUIRED'
      );
    }

    if (
      this.approvals.has(
        input.approvalId
      )
    ) {
      throw new Error(
        'TG_PROFESSIONAL_APPROVAL_DUPLICATE'
      );
    }

    const approval:
      TaxGuardProfessionalReviewApproval =
        Object.freeze({
          approvalId:
            input.approvalId,

          context:
            cloneContext(
              input.context
            ),

          returnVersionId:
            input.returnVersionId,

          requestedBy:
            input.requestedBy,

          approvedBy:
            input.approvedBy,

          approvedByRole:
            input.approvedByRole,

          provenanceDecisionId:
            input.provenanceDecisionId,

          approvedAt:
            new Date()
              .toISOString(),

          immutable:
            true
        });

    this.approvals.set(
      approval.approvalId,
      approval
    );

    return {
      ...approval,

      context: {
        ...approval.context
      }
    };
  }

  get(
    approvalId: string
  ):
    TaxGuardProfessionalReviewApproval {

    const approval =
      this.approvals.get(
        approvalId
      );

    if (!approval) {
      throw new Error(
        'TG_PROFESSIONAL_APPROVAL_NOT_FOUND'
      );
    }

    return {
      ...approval,

      context: {
        ...approval.context
      }
    };
  }

  approvedForVersion(
    context:
      TaxGuardWorkflowContext,

    returnVersionId: string
  ):
    boolean {

    return [
      ...this.approvals.values()
    ].some(
      approval =>
        sameContext(
          approval.context,
          context
        ) &&
        approval.returnVersionId ===
          returnVersionId
    );
  }
}

export class TaxGuardFinalInternalApprovalRegistry {

  private readonly approvals =
    new Map<
      string,
      TaxGuardFinalInternalApproval
    >();

  approve(
    input: {
      approvalId: string;

      context:
        TaxGuardWorkflowContext;

      returnVersionId: string;

      professionalApproval:
        TaxGuardProfessionalReviewApproval;

      provenanceDecisionId: string;

      approvedBy: string;

      approvedByRole:
        | 'REVIEWER'
        | 'CPA'
        | 'EA';
    }
  ):
    TaxGuardFinalInternalApproval {

    requireText(
      input.approvalId,
      'TG_FINAL_APPROVAL_ID_REQUIRED'
    );

    requireText(
      input.returnVersionId,
      'TG_FINAL_RETURN_VERSION_REQUIRED'
    );

    requireText(
      input.provenanceDecisionId,
      'TG_FINAL_PROVENANCE_REQUIRED'
    );

    requireText(
      input.approvedBy,
      'TG_FINAL_APPROVER_REQUIRED'
    );

    if (
      this.approvals.has(
        input.approvalId
      )
    ) {
      throw new Error(
        'TG_FINAL_APPROVAL_DUPLICATE'
      );
    }

    if (
      !sameContext(
        input.context,
        input.professionalApproval
          .context
      )
    ) {
      throw new Error(
        'TG_FINAL_APPROVAL_CONTEXT_MISMATCH'
      );
    }

    if (
      input.professionalApproval
        .returnVersionId !==
      input.returnVersionId
    ) {
      throw new Error(
        'TG_FINAL_APPROVAL_VERSION_MISMATCH'
      );
    }

    if (
      input.professionalApproval
        .approvedBy ===
      input.approvedBy
    ) {
      throw new Error(
        'TG_FINAL_APPROVAL_MAKER_CHECKER_REQUIRED'
      );
    }

    const approval:
      TaxGuardFinalInternalApproval =
        Object.freeze({
          approvalId:
            input.approvalId,

          context:
            cloneContext(
              input.context
            ),

          returnVersionId:
            input.returnVersionId,

          professionalApprovalId:
            input.professionalApproval
              .approvalId,

          provenanceDecisionId:
            input.provenanceDecisionId,

          approvedBy:
            input.approvedBy,

          approvedByRole:
            input.approvedByRole,

          approvedAt:
            new Date()
              .toISOString(),

          externalSubmissionAuthorized:
            false,

          immutable:
            true
        });

    this.approvals.set(
      approval.approvalId,
      approval
    );

    return {
      ...approval,

      context: {
        ...approval.context
      }
    };
  }

  get(
    approvalId: string
  ):
    TaxGuardFinalInternalApproval {

    const approval =
      this.approvals.get(
        approvalId
      );

    if (!approval) {
      throw new Error(
        'TG_FINAL_APPROVAL_NOT_FOUND'
      );
    }

    return {
      ...approval,

      context: {
        ...approval.context
      }
    };
  }
}

export class TaxGuardFinalWorkflowGate {

  static evaluate(
    input: {
      workflow:
        TaxGuardReturnWorkflowRecord;

      returnVersionId: string;

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

      professionalApproval?:
        TaxGuardProfessionalReviewApproval;
    }
  ):
    TaxGuardWorkflowGovernanceResult {

    const reasons:
      string[] = [];

    const readiness =
      TaxGuardWorkflowReadinessGuard
        .evaluate({
          workflow:
            input.workflow,

          latestVersion: {
            versionId:
              input.returnVersionId,

            context:
              input.workflow.context,

            versionNumber:
              1,

            contentHash:
              'workflow-gate',

            preparedReturnId:
              input.workflow.context
                .returnId,

            createdBy:
              'WORKFLOW_GATE',

            createdAt:
              input.workflow.updatedAt,

            locked:
              true,

            immutable:
              true
          },

          taxpayerReviewAccepted:
            input.taxpayerReviewAccepted,

          filingAuthorizationGranted:
            input.filingAuthorizationGranted,

          signatureConsentGranted:
            input.signatureConsentGranted,

          signatureExists:
            input.signatureExists,

          unresolvedExceptionIds:
            input.unresolvedExceptionIds,

          provenanceApproved:
            input.provenanceApproved,

          professionalReviewApproved:
            input.professionalReviewApproved
        });

    reasons.push(
      ...readiness.reasons
    );

    if (
      input.workflow.currentStage !==
        'FINAL_INTERNAL_APPROVAL'
    ) {
      reasons.push(
        'FINAL_INTERNAL_APPROVAL_STAGE_REQUIRED'
      );
    }

    if (
      !input.professionalApproval
    ) {
      reasons.push(
        'PROFESSIONAL_APPROVAL_RECORD_REQUIRED'
      );
    } else {

      if (
        !sameContext(
          input.workflow.context,
          input.professionalApproval
            .context
        )
      ) {
        reasons.push(
          'PROFESSIONAL_APPROVAL_CONTEXT_MISMATCH'
        );
      }

      if (
        input.professionalApproval
          .returnVersionId !==
        input.returnVersionId
      ) {
        reasons.push(
          'PROFESSIONAL_APPROVAL_VERSION_MISMATCH'
        );
      }
    }

    return {
      allowed:
        reasons.length === 0,

      reasons: [
        ...new Set(
          reasons
        )
      ]
    };
  }

  static assertAllowed(
    input: Parameters<
      typeof TaxGuardFinalWorkflowGate.evaluate
    >[0]
  ):
    true {

    const result =
      this.evaluate(
        input
      );

    if (!result.allowed) {
      throw new Error(
        'TG_FINAL_WORKFLOW_GATE_BLOCKED:' +
        result.reasons.join(',')
      );
    }

    return true;
  }
}

export class TaxGuardWorkflowCompletionService {

  constructor(
    private readonly workflows:
      TaxGuardReturnWorkflowEngine
  ) {}

  completeFinalInternalApproval(
    workflowId: string,

    input: {
      actorId: string;

      actorRole:
        | 'REVIEWER'
        | 'CPA'
        | 'EA';

      returnVersionId: string;

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

      professionalApproval:
        TaxGuardProfessionalReviewApproval;

      provenanceDecisionId: string;
    }
  ):
    TaxGuardReturnWorkflowRecord {

    const workflow =
      this.workflows.get(
        workflowId
      );

    TaxGuardFinalWorkflowGate
      .assertAllowed({
        workflow,

        returnVersionId:
          input.returnVersionId,

        taxpayerReviewAccepted:
          input.taxpayerReviewAccepted,

        filingAuthorizationGranted:
          input.filingAuthorizationGranted,

        signatureConsentGranted:
          input.signatureConsentGranted,

        signatureExists:
          input.signatureExists,

        unresolvedExceptionIds:
          input.unresolvedExceptionIds,

        provenanceApproved:
          input.provenanceApproved,

        professionalReviewApproved:
          input.professionalReviewApproved,

        professionalApproval:
          input.professionalApproval
      });

    return this.workflows
      .completeCurrentStage(
        workflowId,
        {
          actorId:
            input.actorId,

          actorRole:
            input.actorRole,

          provenanceDecisionIds: [
            input.provenanceDecisionId
          ],

          notes: [
            'Final internal approval completed. External filing remains disabled.'
          ]
        }
      );
  }
}

export class TaxGuardAiWorkflowBoundary {

  static assertHumanApproval(
    actorId: string,
    actorRole: TaxGuardWorkflowRole
  ):
    true {

    requireText(
      actorId,
      'TG_AI_BOUNDARY_ACTOR_REQUIRED'
    );

    if (
      ![
        'PREPARER',
        'REVIEWER',
        'CPA',
        'EA',
        'SEC_OPS',
        'ADMIN',
        'TAXPAYER'
      ].includes(
        actorRole
      )
    ) {
      throw new Error(
        'TG_AI_FINAL_APPROVAL_BLOCKED'
      );
    }

    return true;
  }

  static approveMaterialTaxDecision():
    never {

    throw new Error(
      'TG_AI_FINAL_APPROVAL_BLOCKED'
    );
  }
}
`
);

write(
  'src/taxguard/workflow/index.ts',
  String.raw`
export * from './TaxGuardReturnWorkflow';
export * from './TaxGuardWorkflowControls';
export * from './TaxGuardWorkflowGovernance';
`
);

/////// M11 Part 4 of 4 — Regression Tests + Builder Completion

write(
  'src/tests/taxGuardRemainingWorkflow.test.ts',
  String.raw`
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxGuardExternalFilingGuard,
  TaxGuardReturnWorkflowEngine
} from '../taxguard/workflow/TaxGuardReturnWorkflow';

import {
  TaxGuardConsentRegistry,
  TaxGuardControlledWorkflowService,
  TaxGuardReturnVersionRegistry,
  TaxGuardSignatureRegistry,
  TaxGuardTaxpayerReviewRegistry,
  TaxGuardWorkflowReadinessGuard
} from '../taxguard/workflow/TaxGuardWorkflowControls';

import {
  TaxGuardAiWorkflowBoundary,
  TaxGuardExceptionWorkflowGate,
  TaxGuardFinalInternalApprovalRegistry,
  TaxGuardFinalWorkflowGate,
  TaxGuardProfessionalReviewRegistry
} from '../taxguard/workflow/TaxGuardWorkflowGovernance';

function context() {
  return {
    clientId:
      'CLIENT-M11-001',

    engagementId:
      'ENGAGEMENT-M11-001',

    taxYear:
      2025,

    correlationId:
      'CORRELATION-M11-001',

    returnId:
      'RETURN-M11-001'
  };
}

function createWorkflow() {

  const workflows =
    new TaxGuardReturnWorkflowEngine();

  const workflow =
    workflows.create({
      workflowId:
        'WORKFLOW-M11-001',

      context:
        context(),

      createdBy:
        'PREPARER-A',

      createdByRole:
        'PREPARER'
    });

  return {
    workflows,
    workflow
  };
}

function advanceToFinalInternalApproval(
  workflows:
    TaxGuardReturnWorkflowEngine
) {

  const controlled =
    new TaxGuardControlledWorkflowService(
      workflows
    );

  const steps = [
    {
      stage:
        'PREPARATION' as const,

      role:
        'PREPARER' as const
    },
    {
      stage:
        'EXCEPTION_REVIEW' as const,

      role:
        'REVIEWER' as const
    },
    {
      stage:
        'PROFESSIONAL_REVIEW' as const,

      role:
        'CPA' as const
    },
    {
      stage:
        'TAXPAYER_REVIEW' as const,

      role:
        'TAXPAYER' as const
    },
    {
      stage:
        'AUTHORIZATION_CONSENT' as const,

      role:
        'TAXPAYER' as const
    },
    {
      stage:
        'RETURN_VERSION_REVIEW' as const,

      role:
        'REVIEWER' as const
    },
    {
      stage:
        'SIGNATURE_CONSENT' as const,

      role:
        'TAXPAYER' as const
    },
    {
      stage:
        'READINESS_REVIEW' as const,

      role:
        'REVIEWER' as const
    }
  ];

  for (
    const [
      index,
      step
    ] of steps.entries()
  ) {
    controlled.advance(
      'WORKFLOW-M11-001',
      {
        expectedStage:
          step.stage,

        actorId:
          'ACTOR-' +
          String(index + 1),

        actorRole:
          step.role,

        allowedRoles: [
          step.role
        ],

        evidenceIds: [
          'EVIDENCE-' +
          String(index + 1)
        ],

        provenanceDecisionIds: [
          'PROVENANCE-' +
          String(index + 1)
        ]
      }
    );
  }

  return workflows.get(
    'WORKFLOW-M11-001'
  );
}

describe(
  'TaxGuard M11 Remaining Tax Workflow',
  () => {

    it(
      'M11.1 creates workflow at preparation stage',
      () => {

        const {
          workflow
        } =
          createWorkflow();

        expect(
          workflow.currentStage
        ).toBe(
          'PREPARATION'
        );

        expect(
          workflow.externalFilingEnabled
        ).toBe(false);
      }
    );

    it(
      'M11.2 advances workflow sequentially',
      () => {

        const {
          workflows
        } =
          createWorkflow();

        const controlled =
          new TaxGuardControlledWorkflowService(
            workflows
          );

        const updated =
          controlled.advance(
            'WORKFLOW-M11-001',
            {
              expectedStage:
                'PREPARATION',

              actorId:
                'PREPARER-A',

              actorRole:
                'PREPARER',

              allowedRoles: [
                'PREPARER'
              ]
            }
          );

        expect(
          updated.currentStage
        ).toBe(
          'EXCEPTION_REVIEW'
        );
      }
    );

    it(
      'M11.3 blocks unauthorized workflow role',
      () => {

        const {
          workflows
        } =
          createWorkflow();

        const controlled =
          new TaxGuardControlledWorkflowService(
            workflows
          );

        expect(
          () =>
            controlled.advance(
              'WORKFLOW-M11-001',
              {
                expectedStage:
                  'PREPARATION',

                actorId:
                  'TAXPAYER-A',

                actorRole:
                  'TAXPAYER',

                allowedRoles: [
                  'PREPARER'
                ]
              }
            )
        ).toThrow(
          'TG_WORKFLOW_ROLE_NOT_AUTHORIZED'
        );
      }
    );

    it(
      'M11.4 blocks unresolved exceptions',
      () => {

        expect(
          () =>
            TaxGuardExceptionWorkflowGate
              .assertClear({
                unresolvedExceptionIds: [
                  'EXCEPTION-1'
                ]
              })
        ).toThrow(
          'TG_WORKFLOW_EXCEPTION_GATE_BLOCKED'
        );
      }
    );

    it(
      'M11.5 records immutable return version',
      () => {

        const versions =
          new TaxGuardReturnVersionRegistry();

        const version =
          versions.create({
            versionId:
              'VERSION-1',

            context:
              context(),

            versionNumber:
              1,

            contentHash:
              'sha256-return-v1',

            preparedReturnId:
              'PREPARED-RETURN-1',

            createdBy:
              'PREPARER-A'
          });

        expect(
          version.locked
        ).toBe(true);

        expect(
          version.immutable
        ).toBe(true);
      }
    );

    it(
      'M11.6 records taxpayer acceptance for exact return version',
      () => {

        const reviews =
          new TaxGuardTaxpayerReviewRegistry();

        reviews.record({
          reviewId:
            'REVIEW-1',

          context:
            context(),

          returnVersionId:
            'VERSION-1',

          taxpayerId:
            'TAXPAYER-1',

          status:
            'ACCEPTED'
        });

        expect(
          reviews.acceptedForVersion(
            context(),
            'VERSION-1'
          )
        ).toBe(true);

        expect(
          reviews.acceptedForVersion(
            context(),
            'VERSION-2'
          )
        ).toBe(false);
      }
    );

    it(
      'M11.7 records explicit filing authorization consent',
      () => {

        const consents =
          new TaxGuardConsentRegistry();

        consents.record({
          consentId:
            'CONSENT-1',

          context:
            context(),

          consentType:
            'FILING_AUTHORIZATION',

          status:
            'GRANTED',

          taxpayerId:
            'TAXPAYER-1',

          returnVersionId:
            'VERSION-1',

          recordedBy:
            'TAXPAYER-1'
        });

        expect(
          consents.hasGrantedConsent(
            context(),
            'FILING_AUTHORIZATION',
            'VERSION-1'
          )
        ).toBe(true);
      }
    );

    it(
      'M11.8 binds signature to return version and consent',
      () => {

        const signatures =
          new TaxGuardSignatureRegistry();

        signatures.record({
          signatureId:
            'SIGNATURE-1',

          context:
            context(),

          taxpayerId:
            'TAXPAYER-1',

          returnVersionId:
            'VERSION-1',

          consentId:
            'CONSENT-SIGN-1',

          signatureMethod:
            'ELECTRONIC',

          recordedBy:
            'TAXPAYER-1'
        });

        expect(
          signatures.existsForVersion(
            context(),
            'VERSION-1'
          )
        ).toBe(true);
      }
    );

    it(
      'M11.9 enforces maker-checker professional review',
      () => {

        const approvals =
          new TaxGuardProfessionalReviewRegistry();

        expect(
          () =>
            approvals.approve({
              approvalId:
                'PROF-1',

              context:
                context(),

              returnVersionId:
                'VERSION-1',

              requestedBy:
                'CPA-A',

              approvedBy:
                'CPA-A',

              approvedByRole:
                'CPA',

              provenanceDecisionId:
                'DECISION-1'
            })
        ).toThrow(
          'TG_PROFESSIONAL_MAKER_CHECKER_REQUIRED'
        );
      }
    );

    it(
      'M11.10 records independent professional approval',
      () => {

        const approvals =
          new TaxGuardProfessionalReviewRegistry();

        const approval =
          approvals.approve({
            approvalId:
              'PROF-2',

            context:
              context(),

            returnVersionId:
              'VERSION-1',

            requestedBy:
              'PREPARER-A',

            approvedBy:
              'EA-B',

            approvedByRole:
              'EA',

            provenanceDecisionId:
              'DECISION-1'
          });

        expect(
          approval.approvedBy
        ).toBe(
          'EA-B'
        );

        expect(
          approval.immutable
        ).toBe(true);
      }
    );

    it(
      'M11.11 fails readiness when required controls are missing',
      () => {

        const {
          workflow
        } =
          createWorkflow();

        const result =
          TaxGuardWorkflowReadinessGuard
            .evaluate({
              workflow,

              latestVersion: {
                versionId:
                  'VERSION-1',

                context:
                  context(),

                versionNumber:
                  1,

                contentHash:
                  'hash',

                preparedReturnId:
                  'PREPARED-1',

                createdBy:
                  'PREPARER-A',

                createdAt:
                  new Date()
                    .toISOString(),

                locked:
                  true,

                immutable:
                  true
              },

              taxpayerReviewAccepted:
                false,

              filingAuthorizationGranted:
                false,

              signatureConsentGranted:
                false,

              signatureExists:
                false,

              unresolvedExceptionIds: [
                'EXCEPTION-1'
              ],

              provenanceApproved:
                false,

              professionalReviewApproved:
                false
            });

        expect(
          result.ready
        ).toBe(false);

        expect(
          result.reasons
        ).toContain(
          'TAXPAYER_REVIEW_REQUIRED'
        );

        expect(
          result.reasons
        ).toContain(
          'UNRESOLVED_EXCEPTIONS'
        );
      }
    );

    it(
      'M11.12 permits readiness when all required controls pass',
      () => {

        const {
          workflow
        } =
          createWorkflow();

        const result =
          TaxGuardWorkflowReadinessGuard
            .evaluate({
              workflow,

              latestVersion: {
                versionId:
                  'VERSION-1',

                context:
                  context(),

                versionNumber:
                  1,

                contentHash:
                  'hash',

                preparedReturnId:
                  'PREPARED-1',

                createdBy:
                  'PREPARER-A',

                createdAt:
                  new Date()
                    .toISOString(),

                locked:
                  true,

                immutable:
                  true
              },

              taxpayerReviewAccepted:
                true,

              filingAuthorizationGranted:
                true,

              signatureConsentGranted:
                true,

              signatureExists:
                true,

              unresolvedExceptionIds: [],

              provenanceApproved:
                true,

              professionalReviewApproved:
                true
            });

        expect(
          result.ready
        ).toBe(true);
      }
    );

    it(
      'M11.13 requires final internal approval stage',
      () => {

        const {
          workflows
        } =
          createWorkflow();

        const workflow =
          advanceToFinalInternalApproval(
            workflows
          );

        expect(
          workflow.currentStage
        ).toBe(
          'FINAL_INTERNAL_APPROVAL'
        );

        const approvals =
          new TaxGuardProfessionalReviewRegistry();

        const approval =
          approvals.approve({
            approvalId:
              'PROF-FINAL',

            context:
              context(),

            returnVersionId:
              'VERSION-1',

            requestedBy:
              'PREPARER-A',

            approvedBy:
              'CPA-B',

            approvedByRole:
              'CPA',

            provenanceDecisionId:
              'DECISION-FINAL'
          });

        const result =
          TaxGuardFinalWorkflowGate
            .evaluate({
              workflow,

              returnVersionId:
                'VERSION-1',

              taxpayerReviewAccepted:
                true,

              filingAuthorizationGranted:
                true,

              signatureConsentGranted:
                true,

              signatureExists:
                true,

              unresolvedExceptionIds: [],

              provenanceApproved:
                true,

              professionalReviewApproved:
                true,

              professionalApproval:
                approval
            });

        expect(
          result.allowed
        ).toBe(true);
      }
    );

    it(
      'M11.14 enforces maker-checker final internal approval',
      () => {

        const professional =
          new TaxGuardProfessionalReviewRegistry();

        const professionalApproval =
          professional.approve({
            approvalId:
              'PROF-MAKER',

            context:
              context(),

            returnVersionId:
              'VERSION-1',

            requestedBy:
              'PREPARER-A',

            approvedBy:
              'CPA-B',

            approvedByRole:
              'CPA',

            provenanceDecisionId:
              'DECISION-1'
          });

        const finalApprovals =
          new TaxGuardFinalInternalApprovalRegistry();

        expect(
          () =>
            finalApprovals.approve({
              approvalId:
                'FINAL-1',

              context:
                context(),

              returnVersionId:
                'VERSION-1',

              professionalApproval,

              provenanceDecisionId:
                'DECISION-2',

              approvedBy:
                'CPA-B',

              approvedByRole:
                'CPA'
            })
        ).toThrow(
          'TG_FINAL_APPROVAL_MAKER_CHECKER_REQUIRED'
        );
      }
    );

    it(
      'M11.15 blocks AI final approval',
      () => {

        expect(
          () =>
            TaxGuardAiWorkflowBoundary
              .approveMaterialTaxDecision()
        ).toThrow(
          'TG_AI_FINAL_APPROVAL_BLOCKED'
        );
      }
    );

    it(
      'M11.16 keeps external tax filing disabled',
      () => {

        expect(
          () =>
            TaxGuardExternalFilingGuard
              .submit()
        ).toThrow(
          'TG_EXTERNAL_FILING_DISABLED'
        );
      }
    );
  }
);
`
);

console.log('');
console.log(
  '============================================================'
);

console.log(
  'TaxGuard M11 Remaining Tax Workflow generated successfully.'
);

console.log(
  '============================================================'
);

console.log('Created:');

console.log(
  'src/taxguard/workflow/TaxGuardReturnWorkflow.ts'
);

console.log(
  'src/taxguard/workflow/TaxGuardWorkflowControls.ts'
);

console.log(
  'src/taxguard/workflow/TaxGuardWorkflowGovernance.ts'
);

console.log(
  'src/taxguard/workflow/index.ts'
);

console.log(
  'src/tests/taxGuardRemainingWorkflow.test.ts'
);

console.log('');

console.log(
  'M1-M10 source was not modified.'
);

console.log(
  'External tax filing remains DISABLED.'
);







