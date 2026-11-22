import { evaluateCanonicalStageGate, type StageGateDecision } from './stageGate.types';
export function evaluateStageEightServerGate(snapshot: any): StageGateDecision {
  return evaluateCanonicalStageGate(8, snapshot, ['taxPlanFinalized']);
}
