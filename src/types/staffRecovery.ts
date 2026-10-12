export type StaffRecoveryReasonCategory = 'lost_authenticator' | 'compromised_factor' | 'device_replacement';
export type StaffRecoveryStatus = 'pending_approval' | 'approved' | 'completed' | 'cancelled';
export type StaffRecoveryJobStatus = 'pending' | 'leased' | 'reset_verified' | 'enrollment_verified' | 'completed' | 'failed';
export interface StaffRecoveryRecord {
  requestId: string; targetUid: string; targetName: string | null; targetRole: string | null;
  makerUid: string; checkerUid: string | null; reasonCategory: StaffRecoveryReasonCategory; reason: string;
  status: StaffRecoveryStatus; createdAt: string; approvedAt: string | null; jobId: string | null; jobStatus: StaffRecoveryJobStatus | null;
  jobAttempts: number | null; jobLastError: string | null; completedAt: string | null; completedBy: string | null; cancelledAt: string | null;
  resetAvailability: 'unavailable' | 'verified'; actions: { approve: boolean; complete: boolean; cancel: boolean; retry: boolean };
}
export interface StaffRecoveryQuery { status?: 'all' | StaffRecoveryStatus; limit?: number; cursor?: string }
export interface StaffRecoveryPage { items: StaffRecoveryRecord[]; nextCursor: string | null; source: 'durable' }
export interface StaffRecoveryRequestInput { requestId: string; targetUid: string; reasonCategory: StaffRecoveryReasonCategory; reason: string }
export interface StaffRecoveryMutationResult { requestId: string; targetUid: string; status: StaffRecoveryStatus; resumed: boolean; jobId?: string; resetAvailability: 'unavailable' }
