import { StageGateDecision } from './stageGate.types';

export interface StageEightGateSnapshot {
  stageSevenComplete: boolean;
  planningDocumentedOrWaived: boolean;
  actualDataPreserved: boolean;
  projectedResultsIsolated: boolean;
  professionalReviewComplete: boolean;
  hardExitGatePassed: boolean;
  blockingReasons?: string[];
}

export function evaluateStageEightServerGate(snapshot: StageEightGateSnapshot): StageGateDecision {
  const checks = {
    stageSevenComplete: snapshot.stageSevenComplete === true,
    planningDocumentedOrWaived: snapshot.planningDocumentedOrWaived === true,
    actualDataPreserved: snapshot.actualDataPreserved === true,
    projectedResultsIsolated: snapshot.projectedResultsIsolated === true,
    professionalReviewComplete: snapshot.professionalReviewComplete === true,
    existingHardExitGatePassed: snapshot.hardExitGatePassed === true,
  };

  const blockingReasons = [...(snapshot.blockingReasons || [])];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(`Stage 08 requirement failed: ${name}`);
    }
  }

  return {
    stage: 8,
    passed: Object.values(checks).every(Boolean) && blockingReasons.length === 0,
    gateName: 'STAGE_08_PLAN_GATE',
    evidence: {
      source: 'TaxGuardPlanningEngine',
      evaluatedAt: new Date().toISOString(),
      checks,
      blockingReasons,
      metadata: {
        actualDataPreserved: snapshot.actualDataPreserved === true,
        projectedResultsIsolated: snapshot.projectedResultsIsolated === true,
      },
    },
  };
}
