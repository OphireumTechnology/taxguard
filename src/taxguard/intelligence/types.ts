export interface EvidencePackage {
  evidencePackageId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  correlationId: string;
  aiProposalIds: string[];
  knowledgeSourceIds: string[];
  ruleEvaluationIds: string[];
  findingIds?: string[];
  [key: string]: any;
}
