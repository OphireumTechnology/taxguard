import { evaluateCanonicalStageGate, type StageGateDecision } from './stageGate.types';
export function evaluateStageFourServerGate(snapshot: any): StageGateDecision {
  return evaluateCanonicalStageGate(4, snapshot, ['ledgerRecorded']);
}
