export const BLOCKED_STAGES: number[] = [13, 14, 15, 16, 17, 18];

export interface StageCapabilityInfo {
  name: string;
  purpose: string;
  responsibility: string;
}

export const STAGE_CAPABILITIES: Record<number, StageCapabilityInfo> = {
  1: {
    name: 'Client Onboarding & Identity',
    purpose: 'Verify client identity, engagement agreements, and contact details.',
    responsibility: 'Client Intake Specialist'
  },
  2: {
    name: 'Document Intake & Extraction',
    purpose: 'Collect required source tax documents and perform automated extraction.',
    responsibility: 'Document Automation Agent'
  },
  3: {
    name: 'Validation & Reconcile',
    purpose: 'Validate cross-document consistency and ensure data integrity.',
    responsibility: 'Tax Preparation Associate'
  },
  4: {
    name: 'Record & Classification',
    purpose: 'Classify income, expenses, and capital transactions according to tax code.',
    responsibility: 'Staff Accountant'
  },
  5: {
    name: 'Reconcile Accounts & Balances',
    purpose: 'Perform book-to-tax adjustments and tie out balance sheet accounts.',
    responsibility: 'Senior Accountant'
  },
  6: {
    name: 'Professional Review',
    purpose: 'Conduct independent supervisory review and maker-checker sign-off.',
    responsibility: 'Tax Manager / Reviewer'
  },
  7: {
    name: 'Financial & Tax Reporting',
    purpose: 'Generate preliminary schedules, statements, and management summaries.',
    responsibility: 'Tax Manager'
  },
  8: {
    name: 'Strategic Tax Planning',
    purpose: 'Evaluate forward-looking deductions, entity structuring, and credit optimization.',
    responsibility: 'Tax Strategist'
  },
  9: {
    name: 'Draft Return Preparation',
    purpose: 'Assemble federal and state forms into draft returns.',
    responsibility: 'Certified Preparer'
  },
  10: {
    name: 'Technical Quality Review',
    purpose: 'Execute automated diagnostics, schema validation, and risk checks.',
    responsibility: 'Quality Control Lead'
  },
  11: {
    name: 'Client Approval & Authorizations',
    purpose: 'Secure Form 8879 electronic signatures and bank disclosures.',
    responsibility: 'Client Engagement Lead'
  },
  12: {
    name: 'Electronic Filing & Submission',
    purpose: 'Transmit encrypted returns to IRS and state modern e-file systems.',
    responsibility: 'E-File Coordinator'
  },
  13: {
    name: 'Filing Acknowledgement & Tracking',
    purpose: 'Track IRS/state acceptance status and store submission manifests.',
    responsibility: 'Filing Operations'
  },
  14: {
    name: 'Government Feedback & Notice Review',
    purpose: 'Process correspondence and notice replies from taxing jurisdictions.',
    responsibility: 'Tax Resolution Specialist'
  },
  15: {
    name: 'Tax Resolution & Defense',
    purpose: 'Provide audit representation, penalty abatement, and appeals support.',
    responsibility: 'Enrolled Agent / Attorney'
  },
  16: {
    name: 'Continuous Monitoring & Compliance',
    purpose: 'Monitor ongoing payroll, sales tax, and estimated payments quarterly.',
    responsibility: 'Compliance Manager'
  },
  17: {
    name: 'Engagement Archive & Data Custody',
    purpose: 'Package immutable tamper-evident workpapers for statutory retention.',
    responsibility: 'Records Custodian'
  },
  18: {
    name: 'Client Retention & Renewal',
    purpose: 'Plan next tax-year rollout, scope updates, and retainer agreements.',
    responsibility: 'Practice Principal'
  }
};

export function stageCapability(stage: number | string): StageCapabilityInfo | null {
  const num = typeof stage === 'string' ? parseInt(stage.replace(/\D/g, ''), 10) : stage;
  return STAGE_CAPABILITIES[num] || null;
}
