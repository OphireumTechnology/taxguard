export interface DecisionTraceEntryInput {
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

export interface DecisionTraceEntry extends DecisionTraceEntryInput {
  traceId: string;
  recordedAt: string;
}

const traceEntries: DecisionTraceEntry[] = [];

export const DecisionTraceLedger = {
  append(input: DecisionTraceEntryInput): DecisionTraceEntry {
    const entry: DecisionTraceEntry = {
      ...input,
      traceId: `trc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      recordedAt: new Date().toISOString(),
    };
    traceEntries.push(entry);
    return entry;
  },
  list(): DecisionTraceEntry[] {
    return [...traceEntries];
  },
};
