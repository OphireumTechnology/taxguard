import {
  StageGateDecision
} from './stageGate.types';

export interface StageOneGateSnapshot {
  hardExitGatePassed: boolean;

  identityComplete: boolean;
  taxProfileComplete: boolean;
  consentComplete: boolean;
  reviewComplete: boolean;

  blockingReasons?: string[];
}

export function evaluateStageOneServerGate(
  snapshot: StageOneGateSnapshot
): StageGateDecision {

  const checks = {
    identityComplete:
      snapshot.identityComplete === true,

    taxProfileComplete:
      snapshot.taxProfileComplete === true,

    consentComplete:
      snapshot.consentComplete === true,

    reviewComplete:
      snapshot.reviewComplete === true,

    existingHardExitGatePassed:
      snapshot.hardExitGatePassed === true
  };

  const blockingReasons = [
    ...(snapshot.blockingReasons || [])
  ];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(
        `Stage 01 requirement failed: ${name}`
      );
    }
  }

  return {
    stage: 1,

    passed:
      Object.values(checks).every(Boolean) &&
      blockingReasons.length === 0,

    gateName: 'STAGE_01_HARD_EXIT_GATE',

    evidence: {
      source: 'StageOneOnboardingService',
      evaluatedAt: new Date().toISOString(),
      checks,
      blockingReasons
    }
  };
}
