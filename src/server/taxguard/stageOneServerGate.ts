import { evaluateCanonicalStageGate, type StageGateDecision } from './stageGate.types';
export function evaluateStageOneServerGate(snapshot: any): StageGateDecision {
  return evaluateCanonicalStageGate(1, snapshot, ['identityVerified', 'engagementSigned']);
}
