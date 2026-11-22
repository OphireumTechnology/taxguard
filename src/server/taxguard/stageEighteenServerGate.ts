import { evaluateCanonicalStageGate, type StageGateDecision } from './stageGate.types';
export function evaluateStageEighteenServerGate(snapshot: any): StageGateDecision {
  return evaluateCanonicalStageGate(18, snapshot, ['carryforwardReviewed', 'nextCycleInitialized']);
}
