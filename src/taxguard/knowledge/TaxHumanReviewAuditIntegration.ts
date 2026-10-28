import {
  HumanReviewBridge
} from '../intelligence/review/HumanReviewBridge';

import {
  DecisionTraceLedger
} from '../intelligence/trace/DecisionTraceLedger';

import {
  StageThreeValidationService
} from '../../services/stageThreeValidationService';

import type {
  EvidencePackage
} from '../intelligence/types';

/**
 * M6.8 — Human Review + Audit Integration
 *
 * IMPORTANT:
 *
 * This class DOES NOT create a new approval authority.
 *
 * StageThreeValidationService remains the authoritative
 * human-review / professional-certification boundary.
 *
 * HumanReviewBridge remains the authoritative bridge
 * into the Stage 03 review queue.
 *
 * DecisionTraceLedger remains the append-only
 * intelligence decision trace.
 *
 * AI remains proposal-only.
 */

export interface TaxHumanReviewRoutingInput {
  evidencePackage: EvidencePackage;

  actorId: string;

  actorRole: string;

  assignedRole?:
    Parameters<
      typeof HumanReviewBridge.submit
    >[0]['assignedRole'];

  assignedReviewer?: string;

  auditReferences?: string[];

  severity?:
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'CRITICAL';

  riskLevel?:
    | 'routine'
    | 'material'
    | 'critical';

  itemType?: string;

  summary?: string;

  traceId?: string;
}

export interface TaxHumanReviewRoutingResult {
  queueItemId: string;

  evidencePackageId: string;

  traceId: string;

  requiresHumanReview: true;

  hasDecisionAuthority: false;
}

export interface TaxAuthorizedDecisionTraceInput {
  traceId: string;

  clientId: string;

  engagementId: string;

  taxYear: number;

  actorId: string;

  actorRole: string;

  summary: string;

  correlationId: string;

  evidencePackageIds: string[];

  knowledgeSourceIds?: string[];

  ruleEvaluationIds?: string[];
}

function required(
  value: string,
  code: string
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(code);
  }

  return normalized;
}

function rejectAIActor(
  actorId: string,
  actorRole: string
): void {
  const identity =
    actorId.trim().toLowerCase();

  const role =
    actorRole.trim().toLowerCase();

  if (
    identity.includes('ai') ||
    identity.includes('model') ||
    identity.includes('gemini') ||
    identity.includes('openai') ||
    role === 'ai' ||
    role === 'ai_model' ||
    role === 'model'
  ) {
    throw new Error(
      'M6_8_AI_CANNOT_ACT_AS_HUMAN_REVIEWER'
    );
  }
}

function buildTraceId(
  evidencePackageId: string
): string {
  return (
    'M6-8-HR-' +
    evidencePackageId
      .trim()
      .replace(
        /[^A-Za-z0-9_-]/g,
        '-'
      )
  );
}

export class TaxHumanReviewAuditIntegration {

  /**
   * Routes an existing EvidencePackage into the
   * authoritative Stage 03 human-review queue and
   * appends a non-authoritative trace record.
   */
  static routeToHumanReview(
    input: TaxHumanReviewRoutingInput
  ): TaxHumanReviewRoutingResult {

    const actorId =
      required(
        input.actorId,
        'M6_8_ACTOR_ID_REQUIRED'
      );

    const actorRole =
      required(
        input.actorRole,
        'M6_8_ACTOR_ROLE_REQUIRED'
      );

    rejectAIActor(
      actorId,
      actorRole
    );

    const evidencePackage =
      input.evidencePackage;

    if (!evidencePackage) {
      throw new Error(
        'M6_8_EVIDENCE_PACKAGE_REQUIRED'
      );
    }

    if (
      evidencePackage
        .requiresHumanReview !== true
    ) {
      throw new Error(
        'M6_8_HUMAN_REVIEW_NOT_REQUIRED'
      );
    }

    const submitted =
      HumanReviewBridge.submit({
        evidencePackage,

        assignedRole:
          input.assignedRole,

        assignedReviewer:
          input.assignedReviewer,

        auditReferences:
          input.auditReferences,

        severity:
          input.severity,

        riskLevel:
          input.riskLevel,

        itemType:
          input.itemType as any
      });

    const traceId =
      input.traceId?.trim() ||
      buildTraceId(
        evidencePackage
          .evidencePackageId
      );

    DecisionTraceLedger.append({
      traceId,

      clientId:
        evidencePackage.clientId,

      engagementId:
        evidencePackage.engagementId,

      taxYear:
        evidencePackage.taxYear,

      stage:
        'HUMAN_REVIEW',

      actorId,
      actorRole,

      summary:
        input.summary?.trim() ||
        'Evidence package routed to authoritative human review.',

      knowledgeSourceIds:
        [
          ...evidencePackage
            .knowledgeSourceIds
        ],

      ruleEvaluationIds:
        [
          ...evidencePackage
            .ruleEvaluationIds
        ],

      evidencePackageIds:
        [
          evidencePackage
            .evidencePackageId
        ],

      correlationId:
        evidencePackage
          .correlationId,

      createdAt:
        new Date()
          .toISOString()
    });

    return {
      queueItemId:
        submitted.queueItemId,

      evidencePackageId:
        evidencePackage
          .evidencePackageId,

      traceId,

      requiresHumanReview:
        true,

      hasDecisionAuthority:
        false
    };
  }

