import { StageGateDecision } from './stageGate.types';

export interface StageFourGateSnapshot {
  stageThreeComplete: boolean;
  validatedEvidenceRecorded: boolean;
  provenanceComplete: boolean;
  unresolvedBlockingExceptions: number;
  unresolvedDuplicateConflicts: number;
  professionalReviewComplete: boolean;
  hardExitGatePassed: boolean;
  blockingReasons?: string[];
}

export function evaluateStageFourServerGate(snapshot: StageFourGateSnapshot): StageGateDecision {
  const checks = {
    stageThreeComplete: snapshot.stageThreeComplete === true,
    validatedEvidenceRecorded: snapshot.validatedEvidenceRecorded === true,
    provenanceComplete: snapshot.provenanceComplete === true,
    noBlockingExceptions: (snapshot.unresolvedBlockingExceptions || 0) === 0,
    noDuplicateConflicts: (snapshot.unresolvedDuplicateConflicts || 0) === 0,
    professionalReviewComplete: snapshot.professionalReviewComplete === true,
    existingHardExitGatePassed: snapshot.hardExitGatePassed === true,
  };

  const blockingReasons = [...(snapshot.blockingReasons || [])];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(`Stage 04 requirement failed: ${name}`);
    }
  }

  return {
    stage: 4,
    passed: Object.values(checks).every(Boolean) && blockingReasons.length === 0,
    gateName: 'STAGE_04_RECORD_GATE',
    evidence: {
      source: 'TaxGuardRecordEngine',
      evaluatedAt: new Date().toISOString(),
      checks,
      blockingReasons,
      metadata: {
        unresolvedBlockingExceptions: snapshot.unresolvedBlockingExceptions || 0,
        unresolvedDuplicateConflicts: snapshot.unresolvedDuplicateConflicts || 0,
      },
    },
  };
}
