export interface ReviewScope {
  tenantId?: string;
  clientId?: string;
  engagementId?: string;
  taxYear?: number;
  [key: string]: any;
}

export interface ReviewerArtifact {
  id: string;
  caseId?: string;
  type?: string;
  title?: string;
  status?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface ReviewerReturn {
  id: string;
  caseId?: string;
  version?: number;
  status: any;
  stale?: any;
  taxYear?: number;
  formType?: string;
  [key: string]: any;
}

export interface ReviewerQueueCase {
  id: string;
  caseId?: string;
  clientId?: string;
  clientName?: string;
  taxYear?: number;
  status?: string;
  riskLevel?: string;
  returns?: ReviewerReturn[];
  artifacts?: ReviewerArtifact[];
  [key: string]: any;
}

export interface ReviewerSnapshot {
  queue?: ReviewerQueueCase[];
  returns?: ReviewerReturn[];
  artifacts?: ReviewerArtifact[];
  summary?: Record<string, any>;
  [key: string]: any;
}