  /**
   * Records a Stage 03 human disposition through
   * StageThreeValidationService.
   *
   * This wrapper intentionally delegates authority
   * rather than implementing approval itself.
   */
  static recordReviewDisposition(
    input:
      Parameters<
        typeof StageThreeValidationService
          .recordReviewDisposition
      >[0]
  ) {
    rejectAIActor(
      String(input.actor ?? ''),
      String(input.actorRole ?? '')
    );

    return StageThreeValidationService
      .recordReviewDisposition(
        input
      );
  }

  /**
   * Professional certification remains owned by
   * StageThreeValidationService.
   *
   * Its existing role authorization and
   * maker-checker controls therefore remain intact.
   */
  static certifyProfessionalReview(
    input:
      Parameters<
        typeof StageThreeValidationService
          .certifyValidation
      >[0]
  ) {
    rejectAIActor(
      String(input.reviewerId ?? ''),
      String(input.reviewerRole ?? '')
    );

    return StageThreeValidationService
      .certifyValidation(
        input
      );
  }

  /**
   * Reopening also remains inside the existing
   * authoritative Stage 03 workflow.
   */
  static reopenHumanReview(
    input:
      Parameters<
        typeof StageThreeValidationService
          .reopenReviewItem
      >[0]
  ) {
    rejectAIActor(
      String(input.reopenedBy ?? ''),
      String(input.reopenedByRole ?? '')
    );

    return StageThreeValidationService
      .reopenReviewItem(
        input
      );
  }

  /**
   * Adds a trace AFTER an authorized human decision.
   *
   * The ledger itself does not grant authority.
   */
  static appendAuthorizedDecisionTrace(
    input: TaxAuthorizedDecisionTraceInput
  ) {
    const actorId =
      required(
        input.actorId,
        'M6_8_DECISION_ACTOR_REQUIRED'
      );

    const actorRole =
      required(
        input.actorRole,
        'M6_8_DECISION_ROLE_REQUIRED'
      );

    const summary =
      required(
        input.summary,
        'M6_8_DECISION_SUMMARY_REQUIRED'
      );

    rejectAIActor(
      actorId,
      actorRole
    );

    if (
      input.evidencePackageIds
        .length === 0
    ) {
      throw new Error(
        'M6_8_DECISION_EVIDENCE_REQUIRED'
      );
    }

    return DecisionTraceLedger.append({
      traceId:
        required(
          input.traceId,
          'M6_8_TRACE_ID_REQUIRED'
        ),

      clientId:
        required(
          input.clientId,
          'M6_8_CLIENT_ID_REQUIRED'
        ),

      engagementId:
        required(
          input.engagementId,
          'M6_8_ENGAGEMENT_ID_REQUIRED'
        ),

      taxYear:
        input.taxYear,

      stage:
        'AUTHORIZED_DECISION',

      actorId,
      actorRole,

      summary,

      knowledgeSourceIds:
        [
          ...(input
            .knowledgeSourceIds ??
            [])
        ],

      ruleEvaluationIds:
        [
          ...(input
            .ruleEvaluationIds ??
            [])
        ],

      evidencePackageIds:
        [
          ...input
            .evidencePackageIds
        ],

      correlationId:
        required(
          input.correlationId,
          'M6_8_CORRELATION_ID_REQUIRED'
        ),

      createdAt:
        new Date()
          .toISOString()
    });
  }
}
