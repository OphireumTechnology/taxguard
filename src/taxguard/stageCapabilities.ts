export const BLOCKED_STAGES: number[] = [11, 12];

export interface StageCapabilityInfo {
  stage: number;
  name: string;
  purpose: string;
  evidence: 'SYSTEM_VERIFIED' | 'HUMAN_ATTESTED' | 'BLOCKED';
  blockedReason?: string;
  responsibility: string;
  clientGuidance: string;
}

const STAGE_TITLES: Record<number, string> = {
  1: 'Onboard & Intake',
  2: 'Collect & Organize',
  3: 'Validate & Verify',
  4: 'Record Transactions',
  5: 'Reconcile Accounts',
  6: 'Review & Close Books',
  7: 'Financial Reporting',
  8: 'Tax Strategy & Planning',
  9: 'Prepare Tax Return',
  10: 'CPA Quality & Approval',
  11: 'Electronic Signature',
  12: 'E-File Transmission',
  13: 'Client Feedback',
  14: 'Resolution & Notices',
  15: 'Ongoing Monitoring',
  16: 'Compliance Archive',
  17: 'Annual Renewal',
  18: 'Continuity Cycle',
};

export function stageCapability(stage: number): StageCapabilityInfo | null {
  if (!Number.isInteger(stage) || stage < 1 || stage > 18) return null;
  const blocked = BLOCKED_STAGES.includes(stage);
  return {
    stage,
    name: STAGE_TITLES[stage] || `Stage ${stage}`,
    purpose: `Workflow milestone ${String(stage).padStart(2, '0')} in the TaxGuard 18-stage engagement lifecycle.`,
    evidence: blocked ? 'BLOCKED' : stage <= 5 ? 'SYSTEM_VERIFIED' : 'HUMAN_ATTESTED',
    blockedReason: blocked
      ? 'External signature and IRS MeF transmission providers are not commissioned in this environment.'
      : undefined,
    responsibility: stage <= 3 ? 'Client & Intake Team' : 'Assigned Tax Professional & CPA Reviewer',
    clientGuidance: blocked
      ? 'Contact your assigned CPA advisor or review your open document checklist.'
      : 'Check your documents and messages for any requested items from your tax team.',
  };
}
