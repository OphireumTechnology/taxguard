export interface EvidencePackage {
  evidencePackageId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  correlationId: string;
  knowledgeSourceIds: string[];
  ruleEvaluationIds: string[];
  findingIds: string[];
  aiProposalIds: string[];
  summaryCounts?: Record<string, number>;
}
