export const SESSION_REVOCATION_REASONS = [
  'USER_REQUEST',
  'ADMIN_SECURITY_ACTION',
  'SUSPECTED_COMPROMISE',
  'ROLE_CHANGE',
  'DEVICE_LOST',
  'OFFBOARDING',
] as const;

export type SessionRevocationReason = (typeof SESSION_REVOCATION_REASONS)[number] | string;

export interface DurableSessionRecord {
  id?: string;
  sessionId?: string;
  uid?: string;
  userId?: string;
  email?: string;
  role?: string;
  status?: string;
  aal?: string;
  assuranceLevel?: any;
  createdAt: string;
  authenticatedAt?: string;
  expiresAt?: string;
  lastSeenAt?: string;
  revokedAt?: string | null;
  revocationReason?: SessionRevocationReason | null;
  ipAddress?: string;
  userAgent?: string;
  current?: boolean;
  [key: string]: any;
}
