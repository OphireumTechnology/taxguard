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

export interface AiProposalRecord extends AiReasoningProviderResponse {
  proposalId: string;
  purpose: string;
  createdAt: string;
  model: string;
}

export class AIReasoningGateway {
  static async reason(
    provider: AiReasoningProvider,
    pkg: EvidencePackage,
    purpose: string
  ): Promise<AiProposalRecord> {
    const response = await provider.reason({
      promptPurpose: purpose,
      taxYear: pkg.taxYear,
      knowledgeSourceIds: pkg.knowledgeSourceIds,
      ruleEvaluationIds: pkg.ruleEvaluationIds,
      findingIds: pkg.findingIds || [],
    });
    return {
      ...response,
      proposalId: 'prop_' + Date.now(),
      purpose,
      createdAt: new Date().toISOString(),
      model: provider.model,
    };
  }
}
