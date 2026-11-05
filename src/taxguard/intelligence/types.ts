/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface EvidencePackage {
  evidenceId: string;
  evidencePackageId?: string;
  correlationId?: string;
  clientId?: string;
  engagementId?: string;
  taxYear?: number;
  aiProposalIds?: string[];
  knowledgeSourceIds?: string[];
  ruleEvaluationIds?: string[];
  scope: {
    tenantId: string;
    clientId: string;
    taxYear: number;
    caseId?: string;
  };
  documents: Array<{
    id: string;
    category: string;
    title: string;
    extractedFields?: Record<string, any>;
  }>;
  taxCalculations?: Record<string, any>;
  timestamp: string;
}
