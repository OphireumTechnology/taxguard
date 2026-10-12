export type StaffRecoveryReasonCategory = 'lost_authenticator' | 'compromised_factor' | 'device_replacement';
export type StaffRecoveryStatus = 'pending_approval' | 'approved';
export interface StaffRecoveryRecord {
  requestId: string; targetUid: string; targetName: string | null; targetRole: string | null;
  makerUid: string; checkerUid: string | null; reasonCategory: StaffRecoveryReasonCategory; reason: string;
  status: StaffRecoveryStatus; createdAt: string; approvedAt: string | null; jobId: string | null; jobStatus: 'pending' | null;
  resetAvailability: 'unavailable'; actions: { approve: boolean };
}
export interface StaffRecoveryQuery { status?: 'all' | StaffRecoveryStatus; limit?: number; cursor?: string }
export interface StaffRecoveryPage { items: StaffRecoveryRecord[]; nextCursor: string | null; source: 'durable' }
export interface StaffRecoveryRequestInput { requestId: string; targetUid: string; reasonCategory: StaffRecoveryReasonCategory; reason: string }
export interface StaffRecoveryMutationResult { requestId: string; targetUid: string; status: StaffRecoveryStatus; resumed: boolean; jobId?: string; resetAvailability: 'unavailable' }
