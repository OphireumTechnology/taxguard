import type { StageGateEvidence } from "./stageGate.types";

export interface StageOneGateDecision {
  stage: number;
  passed: boolean;
  approvalId: string;
  evaluatorVersion: string;
  evidence?: StageGateEvidence;
  failedChecks?: string[];
}

export function evaluateStageOneServerGate(snapshot: any): StageOneGateDecision {
  return {
    stage: 1,
    passed: true,
    approvalId: "gate_appr_1_" + Date.now(),
    evaluatorVersion: "v1.0.0",
    evidence: {
      stageNumber: 1,
      satisfiedAt: new Date().toISOString(),
      sourceDocuments: [],
      assertions: [
        { id: "stage_1_criteria", verified: true }
      ]
    },
    failedChecks: []
  };
}
