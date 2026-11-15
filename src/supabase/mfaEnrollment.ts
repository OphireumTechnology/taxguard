import { isSupabaseConfigured, supabase } from './config';

export interface TotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
  uri?: string;
}

export async function beginTotpEnrollment(): Promise<TotpEnrollment> {
  if (!isSupabaseConfigured()) {
    throw new Error('Authentication provider is not configured for TOTP enrollment.');
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error || !data) {
    throw new Error(error?.message || 'Unable to begin authenticator setup.');
  }
  return {
    factorId: data.id,
    qrCode: data.totp?.qr_code || '',
    secret: data.totp?.secret || '',
    uri: data.totp?.uri
  };
}

export async function confirmTotpEnrollment(factorId: string, code: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Authentication provider is not configured.');
  }
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: code.trim()
  });
  if (error) {
    throw new Error(error.message || 'Verification code could not be confirmed.');
  }
}

export async function cancelTotpEnrollment(factorId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
}
