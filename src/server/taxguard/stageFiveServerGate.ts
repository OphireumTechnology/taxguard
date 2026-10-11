import { StageGateDecision } from './stageGate.types';

export interface StageFiveGateSnapshot {
  stageFourComplete: boolean;
  reconciliationsExecuted: boolean;
  variancesResolved: boolean;
  unresolvedBlockingExceptions: number;
  professionalReviewComplete: boolean;
  hardExitGatePassed: boolean;
  blockingReasons?: string[];
}

export function evaluateStageFiveServerGate(snapshot: StageFiveGateSnapshot): StageGateDecision {
  const checks = {
    stageFourComplete: snapshot.stageFourComplete === true,
    reconciliationsExecuted: snapshot.reconciliationsExecuted === true,
    variancesResolved: snapshot.variancesResolved === true,
    noBlockingExceptions: snapshot.unresolvedBlockingExceptions === 0,
    professionalReviewComplete: snapshot.professionalReviewComplete === true,
    existingHardExitGatePassed: snapshot.hardExitGatePassed === true,
  };

  const blockingReasons = [...(snapshot.blockingReasons || [])];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(`Stage 05 requirement failed: ${name}`);
    }
  }

  return {
    stage: 5,
    passed: Object.values(checks).every(Boolean) && blockingReasons.length === 0,
    gateName: 'STAGE_05_RECONCILE_GATE',
    evidence: {
      source: 'TaxGuardReconciliationEngine',
      evaluatedAt: new Date().toISOString(),
      checks,
      blockingReasons,
      metadata: {
        unresolvedBlockingExceptions: snapshot.unresolvedBlockingExceptions ?? null,
        reconciliationsExecuted: snapshot.reconciliationsExecuted === true,
      },
    },
  };
}
