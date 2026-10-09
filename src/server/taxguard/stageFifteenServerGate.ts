import { StageGateDecision } from './stageGate.types';

export interface StageFifteenGateSnapshot {
  stageFourteenComplete: boolean;
  monitoringItemsCurrent: boolean;
  unresolvedDeadlines: number;
  followUpsCompleted: boolean;
  hardExitGatePassed: boolean;
  blockingReasons?: string[];
}

export function evaluateStageFifteenServerGate(snapshot: StageFifteenGateSnapshot): StageGateDecision {
  const checks = {
    stageFourteenComplete: snapshot.stageFourteenComplete === true,
    monitoringItemsCurrent: snapshot.monitoringItemsCurrent === true,
    noUnresolvedDeadlines: snapshot.unresolvedDeadlines === 0,
    followUpsCompleted: snapshot.followUpsCompleted === true,
    existingHardExitGatePassed: snapshot.hardExitGatePassed === true,
  };

  const blockingReasons = [...(snapshot.blockingReasons || [])];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(`Stage 15 requirement failed: ${name}`);
    }
  }

  return {
    stage: 15,
    passed: Object.values(checks).every(Boolean) && blockingReasons.length === 0,
    gateName: 'STAGE_15_MONITOR_GATE',
    evidence: {
      source: 'TaxGuardMonitoringEngine',
      evaluatedAt: new Date().toISOString(),
      checks,
      blockingReasons,
      metadata: {
        unresolvedDeadlines: snapshot.unresolvedDeadlines ?? null,
        followUpsCompleted: snapshot.followUpsCompleted === true,
      },
    },
  };
}
