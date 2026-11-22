import { evaluateCanonicalStageGate, type StageGateDecision } from './stageGate.types';
export function evaluateStageFifteenServerGate(snapshot: any): StageGateDecision {
  return evaluateCanonicalStageGate(15, snapshot, ['monitoringCalendarActive']);
}
