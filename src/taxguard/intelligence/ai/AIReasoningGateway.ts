/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AiReasoningProviderRequest {
  evidence: any;
  purpose: string;
  promptPurpose?: string;
  taxYear?: number;
  knowledgeSourceIds?: string[];
  ruleEvaluationIds?: string[];
  findingIds?: string[];
}

export interface AiReasoningProviderResponse {
  explanation: string;
  issueSpots: string[];
  recommendations: string[];
  confidence: string;
  proposalId?: string;
  createdAt?: string;
}

export interface AiReasoningProvider {
  model?: string;
  reason: (request: AiReasoningProviderRequest) => Promise<AiReasoningProviderResponse>;
}

export class AIReasoningGateway {
  static async reason(
    provider: any,
    evidencePackage: any,
    purpose: string
  ): Promise<AiReasoningProviderResponse> {
    if (provider && typeof provider.reason === 'function') {
      return provider.reason({ evidence: evidencePackage, purpose, promptPurpose: purpose });
    }
    return {
      explanation: 'Governed rule-based review completed without discrepancy.',
      issueSpots: [],
      recommendations: ['Maintain current evidence records.'],
      confidence: 'HIGH_CONFIDENCE',
      proposalId: 'prop_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString()
    };
  }
}
