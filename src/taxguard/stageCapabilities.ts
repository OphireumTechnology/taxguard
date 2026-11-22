export interface StageCapability {
  stage: number;
  name: string;
  label: string;
  purpose: string;
  responsibility: string;
  evidence: 'SYSTEM_VERIFIED' | 'HUMAN_ATTESTED' | 'BLOCKED';
  blockedReason?: string;
  clientGuidance: string;
  state: 'BLOCKED' | 'AVAILABLE' | 'READ_ONLY';
  blocked?: boolean;
  reason?: string;
  available: boolean;
  readOnly?: boolean;
  notes?: string;
}

const STAGE_NAMES: Record<number, string> = {
  1: 'Onboard',
  2: 'Collect',
  3: 'Validate',
  4: 'Record',
  5: 'Reconcile',
  6: 'Review Books',
  7: 'Report',
  8: 'Plan',
  9: 'Prepare Taxes',
  10: 'Approve',
  11: 'Sign',
  12: 'File',
  13: 'Feedback',
  14: 'Resolve',
  15: 'Monitor',
  16: 'Archive',
  17: 'Renew',
  18: 'Repeat',
};

export const BLOCKED_STAGES: readonly number[] = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export const STAGE_CAPABILITIES: StageCapability[] = Array.from({ length: 18 }, (_, idx) => {
  const stage = idx + 1;
  const blocked = BLOCKED_STAGES.includes(stage);
  const name = STAGE_NAMES[stage] || `Stage ${stage}`;
  return {
    stage,
    name,
    label: `Stage ${String(stage).padStart(2, '0')} — ${name}`,
    purpose: blocked
      ? `Stage ${String(stage).padStart(2, '0')} (${name}) is controlled by your licensed tax practice and is not self-service in the client portal.`
      : `Stage ${String(stage).padStart(2, '0')} (${name}) tracks verified progress for your tax-year engagement.`,
    responsibility: blocked
      ? 'Managed by your licensed DESTRIA TAX SERVICES LLC engagement team.'
      : stage <= 2
        ? 'Shared between you and your assigned DESTRIA TAX SERVICES LLC advisor.'
        : 'Managed by your assigned preparer and independent reviewer.',
    evidence: blocked ? 'BLOCKED' : stage <= 5 ? 'SYSTEM_VERIFIED' : 'HUMAN_ATTESTED',
    blockedReason: blocked
      ? 'This stage requires independent professional review and formal firm authorization before release.'
      : undefined,
    clientGuidance: blocked
      ? 'Upload any requested documents and message your advisor if you have updates.'
      : 'Review open document requests and keep your advisor informed of any tax-year changes.',
    state: blocked ? 'BLOCKED' : stage <= 3 ? 'AVAILABLE' : 'READ_ONLY',
    blocked,
    reason: blocked ? 'Requires independent professional authorization.' : undefined,
    available: !blocked,
    readOnly: !blocked && stage >= 4,
  };
});

export function getStageCapability(stage: number): StageCapability | undefined {
  return STAGE_CAPABILITIES.find((s) => s.stage === stage);
}

export function stageCapability(stage: number): StageCapability | undefined {
  return getStageCapability(stage);
}
