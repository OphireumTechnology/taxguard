export const SESSION_REVOCATION_REASONS = [
  'security_incident',
  'lost_or_stolen_device',
  'offboarding',
  'role_change',
  'administrative_review',
] as const;

export type SessionRevocationReason = (typeof SESSION_REVOCATION_REASONS)[number];

export interface DurableSessionRecord {
  sessionId: string;
  id?: string;
  userId?: string;
  email?: string;
  role?: string;
  status?: string;
  assuranceLevel: 'aal1' | 'aal2' | string;
  current: boolean;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  authenticatedAt: string;
  lastSeenAt?: string;
  expiresAt: string;
  revokedAt?: string;
  revocationReason?: SessionRevocationReason | string;
  [key: string]: any;
}
