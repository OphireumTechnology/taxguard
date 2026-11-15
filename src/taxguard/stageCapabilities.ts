import { CANONICAL_STAGE_LABELS } from '../server/taxguard/persistence.types';

export interface StageCapabilityInfo {
  stage: number;
  name: string;
  purpose: string;
  evidence: 'SYSTEM_VERIFIED' | 'HUMAN_ATTESTED' | 'BLOCKED';
  responsibility: string;
  clientGuidance: string;
  blockedReason?: string;
}

export const BLOCKED_STAGES: number[] = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

const STAGE_CAPABILITIES: Record<number, StageCapabilityInfo> = {
  1: {
    stage: 1,
    name: CANONICAL_STAGE_LABELS[1],
    purpose: 'Establish taxpayer identity, entity classification, and engagement authority.',
    evidence: 'SYSTEM_VERIFIED',
    responsibility: 'Client completes onboarding profile; practice verifies engagement scope.',
    clientGuidance: 'Verify your profile details and tax year selections in your portal.'
  },
  2: {
    stage: 2,
    name: CANONICAL_STAGE_LABELS[2],
    purpose: 'Collect source tax documents and supporting financial records into private storage.',
    evidence: 'SYSTEM_VERIFIED',
    responsibility: 'Client uploads requested records; practice tracks completeness.',
    clientGuidance: 'Upload any requested W-2, 1099, K-1, or accounting documents in Documents.'
  },
  3: {
    stage: 3,
    name: CANONICAL_STAGE_LABELS[3],
    purpose: 'Review uploaded source documents for completeness, legibility, and discrepancy resolution.',
    evidence: 'HUMAN_ATTESTED',
    responsibility: 'Practice staff verify extracted fields and resolve document exceptions.',
    clientGuidance: 'Respond to any open document replacement or clarification requests.'
  },
  4: {
    stage: 4,
    name: CANONICAL_STAGE_LABELS[4],
    purpose: 'Post and classify accounting entries in the durable general ledger.',
    evidence: 'SYSTEM_VERIFIED',
    responsibility: 'Bookkeeper records ledger entries; system verifies balance.',
    clientGuidance: 'Review any uncategorized transaction requests from your bookkeeper.'
  },
  5: {
    stage: 5,
    name: CANONICAL_STAGE_LABELS[5],
    purpose: 'Reconcile bank, credit, and balance sheet accounts for the engagement tax year.',
    evidence: 'SYSTEM_VERIFIED',
    responsibility: 'Bookkeeper completes reconciliations; reviewer inspects open items.',
    clientGuidance: 'Provide missing monthly statements if requested.'
  },
  6: {
    stage: 6,
    name: CANONICAL_STAGE_LABELS[6],
    purpose: 'Perform independent professional review of workpapers and exceptions.',
    evidence: 'HUMAN_ATTESTED',
    responsibility: 'Assigned CPA reviewer attests workpaper completeness.',
    clientGuidance: 'No client action needed unless your reviewer sends a message.'
  },
  7: {
    stage: 7,
    name: CANONICAL_STAGE_LABELS[7],
    purpose: 'Compile trial balance and book-to-tax financial reporting schedules.',
    evidence: 'HUMAN_ATTESTED',
    responsibility: 'Practice preparer and reviewer finalize statements for release.',
    clientGuidance: 'Financial statements will appear in your portal once approved.'
  },
  8: {
    stage: 8,
    name: CANONICAL_STAGE_LABELS[8],
    purpose: 'Document forward-looking tax strategy and planning considerations.',
    evidence: 'HUMAN_ATTESTED',
    responsibility: 'Tax advisor documents strategic recommendations.',
    clientGuidance: 'Schedule an advisory consultation to review planning opportunities.'
  },
  9: {
    stage: 9,
    name: CANONICAL_STAGE_LABELS[9],
    purpose: 'Prepare federal and state tax return drafts from verified workpapers.',
    evidence: 'BLOCKED',
    responsibility: 'Licensed preparer and independent reviewer complete draft assembly.',
    clientGuidance: 'Your practice prepares the return internally. Check Messages for any questions.',
    blockedReason: 'Draft tax return preparation is managed inside the practice workspace until authorized for review.'
  },
  10: {
    stage: 10,
    name: CANONICAL_STAGE_LABELS[10],
    purpose: 'Independent partner quality control and final professional authorization.',
    evidence: 'BLOCKED',
    responsibility: 'Authorizing CPA completes independent sign-off.',
    clientGuidance: 'Await notification when your return is authorized for signature.',
    blockedReason: 'Final authorization is restricted to an independent authorizing CPA.'
  },
  11: {
    stage: 11,
    name: CANONICAL_STAGE_LABELS[11],
    purpose: 'Deliver Form 8879 electronic filing authorization package.',
    evidence: 'BLOCKED',
    responsibility: 'Practice releases signature package; taxpayer executes authorization.',
    clientGuidance: 'Signature packages become available once Stage 10 authorization is released.',
    blockedReason: 'Electronic signature release is gated behind final professional authorization.'
  },
  12: {
    stage: 12,
    name: CANONICAL_STAGE_LABELS[12],
    purpose: 'Transmit authorized returns via IRS MeF and state e-file gateways.',
    evidence: 'BLOCKED',
    responsibility: 'Practice transmits authorized e-file package.',
    clientGuidance: 'Filing confirmation will be posted once transmission is accepted.',
    blockedReason: 'Live e-file transmission is not enabled from the client portal.'
  },
  13: {
    stage: 13,
    name: CANONICAL_STAGE_LABELS[13],
    purpose: 'Post-filing debrief and client feedback collection.',
    evidence: 'BLOCKED',
    responsibility: 'Advisor schedules post-filing review.',
    clientGuidance: 'Available after filing completion.',
    blockedReason: 'Debrief opens once the return filing stage completes.'
  },
  14: {
    stage: 14,
    name: CANONICAL_STAGE_LABELS[14],
    purpose: 'Monitor and resolve IRS or state agency notices.',
    evidence: 'BLOCKED',
    responsibility: 'Practice tracks and responds to tax notices.',
    clientGuidance: 'Upload any received tax notices through Documents.',
    blockedReason: 'Notice resolution is managed by practice staff.'
  },
  15: {
    stage: 15,
    name: CANONICAL_STAGE_LABELS[15],
    purpose: 'Ongoing compliance and estimated tax monitoring.',
    evidence: 'BLOCKED',
    responsibility: 'Practice monitors quarterly obligations.',
    clientGuidance: 'Contact your advisor for quarterly payment adjustments.',
    blockedReason: 'Ongoing monitoring activates after annual filing completion.'
  },
  16: {
    stage: 16,
    name: CANONICAL_STAGE_LABELS[16],
    purpose: 'Permanent encrypted archival of filed returns and workpapers.',
    evidence: 'BLOCKED',
    responsibility: 'Practice archives finalized engagement records.',
    clientGuidance: 'Verified source documents remain available in your Document Vault.',
    blockedReason: 'Permanent archival runs after engagement completion.'
  },
  17: {
    stage: 17,
    name: CANONICAL_STAGE_LABELS[17],
    purpose: 'Annual engagement renewal and scope confirmation.',
    evidence: 'BLOCKED',
    responsibility: 'Practice issues next-year engagement letter.',
    clientGuidance: 'Contact your advisor to renew for the upcoming tax year.',
    blockedReason: 'Renewal opens at the start of the next tax cycle.'
  },
  18: {
    stage: 18,
    name: CANONICAL_STAGE_LABELS[18],
    purpose: 'Carry forward prior-year continuity schedules to the new cycle.',
    evidence: 'BLOCKED',
    responsibility: 'Practice initializes prior-year carryforwards.',
    clientGuidance: 'Prior-year documents remain accessible in Documents.',
    blockedReason: 'Prior-year transfer activates upon engagement renewal.'
  }
};

export function stageCapability(stage: number): StageCapabilityInfo | undefined {
  return STAGE_CAPABILITIES[stage];
}
