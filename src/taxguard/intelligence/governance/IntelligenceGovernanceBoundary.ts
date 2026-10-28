/**
 * TaxGuard Intelligence Core
 * TG-CORE-008 — Intelligence Governance Boundary
 *
 * Purpose:
 * Provides a fail-closed governance boundary around TaxGuard Intelligence Core
 * artifacts before they are permitted to proceed toward authorized human review.
 *
 * IMPORTANT:
 * This component does NOT:
 * - approve tax conclusions;
 * - certify Stage 03;
 * - clear Stage 03 exit gates;
 * - file tax returns;
 * - convert AI output into verified tax facts;
 * - replace StageThreeValidationService;
 *
 * Governance invariant:
 * AI-generated information remains proposed-only until reviewed through the
 * authorized TaxGuard human-review workflow.
 */

import type {
  AiReasoningProposal,
  EvidencePackage,
  IntelligenceFinding,
  KnowledgeSource,
  RuleEvaluation,
} from '../types';

export type GovernanceArtifactType =
  | 'KNOWLEDGE_SOURCE'
  | 'RULE_EVALUATION'
  | 'INTELLIGENCE_FINDING'
  | 'AI_REASONING_PROPOSAL'
  | 'EVIDENCE_PACKAGE';

export type GovernanceDecision =
  | 'ALLOW_FOR_REVIEW'
  | 'BLOCK'
  | 'REQUIRE_HUMAN_REVIEW';

export type GovernanceViolationCode =
  | 'MISSING_CLIENT_ID'
  | 'MISSING_ENGAGEMENT_ID'
  | 'INVALID_TAX_YEAR'
  | 'MISSING_CORRELATION_ID'
  | 'MISSING_ARTIFACT_ID'
  | 'MISSING_KNOWLEDGE_SOURCE'
  | 'INACTIVE_KNOWLEDGE_SOURCE'
  | 'MISSING_RULE_EVALUATION'
  | 'MISSING_FINDING'
  | 'MISSING_AI_PROPOSAL'
  | 'AI_NOT_PROPOSED_ONLY'
  | 'INVALID_AI_STATUS'
  | 'AI_HUMAN_REVIEW_REQUIRED'
  | 'EVIDENCE_HUMAN_REVIEW_REQUIRED'
  | 'CROSS_CLIENT_REFERENCE'
  | 'CROSS_ENGAGEMENT_REFERENCE'
  | 'CROSS_TAX_YEAR_REFERENCE'
  | 'CORRELATION_MISMATCH'
  | 'UNTRACEABLE_REFERENCE'
  | 'STALE_ARTIFACT'
  | 'REJECTED_ARTIFACT'
  | 'SUPERSEDED_ARTIFACT'
  | 'UNVERIFIED_AI_DERIVED_FINDING'
  | 'GOVERNANCE_VALIDATION_FAILED';

export interface GovernanceViolation {
  code: GovernanceViolationCode;
  message: string;
  blocking: boolean;
  artifactType?: GovernanceArtifactType;
  artifactId?: string;
  referenceId?: string;
}

export interface IntelligenceGovernanceContext {
  clientId: string;
  engagementId: string;
  taxYear: number;
  correlationId: string;

  knowledgeSources?: KnowledgeSource[];
  ruleEvaluations?: RuleEvaluation[];
  findings?: IntelligenceFinding[];
  aiProposals?: AiReasoningProposal[];
}

export interface IntelligenceGovernanceResult {
  allowed: boolean;
  decision: GovernanceDecision;

  requiresHumanReview: boolean;

  clientId: string;
  engagementId: string;
  taxYear: number;
  correlationId: string;

  evidencePackageId?: string;

  violations: GovernanceViolation[];

  checkedAt: string;
}

/**
 * IntelligenceGovernanceBoundary
 *
 * This class is intentionally narrow.
 *
 * It validates provenance, identity isolation, tax-year isolation,
 * correlation integrity, AI proposed-only requirements, stale/rejected
 * artifacts, and mandatory human-review requirements.
 *
 * It deliberately exposes no approve(), certify(), clearGate(),
 * fileReturn(), or equivalent authority.
 */
