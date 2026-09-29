import { StageGateDecision } from './stageGate.types';

export interface StageNineGateSnapshot {
  stageEightComplete: boolean;
  authoritativeDataCurrent: boolean;
  deterministicCalculationsComplete: boolean;
  unresolvedBlockingDiagnostics: number;
  draftReturnGenerated: boolean;
  preparerReviewComplete: boolean;
  provenanceComplete: boolean;
  hardExitGatePassed: boolean;
  blockingReasons?: string[];
}

export function evaluateStageNineServerGate(snapshot: StageNineGateSnapshot): StageGateDecision {
  const checks = {
    stageEightComplete: snapshot.stageEightComplete === true,
    authoritativeDataCurrent: snapshot.authoritativeDataCurrent === true,
    deterministicCalculationsComplete: snapshot.deterministicCalculationsComplete === true,
    noBlockingDiagnostics: (snapshot.unresolvedBlockingDiagnostics || 0) === 0,
    draftReturnGenerated: snapshot.draftReturnGenerated === true,
    preparerReviewComplete: snapshot.preparerReviewComplete === true,
    provenanceComplete: snapshot.provenanceComplete === true,
    existingHardExitGatePassed: snapshot.hardExitGatePassed === true,
  };

  const blockingReasons = [...(snapshot.blockingReasons || [])];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(`Stage 09 requirement failed: ${name}`);
    }
  }

  return {
    stage: 9,
    passed: Object.values(checks).every(Boolean) && blockingReasons.length === 0,
    gateName: 'STAGE_09_RETURN_GATE',
    evidence: {
      source: 'TaxGuardReturnEngine',
      evaluatedAt: new Date().toISOString(),
      checks,
      blockingReasons,
      metadata: {
        unresolvedBlockingDiagnostics: snapshot.unresolvedBlockingDiagnostics || 0,
        draftReturnGenerated: snapshot.draftReturnGenerated === true,
      },
    },
  };
}
