export interface TraceEntry {
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
  traceId?: string;
  timestamp?: string;
}

export class DecisionTraceLedger {
  static append(entry: TraceEntry): TraceEntry & { traceId: string; timestamp: string } {
    return {
      ...entry,
      traceId: entry.traceId || `trace_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
    };
  }
}
