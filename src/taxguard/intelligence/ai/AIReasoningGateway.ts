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

export interface AiProposal extends AiReasoningProviderResponse {
  proposalId: string;
  evidencePackageId: string;
  purpose: string;
  model: string;
  createdAt: string;
}

export const AIReasoningGateway = {
  async reason(
    provider: AiReasoningProvider,
    evidencePackage: EvidencePackage,
    purpose: string
  ): Promise<AiProposal> {
    const response = await provider.reason({
      promptPurpose: purpose,
      taxYear: evidencePackage.taxYear,
      knowledgeSourceIds: evidencePackage.knowledgeSourceIds,
      ruleEvaluationIds: evidencePackage.ruleEvaluationIds,
      findingIds: evidencePackage.findingIds
    });
    return {
      ...response,
      proposalId: `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      evidencePackageId: evidencePackage.evidencePackageId,
      purpose,
      model: provider.model,
      createdAt: new Date().toISOString()
    };
  }
};
