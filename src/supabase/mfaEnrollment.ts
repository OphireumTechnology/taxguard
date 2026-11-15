import { isSupabaseConfigured, supabase } from './config';

export interface TotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

export async function beginTotpEnrollment(): Promise<TotpEnrollment> {
  if (!isSupabaseConfigured()) {
    throw new Error('Identity provider is not configured in this environment.');
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error || !data) {
    throw new Error(error?.message || 'Unable to start authenticator enrollment.');
  }
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function confirmTotpEnrollment(factorId: string, code: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Identity provider is not configured in this environment.');
  }
  const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
  if (chErr || !ch) {
    throw new Error(chErr?.message || 'Could not initiate authenticator verification.');
  }
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code });
  if (error) {
    throw new Error(error.message || 'Invalid authenticator code.');
  }
}

export async function cancelTotpEnrollment(factorId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.auth.mfa.unenroll({ factorId });
}
