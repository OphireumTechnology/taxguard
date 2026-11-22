import type { EvidencePackage } from '../types';

export interface AiReasoningProviderRequest {
  purpose: string;
  counts?: Record<string, number>;
  [key: string]: any;
}

export interface AiReasoningProviderResponse {
  explanation: string;
  issueSpots: string[];
  recommendations: string[];
  confidence: 'HIGH_CONFIDENCE' | 'MEDIUM_CONFIDENCE' | 'LOW_CONFIDENCE' | 'MISSING_CONFIDENCE' | string;
}

export interface AiReasoningProvider {
  readonly model: string;
  reason?: (request: AiReasoningProviderRequest) => Promise<AiReasoningProviderResponse>;
  [key: string]: any;
}

export interface AiReasoningProposal extends AiReasoningProviderResponse {
  proposalId: string;
  purpose: string;
  model: string;
  createdAt: string;
}

export const AIReasoningGateway = {
  async reason(
    provider: AiReasoningProvider,
    pkg: EvidencePackage,
    purpose: string
  ): Promise<AiReasoningProposal> {
    const request: AiReasoningProviderRequest = {
      purpose,
      counts: {
        documents: Array.isArray(pkg.documents) ? pkg.documents.length : 0,
        extractions: Array.isArray(pkg.extractions) ? pkg.extractions.length : 0,
      },
    };
    const result = provider.reason
      ? await provider.reason(request)
      : {
          explanation: 'Advisory review requires licensed CPA verification.',
          issueSpots: [],
          recommendations: [],
          confidence: 'LOW_CONFIDENCE',
        };
    return {
      ...result,
      proposalId: `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      purpose,
      model: provider.model || 'unconfigured',
      createdAt: new Date().toISOString(),
    };
  },
};
