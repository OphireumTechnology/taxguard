import { supabase, isSupabaseConfigured } from './config';

export interface ClientMfaStatus {
  state: 'READY' | 'UNAVAILABLE' | 'NO_PROVIDER_SESSION' | 'ERROR';
  currentLevel: 'aal1' | 'aal2' | 'unknown' | string;
  verifiedFactors: number;
  pendingFactors?: number;
}

export interface ClientTotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

export class ClientMfaError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'ClientMfaError';
  }
}

export function clientMfaErrorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred during authenticator setup.';
}

export function clientMfaEnrollmentAvailable(): boolean {
  return isSupabaseConfigured();
}

export async function readClientMfaStatus(): Promise<ClientMfaStatus> {
  if (!isSupabaseConfigured()) {
    return { state: 'UNAVAILABLE', currentLevel: 'unknown', verifiedFactors: 0 };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      return { state: 'NO_PROVIDER_SESSION', currentLevel: 'unknown', verifiedFactors: 0 };
    }

    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) {
      return { state: 'ERROR', currentLevel: 'unknown', verifiedFactors: 0 };
    }

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      return { state: 'ERROR', currentLevel: aal?.currentLevel || 'aal1', verifiedFactors: 0 };
    }

    const verified = factors?.totp?.filter(f => (f.status as string) === 'verified') || [];
    const pending = factors?.totp?.filter(f => (f.status as string) === 'unverified') || [];

    return {
      state: 'READY',
      currentLevel: aal?.currentLevel || 'aal1',
      verifiedFactors: verified.length,
      pendingFactors: pending.length
    };
  } catch {
    return { state: 'ERROR', currentLevel: 'unknown', verifiedFactors: 0 };
  }
}

export async function beginClientTotpEnrollment(): Promise<ClientTotpEnrollment> {
  if (!isSupabaseConfigured()) {
    throw new ClientMfaError('Authentication provider not configured in this environment.', 'UNAVAILABLE');
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'DESTRIA TAX SERVICES LLC'
  });

  if (error || !data) {
    throw new ClientMfaError(error?.message || 'Could not initiate authenticator enrollment.', error?.code);
  }

  return {
    factorId: data.id,
    qrCode: data.totp?.qr_code || '',
    secret: data.totp?.secret || ''
  };
}

export async function confirmClientTotpEnrollment(factorId: string, code: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new ClientMfaError('Authentication provider not configured in this environment.', 'UNAVAILABLE');
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId
  });

  if (challengeError || !challenge) {
    throw new ClientMfaError(challengeError?.message || 'Failed to challenge authenticator.', challengeError?.code);
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim()
  });

  if (verifyError) {
    throw new ClientMfaError(verifyError.message || 'Invalid authenticator code.', verifyError.code);
  }
}

export async function cancelClientTotpEnrollment(factorId: string): Promise<void> {
  if (!isSupabaseConfigured() || !factorId) return;

  try {
    await supabase.auth.mfa.unenroll({ factorId });
  } catch {
    // Ignore cancel failure
  }
}
