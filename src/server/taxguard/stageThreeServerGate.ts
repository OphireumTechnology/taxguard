import { evaluateCanonicalStageGate, type StageGateDecision } from './stageGate.types';
export function evaluateStageThreeServerGate(snapshot: any): StageGateDecision {
  return evaluateCanonicalStageGate(3, snapshot, ['documentsValidated']);
}
