/**
 * Staff multi-factor authentication policy for Supabase-backed (durable) sessions.
 *
 * Every role other than client / prospective client is staff. A staff session is created only
 * from a verified Supabase access token at assurance level AAL2 (a verified MFA factor was
 * used), and every staff API request re-checks the level recorded on the durable session row.
 * The level is never taken from the browser.
 */
import type { User } from '../types';

const CLIENT_ROLES = new Set(['client', 'prospective_client']);

export type AssuranceLevel = 'aal1' | 'aal2';

export function requiresStaffMfa(role: string | undefined | null): boolean {
  return Boolean(role) && !CLIENT_ROLES.has(role as string);
}

/** Decodes the payload of a JWT that has ALREADY been verified by the Supabase Auth server. */
export function verifiedTokenAssuranceLevel(verifiedAccessToken: string): AssuranceLevel {
  try {
    const payload = verifiedAccessToken.split('.')[1];
    if (!payload) return 'aal1';
    const claims = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return claims?.aal === 'aal2' ? 'aal2' : 'aal1';
  } catch {
    return 'aal1';
  }
}

/** Attaches the session's assurance level without making it part of serialized user data. */
export function attachSessionAssuranceLevel(user: User, level: AssuranceLevel): void {
  Object.defineProperty(user, 'sessionAssuranceLevel', { value: level, enumerable: false, configurable: true, writable: false });
}

export function sessionAssuranceLevel(user: User | null | undefined): AssuranceLevel | undefined {
  return (user as (User & { sessionAssuranceLevel?: AssuranceLevel }) | null | undefined)?.sessionAssuranceLevel;
}

/** Staff sign-in gate, evaluated before any durable staff session is minted. */
export function staffMfaDenial(role: string | undefined, verified: { aal?: AssuranceLevel; verifiedFactorCount?: number }): 'STAFF_MFA_ENROLLMENT_REQUIRED' | 'STAFF_MFA_REQUIRED' | null {
  if (!requiresStaffMfa(role)) return null;
  if (!verified.verifiedFactorCount) return 'STAFF_MFA_ENROLLMENT_REQUIRED';
  if (verified.aal !== 'aal2') return 'STAFF_MFA_REQUIRED';
  return null;
}

/**
 * Client sign-in gate (contract C2). A client, or an identity without a staff role, that has a
 * verified authenticator at the identity provider must have used it: no TaxGuard session is minted
 * from an AAL1 token for such an account. The factor count comes from the provider's own user record
 * for the verified token, never from the browser. Clients without an authenticator are unaffected.
 */
export function clientMfaDenial(role: string | undefined | null, verified: { aal?: AssuranceLevel; verifiedFactorCount?: number }): 'CLIENT_MFA_REQUIRED' | null {
  if (requiresStaffMfa(role)) return null;
  return (verified.verifiedFactorCount ?? 0) > 0 && verified.aal !== 'aal2' ? 'CLIENT_MFA_REQUIRED' : null;
}
