export type TaxAIProposalKind =
  | 'fact_extraction'
  | 'fact_classification'
  | 'rule_candidate'
  | 'authority_candidate'
  | 'evidence_candidate'
  | 'explanation'
  | 'review_recommendation';

export type TaxAIProposalStatus =
  | 'proposed'
  | 'requires_evidence'
  | 'requires_rule_validation'
  | 'requires_authority_validation'
  | 'requires_professional_review'
  | 'rejected'
  | 'accepted_as_proposal';

export interface TaxAIProposal {
  proposalId: string;

  kind:
    TaxAIProposalKind;

  status:
    TaxAIProposalStatus;

  proposedValue:
    unknown;

  confidence:
    number | null;

  sourceArtifactIds:
    string[];

  evidenceIds:
    string[];

  ruleIds:
    string[];

  authoritySourceIds:
    string[];

  createdAt:
    string;

  isAiProposedOnly:
    true;
}

export interface TaxAIKnowledgeEvaluationInput {
  proposal:
    TaxAIProposal;

  verifiedFact:
    boolean;

  verifiedEvidence:
    boolean;

  verifiedRule:
    boolean;

  verifiedAuthority:
    boolean;

  unresolvedBlockingConflict:
    boolean;

  unresolvedMaterialConflict:
    boolean;

  professionalReviewRequired:
    boolean;

  professionalReviewCompleted:
    boolean;

  humanApprovalPresent:
    boolean;
}

export interface TaxAIKnowledgeEvaluation {
  proposalId: string;

  canUseAsProposal:
    boolean;

  canUseAsVerifiedFact:
    boolean;

  canUseAsVerifiedRule:
    boolean;

  canUseAsVerifiedAuthority:
    boolean;

  canUseForMaterialDecision:
    boolean;

  requiresHumanReview:
    boolean;

  blockingReasons:
    string[];

  evaluatedAt:
    string;
}

export interface TaxAIHumanApproval {
  approvalId: string;

  proposalId: string;

  approvedBy: string;

  role: string;

  rationale: string;

  approvedAt: string;
}

function normalize(
  value: string
): string {
  return value.trim();
}

function cloneProposal(
  proposal: TaxAIProposal
): TaxAIProposal {
  return {
    ...proposal,

    sourceArtifactIds:
      [...proposal.sourceArtifactIds],

    evidenceIds:
      [...proposal.evidenceIds],

    ruleIds:
      [...proposal.ruleIds],

    authoritySourceIds:
      [...proposal.authoritySourceIds],

    isAiProposedOnly:
      true
  };
}

export class TaxAIKnowledgeBoundary {

  private readonly proposals =
    new Map<
      string,
      TaxAIProposal
    >();

  private readonly approvals =
    new Map<
      string,
      TaxAIHumanApproval
    >();

  registerProposal(
    input: {
      proposalId: string;

      kind:
        TaxAIProposalKind;

      proposedValue:
        unknown;

      confidence?: number | null;

      sourceArtifactIds?: string[];

      evidenceIds?: string[];

      ruleIds?: string[];

      authoritySourceIds?: string[];
    }
  ): TaxAIProposal {

    const proposalId =
      normalize(
        input.proposalId
      );

    if (!proposalId) {
      throw new Error(
        'AI_PROPOSAL_ID_REQUIRED'
      );
    }

    if (
      this.proposals.has(
        proposalId
      )
    ) {
      throw new Error(
        'AI_PROPOSAL_ALREADY_EXISTS'
      );
    }

    if (
      input.confidence !== undefined &&
      input.confidence !== null &&
      (
        input.confidence < 0 ||
        input.confidence > 1
      )
    ) {
      throw new Error(
        'AI_PROPOSAL_CONFIDENCE_INVALID'
      );
    }

    const proposal:
      TaxAIProposal = {

      proposalId,

      kind:
        input.kind,

      status:
        'proposed',

      proposedValue:
        input.proposedValue,

      confidence:
        input.confidence ??
        null,

      sourceArtifactIds:
        [...(
          input.sourceArtifactIds ??
          []
        )],

      evidenceIds:
        [...(
          input.evidenceIds ??
          []
        )],

      ruleIds:
        [...(
          input.ruleIds ??
          []
        )],

      authoritySourceIds:
        [...(
          input.authoritySourceIds ??
          []
        )],

      createdAt:
        new Date()
          .toISOString(),

      isAiProposedOnly:
        true
    };

    this.proposals.set(
      proposalId,
      proposal
    );

    return cloneProposal(
      proposal
    );
  }

  getProposal(
    proposalId: string
  ): TaxAIProposal | null {

    const proposal =
      this.proposals.get(
        normalize(
          proposalId
        )
      );

    return proposal
      ? cloneProposal(proposal)
      : null;
  }

