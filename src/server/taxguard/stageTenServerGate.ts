import { evaluateCanonicalStageGate, type StageGateDecision } from './stageGate.types';
export function evaluateStageTenServerGate(snapshot: any): StageGateDecision {
  return evaluateCanonicalStageGate(10, snapshot, ['independentReviewerApproved', 'qcGatesPassed']);
}
