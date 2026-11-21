import { supabase } from './config';

export interface TotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
  uri?: string;
}

export async function beginTotpEnrollment(): Promise<TotpEnrollment> {
  if (!supabase) {
    throw new Error('Identity provider is not configured in this environment.');
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error || !data) {
    throw new Error(error?.message || 'Unable to begin authenticator enrollment.');
  }
  return {
    factorId: data.id,
    qrCode: data.totp?.qr_code || '',
    secret: data.totp?.secret || '',
    uri: data.totp?.uri,
  };
}

export async function confirmTotpEnrollment(factorId: string, code: string): Promise<void> {
  if (!supabase) {
    throw new Error('Identity provider is not configured in this environment.');
  }
  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
  if (chErr || !challenge) {
    throw new Error(chErr?.message || 'Could not initiate verification challenge.');
  }
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (error) {
    throw new Error(error.message || 'Invalid authenticator code.');
  }
}

export async function cancelTotpEnrollment(factorId: string): Promise<void> {
  if (!supabase) return;
  await supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
}
