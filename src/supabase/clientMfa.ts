import { isSupabaseConfigured, supabase } from './config';

export type ClientMfaStatus =
  | { state: 'UNAVAILABLE' }
  | { state: 'NO_PROVIDER_SESSION' }
  | { state: 'ERROR' }
  | { state: 'READY'; currentLevel: 'aal1' | 'aal2' | 'unknown'; verifiedFactors: number; pendingFactors: number };

export interface ClientTotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

export class ClientMfaError extends Error {
  constructor(public readonly code: string, message?: string) {
    super(message || code);
  }
}

export function clientMfaEnrollmentAvailable(): boolean {
  return isSupabaseConfigured();
}

export function clientMfaErrorText(code?: string): string {
  switch (code) {
    case 'INVALID_CODE':
      return 'That 6-digit code was not accepted. Check your authenticator app and try again.';
    case 'UNAVAILABLE':
      return 'Authenticator setup is unavailable in this environment.';
    default:
      return 'Unable to update your authenticator right now. Please try again.';
  }
}

export async function readClientMfaStatus(): Promise<ClientMfaStatus> {
  if (!isSupabaseConfigured()) return { state: 'UNAVAILABLE' };
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) return { state: 'ERROR' };
  if (!sessionData?.session) return { state: 'NO_PROVIDER_SESSION' };

  const [{ data: aal }, { data: factors, error: factorsErr }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors()
  ]);
  if (factorsErr) return { state: 'ERROR' };

  const allFactors = factors?.all || [];
  const verifiedFactors = allFactors.filter(f => f.status === 'verified').length;
  const pendingFactors = allFactors.filter(f => f.status !== 'verified').length;
  const currentLevel = aal?.currentLevel === 'aal2' ? 'aal2' : aal?.currentLevel === 'aal1' ? 'aal1' : 'unknown';

  return { state: 'READY', currentLevel, verifiedFactors, pendingFactors };
}

export async function beginClientTotpEnrollment(): Promise<ClientTotpEnrollment> {
  if (!isSupabaseConfigured()) throw new ClientMfaError('UNAVAILABLE');
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error || !data) throw new ClientMfaError('ENROLL_FAILED', error?.message);
  return {
    factorId: data.id,
    qrCode: data.totp?.qr_code || '',
    secret: data.totp?.secret || ''
  };
}

export async function confirmClientTotpEnrollment(factorId: string, code: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new ClientMfaError('UNAVAILABLE');
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
  if (error) throw new ClientMfaError('INVALID_CODE', error.message);
}

export async function cancelClientTotpEnrollment(factorId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
}
