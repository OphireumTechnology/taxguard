export interface DecisionTraceEntry {
  traceId: string;
  clientId?: string;
  engagementId?: string;
  taxYear?: number;
  stage?: string;
  actorId?: string;
  actorRole?: string;
  summary?: string;
  timestamp: string;
  [key: string]: any;
}

const traceEntries: DecisionTraceEntry[] = [];

export const DecisionTraceLedger = {
  append(entry: Record<string, any>): DecisionTraceEntry {
    const record: DecisionTraceEntry = {
      ...entry,
      traceId: `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };
    traceEntries.push(record);
    return record;
  },
  list(): DecisionTraceEntry[] {
    return [...traceEntries];
  },
};
