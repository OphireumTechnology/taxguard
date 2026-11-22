export type StaffRecoveryReasonCategory =
  | 'lost_device'
  | 'damaged_device'
  | 'authenticator_reset'
  | 'device_replacement'
  | 'other'
  | string;

export interface StaffRecoveryRequestInput {
  targetUid?: string;
  reasonCategory: StaffRecoveryReasonCategory;
  reasonNotes?: string;
  [key: string]: any;
}

export interface StaffRecoveryRecord {
  id?: string;
  requestId?: string;
  targetUid: string;
  targetEmail?: string;
  targetName?: string;
  targetRole?: string;
  status: string;
  reasonCategory: StaffRecoveryReasonCategory;
  reasonNotes?: string;
  reason?: string;
  requestedBy?: string;
  requestedAt?: string;
  makerUid?: string;
  checkerUid?: string | null;
  createdAt?: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  completedAt?: string | null;
  [key: string]: any;
}

export interface StaffRecoveryQuery {
  limit?: number;
  cursor?: string;
  status?: string;
  targetUid?: string;
}
