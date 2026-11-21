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
  confidence: 'HIGH_CONFIDENCE' | 'MEDIUM_CONFIDENCE' | 'LOW_CONFIDENCE' | 'MISSING_CONFIDENCE';
}

export interface AiReasoningProvider {
  readonly model: string;
  reason(request: AiReasoningProviderRequest): Promise<AiReasoningProviderResponse>;
}

export interface AiProposalRecord extends AiReasoningProviderResponse {
  proposalId: string;
  purpose: string;
  createdAt: string;
  isAiProposedOnly: true;
}

export const AIReasoningGateway = {
  async reason(
    provider: AiReasoningProvider,
    evidencePackage: EvidencePackage,
    promptPurpose: string
  ): Promise<AiProposalRecord> {
    const response = await provider.reason({
      promptPurpose,
      taxYear: evidencePackage.taxYear,
      knowledgeSourceIds: evidencePackage.knowledgeSourceIds,
      ruleEvaluationIds: evidencePackage.ruleEvaluationIds,
      findingIds: evidencePackage.findingIds,
    });
    return {
      ...response,
      proposalId: `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      purpose: promptPurpose,
      createdAt: new Date().toISOString(),
      isAiProposedOnly: true,
    };
  },
};
