import { supabase, isSupabaseConfigured } from './config';

export type ClientMfaStatus =
  | { state: 'UNAVAILABLE' }
  | { state: 'NO_PROVIDER_SESSION' }
  | { state: 'ERROR' }
  | {
      state: 'READY';
      currentLevel: 'aal1' | 'aal2' | 'unknown' | string;
      nextLevel?: string | null;
      verifiedFactors: number;
      pendingFactors: number;
      enrolled?: boolean;
      verified?: boolean;
      factors?: Array<{ id: string; friendlyName?: string; status?: string; createdAt?: string }>;
    };

export interface ClientTotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
}

export class ClientMfaError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ClientMfaError';
    this.code = code;
  }
}

export function clientMfaEnrollmentAvailable(): boolean {
  return isSupabaseConfigured() && Boolean(supabase);
}

export function clientMfaErrorText(error: unknown): string {
  if (error instanceof ClientMfaError) return error.message;
  if (typeof error === 'string' && error) return error;
  if (error instanceof Error) return error.message;
  return 'Unable to update multi-factor authentication settings right now.';
}

export async function readClientMfaStatus(): Promise<ClientMfaStatus> {
  if (!isSupabaseConfigured() || !supabase) {
    return { state: 'UNAVAILABLE' };
  }
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) return { state: 'NO_PROVIDER_SESSION' };
    const [{ data: aal }, { data: factors }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);
    const totp = (factors?.totp || []).map((f: any) => ({
      id: f.id,
      friendlyName: f.friendly_name,
      status: f.status,
      createdAt: f.created_at,
    }));
    const verifiedFactors = totp.filter((f) => f.status === 'verified').length;
    const pendingFactors = totp.filter((f) => f.status !== 'verified').length;
    return {
      state: 'READY',
      currentLevel: aal?.currentLevel || 'unknown',
      nextLevel: aal?.nextLevel ?? null,
      verifiedFactors,
      pendingFactors,
      enrolled: verifiedFactors > 0,
      verified: aal?.currentLevel === 'aal2',
      factors: totp,
    };
  } catch {
    return { state: 'ERROR' };
  }
}

export async function beginClientTotpEnrollment(friendlyName = 'Authenticator App'): Promise<ClientTotpEnrollment> {
  if (!supabase) {
    throw new ClientMfaError('UNAVAILABLE', 'MFA enrollment is unavailable without a configured identity provider.');
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName });
  if (error || !data) {
    throw new ClientMfaError('ENROLL_FAILED', error?.message || 'Unable to begin TOTP enrollment.');
  }
  return {
    factorId: data.id,
    qrCode: data.totp?.qr_code || '',
    secret: data.totp?.secret || '',
    uri: data.totp?.uri || '',
  };
}

export async function confirmClientTotpEnrollment(factorId: string, code: string): Promise<void> {
  if (!supabase) {
    throw new ClientMfaError('UNAVAILABLE', 'MFA confirmation unavailable.');
  }
  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
  if (chErr || !challenge) {
    throw new ClientMfaError('CHALLENGE_FAILED', chErr?.message || 'Unable to verify authenticator.');
  }
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (error) {
    throw new ClientMfaError('INVALID_CODE', 'The verification code is invalid or expired.');
  }
}

export async function cancelClientTotpEnrollment(factorId: string): Promise<void> {
  if (!supabase) return;
  await supabase.auth.mfa.unenroll({ factorId }).catch(() => undefined);
}
