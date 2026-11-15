export type StaffMembershipAction = 'approve' | 'suspend' | 'deactivate' | 'reactivate' | 'revoke' | 'role_change' | string;

export interface StaffMemberRecord {
  uid: string;
  id?: string;
  email: string;
  name: string;
  role: string;
  status: string;
  mfaEnrolled?: boolean;
  mfaReenrollmentRequired?: boolean;
  invitedBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  statusChangedBy?: string | null;
  statusChangedAt?: string | null;
  lastLoginAt?: string;
  createdAt?: string;
  actions?: {
    approve?: boolean;
    suspend?: boolean;
    deactivate?: boolean;
    reactivate?: boolean;
    [key: string]: boolean | undefined;
  };
  [key: string]: any;
}

export interface StaffInvitationRecord {
  id: string;
  email: string;
  name?: string;
  legalFirstName?: string;
  legalLastName?: string;
  role: string;
  status: string;
  expiresAt?: string;
  createdAt?: string;
  invitedBy?: string;
  acceptedUid?: string | null;
  acceptedAt?: string | null;
  revokedBy?: string | null;
  revokedAt?: string | null;
  actions?: { revoke?: boolean; [key: string]: boolean | undefined };
  [key: string]: any;
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
  name?: string;
  legalFirstName: string;
  legalLastName: string;
  role: StaffInvitationRole;
  [key: string]: any;
}

export interface StaffInvitationIssueResult {
  success?: boolean;
  id?: string;
  token?: string;
  expiresAt?: string;
  delivery?: string;
  invitation?: StaffInvitationRecord;
  error?: string;
  [key: string]: any;
}

export interface StaffDirectoryQuery {
  page?: number;
  pageSize?: number;
  limit?: number;
  cursor?: string;
  search?: string;
  role?: string;
  status?: string;
  [key: string]: any;
}

export interface StaffDirectoryPage<T = StaffMemberRecord> {
  items: T[];
  invitations?: StaffInvitationRecord[];
  source?: string;
  nextCursor?: string | null;
  total?: number;
  page?: number;
  pageSize?: number;
  [key: string]: any;
}
