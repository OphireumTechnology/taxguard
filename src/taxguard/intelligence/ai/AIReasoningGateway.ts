import type { AIProposalRecord, EvidencePackage } from '../types';

export interface AiReasoningProviderRequest {
  evidencePackage?: EvidencePackage;
  purpose: string;
  counts?: Record<string, number>;
  [key: string]: any;
}

export interface AiReasoningProviderResponse {
  summary?: string;
  findings?: any[];
  questions?: string[];
  confidence?: number;
  raw?: any;
  [key: string]: any;
}

export interface AiReasoningProvider {
  readonly model?: string;
  reason?(request: AiReasoningProviderRequest): Promise<AiReasoningProviderResponse>;
  generateCountsOnlyAdvisory?(
    pkg: EvidencePackage,
    purpose: string
  ): Promise<AiReasoningProviderResponse>;
  [key: string]: any;
}

export class AIReasoningGateway {
  static async reason(
    provider: AiReasoningProvider,
    evidencePackage: EvidencePackage,
    purpose: string
  ): Promise<AIProposalRecord> {
    const output =
      typeof provider?.generateCountsOnlyAdvisory === 'function'
        ? await provider.generateCountsOnlyAdvisory(evidencePackage, purpose)
        : typeof provider?.reason === 'function'
          ? await provider.reason({ evidencePackage, purpose })
          : {};
    return {
      proposalId: `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      evidencePackageId: evidencePackage.evidencePackageId || evidencePackage.id || 'ev_pkg',
      purpose,
      model: provider?.model || 'counts-only',
      summary: output?.summary || 'Advisory checklist requires independent professional review.',
      confidence: typeof output?.confidence === 'number' ? output.confidence : 0,
      createdAt: new Date().toISOString(),
      ...(output || {}),
    };
  }

  async reason(
    provider: AiReasoningProvider,
    evidencePackage: EvidencePackage,
    purpose: string
  ): Promise<AIProposalRecord> {
    return AIReasoningGateway.reason(provider, evidencePackage, purpose);
  }
}
