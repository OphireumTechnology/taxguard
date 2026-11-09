import type { EvidencePackage } from '../types';

export interface AiReasoningProviderRequest {
  purpose: string;
  promptPurpose?: string;
  taxYear?: number;
  knowledgeSourceIds?: string[];
  ruleEvaluationIds?: string[];
  findingIds?: string[];
  evidencePackage?: EvidencePackage;
  package?: EvidencePackage;
  [key: string]: any;
}

export interface AiReasoningProviderResponse {
  explanation: string;
  issueSpots: string[];
  recommendations: string[];
  confidence: string;
}

export interface AiReasoningProvider {
  model: string;
  reason(request: AiReasoningProviderRequest): Promise<AiReasoningProviderResponse>;
}

export class AIReasoningGateway {
  static async reason(
    provider: AiReasoningProvider,
    evidencePackage: EvidencePackage,
    purpose: string
  ): Promise<AiReasoningProviderResponse & { proposalId: string; createdAt: string }> {
    const res = await provider.reason({
      purpose,
      promptPurpose: purpose,
      evidencePackage,
      package: evidencePackage,
      taxYear: evidencePackage.taxYear,
      knowledgeSourceIds: evidencePackage.knowledgeSourceIds,
      ruleEvaluationIds: evidencePackage.ruleEvaluationIds,
    });
    return {
      ...res,
      proposalId: `prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
  }
}
