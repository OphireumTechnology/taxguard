import { supabase, isSupabaseConfigured } from './config';

export interface TotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

export async function beginTotpEnrollment(): Promise<TotpEnrollment> {
  if (isSupabaseConfigured() && (supabase.auth as any).mfa?.enroll) {
    const { data, error } = await (supabase.auth as any).mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Staff Authenticator'
    });
    if (error) throw error;
    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret
    };
  }
  // Safe development fallback
  return {
    factorId: 'mock-factor-' + Math.random().toString(36).substring(2, 9),
    qrCode: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23071A2E"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23D4A843" font-size="12">QR Code Placeholder</text></svg>',
    secret: 'JBSWY3DPEHPK3PXP'
  };
}

export async function confirmTotpEnrollment(factorId: string, code: string): Promise<void> {
  if (isSupabaseConfigured() && (supabase.auth as any).mfa?.challengeAndVerify) {
    const { error } = await (supabase.auth as any).mfa.challengeAndVerify({
      factorId,
      code
    });
    if (error) throw error;
    return;
  }
  if (!code || code.length !== 6) {
    throw new Error('Please enter a valid 6-digit authenticator code.');
  }
}

export async function cancelTotpEnrollment(factorId: string): Promise<void> {
  if (isSupabaseConfigured() && (supabase.auth as any).mfa?.unenroll) {
    await (supabase.auth as any).mfa.unenroll({ factorId }).catch(() => {});
  }
}
