import type { DecisionTraceRecord } from '../types';

export class DecisionTraceLedger {
  static append(input: Record<string, any>): DecisionTraceRecord {
    return {
      traceId: `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      recordedAt: new Date().toISOString(),
      ...input,
    };
  }

  append(input: Record<string, any>): DecisionTraceRecord {
    return DecisionTraceLedger.append(input);
  }
}
