
export interface EvidencePackage {
  packageId?: string;
  sourceDocuments?: string[];
  facts?: Record<string, any>;
  taxYear?: number;
  [key: string]: any;
}

export interface AiReasoningProposal {
  explanation: string;
  issueSpots: string[];
  recommendations: string[];
  confidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE" | "MISSING_CONFIDENCE";
  model?: string;
}
