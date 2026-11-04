export type StaffRecoveryReasonCategory = 'lost_authenticator' | 'compromised_factor' | 'device_replacement';

export interface StaffRecoveryRequestInput {
  requestId: string;
  targetUid: string;
  reasonCategory: StaffRecoveryReasonCategory;
  reason: string;
}

export interface StaffRecoveryRecord {
  requestId: string;
  targetUid: string;
  targetEmail?: string;
  targetName?: string;
  reasonCategory: StaffRecoveryReasonCategory;
  reason: string;
  status: 'pending' | 'leased' | 'reset_verified' | 'enrollment_verified' | 'completed' | 'failed';
  requestedBy?: string;
  createdAt: string;
  completedAt?: string | null;
}

export interface StaffRecoveryQuery {
  cursor?: string | null;
  status?: string;
  limit?: number;
}
