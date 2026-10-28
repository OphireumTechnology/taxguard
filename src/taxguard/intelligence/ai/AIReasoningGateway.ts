
import type { EvidencePackage, AiReasoningProposal } from "../types";

export interface AiReasoningProviderRequest {
  evidencePackage: EvidencePackage;
  purpose: string;
}

export interface AiReasoningProviderResponse {
  explanation: string;
  issueSpots: string[];
  recommendations: string[];
  confidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE" | "MISSING_CONFIDENCE";
}

export interface AiReasoningProvider {
  model: string;
  reason(request: AiReasoningProviderRequest): Promise<AiReasoningProviderResponse>;
}

export class AIReasoningGateway {
  static async reason(provider: AiReasoningProvider, evidencePackage: EvidencePackage, purpose: string): Promise<AiReasoningProposal> {
    const res = await provider.reason({ evidencePackage, purpose });
    return {
      ...res,
      model: provider.model
    };
  }
}
