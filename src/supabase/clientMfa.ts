import { isSupabaseConfigured, supabase } from './config';

export interface ClientTotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
  uri?: string;
}

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
  }
}

export function clientMfaEnrollmentAvailable(): boolean {
  return isSupabaseConfigured();
}

export function clientMfaErrorText(code?: string): string {
  switch (code) {
    case 'UNAVAILABLE':
      return 'Authenticator setup is unavailable in this environment.';
    case 'INVALID_CODE':
      return 'The 6-digit code was invalid. Please try again.';
    default:
      return 'Could not complete authenticator setup.';
  }
}

export async function readClientMfaStatus(): Promise<ClientMfaStatus> {
  if (!isSupabaseConfigured()) return { state: 'UNAVAILABLE' };
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return { state: 'NO_PROVIDER_SESSION' };
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp || [];
  return {
    state: 'READY',
    currentLevel: (aal?.currentLevel as 'aal1' | 'aal2') || 'unknown',
    verifiedFactors: totp.filter((f: any) => f.status === 'verified').length,
    pendingFactors: totp.filter((f: any) => f.status !== 'verified').length,
  };
}

export async function beginClientTotpEnrollment(): Promise<ClientTotpEnrollment> {
  if (!isSupabaseConfigured()) throw new ClientMfaError('UNAVAILABLE');
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error || !data) throw new ClientMfaError('ENROLL_FAILED', error?.message);
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

export async function confirmClientTotpEnrollment(factorId: string, code: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new ClientMfaError('UNAVAILABLE');
  const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
  if (chErr || !ch) throw new ClientMfaError('INVALID_CODE', chErr?.message);
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code });
  if (error) throw new ClientMfaError('INVALID_CODE', error.message);
}

export async function cancelClientTotpEnrollment(factorId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.auth.mfa.unenroll({ factorId });
}
