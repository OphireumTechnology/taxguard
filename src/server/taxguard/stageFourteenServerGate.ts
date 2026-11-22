import { evaluateCanonicalStageGate, type StageGateDecision } from './stageGate.types';
export function evaluateStageFourteenServerGate(snapshot: any): StageGateDecision {
  return evaluateCanonicalStageGate(14, snapshot, ['resolutionConfirmed']);
}
