import { StageGateDecision } from './stageGate.types';

export interface StageElevenGateSnapshot {
  stageTenComplete: boolean;
  signaturePackageCreated: boolean;
  allSignaturesObtained: boolean;
  providerConfigured: boolean;
  hardExitGatePassed: boolean;
  blockingReasons?: string[];
}

export function evaluateStageElevenServerGate(snapshot: StageElevenGateSnapshot): StageGateDecision {
  const checks = {
    stageTenComplete: snapshot.stageTenComplete === true,
    signaturePackageCreated: snapshot.signaturePackageCreated === true,
    allSignaturesObtained: snapshot.allSignaturesObtained === true,
    providerConfigured: snapshot.providerConfigured === true,
    existingHardExitGatePassed: snapshot.hardExitGatePassed === true,
  };

  const blockingReasons = [...(snapshot.blockingReasons || [])];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(`Stage 11 requirement failed: ${name}`);
    }
  }

  return {
    stage: 11,
    passed: Object.values(checks).every(Boolean) && blockingReasons.length === 0,
    gateName: 'STAGE_11_SIGN_GATE',
    evidence: {
      source: 'TaxGuardSignatureEngine',
      evaluatedAt: new Date().toISOString(),
      checks,
      blockingReasons,
      metadata: {
        allSignaturesObtained: snapshot.allSignaturesObtained === true,
        providerConfigured: snapshot.providerConfigured === true,
      },
    },
  };
}
