import { evaluateCanonicalStageGate, type StageGateDecision } from './stageGate.types';
export function evaluateStageThirteenServerGate(snapshot: any): StageGateDecision {
  return evaluateCanonicalStageGate(13, snapshot, ['governmentFeedbackRecorded']);
}
