import {
  StageGateDecision
} from './stageGate.types';

export interface StageTwoGateSnapshot {
  completenessPassed: boolean;

  unresolvedBlockingExceptions: number;

  reconciliationPassed: boolean;

  professionalCertificationPassed: boolean;

  hardExitGatePassed: boolean;

  blockingReasons?: string[];
}

export function evaluateStageTwoServerGate(
  snapshot: StageTwoGateSnapshot
): StageGateDecision {

  const checks = {
    completenessPassed:
      snapshot.completenessPassed === true,

    noBlockingExceptions:
      snapshot.unresolvedBlockingExceptions === 0,

    reconciliationPassed:
      snapshot.reconciliationPassed === true,

    professionalCertificationPassed:
      snapshot.professionalCertificationPassed === true,

    existingHardExitGatePassed:
      snapshot.hardExitGatePassed === true
  };

  const blockingReasons = [
    ...(snapshot.blockingReasons || [])
  ];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(
        `Stage 02 requirement failed: ${name}`
      );
    }
  }

  return {
    stage: 2,

    passed:
      Object.values(checks).every(Boolean) &&
      blockingReasons.length === 0,

    gateName: 'STAGE_02_HARD_EXIT_GATE',

    evidence: {
      source:
        'StageTwoCollectionOperationsService',

      evaluatedAt:
        new Date().toISOString(),

      checks,
      blockingReasons,

      metadata: {
        unresolvedBlockingExceptions:
          snapshot.unresolvedBlockingExceptions
      }
    }
  };
}
