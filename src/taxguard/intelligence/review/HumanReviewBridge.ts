import type { EvidencePackage } from '../types';
import { StageThreeValidationService } from '../../../services/stageThreeValidationService';

/**
 * TG-CORE-004 — Human Review Bridge
 *
 * Connects the TaxGuard Intelligence Core to the existing
 * Stage 03 human-review workflow.
 *
 * GOVERNANCE:
 * - Intelligence Core may propose findings.
 * - Intelligence Core may submit evidence for human review.
 * - Intelligence Core may NOT approve its own findings.
 * - Intelligence Core may NOT certify tax conclusions.
 * - Intelligence Core may NOT clear Stage 03.
 * - Intelligence Core may NOT bypass maker-checker controls.
 * - AI-generated material remains proposed-only until reviewed.
 */

export type HumanReviewSeverity =
  | 'INFO'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type HumanReviewRiskLevel =
  | 'routine'
  | 'material'
  | 'high_risk'
  | 'critical';

export type HumanReviewAssignedRole =
  | 'cpa'
  | 'ea'
  | 'tax_attorney'
  | 'reviewer'
  | 'accountant'
  | 'unassigned';

export type HumanReviewItemType =
  | 'LOW_CONFIDENCE'
  | 'TAX_YEAR_MISMATCH'
  | 'CONFLICT'
  | 'INSUFFICIENT_EVIDENCE'
  | 'IDENTITY_MISMATCH'
  | 'MATHEMATICAL_VARIANCE'
  | 'SUPERSEDED_SOURCE'
  | 'CONTROLLED_FORM_DEFECT'
  | 'PROVENANCE_FAILURE'
  | 'VERSION_CONFLICT'
  | 'BLOCKING_EXCEPTION';

export interface HumanReviewSubmission {
  evidencePackage: EvidencePackage;

  title?: string;
  description?: string;

  itemType?: HumanReviewItemType;

  severity?: HumanReviewSeverity;

  riskLevel?: HumanReviewRiskLevel;

  assignedRole?: HumanReviewAssignedRole;

  assignedReviewer?: string;

  referenceId?: string;

  sourceDocumentIds?: string[];

  exceptionIds?: string[];

  auditReferences?: string[];
}

export interface HumanReviewBridgeResult {
  queueItemId: string;

  evidencePackageId: string;

  clientId: string;
  engagementId: string;
  taxYear: number;

  correlationId: string;

  requiresHumanReview: true;

  status: string;
}

/**
 * HumanReviewBridge
 *
 * This bridge is intentionally narrow.
 *
 * Its responsibility is only to place Intelligence Core evidence
 * into the authoritative Stage 03 human-review workflow.
 *
 * It deliberately exposes no approve(), certify(), clear(),
 * or autoResolve() method.
 */
export class HumanReviewBridge {
  /**
   * Submit an Intelligence Core EvidencePackage to Stage 03.
   *
   * The resulting queue item remains under the authority of the
   * StageThreeValidationService human-review workflow.
   */
  public static submit(
    submission: HumanReviewSubmission,
  ): HumanReviewBridgeResult {
    const pkg = submission.evidencePackage;

    this.validateEvidencePackage(pkg);

    const queueItem =
      StageThreeValidationService.enqueueHumanReview({
        clientId: pkg.clientId,

        engagementId: pkg.engagementId,

        taxYear: pkg.taxYear,

        itemType:
          submission.itemType ??
          'INSUFFICIENT_EVIDENCE',

        referenceId:
          submission.referenceId ??
          pkg.evidencePackageId,

        title:
          submission.title ??
          `TaxGuard Intelligence Evidence Package ${pkg.evidencePackageId}`,

        description:
          submission.description ??
          'TaxGuard Intelligence Core evidence package requires authorized human review.',

        severity:
          submission.severity ??
          'MEDIUM',

        riskLevel:
          submission.riskLevel ??
          'material',

        assignedRole:
          submission.assignedRole ??
          'reviewer',

        assignedReviewer:
          submission.assignedReviewer ??
          'UNASSIGNED',

        sourceDocumentIds:
          submission.sourceDocumentIds ?? [],

        exceptionIds:
          submission.exceptionIds ?? [],

        auditReferences: [
          pkg.correlationId,
          ...(submission.auditReferences ?? []),
        ],

        status: 'PENDING_REVIEW',
      });

    return {
      queueItemId: queueItem.queueItemId,

      evidencePackageId:
        pkg.evidencePackageId,

      clientId:
        pkg.clientId,

      engagementId:
        pkg.engagementId,

      taxYear:
        pkg.taxYear,

      correlationId:
        pkg.correlationId,

      requiresHumanReview: true,

      status:
        queueItem.status,
    };
  }

  /**
   * Validate the minimum evidence contract before anything is
   * allowed to enter the human-review workflow.
   */
  private static validateEvidencePackage(
    pkg: EvidencePackage,
  ): void {
    if (!pkg) {
      throw new Error(
        'Human review submission requires an EvidencePackage.',
      );
    }

    if (!pkg.evidencePackageId?.trim()) {
      throw new Error(
        'EvidencePackage requires evidencePackageId.',
      );
    }

    if (!pkg.clientId?.trim()) {
      throw new Error(
        'EvidencePackage requires clientId.',
      );
    }

    if (!pkg.engagementId?.trim()) {
      throw new Error(
        'EvidencePackage requires engagementId.',
      );
    }

    if (
      !Number.isInteger(pkg.taxYear) ||
      pkg.taxYear < 1900 ||
      pkg.taxYear > 2200
    ) {
      throw new Error(
        'EvidencePackage requires a valid taxYear.',
      );
    }

    if (!pkg.correlationId?.trim()) {
      throw new Error(
        'EvidencePackage requires correlationId.',
      );
    }

    /**
     * Hard governance requirement.
     *
     * Intelligence Core evidence must never enter the workflow
     * marked as not requiring human review.
     */
    if (pkg.requiresHumanReview !== true) {
      throw new Error(
        'EvidencePackage must require human review.',
      );
    }

    /**
     * An evidence package must contain at least one traceable
     * artifact from the Knowledge Base, Rule Engine, findings,
     * or AI proposal layer.
     */
    const hasEvidence =
      pkg.knowledgeSourceIds.length > 0 ||
      pkg.ruleEvaluationIds.length > 0 ||
      pkg.findingIds.length > 0 ||
      pkg.aiProposalIds.length > 0;

    if (!hasEvidence) {
      throw new Error(
        'EvidencePackage must contain at least one traceable evidence reference.',
      );
    }
  }
}