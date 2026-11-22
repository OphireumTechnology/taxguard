export interface EvidencePackage {
  correlationId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  aiProposalIds: string[];
  documents?: any[];
  extractions?: any[];
  [key: string]: any;
}
