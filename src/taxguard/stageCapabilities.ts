import { CANONICAL_STAGE_LABELS, type StageNumber } from '../server/taxguard/persistence.types';

export interface StageCapabilityInfo {
  stage: number;
  name: string;
  purpose: string;
  responsibility: string;
  evidence: 'SYSTEM_VERIFIED' | 'HUMAN_ATTESTED' | 'BLOCKED';
  blockedReason?: string;
  clientGuidance: string;
}

export const BLOCKED_STAGES: number[] = [12, 13, 14, 15];

export function stageCapability(stage: number): StageCapabilityInfo | null {
  if (!Number.isInteger(stage) || stage < 1 || stage > 18) return null;
  const label = CANONICAL_STAGE_LABELS[stage as StageNumber] ?? `Stage ${stage}`;
  const blocked = BLOCKED_STAGES.includes(stage);
  return {
    stage,
    name: label,
    purpose: `Workflow stage ${String(stage).padStart(2, '0')}: ${label}.`,
    responsibility: stage <= 3 ? 'Client & Intake Team' : stage <= 8 ? 'Bookkeeping & Preparation Team' : 'Licensed CPA / Reviewer',
    evidence: blocked ? 'BLOCKED' : stage <= 5 ? 'SYSTEM_VERIFIED' : 'HUMAN_ATTESTED',
    blockedReason: blocked ? 'External filing transmission and post-filing agency monitoring require authorized production e-file commissioning.' : undefined,
    clientGuidance: blocked
      ? 'Review your uploaded documents or message your advisor while practice review continues.'
      : 'Check your document requests and messages for any items needed to advance this stage.',
  };
}
