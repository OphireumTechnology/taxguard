export const SESSION_REVOCATION_REASONS = [
  'admin_action',
  'user_requested',
  'suspicious_activity',
  'credential_change',
  'timeout',
] as const;

export type SessionRevocationReason = typeof SESSION_REVOCATION_REASONS[number];

export interface DurableSessionRecord {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  revocationReason?: SessionRevocationReason | null;
  userAgent?: string;
  ipAddress?: string;
  assuranceLevel?: string;
}

export interface DurableSessionList {
  items: DurableSessionRecord[];
  total?: number;
}
