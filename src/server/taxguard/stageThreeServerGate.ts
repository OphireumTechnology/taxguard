import {
  StageGateDecision
} from './stageGate.types';

export interface StageThreeGateSnapshot {
  validationComplete: boolean;

  provenanceComplete: boolean;

  unresolvedBlockingExceptions: number;

  humanReviewRequired: boolean;

  humanReviewApproved: boolean;

  hardExitGatePassed: boolean;

  aiOnlyDecision?: boolean;

  blockingReasons?: string[];
}

export function evaluateStageThreeServerGate(
  snapshot: StageThreeGateSnapshot
): StageGateDecision {

  const humanReviewSatisfied =
    snapshot.humanReviewRequired
      ? snapshot.humanReviewApproved === true
      : true;

  const checks = {
    validationComplete:
      snapshot.validationComplete === true,

    provenanceComplete:
      snapshot.provenanceComplete === true,

    noBlockingExceptions:
      snapshot.unresolvedBlockingExceptions === 0,

    humanReviewSatisfied,

    notAiOnly:
      snapshot.aiOnlyDecision !== true,

    existingHardExitGatePassed:
      snapshot.hardExitGatePassed === true
  };

  const blockingReasons = [
    ...(snapshot.blockingReasons || [])
  ];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(
        `Stage 03 requirement failed: ${name}`
      );
    }
  }

  return {
    stage: 3,

    passed:
      Object.values(checks).every(Boolean) &&
      blockingReasons.length === 0,

    gateName: 'STAGE_03_HARD_EXIT_GATE',

    evidence: {
      source:
        'StageThreeValidationService',

      evaluatedAt:
        new Date().toISOString(),

      checks,
      blockingReasons,

      metadata: {
        unresolvedBlockingExceptions:
          snapshot.unresolvedBlockingExceptions,

        humanReviewRequired:
          snapshot.humanReviewRequired,

        humanReviewApproved:
          snapshot.humanReviewApproved,

        aiOnlyDecision:
          snapshot.aiOnlyDecision === true
      }
    }
  };
}
