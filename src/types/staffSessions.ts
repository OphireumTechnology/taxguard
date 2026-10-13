export const SESSION_REVOCATION_REASONS = ['security_incident', 'lost_or_stolen_device', 'offboarding', 'role_change', 'administrative_review'] as const;
export type SessionRevocationReason = typeof SESSION_REVOCATION_REASONS[number];
export interface DurableSessionRecord {
  sessionId: string; createdAt: string; authenticatedAt: string; expiresAt: string;
  assuranceLevel: 'aal1' | 'aal2'; current: boolean;
}
export interface DurableSessionList { items: DurableSessionRecord[]; source: 'durable' }
