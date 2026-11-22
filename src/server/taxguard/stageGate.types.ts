import { randomUUID } from 'node:crypto';

export interface StageGateEvidence {
  checkedAt: string;
  requiredChecks: string[];
  missingChecks: string[];
  details?: Record<string, unknown>;
}

export interface StageGateDecision {
  stage: number;
  passed: boolean;
  approvalId: string;
  evaluatorVersion: string;
  blockers: string[];
  evidence: StageGateEvidence;
}

export function evaluateCanonicalStageGate(
  stage: number,
  snapshot: Record<string, unknown> | null | undefined,
  requiredFlags: string[]
): StageGateDecision {
  const checkedAt = new Date().toISOString();
  const data = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const missingChecks = requiredFlags.filter((key) => !Boolean(data[key]));
  const passed = missingChecks.length === 0;
  return {
    stage,
    passed,
    approvalId: `gate-s${String(stage).padStart(2, '0')}-${randomUUID().slice(0, 8)}`,
    evaluatorVersion: 'LEGACY_18_V1',
    blockers: missingChecks.map((key) => `MISSING_REQUIREMENT:${key}`),
    evidence: {
      checkedAt,
      requiredChecks: requiredFlags,
      missingChecks,
    },
  };
}
