import { StageGateDecision } from './stageGate.types';

export interface StageSixteenGateSnapshot {
  stageFifteenComplete: boolean;
  caseClosedOrFiled: boolean;
  archiveManifestGenerated: boolean;
  integrityHashVerified: boolean;
  immutableRetentionPolicySet: boolean;
  hardExitGatePassed: boolean;
  blockingReasons?: string[];
}

export function evaluateStageSixteenServerGate(snapshot: StageSixteenGateSnapshot): StageGateDecision {
  const checks = {
    stageFifteenComplete: snapshot.stageFifteenComplete === true,
    caseClosedOrFiled: snapshot.caseClosedOrFiled === true,
    archiveManifestGenerated: snapshot.archiveManifestGenerated === true,
    integrityHashVerified: snapshot.integrityHashVerified === true,
    immutableRetentionPolicySet: snapshot.immutableRetentionPolicySet === true,
    existingHardExitGatePassed: snapshot.hardExitGatePassed === true,
  };

  const blockingReasons = [...(snapshot.blockingReasons || [])];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(`Stage 16 requirement failed: ${name}`);
    }
  }

  return {
    stage: 16,
    passed: Object.values(checks).every(Boolean) && blockingReasons.length === 0,
    gateName: 'STAGE_16_ARCHIVE_GATE',
    evidence: {
      source: 'TaxGuardArchiveEngine',
      evaluatedAt: new Date().toISOString(),
      checks,
      blockingReasons,
      metadata: {
        archiveManifestGenerated: snapshot.archiveManifestGenerated === true,
        integrityHashVerified: snapshot.integrityHashVerified === true,
      },
    },
  };
}
