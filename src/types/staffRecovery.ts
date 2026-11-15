export type StaffRecoveryReasonCategory =
  | 'lost_device'
  | 'broken_device'
  | 'app_reset'
  | 'account_lockout'
  | string;

export interface StaffRecoveryRecord {
  id?: string;
  requestId?: string;
  staffUid?: string;
  targetUid?: string;
  targetName?: string;
  targetRole?: string;
  makerUid?: string;
  checkerUid?: string;
  staffEmail?: string;
  staffName?: string;
  reasonCategory: StaffRecoveryReasonCategory;
  reason?: string;
  reasonDetail?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'expired' | string;
  createdAt: string;
  approvedAt?: string | null;
  updatedAt?: string;
  jobId?: string | null;
  jobStatus?: string | null;
  actions?: Record<string, boolean>;
  [key: string]: any;
}

export interface StaffRecoveryRequestInput {
  staffUid?: string;
  targetUid?: string;
  email?: string;
  reasonCategory: StaffRecoveryReasonCategory;
  reason?: string;
  reasonDetail?: string;
  [key: string]: any;
}

export interface StaffRecoveryQuery {
  status?: string;
  cursor?: string | null;
  limit?: number;
  [key: string]: any;
}
