export interface DecisionTraceInput {
  clientId: string;
  engagementId: string;
  taxYear: number;
  stage: string;
  actorId: string;
  actorRole: string;
  summary: string;
  evidencePackageIds: string[];
  aiProposalIds: string[];
  knowledgeSourceIds: string[];
  ruleEvaluationIds: string[];
  humanReviewIds: string[];
  isAiProposedOnly: boolean;
  correlationId: string;
}

export interface DecisionTraceRecord extends DecisionTraceInput {
  traceId: string;
  recordedAt: string;
}

export class DecisionTraceLedger {
  static append(input: DecisionTraceInput): DecisionTraceRecord {
    return {
      ...input,
      traceId: 'trace_' + Date.now(),
      recordedAt: new Date().toISOString(),
    };
  }
}
