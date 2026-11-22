import { evaluateCanonicalStageGate, type StageGateDecision } from './stageGate.types';
export function evaluateStageSixServerGate(snapshot: any): StageGateDecision {
  return evaluateCanonicalStageGate(6, snapshot, ['reviewApproved']);
}
