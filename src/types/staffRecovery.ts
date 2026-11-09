export type StaffRecoveryReasonCategory =
  | 'lost_authenticator'
  | 'compromised_factor'
  | 'device_replacement';

export interface StaffRecoveryRequestInput {
  requestId: string;
  targetUid: string;
  reasonCategory: StaffRecoveryReasonCategory;
  reason: string;
}

export interface StaffRecoveryRecord {
  requestId: string;
  targetUid: string;
  targetName?: string;
  targetEmail?: string;
  targetRole?: string;
  makerUid?: string;
  checkerUid?: string | null;
  reasonCategory: StaffRecoveryReasonCategory;
  reason: string;
  status: string;
  jobId?: string | null;
  jobStatus: 'pending' | 'leased' | 'reset_verified' | 'enrollment_verified' | 'completed' | 'failed' | null;
  jobAttempts?: number;
  jobLastError?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  cancelledAt?: string | null;
  resetAvailability?: string;
  updatedAt?: string;
  actions: {
    approve: boolean;
    complete: boolean;
    cancel: boolean;
    retry: boolean;
    [key: string]: any;
  };
}

export interface StaffRecoveryQuery {
  limit?: number;
  cursor?: string;
  status?: string;
}
