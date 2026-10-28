import type { EvidencePackage } from '../types';

/**
 * Input contract for creating a TaxGuard Intelligence Core
 * evidence package.
 *
 * Evidence packages are review artifacts only.
 * They do not constitute tax approval, filing authorization,
 * or professional sign-off.
 */
export interface BuildEvidencePackageInput {
  clientId: string;
  engagementId: string;
  taxYear: number;

  knowledgeSourceIds?: string[];
  ruleEvaluationIds?: string[];
  findingIds?: string[];
  aiProposalIds?: string[];

  correlationId: string;
}

/**
 * TG-CORE-003 — Evidence Package Builder
 *
 * Collects traceable Intelligence Core artifacts into a single
 * review package for the authorized TaxGuard human-review workflow.
 *
 * Governance invariant:
 * Every package requires human review.
 */
export class EvidencePackageBuilder {
  public static build(
    input: BuildEvidencePackageInput
  ): EvidencePackage {
    this.validateRequiredString(input.clientId, 'clientId');
    this.validateRequiredString(input.engagementId, 'engagementId');
    this.validateRequiredString(input.correlationId, 'correlationId');

    if (
      !Number.isInteger(input.taxYear) ||
      input.taxYear < 1900 ||
      input.taxYear > 9999
    ) {
      throw new Error(
        'EvidencePackage requires a valid integer taxYear.'
      );
    }

    const knowledgeSourceIds = this.normalizeIds(
      input.knowledgeSourceIds ?? []
    );

    const ruleEvaluationIds = this.normalizeIds(
      input.ruleEvaluationIds ?? []
    );

    const findingIds = this.normalizeIds(
      input.findingIds ?? []
    );

    const aiProposalIds = this.normalizeIds(
      input.aiProposalIds ?? []
    );

    if (
      knowledgeSourceIds.length === 0 &&
      ruleEvaluationIds.length === 0 &&
      findingIds.length === 0 &&
      aiProposalIds.length === 0
    ) {
      throw new Error(
        'EvidencePackage requires at least one traceable evidence artifact.'
      );
    }

    return {
      evidencePackageId: this.createEvidencePackageId(),

      clientId: input.clientId.trim(),
      engagementId: input.engagementId.trim(),
      taxYear: input.taxYear,

      knowledgeSourceIds,
      ruleEvaluationIds,
      findingIds,
      aiProposalIds,

      requiresHumanReview: true,

      createdAt: new Date().toISOString(),

      correlationId: input.correlationId.trim(),
    };
  }

  private static validateRequiredString(
    value: string,
    fieldName: string
  ): void {
    if (!value || value.trim().length === 0) {
      throw new Error(
        `EvidencePackage requires ${fieldName}.`
      );
    }
  }

  private static normalizeIds(ids: string[]): string[] {
    return Array.from(
      new Set(
        ids
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      )
    );
  }

  private static createEvidencePackageId(): string {
    const randomPart =
      typeof globalThis.crypto !== 'undefined' &&
      typeof globalThis.crypto.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 12)}`;

    return `EP-${randomPart}`;
  }
}