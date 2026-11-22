export type StageNumber =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;

export const CANONICAL_STAGE_LABELS: Record<StageNumber, string> = {
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

export interface ProviderStatusRecord {
  provider: string;
  status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'DEGRADED' | 'UNAVAILABLE' | string;
  isOperational: boolean;
  details?: string;
  [key: string]: any;
}

export interface ProviderReadinessInfo {
  ready?: boolean;
  status?: string;
  providers?: ProviderStatusRecord[] | Record<string, any>;
  checkedAt?: string;
  [key: string]: any;
}
