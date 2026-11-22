export type StageNumber =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;

export const CANONICAL_STAGE_LABELS: Record<StageNumber, string> = {
  1: 'Client Onboarding & Identity',
  2: 'Document Collection',
  3: 'Document Validation',
  4: 'Transaction Recording',
  5: 'Account Reconciliation',
  6: 'Accounting Review',
  7: 'Financial Reporting',
  8: 'Tax Planning & Strategy',
  9: 'Draft Return Preparation',
  10: 'CPA Review & Approval',
  11: 'Client Signature Authorization',
  12: 'Electronic Filing',
  13: 'Government Acknowledgement',
  14: 'Notice & Resolution',
  15: 'Post-Filing Monitoring',
  16: 'Permanent Archive',
  17: 'Annual Renewal',
  18: 'Continuous Tax Cycle',
};

export interface ProviderReadinessInfo {
  provider: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'NOT_CONFIGURED' | 'DISABLED' | string;
  isOperational: boolean;
  message?: string;
  checkedAt?: string;
  [key: string]: any;
}
