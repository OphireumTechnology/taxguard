/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const BLOCKED_STAGES: number[] = [10, 11, 12, 13, 14, 15, 16, 17, 18];

export interface StageCapabilityInfo {
  stage: number;
  name: string;
  purpose: string;
  evidence: 'SYSTEM_VERIFIED' | 'HUMAN_ATTESTED' | 'BLOCKED';
  blockedReason?: string;
  responsibility: string;
  clientGuidance: string;
}

const STAGES_MAP: Record<number, StageCapabilityInfo> = {
  1: { stage: 1, name: 'Identity & Intake', purpose: 'Capture verified client and entity profile', evidence: 'SYSTEM_VERIFIED', responsibility: 'Client & Onboarding Specialist', clientGuidance: 'Complete your intake questionnaire and identity confirmation.' },
  2: { stage: 2, name: 'Document Collection', purpose: 'Gather all required tax documents and statements', evidence: 'SYSTEM_VERIFIED', responsibility: 'Client & Document Specialist', clientGuidance: 'Upload missing documents requested in your checklist.' },
  3: { stage: 3, name: 'Document Validation', purpose: 'Validate document legibility and completeness', evidence: 'HUMAN_ATTESTED', responsibility: 'Accountant', clientGuidance: 'Wait while your tax accountant reviews your uploaded documents.' },
  4: { stage: 4, name: 'Record & Classify', purpose: 'Record income, expenses, and asset transactions', evidence: 'HUMAN_ATTESTED', responsibility: 'Bookkeeper & Accountant', clientGuidance: 'Tax preparer is classifying financial accounts and transactions.' },
  5: { stage: 5, name: 'Reconciliation', purpose: 'Reconcile bank accounts, 1099s, and ledger balances', evidence: 'HUMAN_ATTESTED', responsibility: 'Senior Reviewer', clientGuidance: 'Trial balance reconciliation in progress.' },
  6: { stage: 6, name: 'Preparer Review', purpose: 'First-level review of workpapers and source schedules', evidence: 'HUMAN_ATTESTED', responsibility: 'Staff Accountant', clientGuidance: 'Preparer is reviewing workpapers and schedule details.' },
  7: { stage: 7, name: 'Financial Reporting', purpose: 'Compile book-to-tax adjustments and M-1/M-3 schedules', evidence: 'HUMAN_ATTESTED', responsibility: 'Senior Accountant', clientGuidance: 'Financial schedules and adjustments are being calculated.' },
  8: { stage: 8, name: 'Tax Strategy & Planning', purpose: 'Formulate deductions, credits, and timing strategies', evidence: 'HUMAN_ATTESTED', responsibility: 'Senior Tax Advisor', clientGuidance: 'Advisor is applying tax credits and optimal deduction elections.' },
  9: { stage: 9, name: 'Return Preparation', purpose: 'Assemble draft federal and state tax returns', evidence: 'HUMAN_ATTESTED', responsibility: 'Certified Preparer', clientGuidance: 'Your tax return draft is being generated for quality review.' },
  10: { stage: 10, name: 'Quality Control & Review', purpose: 'Independent dual-reviewer audit of complete draft return', evidence: 'BLOCKED', blockedReason: 'Requires certified senior reviewer sign-off after stage 9 certification.', responsibility: 'Independent Senior Reviewer', clientGuidance: 'Independent CPA review will unlock once return assembly is certified.' },
  11: { stage: 11, name: 'Client Authorization & e-Signature', purpose: 'Client review of Form 8879 and final return delivery', evidence: 'BLOCKED', blockedReason: 'Stage unlocked after independent review approval.', responsibility: 'Client', clientGuidance: 'You will review and e-sign your tax return once quality control passes.' },
  12: { stage: 12, name: 'Electronic Filing Transmission', purpose: 'Transmit authenticated MeF package to IRS and State DOR', evidence: 'BLOCKED', blockedReason: 'Filing transmission requires executed Form 8879 authorization.', responsibility: 'Filing Operations Officer', clientGuidance: 'Filing occurs immediately upon receiving your digital signature.' },
  13: { stage: 13, name: 'Agency Acknowledgement', purpose: 'Monitor IRS and state acceptance notices', evidence: 'BLOCKED', blockedReason: 'Awaiting transmission and agency gateway response.', responsibility: 'Operations Officer', clientGuidance: 'Confirmation and acceptance numbers will display here once acknowledged.' },
  14: { stage: 14, name: 'Post-Filing Settlement & Payment', purpose: 'Coordinate balance due payments or refund tracking', evidence: 'BLOCKED', blockedReason: 'Unlocked upon agency acceptance.', responsibility: 'Client & Advisory Team', clientGuidance: 'Payment vouchers and refund tracker become available after acceptance.' },
  15: { stage: 15, name: 'Monitoring & Audit Defense Guard', purpose: 'Proactive IRS transcript monitoring and notice defense', evidence: 'BLOCKED', blockedReason: 'Active following completed filing cycle.', responsibility: 'Practice Compliance Director', clientGuidance: 'Year-round compliance monitoring activates once filing is settled.' },
  16: { stage: 16, name: 'Permanent Archive & Vaulting', purpose: 'Durable immutable archiving of workpapers and transcripts', evidence: 'BLOCKED', blockedReason: 'Archiving begins at conclusion of tax year processing.', responsibility: 'Records Custodian', clientGuidance: 'Completed return and workpaper binder will be available for permanent download.' },
  17: { stage: 17, name: 'Annual Renewal & Proactive Advisory', purpose: 'Quarterly estimate projection and subsequent year planning', evidence: 'BLOCKED', blockedReason: 'Subsequent cycle advisory.', responsibility: 'Executive Advisory Partner', clientGuidance: 'Review next year planning roadmap with your managing advisor.' },
  18: { stage: 18, name: 'Repeat Cycle Engagement', purpose: 'Roll over historical balances and schedule next year intake', evidence: 'BLOCKED', blockedReason: 'Subsequent tax year initiation.', responsibility: 'Practice Manager', clientGuidance: 'Continuity rollover occurs at the start of the next tax season.' },
};

export function stageCapability(stage: number): StageCapabilityInfo | undefined {
  return STAGES_MAP[stage];
}
