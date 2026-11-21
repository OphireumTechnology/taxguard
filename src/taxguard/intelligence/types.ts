export interface EvidencePackage {
  evidencePackageId: string;
  correlationId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  knowledgeSourceIds: string[];
  ruleEvaluationIds: string[];
  findingIds: string[];
  aiProposalIds: string[];
  createdAt?: string;
}
