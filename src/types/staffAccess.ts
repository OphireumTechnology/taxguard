export interface StaffDirectoryPage<T> {
  items: T[];
  nextCursor: string | null;
  source: 'durable';
}

export interface StaffDirectoryQuery {
  limit?: number;
  cursor?: string;
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

export interface StaffInvitationIssueInput {
  email: string;
  role: string;
  legalFirstName: string;
  legalLastName: string;
}

export interface StaffInvitationIssueResult {
  id: string;
  token: string;
  delivery: string;
  expiresAt: string;
}

export type StaffMembershipAction = 'approve' | 'suspend' | 'deactivate' | 'reactivate' | 'revoke';
