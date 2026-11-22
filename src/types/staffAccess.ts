export type StaffMembershipAction =
  | 'approve'
  | 'activate'
  | 'suspend'
  | 'deactivate'
  | 'reactivate'
  | 'revoke'
  | 'reinstate'
  | 'change_role'
  | string;

export interface StaffMemberActions {
  approve: boolean;
  suspend: boolean;
  deactivate: boolean;
  reactivate: boolean;
}

export interface StaffInvitationActions {
  revoke: boolean;
}

export interface StaffMemberRecord {
  uid: string;
  id?: string;
  userId?: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  invitedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  statusChangedBy: string | null;
  statusChangedAt: string | null;
  mfaReenrollmentRequired: boolean;
  actions: StaffMemberActions;
  mfaEnrolled?: boolean;
  updatedAt?: string;
  lastActiveAt?: string;
}

export interface StaffInvitationRecord {
  id: string;
  email: string;
  role: string;
  legalFirstName: string;
  legalLastName: string;
  status: 'pending' | 'accepted' | 'revoked' | string;
  createdAt: string;
  expiresAt: string;
  invitedBy: string;
  acceptedUid: string | null;
  acceptedAt: string | null;
  revokedBy: string | null;
  revokedAt: string | null;
  actions: StaffInvitationActions;
}

export type StaffInvitationRole =
  | 'accountant'
  | 'reviewer'
  | 'senior_reviewer'
  | 'bookkeeper'
  | 'practice_manager'
  | 'operations'
  | 'admin';

export interface StaffInvitationIssueInput {
  email: string;
  role: StaffInvitationRole;
  legalFirstName: string;
  legalLastName: string;
  name?: string;
  note?: string;
  [key: string]: any;
}

export interface StaffInvitationIssueResult {
  success?: boolean;
  invitation?: StaffInvitationRecord;
  inviteToken?: string;
  error?: string;
  [key: string]: any;
}

export interface StaffDirectoryQuery {
  search?: string;
  role?: string;
  status?: string;
  limit?: number;
  cursor?: string;
  page?: number;
  pageSize?: number;
  [key: string]: any;
}

export interface StaffDirectoryPage<T = StaffMemberRecord> {
  items: T[];
  nextCursor: string | null;
  source?: 'durable' | string;
  members?: StaffMemberRecord[];
  invitations?: StaffInvitationRecord[];
  total?: number;
  page?: number;
  pageSize?: number;
}
