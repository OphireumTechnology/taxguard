export const BLOCKED_STAGES: number[] = [12, 14, 15];

export type StageEvidenceKind = 'SYSTEM_VERIFIED' | 'HUMAN_ATTESTED' | 'BLOCKED';

export interface StageCapabilityInfo {
  stage: number;
  name: string;
  title: string;
  purpose: string;
  responsibility: string;
  evidence: StageEvidenceKind;
  blockedReason?: string;
  clientGuidance: string;
  available: boolean;
  clientVisible: boolean;
  requiresStaffApproval: boolean;
  summary: string;
  reason?: string;
}

const STAGE_TITLES: Record<number, string> = {
  1: 'Client Identity & Onboarding',
  2: 'Document Collection',
  3: 'Document Validation',
  4: 'Transaction Recording',
  5: 'Account Reconciliation',
  6: 'Accounting Review',
  7: 'Financial Reporting',
  8: 'Tax Strategy & Planning',
  9: 'Draft Return Preparation',
  10: 'CPA Review & Approval',
  11: 'Client Signature Authorization',
  12: 'Electronic Filing Transmission',
  13: 'Government Acknowledgement & Feedback',
  14: 'Notice & Resolution Management',
  15: 'Post-Filing Compliance Monitoring',
  16: 'Permanent Tax Archive',
  17: 'Annual Engagement Renewal',
  18: 'Continuous Tax Cycle',
};

export function stageCapability(stage: number): StageCapabilityInfo | undefined {
  if (!Number.isInteger(stage) || stage < 1 || stage > 18) return undefined;
  const blocked = BLOCKED_STAGES.includes(stage);
  const name = STAGE_TITLES[stage] || `Stage ${stage}`;
  const evidence: StageEvidenceKind = blocked
    ? 'BLOCKED'
    : stage <= 5
    ? 'SYSTEM_VERIFIED'
    : 'HUMAN_ATTESTED';
  const blockedReason = blocked
    ? 'External filing, notice, or monitoring provider integration is not commissioned in this environment.'
    : undefined;
  const purpose = blocked
    ? `${name} requires an authorized external provider integration and is currently gated.`
    : `${name} is managed through the TaxGuard client and staff workflow.`;
  const responsibility =
    stage <= 2 || stage === 11
      ? 'Client and Assigned Tax Practice Team'
      : 'Assigned Tax Practice Team and Reviewer';
  const clientGuidance = blocked
    ? 'No action is required on this stage right now. Use Documents or Messages if you need to coordinate with your advisor.'
    : 'Review any open document requests or messages from your advisor team to keep this stage moving.';
  return {
    stage,
    name,
    title: name,
    purpose,
    responsibility,
    evidence,
    blockedReason,
    clientGuidance,
    available: !blocked,
    clientVisible: true,
    requiresStaffApproval: stage >= 6,
    summary: purpose,
    reason: blockedReason,
  };
}
