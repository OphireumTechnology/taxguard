export interface DecisionTraceEntry {
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

export class DecisionTraceLedger {
  private static readonly entries: Array<DecisionTraceEntry & { traceId: string; recordedAt: string }> = [];

  static append(entry: DecisionTraceEntry) {
    const record = {
      ...entry,
      traceId: `tr_${Date.now().toString(36)}_${this.entries.length + 1}`,
      recordedAt: new Date().toISOString(),
    };
    this.entries.push(record);
    return record;
  }
}
