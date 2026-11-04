export const SESSION_REVOCATION_REASONS = [
  'admin_manual_revocation',
  'suspicious_activity',
  'device_loss',
  'credential_rotation',
  'scheduled_expiry'
] as const;

export type SessionRevocationReason = typeof SESSION_REVOCATION_REASONS[number] | string;

export interface DurableSessionRecord {
  sessionId: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  role: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  status: 'active' | 'revoked' | 'expired';
}
