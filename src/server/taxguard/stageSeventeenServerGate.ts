import { evaluateCanonicalStageGate, type StageGateDecision } from './stageGate.types';
export function evaluateStageSeventeenServerGate(snapshot: any): StageGateDecision {
  return evaluateCanonicalStageGate(17, snapshot, ['renewalAuthorized']);
}
