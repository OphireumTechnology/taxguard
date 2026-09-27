import type {
  AiReasoningProposal,
  ConfidenceLevel,
  EvidencePackage,
} from '../types';

/**
 * TG-CORE-005 — AI Reasoning Gateway
 *
 * Controlled boundary between TaxGuard's deterministic intelligence layer
 * and an external AI/LLM reasoning provider.
 *
 * HARD GOVERNANCE RULES
 * ---------------------
 * 1. AI output is advisory only.
 * 2. AI output is always proposed-only.
 * 3. AI cannot certify tax conclusions.
 * 4. AI cannot approve a return.
 * 5. AI cannot clear a TaxGuard gate.
 * 6. AI cannot modify deterministic rule results.
 * 7. AI cannot replace authoritative knowledge sources.
 * 8. AI proposals must remain traceable to the Evidence Package.
 * 9. AI proposals require the authorized human-review workflow.
 */

export interface AiReasoningProviderResponse {
  explanation: string;
  issueSpots?: string[];
  recommendations?: string[];
  confidence?: ConfidenceLevel;
}

export interface AiReasoningProviderRequest {
  clientId: string;
  engagementId: string;
  taxYear: number;

  promptPurpose: string;

  evidencePackageId: string;
  knowledgeSourceIds: string[];
  ruleEvaluationIds: string[];
  findingIds: string[];

  correlationId: string;
}

export interface AiReasoningProvider {
  reason(
    request: AiReasoningProviderRequest,
  ):
    | AiReasoningProviderResponse
    | Promise<AiReasoningProviderResponse>;
}

export interface GenerateAiReasoningParams {
  evidencePackage: EvidencePackage;
  promptPurpose: string;
  providerResponse: AiReasoningProviderResponse;
  correlationId?: string;
}

export class AIReasoningGateway {
  /**
   * Creates a governed AI proposal from an already-generated provider
   * response.
   *
   * The provider is intentionally separated from this method so the
   * governance boundary can be tested without making network calls.
   */
  public static createProposal(
    params: GenerateAiReasoningParams,
  ): AiReasoningProposal {
    const evidencePackage = this.validateEvidencePackage(
      params.evidencePackage,
    );

    const promptPurpose = this.requireText(
      params.promptPurpose,
      'promptPurpose',
    );

    const response = this.validateProviderResponse(
      params.providerResponse,
    );

    const correlationId =
      this.cleanOptionalText(params.correlationId) ??
      evidencePackage.correlationId;

    if (!correlationId) {
      throw new Error(
        'AI reasoning proposal requires a correlation ID.',
      );
    }

    const proposal: AiReasoningProposal = {
      proposalId: this.createId('AI-PROP'),

      clientId: evidencePackage.clientId,
      engagementId: evidencePackage.engagementId,
      taxYear: evidencePackage.taxYear,

      promptPurpose,

      explanation: response.explanation,

      issueSpots: this.uniqueStrings(response.issueSpots ?? []),
      recommendations: this.uniqueStrings(
        response.recommendations ?? [],
      ),

      knowledgeSourceIds: this.uniqueStrings(
        evidencePackage.knowledgeSourceIds,
      ),

      ruleEvaluationIds: this.uniqueStrings(
        evidencePackage.ruleEvaluationIds,
      ),

      confidence: response.confidence ?? 'LOW_CONFIDENCE',

      /**
       * HARD GOVERNANCE INVARIANT.
       *
       * No provider response is allowed to change this value.
       */
      isAiProposedOnly: true,

      /**
       * All AI reasoning must enter the human-review workflow.
       */
      status: 'REVIEW_REQUIRED',

      createdAt: new Date().toISOString(),

      correlationId,
    };

    return this.cloneProposal(proposal);
  }

  /**
   * Executes a provider through the governed gateway.
   *
   * Even if a provider returns additional fields at runtime, only the
   * explicitly permitted advisory fields are accepted into TaxGuard.
   */
  public static async reason(
    provider: AiReasoningProvider,
    evidencePackage: EvidencePackage,
    promptPurpose: string,
  ): Promise<AiReasoningProposal> {
    if (!provider || typeof provider.reason !== 'function') {
      throw new Error(
        'AI reasoning provider must implement reason().',
      );
    }

    const validatedPackage =
      this.validateEvidencePackage(evidencePackage);

    const purpose = this.requireText(
      promptPurpose,
      'promptPurpose',
    );

    const request: AiReasoningProviderRequest = {
      clientId: validatedPackage.clientId,
      engagementId: validatedPackage.engagementId,
      taxYear: validatedPackage.taxYear,

      promptPurpose: purpose,

      evidencePackageId:
        validatedPackage.evidencePackageId,

      knowledgeSourceIds: this.uniqueStrings(
        validatedPackage.knowledgeSourceIds,
      ),

      ruleEvaluationIds: this.uniqueStrings(
        validatedPackage.ruleEvaluationIds,
      ),

      findingIds: this.uniqueStrings(
        validatedPackage.findingIds,
      ),

      correlationId: validatedPackage.correlationId,
    };

    const providerResponse = await provider.reason({
      ...request,
      knowledgeSourceIds: [...request.knowledgeSourceIds],
      ruleEvaluationIds: [...request.ruleEvaluationIds],
      findingIds: [...request.findingIds],
    });

    return this.createProposal({
      evidencePackage: validatedPackage,
      promptPurpose: purpose,
      providerResponse,
      correlationId: validatedPackage.correlationId,
    });
  }

