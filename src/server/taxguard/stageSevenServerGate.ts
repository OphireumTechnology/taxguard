import { evaluateCanonicalStageGate, type StageGateDecision } from './stageGate.types';
export function evaluateStageSevenServerGate(snapshot: any): StageGateDecision {
  return evaluateCanonicalStageGate(7, snapshot, ['financialReportsIssued']);
}
