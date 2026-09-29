import { StageGateDecision } from './stageGate.types';

export interface StageTenGateSnapshot {
  stageNineComplete: boolean;
  returnApproved: boolean;
  makerCheckerVerified: boolean;
  reviewerCredentialVerified: boolean;
  unresolvedBlockingDiagnostics: number;
  unresolvedMaterialExceptions: number;
  hardExitGatePassed: boolean;
  blockingReasons?: string[];
}

export function evaluateStageTenServerGate(snapshot: StageTenGateSnapshot): StageGateDecision {
  const checks = {
    stageNineComplete: snapshot.stageNineComplete === true,
    returnApproved: snapshot.returnApproved === true,
    makerCheckerVerified: snapshot.makerCheckerVerified === true,
    reviewerCredentialVerified: snapshot.reviewerCredentialVerified === true,
    noBlockingDiagnostics: (snapshot.unresolvedBlockingDiagnostics || 0) === 0,
    noMaterialExceptions: (snapshot.unresolvedMaterialExceptions || 0) === 0,
    existingHardExitGatePassed: snapshot.hardExitGatePassed === true,
  };

  const blockingReasons = [...(snapshot.blockingReasons || [])];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(`Stage 10 requirement failed: ${name}`);
    }
  }

  return {
    stage: 10,
    passed: Object.values(checks).every(Boolean) && blockingReasons.length === 0,
    gateName: 'STAGE_10_APPROVE_GATE',
    evidence: {
      source: 'TaxGuardApprovalEngine',
      evaluatedAt: new Date().toISOString(),
      checks,
      blockingReasons,
      metadata: {
        makerCheckerVerified: snapshot.makerCheckerVerified === true,
        reviewerCredentialVerified: snapshot.reviewerCredentialVerified === true,
      },
    },
  };
}
