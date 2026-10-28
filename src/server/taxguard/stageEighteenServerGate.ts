import { StageGateDecision } from './stageGate.types';

export interface StageEighteenGateSnapshot {
  stageSeventeenComplete: boolean;
  nextYearCaseCreated: boolean;
  nextYearStartsAtStageOne: boolean;
  provenancePreserved: boolean;
  noDuplicateActiveCase: boolean;
  hardExitGatePassed: boolean;
  blockingReasons?: string[];
}

export function evaluateStageEighteenServerGate(snapshot: StageEighteenGateSnapshot): StageGateDecision {
  const checks = {
    stageSeventeenComplete: snapshot.stageSeventeenComplete === true,
    nextYearCaseCreated: snapshot.nextYearCaseCreated === true,
    nextYearStartsAtStageOne: snapshot.nextYearStartsAtStageOne === true,
    provenancePreserved: snapshot.provenancePreserved === true,
    noDuplicateActiveCase: snapshot.noDuplicateActiveCase === true,
    existingHardExitGatePassed: snapshot.hardExitGatePassed === true,
  };

  const blockingReasons = [...(snapshot.blockingReasons || [])];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(`Stage 18 requirement failed: ${name}`);
    }
  }

  return {
    stage: 18,
    passed: Object.values(checks).every(Boolean) && blockingReasons.length === 0,
    gateName: 'STAGE_18_REPEAT_GATE',
    evidence: {
      source: 'TaxGuardRepeatEngine',
      evaluatedAt: new Date().toISOString(),
      checks,
      blockingReasons,
      metadata: {
        nextYearCaseCreated: snapshot.nextYearCaseCreated === true,
        nextYearStartsAtStageOne: snapshot.nextYearStartsAtStageOne === true,
      },
    },
  };
}
