export interface EvidencePackage {
  id?: string;
  evidencePackageId?: string;
  caseId?: string;
  engagementId?: string;
  tenantId?: string;
  clientId?: string;
  taxYear?: number;
  correlationId?: string;
  aiProposalIds?: string[];
  knowledgeSourceIds?: string[];
  ruleEvaluationIds?: string[];
  items?: Array<{
    id: string;
    type?: string;
    summary?: string;
    sourceRef?: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export interface AIProposalRecord {
  proposalId: string;
  evidencePackageId?: string;
  purpose?: string;
  model?: string;
  summary?: string;
  confidence?: number;
  createdAt: string;
  [key: string]: any;
}

export interface HumanReviewItem {
  queueItemId: string;
  status: string;
  title?: string;
  description?: string;
  severity?: string;
  createdAt: string;
  [key: string]: any;
}

export interface DecisionTraceRecord {
  traceId: string;
  stage?: string;
  summary?: string;
  recordedAt: string;
  [key: string]: any;
}
