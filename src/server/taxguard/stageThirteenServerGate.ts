import { StageGateDecision } from './stageGate.types';

export interface StageThirteenGateSnapshot {
  stageTwelveComplete: boolean;
  feedbackReceived: boolean;
  feedbackProcessed: boolean;
  unresolvedGovernmentNotices: number;
  hardExitGatePassed: boolean;
  blockingReasons?: string[];
}

export function evaluateStageThirteenServerGate(snapshot: StageThirteenGateSnapshot): StageGateDecision {
  const checks = {
    stageTwelveComplete: snapshot.stageTwelveComplete === true,
    feedbackReceived: snapshot.feedbackReceived === true,
    feedbackProcessed: snapshot.feedbackProcessed === true,
    noUnresolvedNotices: (snapshot.unresolvedGovernmentNotices || 0) === 0,
    existingHardExitGatePassed: snapshot.hardExitGatePassed === true,
  };

  const blockingReasons = [...(snapshot.blockingReasons || [])];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(`Stage 13 requirement failed: ${name}`);
    }
  }

  return {
    stage: 13,
    passed: Object.values(checks).every(Boolean) && blockingReasons.length === 0,
    gateName: 'STAGE_13_GOVERNMENT_FEEDBACK_GATE',
    evidence: {
      source: 'TaxGuardGovernmentFeedbackEngine',
      evaluatedAt: new Date().toISOString(),
      checks,
      blockingReasons,
      metadata: {
        feedbackReceived: snapshot.feedbackReceived === true,
        unresolvedGovernmentNotices: snapshot.unresolvedGovernmentNotices || 0,
      },
    },
  };
}
