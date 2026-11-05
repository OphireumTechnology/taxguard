export type SessionRevocationReason =
  | 'security_incident'
  | 'lost_or_stolen_device'
  | 'offboarding'
  | 'role_change'
  | 'administrative_review';

export const SESSION_REVOCATION_REASONS: SessionRevocationReason[] = [
  'security_incident',
  'lost_or_stolen_device',
  'offboarding',
  'role_change',
  'administrative_review'
];

export interface DurableSessionRecord {
  sessionId: string;
  createdAt: string;
  authenticatedAt: string;
  expiresAt: string;
  assuranceLevel: 'aal1' | 'aal2';
  current: boolean;
}
