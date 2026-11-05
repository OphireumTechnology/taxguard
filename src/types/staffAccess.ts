export type StaffMembershipAction = 'suspend' | 'deactivate' | 'reactivate';

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
    [key: string]: boolean;
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
    [key: string]: boolean;
  };
}

export interface StaffDirectoryPage<T> {
  items: T[];
  nextCursor: string | null;
  source: 'durable' | string;
}

export interface StaffDirectoryQuery {
  limit?: number;
  cursor?: string;
  role?: string;
  status?: string;
}

export interface StaffInvitationIssueInput {
  email: string;
  legalFirstName: string;
  legalLastName: string;
  role: string;
}

export interface StaffInvitationIssueResult {
  id: string;
  token: string;
  expiresAt: string;
  delivery: string;
}
