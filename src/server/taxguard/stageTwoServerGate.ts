import { evaluateCanonicalStageGate, type StageGateDecision } from './stageGate.types';
export function evaluateStageTwoServerGate(snapshot: any): StageGateDecision {
  return evaluateCanonicalStageGate(2, snapshot, ['documentsCollected']);
}
