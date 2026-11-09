export interface EvidencePackage {
  evidencePackageId?: string;
  evidenceId?: string;
  correlationId?: string;
  clientId?: string;
  engagementId?: string;
  taxYear?: number;
  scope?: any;
  documents?: any[];
  timestamp?: string;
  aiProposalIds?: string[];
  knowledgeSourceIds?: string[];
  ruleEvaluationIds?: string[];
  items?: Array<{ id: string; description: string; type?: string }>;
  metadata?: Record<string, unknown>;
  [key: string]: any;
}
