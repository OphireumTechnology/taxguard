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
    super(message ?? code);
  }
}

export function clientMfaEnrollmentAvailable(): boolean {
  return isSupabaseConfigured();
}

export function clientMfaErrorText(code?: string): string {
  switch (code) {
    case 'UNAVAILABLE':
      return 'Identity provider is not configured in this environment.';
    case 'INVALID_CODE':
      return 'The 6-digit code was not accepted. Check your authenticator app and try again.';
    default:
      return 'Authenticator setup could not be completed.';
  }
}

export async function readClientMfaStatus(): Promise<ClientMfaStatus> {
  if (!isSupabaseConfigured()) return { state: 'UNAVAILABLE' };
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) return { state: 'NO_PROVIDER_SESSION' };
    const { data: aal, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const { data: factors, error: facErr } = await supabase.auth.mfa.listFactors();
    if (aalErr || facErr) return { state: 'ERROR' };
    const all = factors?.all ?? [];
    const verifiedFactors = all.filter((f: { status?: string }) => f.status === 'verified').length;
    const pendingFactors = all.filter((f: { status?: string }) => f.status !== 'verified').length;
    const level = aal?.currentLevel === 'aal2' ? 'aal2' : aal?.currentLevel === 'aal1' ? 'aal1' : 'unknown';
    return { state: 'READY', currentLevel: level, verifiedFactors, pendingFactors };
  } catch {
    return { state: 'ERROR' };
  }
}

export async function beginClientTotpEnrollment(): Promise<ClientTotpEnrollment> {
  if (!isSupabaseConfigured()) throw new ClientMfaError('UNAVAILABLE');
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error || !data) throw new ClientMfaError('ENROLL_FAILED', error?.message);
  return {
    factorId: data.id,
    qrCode: data.totp?.qr_code ?? '',
    secret: data.totp?.secret ?? '',
  };
}

export async function confirmClientTotpEnrollment(factorId: string, code: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new ClientMfaError('UNAVAILABLE');
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw new ClientMfaError('INVALID_CODE', error.message);
}

export async function cancelClientTotpEnrollment(factorId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
}
