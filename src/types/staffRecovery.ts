export type StaffRecoveryReasonCategory =
  | 'lost_authenticator'
  | 'device_replaced'
  | 'device_damaged'
  | 'authenticator_reset'
  | 'security_incident'
  | string;

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

export interface StaffRecoveryRecord {
  id?: string;
  requestId: string;
  targetUid: string;
  targetEmail?: string;
  targetName?: string;
  targetRole?: string;
  makerUid?: string;
  checkerUid?: string | null;
  reasonCategory: StaffRecoveryReasonCategory;
  reason: string;
  status: 'pending_approval' | 'approved' | 'completed' | 'cancelled' | 'rejected' | string;
  requestedBy?: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  jobId?: string | null;
  jobStatus:
    | null
    | 'pending'
    | 'leased'
    | 'reset_verified'
    | 'enrollment_verified'
    | 'completed'
    | 'failed';
  jobAttempts?: number;
  jobLastError?: string | null;
  actions?: Record<string, boolean>;
  createdAt: string;
  updatedAt?: string;
  [key: string]: any;
}
