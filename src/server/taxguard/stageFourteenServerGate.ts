import { StageGateDecision } from './stageGate.types';

export interface StageFourteenGateSnapshot {
  stageThirteenComplete: boolean;
  rejectionsOrNoticesResolved: boolean;
  openResolutionIssues: number;
  professionalReviewComplete: boolean;
  hardExitGatePassed: boolean;
  blockingReasons?: string[];
}

export function evaluateStageFourteenServerGate(snapshot: StageFourteenGateSnapshot): StageGateDecision {
  const checks = {
    stageThirteenComplete: snapshot.stageThirteenComplete === true,
    rejectionsOrNoticesResolved: snapshot.rejectionsOrNoticesResolved === true,
    noOpenResolutionIssues: (snapshot.openResolutionIssues || 0) === 0,
    professionalReviewComplete: snapshot.professionalReviewComplete === true,
    existingHardExitGatePassed: snapshot.hardExitGatePassed === true,
  };

  const blockingReasons = [...(snapshot.blockingReasons || [])];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(`Stage 14 requirement failed: ${name}`);
    }
  }

  return {
    stage: 14,
    passed: Object.values(checks).every(Boolean) && blockingReasons.length === 0,
    gateName: 'STAGE_14_RESOLVE_GATE',
    evidence: {
      source: 'TaxGuardResolutionEngine',
      evaluatedAt: new Date().toISOString(),
      checks,
      blockingReasons,
      metadata: {
        openResolutionIssues: snapshot.openResolutionIssues || 0,
        professionalReviewComplete: snapshot.professionalReviewComplete === true,
      },
    },
  };
}
