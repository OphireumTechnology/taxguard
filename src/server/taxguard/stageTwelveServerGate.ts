import { StageGateDecision } from './stageGate.types';

export interface StageTwelveGateSnapshot {
  stageElevenComplete: boolean;
  signaturesVerified: boolean;
  filingPackageCreated: boolean;
  filingSubmitted: boolean;
  filingAcknowledged: boolean;
  providerConfigured: boolean;
  hardExitGatePassed: boolean;
  blockingReasons?: string[];
}

export function evaluateStageTwelveServerGate(snapshot: StageTwelveGateSnapshot): StageGateDecision {
  const checks = {
    stageElevenComplete: snapshot.stageElevenComplete === true,
    signaturesVerified: snapshot.signaturesVerified === true,
    filingPackageCreated: snapshot.filingPackageCreated === true,
    filingSubmitted: snapshot.filingSubmitted === true,
    filingAcknowledged: snapshot.filingAcknowledged === true,
    providerConfigured: snapshot.providerConfigured === true,
    existingHardExitGatePassed: snapshot.hardExitGatePassed === true,
  };

  const blockingReasons = [...(snapshot.blockingReasons || [])];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(`Stage 12 requirement failed: ${name}`);
    }
  }

  return {
    stage: 12,
    passed: Object.values(checks).every(Boolean) && blockingReasons.length === 0,
    gateName: 'STAGE_12_FILE_GATE',
    evidence: {
      source: 'TaxGuardFilingEngine',
      evaluatedAt: new Date().toISOString(),
      checks,
      blockingReasons,
      metadata: {
        filingSubmitted: snapshot.filingSubmitted === true,
        filingAcknowledged: snapshot.filingAcknowledged === true,
        providerConfigured: snapshot.providerConfigured === true,
      },
    },
  };
}
