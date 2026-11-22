import { isSupabaseConfigured, supabase } from './config';
import { beginTotpEnrollment, cancelTotpEnrollment, confirmTotpEnrollment, type TotpEnrollment } from './mfaEnrollment';

export type ClientTotpEnrollment = TotpEnrollment;

export type ClientMfaStatus =
  | { state: 'UNAVAILABLE' }
  | { state: 'NO_PROVIDER_SESSION' }
  | { state: 'ERROR' }
  | {
      state: 'READY';
      currentLevel: 'aal1' | 'aal2' | 'unknown';
      verifiedFactors: number;
      pendingFactors: number;
    };

export class ClientMfaError extends Error {
  constructor(public readonly code: string, message?: string) {
    super(message || code);
    this.name = 'ClientMfaError';
  }
}

export function clientMfaEnrollmentAvailable(): boolean {
  return isSupabaseConfigured() && import.meta.env?.VITE_CLIENT_MFA_ENROLLMENT === 'true';
}

export function clientMfaErrorText(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Authenticator operation could not be completed.';
}

export async function readClientMfaStatus(): Promise<ClientMfaStatus> {
  if (!isSupabaseConfigured() || !supabase) {
    return { state: 'UNAVAILABLE' };
  }
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return { state: 'NO_PROVIDER_SESSION' };
    }
    const [{ data: aal }, { data: factors }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);
    const totp = factors?.totp || [];
    const verifiedFactors = totp.filter((f: any) => f.status === 'verified').length;
    const pendingFactors = totp.filter((f: any) => f.status !== 'verified').length;
    return {
      state: 'READY',
      currentLevel: aal?.currentLevel === 'aal2' ? 'aal2' : aal?.currentLevel === 'aal1' ? 'aal1' : 'unknown',
      verifiedFactors,
      pendingFactors,
    };
  } catch {
    return { state: 'ERROR' };
  }
}

export const beginClientTotpEnrollment = beginTotpEnrollment;
export const confirmClientTotpEnrollment = confirmTotpEnrollment;
export const cancelClientTotpEnrollment = cancelTotpEnrollment;
