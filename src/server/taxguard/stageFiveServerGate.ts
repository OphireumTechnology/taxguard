import { evaluateCanonicalStageGate, type StageGateDecision } from './stageGate.types';
export function evaluateStageFiveServerGate(snapshot: any): StageGateDecision {
  return evaluateCanonicalStageGate(5, snapshot, ['reconciliationComplete']);
}
