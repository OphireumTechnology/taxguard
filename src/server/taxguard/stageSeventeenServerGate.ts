import { StageGateDecision } from './stageGate.types';

export interface StageSeventeenGateSnapshot {
  stageSixteenComplete: boolean;
  priorYearCaseArchived: boolean;
  renewalChecklistCompleted: boolean;
  carryForwardCandidatesClassified: boolean;
  hardExitGatePassed: boolean;
  blockingReasons?: string[];
}

export function evaluateStageSeventeenServerGate(snapshot: StageSeventeenGateSnapshot): StageGateDecision {
  const checks = {
    stageSixteenComplete: snapshot.stageSixteenComplete === true,
    priorYearCaseArchived: snapshot.priorYearCaseArchived === true,
    renewalChecklistCompleted: snapshot.renewalChecklistCompleted === true,
    carryForwardCandidatesClassified: snapshot.carryForwardCandidatesClassified === true,
    existingHardExitGatePassed: snapshot.hardExitGatePassed === true,
  };

  const blockingReasons = [...(snapshot.blockingReasons || [])];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(`Stage 17 requirement failed: ${name}`);
    }
  }

  return {
    stage: 17,
    passed: Object.values(checks).every(Boolean) && blockingReasons.length === 0,
    gateName: 'STAGE_17_RENEW_GATE',
    evidence: {
      source: 'TaxGuardRenewalEngine',
      evaluatedAt: new Date().toISOString(),
      checks,
      blockingReasons,
      metadata: {
        priorYearCaseArchived: snapshot.priorYearCaseArchived === true,
        carryForwardCandidatesClassified: snapshot.carryForwardCandidatesClassified === true,
      },
    },
  };
}
