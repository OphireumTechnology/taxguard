export type StageNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;

export const CANONICAL_STAGE_LABELS: Record<number, string> = {
  1: 'Intake & Identity Verification',
  2: 'Document & Data Collection',
  3: 'Document Intelligence & Verification',
  4: 'Bookkeeping & Record Keeping',
  5: 'Reconciliation & General Ledger Review',
  6: 'Preliminary CPA Review',
  7: 'Financial Statements & Reporting',
  8: 'Strategic Tax Advisory & Planning',
  9: 'Tax Return Preparation',
  10: 'Partner Approval & Client Review',
  11: 'Electronic Signature (Form 8879)',
  12: 'IRS & State Electronic Transmission',
  13: 'Client Feedback & Debrief',
  14: 'Notice Monitoring & Resolution',
  15: 'Ongoing Monitoring & Tax Updates',
  16: 'Permanent Document Archival',
  17: 'Annual Engagement Renewal',
  18: 'Cycle Repeat & Prior Year Transfer'
};

export interface ProviderReadinessInfo {
  provider: string;
  status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'ERROR';
  description?: string;
  lastCheckedAt?: string;
  lastChecked?: string;
}
