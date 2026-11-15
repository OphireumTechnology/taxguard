export interface DecisionTraceEntry {
  traceId: string;
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
  recordedAt: string;
}

const traceBuffer: DecisionTraceEntry[] = [];

export const DecisionTraceLedger = {
  append(input: Omit<DecisionTraceEntry, 'traceId' | 'recordedAt'>): DecisionTraceEntry {
    const entry: DecisionTraceEntry = {
      ...input,
      traceId: `trc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      recordedAt: new Date().toISOString()
    };
    traceBuffer.push(entry);
    if (traceBuffer.length > 500) traceBuffer.shift();
    return entry;
  },
  list(): DecisionTraceEntry[] {
    return [...traceBuffer];
  }
};
