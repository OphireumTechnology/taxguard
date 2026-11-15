export type StaffMembershipAction = 'approve' | 'suspend' | 'deactivate' | 'reactivate';

export interface StaffInvitationIssueInput {
  email: string;
  legalFirstName: string;
  legalLastName: string;
  role: 'accountant' | 'reviewer' | 'senior_reviewer' | 'bookkeeper' | 'practice_manager' | 'operations' | 'admin';
}

export interface StaffInvitationIssueResult {
  id: string;
  token: string;
  delivery: 'administrator_handoff';
  expiresAt: string;
  status?: string;
}

export interface StaffMemberRecord {
  uid: string;
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
  actions: {
    approve: boolean;
    suspend: boolean;
    deactivate: boolean;
    reactivate: boolean;
  };
}

export interface StaffInvitationRecord {
  id: string;
  email: string;
  role: string;
  legalFirstName: string;
  legalLastName: string;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: string;
  expiresAt: string;
  invitedBy: string;
  acceptedUid: string | null;
  acceptedAt: string | null;
  revokedBy: string | null;
  revokedAt: string | null;
  actions: {
    revoke: boolean;
  };
}

export interface StaffDirectoryQuery {
  cursor?: string;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
}

export interface StaffDirectoryPage<T = StaffMemberRecord> {
  items: T[];
  nextCursor: string | null;
  source: 'durable';
}