  evaluate(
    input:
      TaxAIKnowledgeEvaluationInput
  ): TaxAIKnowledgeEvaluation {

    const proposal =
      input.proposal;

    if (
      proposal.isAiProposedOnly !==
      true
    ) {
      throw new Error(
        'AI_PROPOSAL_BOUNDARY_INVALID'
      );
    }

    const blockingReasons:
      string[] = [];

    /*
     * AI extraction/classification never turns
     * itself into a verified taxpayer fact.
     */
    if (!input.verifiedFact) {
      blockingReasons.push(
        'FACT_NOT_VERIFIED'
      );
    }

    if (!input.verifiedEvidence) {
      blockingReasons.push(
        'EVIDENCE_NOT_VERIFIED'
      );
    }

    if (!input.verifiedRule) {
      blockingReasons.push(
        'RULE_NOT_VERIFIED'
      );
    }

    if (!input.verifiedAuthority) {
      blockingReasons.push(
        'AUTHORITY_NOT_VERIFIED'
      );
    }

    if (
      input.unresolvedBlockingConflict
    ) {
      blockingReasons.push(
        'BLOCKING_KNOWLEDGE_CONFLICT'
      );
    }

    if (
      input.unresolvedMaterialConflict
    ) {
      blockingReasons.push(
        'MATERIAL_KNOWLEDGE_CONFLICT'
      );
    }

    if (
      input.professionalReviewRequired &&
      !input.professionalReviewCompleted
    ) {
      blockingReasons.push(
        'PROFESSIONAL_REVIEW_REQUIRED'
      );
    }

    if (
      !input.humanApprovalPresent
    ) {
      blockingReasons.push(
        'HUMAN_APPROVAL_REQUIRED'
      );
    }

    const requiresHumanReview =
      input.professionalReviewRequired ||
      input.unresolvedBlockingConflict ||
      input.unresolvedMaterialConflict;

    /*
     * AI output is always allowed to remain a
     * proposal. It does not become authoritative
     * merely because it exists.
     */
    const canUseAsProposal =
      true;

    /*
     * AI cannot itself verify facts, rules,
     * or authorities.
     */
    const canUseAsVerifiedFact =
      false;

    const canUseAsVerifiedRule =
      false;

    const canUseAsVerifiedAuthority =
      false;

    const canUseForMaterialDecision =
      blockingReasons.length === 0;

    return {
      proposalId:
        proposal.proposalId,

      canUseAsProposal,

      canUseAsVerifiedFact,

      canUseAsVerifiedRule,

      canUseAsVerifiedAuthority,

      canUseForMaterialDecision,

      requiresHumanReview,

      blockingReasons,

      evaluatedAt:
        new Date()
          .toISOString()
    };
  }

  approveProposal(
    input: {
      approvalId: string;

      proposalId: string;

      approvedBy: string;

      role: string;

      rationale: string;
    }
  ): TaxAIHumanApproval {

    const approvalId =
      normalize(
        input.approvalId
      );

    const proposalId =
      normalize(
        input.proposalId
      );

    const approvedBy =
      normalize(
        input.approvedBy
      );

    const role =
      normalize(
        input.role
      );

    const rationale =
      normalize(
        input.rationale
      );

    if (!approvalId) {
      throw new Error(
        'AI_APPROVAL_ID_REQUIRED'
      );
    }

    if (
      this.approvals.has(
        approvalId
      )
    ) {
      throw new Error(
        'AI_APPROVAL_ALREADY_EXISTS'
      );
    }

    if (
      !this.proposals.has(
        proposalId
      )
    ) {
      throw new Error(
        'AI_PROPOSAL_NOT_FOUND'
      );
    }

    if (!approvedBy) {
      throw new Error(
        'AI_APPROVER_REQUIRED'
      );
    }

    if (!role) {
      throw new Error(
        'AI_APPROVER_ROLE_REQUIRED'
      );
    }

    if (!rationale) {
      throw new Error(
        'AI_APPROVAL_RATIONALE_REQUIRED'
      );
    }

    /*
     * The human approves use/review of the
     * proposal. This does NOT mutate the AI
     * proposal into a verified tax fact/rule/
     * authority.
     */
    const approval:
      TaxAIHumanApproval = {

      approvalId,

      proposalId,

      approvedBy,

      role,

      rationale,

      approvedAt:
        new Date()
          .toISOString()
    };

    this.approvals.set(
      approvalId,
      approval
    );

    return {
      ...approval
    };
  }

  getApproval(
    approvalId: string
  ): TaxAIHumanApproval | null {

    const approval =
      this.approvals.get(
        normalize(
          approvalId
        )
      );

    return approval
      ? {...approval}
      : null;
  }

  assertMaterialDecisionAllowed(
    input:
      TaxAIKnowledgeEvaluationInput
  ): void {

    const evaluation =
      this.evaluate(input);

    if (
      !evaluation
        .canUseForMaterialDecision
    ) {
      throw new Error(
        'AI_MATERIAL_DECISION_BLOCKED:' +
        evaluation
          .blockingReasons
          .join(',')
      );
    }
  }
}
