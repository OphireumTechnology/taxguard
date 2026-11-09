import { supabase, isSupabaseConfigured } from './config';

export interface TotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

export async function beginTotpEnrollment(): Promise<TotpEnrollment> {
  if (!isSupabaseConfigured()) {
    throw new Error('Authentication is not configured in this environment.');
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'DESTRIA TAX SERVICES LLC'
  });

  if (error || !data) {
    throw new Error(error?.message || 'Failed to begin TOTP enrollment.');
  }

  return {
    factorId: data.id,
    qrCode: data.totp?.qr_code || '',
    secret: data.totp?.secret || ''
  };
}

export async function confirmTotpEnrollment(factorId: string, code: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Authentication is not configured in this environment.');
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId
  });

  if (challengeError || !challenge) {
    throw new Error(challengeError?.message || 'Failed to challenge TOTP factor.');
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim()
  });

  if (verifyError) {
    throw new Error(verifyError.message || 'Invalid verification code.');
  }
}

export async function cancelTotpEnrollment(factorId: string): Promise<void> {
  if (!isSupabaseConfigured() || !factorId) return;

  try {
    await supabase.auth.mfa.unenroll({ factorId });
  } catch {
    // Ignore cancel failure
  }
}
