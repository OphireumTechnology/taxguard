import { isSupabaseConfigured, supabase } from './config';

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

export interface ClientTotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
  uri?: string;
}

export class ClientMfaError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || clientMfaErrorText(code));
    this.name = 'ClientMfaError';
    this.code = code;
  }
}

export function clientMfaErrorText(code?: string): string {
  switch (code) {
    case 'UNAVAILABLE':
      return 'Authenticator setup is unavailable in this environment.';
    case 'INVALID_CODE':
      return 'That 6-digit code was not accepted. Please try the current code from your authenticator app.';
    case 'ENROLLMENT_FAILED':
      return 'Unable to start authenticator setup right now.';
    default:
      return 'Authenticator setup could not be completed. Please try again.';
  }
}

export function clientMfaEnrollmentAvailable(): boolean {
  return isSupabaseConfigured();
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
    const totp = factors?.totp ?? [];
    const verifiedFactors = totp.filter(f => f.status === 'verified').length;
    const pendingFactors = totp.filter(f => f.status !== 'verified').length;
    const currentLevel =
      aal?.currentLevel === 'aal2' ? 'aal2' : aal?.currentLevel === 'aal1' ? 'aal1' : 'unknown';
    return {
      state: 'READY',
      currentLevel,
      verifiedFactors,
      pendingFactors,
    };
  } catch {
    return { state: 'ERROR' };
  }
}

export async function beginClientTotpEnrollment(): Promise<ClientTotpEnrollment> {
  if (!supabase) {
    throw new ClientMfaError('UNAVAILABLE');
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error || !data) {
    throw new ClientMfaError('ENROLLMENT_FAILED', error?.message);
  }
  return {
    factorId: data.id,
    qrCode: data.totp?.qr_code || '',
    secret: data.totp?.secret || '',
    uri: data.totp?.uri,
  };
}

export async function confirmClientTotpEnrollment(factorId: string, code: string): Promise<void> {
  if (!supabase) {
    throw new ClientMfaError('UNAVAILABLE');
  }
  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
  if (chErr || !challenge) {
    throw new ClientMfaError('ENROLLMENT_FAILED', chErr?.message);
  }
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (error) {
    throw new ClientMfaError('INVALID_CODE', error.message);
  }
}

export async function cancelClientTotpEnrollment(factorId: string): Promise<void> {
  if (!supabase) return;
  await supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
}
