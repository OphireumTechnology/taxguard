/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type StaffRecoveryReasonCategory =
  | 'lost_authenticator'
  | 'compromised_factor'
  | 'device_replacement'
  | 'damaged_device'
  | 'device_upgrade'
  | 'admin_reset'
  | (string & {});

export interface StaffRecoveryRecord {
  requestId: string;
  targetUid: string;
  targetName?: string | null;
  targetRole?: string | null;
  makerUid?: string;
  checkerUid?: string | null;
  status: 'pending' | 'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'cancelled' | 'failed' | string;
  reasonCategory: StaffRecoveryReasonCategory;
  reason: string;
  requestedBy?: string;
  requestedAt?: string;
  createdAt?: string;
  approvedAt?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  cancelledAt?: string | null;
  jobId?: string | null;
  jobStatus: 'pending' | 'leased' | 'reset_verified' | 'enrollment_verified' | 'completed' | 'failed' | null;
  jobAttempts?: number | null;
  jobLastError?: string | null;
  resetAvailability?: string;
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
  cursor?: string;
  status?: string;
}