export class IntelligenceGovernanceBoundary {
  /**
   * Evaluate a complete evidence package before it proceeds to human review.
   *
   * This method NEVER performs approval.
   */
  public static evaluateEvidencePackage(
    evidencePackage: EvidencePackage,
    context: IntelligenceGovernanceContext,
  ): IntelligenceGovernanceResult {
    const violations: GovernanceViolation[] = [];

    this.validateContext(context, violations);

    this.validateEvidencePackageIdentity(
      evidencePackage,
      context,
      violations,
    );

    this.validateEvidencePackageInvariant(
      evidencePackage,
      violations,
    );

    this.validateKnowledgeSources(
      evidencePackage,
      context,
      violations,
    );

    this.validateRuleEvaluations(
      evidencePackage,
      context,
      violations,
    );

    this.validateFindings(
      evidencePackage,
      context,
      violations,
    );

    this.validateAiProposals(
      evidencePackage,
      context,
      violations,
    );

    const blocking = violations.some(
      violation => violation.blocking,
    );

    /*
     * EvidencePackage.requiresHumanReview is a canonical hard invariant.
     *
     * Therefore a valid package is not "approved".
     * It is only allowed to proceed to authorized human review.
     */
    return {
      allowed: !blocking,

      decision: blocking
        ? 'BLOCK'
        : 'REQUIRE_HUMAN_REVIEW',

      requiresHumanReview: true,

      clientId: context.clientId,
      engagementId: context.engagementId,
      taxYear: context.taxYear,
      correlationId: context.correlationId,

      evidencePackageId: evidencePackage.evidencePackageId,

      violations,

      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Evaluate a standalone AI proposal.
   *
   * A successful result only means the proposal may proceed to
   * human review. It does not make the proposal verified.
   */
  public static evaluateAiProposal(
    proposal: AiReasoningProposal,
    context: IntelligenceGovernanceContext,
  ): IntelligenceGovernanceResult {
    const violations: GovernanceViolation[] = [];

    this.validateContext(context, violations);

    this.validateArtifactIdentity(
      {
        clientId: proposal.clientId,
        engagementId: proposal.engagementId,
        taxYear: proposal.taxYear,
        correlationId: proposal.correlationId,
      },
      context,
      'AI_REASONING_PROPOSAL',
      proposal.proposalId,
      violations,
    );

    this.validateAiProposalInvariant(
      proposal,
      violations,
    );

    this.validateReferencedKnowledgeSources(
      proposal.knowledgeSourceIds,
      context,
      'AI_REASONING_PROPOSAL',
      proposal.proposalId,
      violations,
    );

    this.validateReferencedRuleEvaluations(
      proposal.ruleEvaluationIds,
      context,
      'AI_REASONING_PROPOSAL',
      proposal.proposalId,
      violations,
    );

    const blocking = violations.some(
      violation => violation.blocking,
    );

    return {
      allowed: !blocking,

      decision: blocking
        ? 'BLOCK'
        : 'REQUIRE_HUMAN_REVIEW',

      requiresHumanReview: true,

      clientId: context.clientId,
      engagementId: context.engagementId,
      taxYear: context.taxYear,
      correlationId: context.correlationId,

      violations,

      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Convenience method for callers that need a simple boolean.
   *
   * "true" means only that the artifact may enter the human-review
   * workflow. It does NOT mean approved, certified, or tax verified.
   */
  public static canProceedToHumanReview(
    evidencePackage: EvidencePackage,
    context: IntelligenceGovernanceContext,
  ): boolean {
    return this.evaluateEvidencePackage(
      evidencePackage,
      context,
    ).allowed;
  }

  private static validateContext(
    context: IntelligenceGovernanceContext,
    violations: GovernanceViolation[],
  ): void {
    if (!context.clientId?.trim()) {
      violations.push({
        code: 'MISSING_CLIENT_ID',
        message: 'Governance context requires a client identity.',
        blocking: true,
      });
    }

    if (!context.engagementId?.trim()) {
      violations.push({
        code: 'MISSING_ENGAGEMENT_ID',
        message: 'Governance context requires an engagement identity.',
        blocking: true,
      });
    }

    if (
      !Number.isInteger(context.taxYear) ||
      context.taxYear < 1900 ||
      context.taxYear > 2200
    ) {
      violations.push({
        code: 'INVALID_TAX_YEAR',
        message: 'Governance context contains an invalid tax year.',
        blocking: true,
      });
    }

    if (!context.correlationId?.trim()) {
      violations.push({
        code: 'MISSING_CORRELATION_ID',
        message: 'Governance context requires a correlation ID.',
        blocking: true,
      });
    }
  }

  private static validateEvidencePackageIdentity(
    evidencePackage: EvidencePackage,
    context: IntelligenceGovernanceContext,
    violations: GovernanceViolation[],
  ): void {
    if (!evidencePackage.evidencePackageId?.trim()) {
      violations.push({
        code: 'MISSING_ARTIFACT_ID',
        message: 'Evidence package requires an evidencePackageId.',
        blocking: true,
        artifactType: 'EVIDENCE_PACKAGE',
      });
    }

    this.validateArtifactIdentity(
      evidencePackage,
      context,
      'EVIDENCE_PACKAGE',
      evidencePackage.evidencePackageId,
      violations,
    );
  }

  private static validateEvidencePackageInvariant(
    evidencePackage: EvidencePackage,
    violations: GovernanceViolation[],
  ): void {
    if (evidencePackage.requiresHumanReview !== true) {
      violations.push({
        code: 'EVIDENCE_HUMAN_REVIEW_REQUIRED',
        message:
          'Evidence packages must remain gated for authorized human review.',
        blocking: true,
        artifactType: 'EVIDENCE_PACKAGE',
        artifactId: evidencePackage.evidencePackageId,
      });
    }
  }

  private static validateKnowledgeSources(
    evidencePackage: EvidencePackage,
    context: IntelligenceGovernanceContext,
    violations: GovernanceViolation[],
  ): void {
    this.validateReferencedKnowledgeSources(
      evidencePackage.knowledgeSourceIds,
      context,
      'EVIDENCE_PACKAGE',
      evidencePackage.evidencePackageId,
      violations,
    );
  }

  private static validateReferencedKnowledgeSources(
    sourceIds: string[],
    context: IntelligenceGovernanceContext,
    artifactType: GovernanceArtifactType,
    artifactId: string,
    violations: GovernanceViolation[],
  ): void {
    const sources = context.knowledgeSources ?? [];

    for (const sourceId of this.unique(sourceIds)) {
      const source = sources.find(
        candidate => candidate.sourceId === sourceId,
      );

      if (!source) {
        violations.push({
          code: 'MISSING_KNOWLEDGE_SOURCE',
          message: `Knowledge source '${sourceId}' could not be resolved.`,
          blocking: true,
          artifactType,
          artifactId,
          referenceId: sourceId,
        });

        continue;
      }

      if (!source.isActive) {
        violations.push({
          code: 'INACTIVE_KNOWLEDGE_SOURCE',
          message: `Knowledge source '${sourceId}' is inactive.`,
          blocking: true,
          artifactType: 'KNOWLEDGE_SOURCE',
          artifactId: source.sourceId,
          referenceId: sourceId,
        });
      }

      if (
        source.taxYear !== undefined &&
        source.taxYear !== context.taxYear
      ) {
        violations.push({
          code: 'CROSS_TAX_YEAR_REFERENCE',
          message:
            `Knowledge source '${sourceId}' belongs to tax year ` +
            `${source.taxYear}, not ${context.taxYear}.`,
          blocking: true,
          artifactType: 'KNOWLEDGE_SOURCE',
          artifactId: source.sourceId,
          referenceId: sourceId,
        });
      }
    }
  }

  private static validateRuleEvaluations(
    evidencePackage: EvidencePackage,
    context: IntelligenceGovernanceContext,
    violations: GovernanceViolation[],
  ): void {
    this.validateReferencedRuleEvaluations(
      evidencePackage.ruleEvaluationIds,
      context,
      'EVIDENCE_PACKAGE',
      evidencePackage.evidencePackageId,
      violations,
    );
  }

  private static validateReferencedRuleEvaluations(
    evaluationIds: string[],
    context: IntelligenceGovernanceContext,
    artifactType: GovernanceArtifactType,
    artifactId: string,
    violations: GovernanceViolation[],
  ): void {
    const evaluations = context.ruleEvaluations ?? [];

    for (const evaluationId of this.unique(evaluationIds)) {
      const evaluation = evaluations.find(
        candidate => candidate.evaluationId === evaluationId,
      );

      if (!evaluation) {
        violations.push({
          code: 'MISSING_RULE_EVALUATION',
          message: `Rule evaluation '${evaluationId}' could not be resolved.`,
          blocking: true,
          artifactType,
          artifactId,
          referenceId: evaluationId,
        });

        continue;
      }

      this.validateArtifactIdentity(
        evaluation,
        context,
        'RULE_EVALUATION',
        evaluation.evaluationId,
        violations,
      );

      this.validateReferencedKnowledgeSources(
        evaluation.authoritySourceIds,
        context,
        'RULE_EVALUATION',
        evaluation.evaluationId,
        violations,
      );
    }
  }

  private static validateFindings(
    evidencePackage: EvidencePackage,
    context: IntelligenceGovernanceContext,
    violations: GovernanceViolation[],
  ): void {
    const findings = context.findings ?? [];

    for (const findingId of this.unique(evidencePackage.findingIds)) {
      const finding = findings.find(
        candidate => candidate.findingId === findingId,
      );

      if (!finding) {
        violations.push({
          code: 'MISSING_FINDING',
          message: `Finding '${findingId}' could not be resolved.`,
          blocking: true,
          artifactType: 'EVIDENCE_PACKAGE',
          artifactId: evidencePackage.evidencePackageId,
          referenceId: findingId,
        });

        continue;
      }

      this.validateFinding(
        finding,
        context,
        violations,
      );
    }
  }

  private static validateFinding(
    finding: IntelligenceFinding,
    context: IntelligenceGovernanceContext,
    violations: GovernanceViolation[],
  ): void {
    this.validateArtifactIdentity(
      finding,
      context,
      'INTELLIGENCE_FINDING',
      finding.findingId,
      violations,
    );

    if (finding.status === 'STALE') {
      violations.push({
        code: 'STALE_ARTIFACT',
        message: `Finding '${finding.findingId}' is stale.`,
        blocking: true,
        artifactType: 'INTELLIGENCE_FINDING',
        artifactId: finding.findingId,
      });
    }

    if (finding.status === 'REJECTED') {
      violations.push({
        code: 'REJECTED_ARTIFACT',
        message: `Finding '${finding.findingId}' has been rejected.`,
        blocking: true,
        artifactType: 'INTELLIGENCE_FINDING',
        artifactId: finding.findingId,
      });
    }

    if (finding.status === 'SUPERSEDED') {
      violations.push({
        code: 'SUPERSEDED_ARTIFACT',
        message: `Finding '${finding.findingId}' has been superseded.`,
        blocking: true,
        artifactType: 'INTELLIGENCE_FINDING',
        artifactId: finding.findingId,
      });
    }

    /*
     * An AI-origin finding may never bypass human review.
     */
    if (
      finding.origin === 'AI_REASONING' &&
      finding.requiresHumanReview !== true
    ) {
      violations.push({
        code: 'UNVERIFIED_AI_DERIVED_FINDING',
        message:
          `AI-derived finding '${finding.findingId}' must require ` +
          'authorized human review.',
        blocking: true,
        artifactType: 'INTELLIGENCE_FINDING',
        artifactId: finding.findingId,
      });
    }

    this.validateReferencedKnowledgeSources(
      finding.knowledgeSourceIds,
      context,
      'INTELLIGENCE_FINDING',
      finding.findingId,
      violations,
    );

    this.validateReferencedRuleEvaluations(
      finding.ruleEvaluationIds,
      context,
      'INTELLIGENCE_FINDING',
      finding.findingId,
      violations,
    );
  }

  private static validateAiProposals(
    evidencePackage: EvidencePackage,
    context: IntelligenceGovernanceContext,
    violations: GovernanceViolation[],
  ): void {
    const proposals = context.aiProposals ?? [];

    for (const proposalId of this.unique(evidencePackage.aiProposalIds)) {
      const proposal = proposals.find(
        candidate => candidate.proposalId === proposalId,
      );

      if (!proposal) {
        violations.push({
          code: 'MISSING_AI_PROPOSAL',
          message: `AI proposal '${proposalId}' could not be resolved.`,
          blocking: true,
          artifactType: 'EVIDENCE_PACKAGE',
          artifactId: evidencePackage.evidencePackageId,
          referenceId: proposalId,
        });

        continue;
      }

      this.validateArtifactIdentity(
        proposal,
        context,
        'AI_REASONING_PROPOSAL',
        proposal.proposalId,
        violations,
      );

      this.validateAiProposalInvariant(
        proposal,
        violations,
      );

      this.validateReferencedKnowledgeSources(
        proposal.knowledgeSourceIds,
        context,
        'AI_REASONING_PROPOSAL',
        proposal.proposalId,
        violations,
      );

      this.validateReferencedRuleEvaluations(
        proposal.ruleEvaluationIds,
        context,
        'AI_REASONING_PROPOSAL',
        proposal.proposalId,
        violations,
      );
    }
  }

  private static validateAiProposalInvariant(
    proposal: AiReasoningProposal,
    violations: GovernanceViolation[],
  ): void {
    /*
     * TypeScript enforces this at compile time for trusted callers,
     * but runtime data may originate from storage, JSON, APIs,
     * migrations, or external systems. Therefore we verify it again.
     */
    if ((proposal as { isAiProposedOnly?: unknown }).isAiProposedOnly !== true) {
      violations.push({
        code: 'AI_NOT_PROPOSED_ONLY',
        message:
          `AI proposal '${proposal.proposalId}' violated the ` +
          'proposed-only governance invariant.',
        blocking: true,
        artifactType: 'AI_REASONING_PROPOSAL',
        artifactId: proposal.proposalId,
      });
    }

    if (
      proposal.status !== 'PROPOSED' &&
      proposal.status !== 'REVIEW_REQUIRED'
    ) {
      violations.push({
        code: 'INVALID_AI_STATUS',
        message:
          `AI proposal '${proposal.proposalId}' contains a prohibited status.`,
        blocking: true,
        artifactType: 'AI_REASONING_PROPOSAL',
        artifactId: proposal.proposalId,
      });
    }
  }

  private static validateArtifactIdentity(
    artifact: {
      clientId: string;
      engagementId: string;
      taxYear: number;
      correlationId: string;
    },
    context: IntelligenceGovernanceContext,
    artifactType: GovernanceArtifactType,
    artifactId: string,
    violations: GovernanceViolation[],
  ): void {
    if (artifact.clientId !== context.clientId) {
      violations.push({
        code: 'CROSS_CLIENT_REFERENCE',
        message:
          `Artifact '${artifactId}' belongs to a different client.`,
        blocking: true,
        artifactType,
        artifactId,
      });
    }

    if (artifact.engagementId !== context.engagementId) {
      violations.push({
        code: 'CROSS_ENGAGEMENT_REFERENCE',
        message:
          `Artifact '${artifactId}' belongs to a different engagement.`,
        blocking: true,
        artifactType,
        artifactId,
      });
    }

    if (artifact.taxYear !== context.taxYear) {
      violations.push({
        code: 'CROSS_TAX_YEAR_REFERENCE',
        message:
          `Artifact '${artifactId}' belongs to tax year ` +
          `${artifact.taxYear}, not ${context.taxYear}.`,
        blocking: true,
        artifactType,
        artifactId,
      });
    }

    if (!artifact.correlationId?.trim()) {
      violations.push({
        code: 'MISSING_CORRELATION_ID',
        message:
          `Artifact '${artifactId}' does not contain a correlation ID.`,
        blocking: true,
        artifactType,
        artifactId,
      });

      return;
    }

    if (
      context.correlationId &&
      artifact.correlationId !== context.correlationId
    ) {
      violations.push({
        code: 'CORRELATION_MISMATCH',
        message:
          `Artifact '${artifactId}' does not belong to the active ` +
          'correlation chain.',
        blocking: true,
        artifactType,
        artifactId,
      });
    }
  }

  private static unique(values: string[] | undefined): string[] {
    if (!values) {
      return [];
    }

    return Array.from(
      new Set(
        values.filter(
          value =>
            typeof value === 'string' &&
            value.trim().length > 0,
        ),
      ),
    );
  }
}