export interface StaffMemberRecord {
  uid: string;
  email: string;
  name: string;
  role: string;
  status: 'active' | 'suspended' | 'invited' | string;
  mfaEnrolled?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface StaffInvitationRecord {
  invitationId: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  invitedBy?: string;
  expiresAt: string;
  createdAt: string;
}

export interface StaffDirectoryQuery {
  page?: number;
  pageSize?: number;
  role?: string;
  status?: string;
  search?: string;
}

export interface StaffDirectoryPage {
  items: StaffMemberRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StaffInvitationIssueInput {
  email: string;
  name: string;
  role: string;
}

export interface StaffInvitationIssueResult {
  success: boolean;
  invitationId?: string;
  invitationUrl?: string;
  error?: string;
}

export type StaffMembershipAction = 'suspend' | 'activate' | 'revoke' | 'reassign';
