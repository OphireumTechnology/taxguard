export interface StaffMemberActions { approve: boolean; suspend: boolean; deactivate: boolean; reactivate: boolean }
export interface StaffMemberRecord {
  uid: string; name: string; email: string; role: string; status: string; createdAt: string;
  invitedBy: string | null; approvedBy: string | null; approvedAt: string | null;
  statusChangedBy: string | null; statusChangedAt: string | null;
  mfaReenrollmentRequired: boolean; actions: StaffMemberActions;
}
export interface StaffInvitationRecord {
  id: string; email: string; role: string; legalFirstName: string; legalLastName: string;
  status: 'pending' | 'accepted' | 'revoked'; createdAt: string; expiresAt: string;
  invitedBy: string; acceptedUid: string | null; acceptedAt: string | null;
  revokedBy: string | null; revokedAt: string | null; actions: { revoke: boolean };
}
export interface StaffDirectoryPage<T> { items: T[]; nextCursor: string | null; source: 'durable' }
export interface StaffDirectoryQuery { limit?: number; status?: string; cursor?: string }
export interface StaffInvitationIssueInput { email: string; role: 'accountant' | 'reviewer' | 'senior_reviewer' | 'bookkeeper' | 'practice_manager' | 'operations' | 'admin'; legalFirstName: string; legalLastName: string }
export interface StaffInvitationIssueResult { id: string; token: string; expiresAt: string; delivery: 'administrator_handoff' }
export type StaffMembershipAction = 'suspend' | 'deactivate' | 'reactivate';
