import { StageGateDecision } from './stageGate.types';

export interface StageSevenGateSnapshot {
  stageSixComplete: boolean;
  requiredReportsGenerated: boolean;
  reportsCurrent: boolean;
  unresolvedBlockingExceptions: number;
  hardExitGatePassed: boolean;
  blockingReasons?: string[];
}

export function evaluateStageSevenServerGate(snapshot: StageSevenGateSnapshot): StageGateDecision {
  const checks = {
    stageSixComplete: snapshot.stageSixComplete === true,
    requiredReportsGenerated: snapshot.requiredReportsGenerated === true,
    reportsCurrent: snapshot.reportsCurrent === true,
    noBlockingExceptions: (snapshot.unresolvedBlockingExceptions || 0) === 0,
    existingHardExitGatePassed: snapshot.hardExitGatePassed === true,
  };

  const blockingReasons = [...(snapshot.blockingReasons || [])];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(`Stage 07 requirement failed: ${name}`);
    }
  }

  return {
    stage: 7,
    passed: Object.values(checks).every(Boolean) && blockingReasons.length === 0,
    gateName: 'STAGE_07_REPORT_GATE',
    evidence: {
      source: 'TaxGuardReportingEngine',
      evaluatedAt: new Date().toISOString(),
      checks,
      blockingReasons,
      metadata: {
        unresolvedBlockingExceptions: snapshot.unresolvedBlockingExceptions || 0,
        reportsCurrent: snapshot.reportsCurrent === true,
      },
    },
  };
}
