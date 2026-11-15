import { StageGateDecision } from './stageGate.types';

export interface StageSixGateSnapshot {
  stageFiveComplete: boolean;
  reviewQueueCleared: boolean;
  makerCheckerSatisfied: boolean;
  workpapersComplete: boolean;
  unresolvedBlockingExceptions: number;
  hardExitGatePassed: boolean;
  blockingReasons?: string[];
}

export function evaluateStageSixServerGate(snapshot: StageSixGateSnapshot): StageGateDecision {
  const checks = {
    stageFiveComplete: snapshot.stageFiveComplete === true,
    reviewQueueCleared: snapshot.reviewQueueCleared === true,
    makerCheckerSatisfied: snapshot.makerCheckerSatisfied === true,
    workpapersComplete: snapshot.workpapersComplete === true,
    noBlockingExceptions: snapshot.unresolvedBlockingExceptions === 0,
    existingHardExitGatePassed: snapshot.hardExitGatePassed === true,
  };

  const blockingReasons = [...(snapshot.blockingReasons || [])];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(`Stage 06 requirement failed: ${name}`);
    }
  }

  return {
    stage: 6,
    passed: Object.values(checks).every(Boolean) && blockingReasons.length === 0,
    gateName: 'STAGE_06_REVIEW_GATE',
    evidence: {
      source: 'TaxGuardReviewEngine',
      evaluatedAt: new Date().toISOString(),
      checks,
      blockingReasons,
      metadata: {
        unresolvedBlockingExceptions: snapshot.unresolvedBlockingExceptions ?? null,
        makerCheckerSatisfied: snapshot.makerCheckerSatisfied === true,
      },
    },
  };
}
