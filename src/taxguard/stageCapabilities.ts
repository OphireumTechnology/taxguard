export interface StageCapabilityInfo {
  stage: number;
  name: string;
  purpose: string;
  evidence: 'SYSTEM_VERIFIED' | 'HUMAN_ATTESTED' | 'BLOCKED';
  responsibility: string;
  clientGuidance: string;
  blockedReason?: string;
}

export const BLOCKED_STAGES: readonly number[] = [11, 12, 13, 14, 15, 16, 17, 18];

const STAGE_CATALOG: Record<number, StageCapabilityInfo> = {
  1: {
    stage: 1,
    name: 'Client Identity & Engagement Onboarding',
    purpose: 'Establish verified taxpayer identity, filing scope, and authorized engagement agreement.',
    evidence: 'SYSTEM_VERIFIED',
    responsibility: 'Client completes profile details; DESTRIA TAX SERVICES, LLC verifies onboarding records.',
    clientGuidance: 'Verify your identity details and contact information in your profile workspace.',
  },
  2: {
    stage: 2,
    name: 'Document Collection & Intake',
    purpose: 'Collect required tax forms, financial statements, and supporting schedules in the encrypted vault.',
    evidence: 'SYSTEM_VERIFIED',
    responsibility: 'Client uploads requested tax documents; intake team checks completeness.',
    clientGuidance: 'Upload all requested forms from your document checklist.',
  },
  3: {
    stage: 3,
    name: 'Document Validation & Discrepancy Check',
    purpose: 'Confirm legibility, tax year accuracy, and consistency across submitted source documents.',
    evidence: 'HUMAN_ATTESTED',
    responsibility: 'Assigned accountant reviews submitted evidence and flags missing or conflicting data.',
    clientGuidance: 'Respond promptly to any document follow-up requests in your portal.',
  },
  4: {
    stage: 4,
    name: 'Accounting Record & Ledger Entry',
    purpose: 'Record business and personal financial activity into structured accounting schedules.',
    evidence: 'SYSTEM_VERIFIED',
    responsibility: 'Bookkeeping team posts verified transactions and maintains ledger integrity.',
    clientGuidance: 'No action required unless your advisor requests supporting receipts or statements.',
  },
  5: {
    stage: 5,
    name: 'Account Reconciliation',
    purpose: 'Reconcile bank, credit, payroll, and balance sheet accounts for the tax period.',
    evidence: 'SYSTEM_VERIFIED',
    responsibility: 'Bookkeeper and accountant verify reconciled ending balances.',
    clientGuidance: 'Ensure year-end bank and loan statements have been uploaded to your vault.',
  },
  6: {
    stage: 6,
    name: 'Professional Accounting Review',
    purpose: 'Independent review of trial balance, adjustments, and workpaper evidence.',
    evidence: 'HUMAN_ATTESTED',
    responsibility: 'Case reviewer confirms accounting workpapers are complete and accurate.',
    clientGuidance: 'Your practice team is completing internal quality checks.',
  },
  7: {
    stage: 7,
    name: 'Financial Reporting & Book-to-Tax Alignment',
    purpose: 'Prepare management financial statements and book-to-tax adjustment schedules.',
    evidence: 'HUMAN_ATTESTED',
    responsibility: 'Accountant prepares and reviews release-ready financial summaries.',
    clientGuidance: 'Watch your messages for any clarifying questions on business deductions or assets.',
  },
  8: {
    stage: 8,
    name: 'Tax Strategy & Planning Review',
    purpose: 'Evaluate applicable credits, elections, and multi-year tax planning opportunities.',
    evidence: 'HUMAN_ATTESTED',
    responsibility: 'Tax advisor documents strategic considerations for your return.',
    clientGuidance: 'Message your advisor if you have major upcoming income, entity, or life changes.',
  },
  9: {
    stage: 9,
    name: 'Draft Tax Return Preparation',
    purpose: 'Assemble draft federal and state returns from verified workpapers and tax rules.',
    evidence: 'HUMAN_ATTESTED',
    responsibility: 'Licensed tax preparer compiles draft returns and supporting schedules.',
    clientGuidance: 'Your preparer will notify you once the draft return is ready for review.',
  },
  10: {
    stage: 10,
    name: 'Quality Control & Final Authorization',
    purpose: 'Senior reviewer quality inspection and practice sign-off prior to release.',
    evidence: 'HUMAN_ATTESTED',
    responsibility: 'Senior reviewer verifies calculations, disclosures, and compliance controls.',
    clientGuidance: 'Review notifications for final consultation or approval steps.',
  },
  11: {
    stage: 11,
    name: 'Client Signature & E-File Authorization',
    purpose: 'Execute Form 8879 e-file authorization and client return approval.',
    evidence: 'BLOCKED',
    responsibility: 'Client reviews and signs authorization package through configured signature provider.',
    clientGuidance: 'Contact your advisor for offline or coordinated signature delivery.',
    blockedReason: 'External e-signature provider integration is not active in this environment.',
  },
  12: {
    stage: 12,
    name: 'Electronic Filing & Transmission',
    purpose: 'Transmit authorized returns to IRS MeF and state revenue agencies.',
    evidence: 'BLOCKED',
    responsibility: 'Practice transmits authorized returns via certified e-file transmitter.',
    clientGuidance: 'Your advisor will confirm filing status directly once transmission is enabled.',
    blockedReason: 'External IRS MeF / state filing transmission gateway is not configured in this environment.',
  },
  13: {
    stage: 13,
    name: 'Post-Filing Client Feedback',
    purpose: 'Confirm delivery of filed return copies and gather engagement feedback.',
    evidence: 'BLOCKED',
    responsibility: 'Client service team follows up after verified filing acceptance.',
    clientGuidance: 'Reach out to your advisor via portal messages with any questions.',
    blockedReason: 'Requires completed external filing acknowledgement from Stage 12.',
  },
  14: {
    stage: 14,
    name: 'Notice Resolution & Amendments',
    purpose: 'Track and resolve any IRS or state agency notices or amended filings.',
    evidence: 'BLOCKED',
    responsibility: 'Compliance team handles correspondence and representation matters.',
    clientGuidance: 'Upload any agency notice to your document vault and message your advisor.',
    blockedReason: 'Post-filing agency resolution workflow activates after filing completion.',
  },
  15: {
    stage: 15,
    name: 'Year-Round Tax Monitoring',
    purpose: 'Monitor estimated tax installments and quarterly compliance milestones.',
    evidence: 'BLOCKED',
    responsibility: 'Advisory team tracks quarterly estimates and threshold changes.',
    clientGuidance: 'Schedule a mid-year planning consultation with your advisor as needed.',
    blockedReason: 'Automated post-filing monitoring activates after Stage 12 filing.',
  },
  16: {
    stage: 16,
    name: 'Compliance Archiving & Retention',
    purpose: 'Seal final return packages and workpapers into long-term retention archive.',
    evidence: 'BLOCKED',
    responsibility: 'Practice maintains encrypted multi-year archival records.',
    clientGuidance: 'Your uploaded documents remain accessible in your document vault.',
    blockedReason: 'Final archival sealing requires verified filing completion.',
  },
  17: {
    stage: 17,
    name: 'Annual Engagement Renewal',
    purpose: 'Prepare next tax year engagement scope and fee agreement.',
    evidence: 'BLOCKED',
    responsibility: 'Practice manager issues renewal terms for the upcoming tax season.',
    clientGuidance: 'Contact your practice team to discuss upcoming tax year services.',
    blockedReason: 'Renewal workflow unlocks after current tax year closure.',
  },
  18: {
    stage: 18,
    name: 'Next-Year Carryforward & Continuity',
    purpose: 'Carry forward depreciation, basis, and prior-year tax attributes into the next cycle.',
    evidence: 'BLOCKED',
    responsibility: 'Tax preparation team initializes next-year continuity schedules.',
    clientGuidance: 'Your advisor will open next year’s organizer when the new season begins.',
    blockedReason: 'Carryforward initialization requires archived prior-year return data.',
  },
};

export function stageCapability(stage: number): StageCapabilityInfo | undefined {
  return STAGE_CATALOG[stage];
}