  /**
   * Explicitly documents actions that AI is never authorized to perform.
   */
  public static canApproveReturn(): false {
    return false;
  }

  public static canCertifyTaxConclusion(): false {
    return false;
  }

  public static canClearGate(): false {
    return false;
  }

  public static canModifyDeterministicResult(): false {
    return false;
  }

  public static requiresHumanReview(): true {
    return true;
  }

  private static validateEvidencePackage(
    input: EvidencePackage,
  ): EvidencePackage {
    if (!input) {
      throw new Error(
        'AI reasoning requires an Evidence Package.',
      );
    }

    const evidencePackageId = this.requireText(
      input.evidencePackageId,
      'evidencePackageId',
    );

    const clientId = this.requireText(
      input.clientId,
      'clientId',
    );

    const engagementId = this.requireText(
      input.engagementId,
      'engagementId',
    );

    if (
      !Number.isInteger(input.taxYear) ||
      input.taxYear < 1900 ||
      input.taxYear > 2200
    ) {
      throw new Error(
        'AI reasoning requires a valid tax year.',
      );
    }

    if (input.requiresHumanReview !== true) {
      throw new Error(
        'AI reasoning requires an Evidence Package that is gated for human review.',
      );
    }

    const correlationId = this.requireText(
      input.correlationId,
      'correlationId',
    );

    if (
      !Array.isArray(input.knowledgeSourceIds) ||
      input.knowledgeSourceIds.length === 0
    ) {
      throw new Error(
        'AI reasoning requires at least one authoritative knowledge source.',
      );
    }

    if (
      !Array.isArray(input.ruleEvaluationIds) ||
      input.ruleEvaluationIds.length === 0
    ) {
      throw new Error(
        'AI reasoning requires at least one deterministic rule evaluation.',
      );
    }

    if (!Array.isArray(input.findingIds)) {
      throw new Error(
        'Evidence Package findingIds must be an array.',
      );
    }

    if (!Array.isArray(input.aiProposalIds)) {
      throw new Error(
        'Evidence Package aiProposalIds must be an array.',
      );
    }

    return {
      ...input,

      evidencePackageId,
      clientId,
      engagementId,
      correlationId,

      knowledgeSourceIds: this.uniqueStrings(
        input.knowledgeSourceIds,
      ),

      ruleEvaluationIds: this.uniqueStrings(
        input.ruleEvaluationIds,
      ),

      findingIds: this.uniqueStrings(input.findingIds),

      aiProposalIds: this.uniqueStrings(
        input.aiProposalIds,
      ),

      requiresHumanReview: true,
    };
  }

  private static validateProviderResponse(
    response: AiReasoningProviderResponse,
  ): AiReasoningProviderResponse {
    if (!response) {
      throw new Error(
        'AI reasoning provider returned no response.',
      );
    }

    const explanation = this.requireText(
      response.explanation,
      'explanation',
    );

    const issueSpots = this.uniqueStrings(
      response.issueSpots ?? [],
    );

    const recommendations = this.uniqueStrings(
      response.recommendations ?? [],
    );

    return {
      explanation,
      issueSpots,
      recommendations,
      confidence: response.confidence ?? 'LOW_CONFIDENCE',
    };
  }

  private static requireText(
    value: string,
    fieldName: string,
  ): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(
        `AI reasoning requires ${fieldName}.`,
      );
    }

    return value.trim();
  }

  private static cleanOptionalText(
    value: string | undefined,
  ): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const cleaned = value.trim();

    return cleaned || undefined;
  }

  private static uniqueStrings(
    values: string[],
  ): string[] {
    return Array.from(
      new Set(
        values
          .filter(
            (value): value is string =>
              typeof value === 'string',
          )
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );
  }

  private static createId(prefix: string): string {
    const randomPart = Math.random()
      .toString(36)
      .slice(2, 10);

    return `${prefix}-${Date.now()}-${randomPart}`;
  }

  private static cloneProposal(
    proposal: AiReasoningProposal,
  ): AiReasoningProposal {
    return {
      ...proposal,
      issueSpots: [...proposal.issueSpots],
      recommendations: [...proposal.recommendations],
      knowledgeSourceIds: [
        ...proposal.knowledgeSourceIds,
      ],
      ruleEvaluationIds: [
        ...proposal.ruleEvaluationIds,
      ],
    };
  }
}
