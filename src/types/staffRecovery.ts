export type StaffRecoveryReasonCategory = 'lost_authenticator' | 'compromised_factor' | 'device_replacement';

export interface StaffRecoveryRecord {
  requestId: string;
  targetUid: string;
  targetName: string | null;
  targetRole: string | null;
  makerUid: string;
  checkerUid: string | null;
  reasonCategory: StaffRecoveryReasonCategory;
  reason: string;
  status: 'pending_approval' | 'approved' | 'completed' | 'cancelled';
  createdAt: string;
  approvedAt: string | null;
  jobId: string | null;
  jobStatus: string | null;
  jobAttempts: number | null;
  jobLastError: string | null;
  completedAt: string | null;
  completedBy: string | null;
  cancelledAt: string | null;
  resetAvailability: 'unavailable' | 'verified';
  actions: {
    approve: boolean;
    complete: boolean;
    cancel: boolean;
    retry: boolean;
  };
}

export interface StaffRecoveryRequestInput {
  requestId: string;
  targetUid: string;
  reasonCategory: StaffRecoveryReasonCategory;
  reason: string;
}

export interface StaffRecoveryQuery {
  limit?: number;
  status?: string;
  cursor?: string;
}
