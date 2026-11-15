import type { EvidencePackage } from '../types';

export interface AiReasoningProviderRequest {
  promptPurpose: string;
  taxYear: number;
  knowledgeSourceIds: string[];
  ruleEvaluationIds: string[];
  findingIds: string[];
}

export interface AiReasoningProviderResponse {
  explanation: string;
  issueSpots: string[];
  recommendations: string[];
  confidence: string;
}

export interface AiReasoningProvider {
  readonly model: string;
  reason(request: AiReasoningProviderRequest): Promise<AiReasoningProviderResponse>;
}

export class AIReasoningGateway {
  static async reason(
    provider: AiReasoningProvider,
    pkg: EvidencePackage,
    purpose: string,
  ): Promise<AiReasoningProviderResponse & { proposalId: string; createdAt: string }> {
    const res = await provider.reason({
      promptPurpose: purpose,
      taxYear: pkg.taxYear,
      knowledgeSourceIds: pkg.knowledgeSourceIds ?? [],
      ruleEvaluationIds: pkg.ruleEvaluationIds ?? [],
      findingIds: pkg.findingIds ?? [],
    });
    return {
      ...res,
      proposalId: `prop_${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
    };
  }
}
