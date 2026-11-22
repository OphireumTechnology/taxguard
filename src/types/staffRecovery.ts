export type StaffRecoveryReasonCategory =
  | 'lost_device'
  | 'broken_device'
  | 'new_phone'
  | 'authenticator_reset'
  | 'security_incident'
  | 'other'
  | string;

export interface StaffRecoveryRequestInput {
  targetUserId?: string;
  targetUid?: string;
  targetEmail?: string;
  reasonCategory: StaffRecoveryReasonCategory;
  reasonDetail?: string;
  reason?: string;
  [key: string]: any;
}

export interface StaffRecoveryRecord {
  id?: string;
  requestId?: string;
  targetUid?: string;
  targetUserId?: string;
  targetEmail?: string;
  targetName?: string;
  reasonCategory: StaffRecoveryReasonCategory;
  reasonDetail?: string;
  reason?: string;
  status: string;
  requestedAt?: string;
  createdAt?: string;
  resolvedAt?: string;
  approvedBy?: string;
  [key: string]: any;
}

export interface StaffRecoveryQuery {
  status?: string;
  search?: string;
  limit?: number;
  [key: string]: any;
}
