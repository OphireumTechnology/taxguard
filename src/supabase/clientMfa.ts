import { isSupabaseConfigured, supabase } from './config';

export class ClientMfaError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ClientMfaError';
    this.code = code;
  }
}

export function clientMfaErrorText(code?: string): string {
  switch (code) {
    case 'MFA_CODE_INVALID':
      return 'The code entered is invalid or expired. Check your authenticator and try again.';
    case 'MFA_ENROLLMENT_DISABLED':
      return 'Authenticator setup is disabled for this environment.';
    case 'RATE_LIMITED':
      return 'Too many attempts. Please wait a few minutes before trying again.';
    default:
      return 'Could not complete authenticator action. Please try again.';
  }
}

export function clientMfaEnrollmentAvailable(): boolean {
  return isSupabaseConfigured() && !import.meta.env.PROD;
}

export interface ClientMfaStatus {
  state: 'READY' | 'UNAVAILABLE' | 'NO_PROVIDER_SESSION' | 'ERROR';
  currentLevel?: 'aal1' | 'aal2' | 'unknown';
  verifiedFactors?: number;
  pendingFactors?: number;
}

export interface ClientTotpEnrollment {
  factorId: string;
  secret: string;
  qrCode: string;
}

export async function readClientMfaStatus(): Promise<ClientMfaStatus> {
  if (!isSupabaseConfigured()) {
    return {
      state: 'UNAVAILABLE',
      currentLevel: 'unknown',
      verifiedFactors: 0
    };
  }
  try {
    const sessionRes = await supabase.auth.getSession();
    if (!sessionRes.data?.session) {
      return {
        state: 'NO_PROVIDER_SESSION',
        currentLevel: 'unknown',
        verifiedFactors: 0
      };
    }
    const factors = (sessionRes.data.session.user as any)?.factors || [];
    const verified = factors.filter((f: any) => f.status === 'verified').length;
    const pending = factors.filter((f: any) => f.status === 'unverified').length;
    const aal = (sessionRes.data.session.user as any)?.aal || (verified > 0 ? 'aal2' : 'aal1');
    return {
      state: 'READY',
      currentLevel: aal === 'aal2' ? 'aal2' : 'aal1',
      verifiedFactors: verified,
      pendingFactors: pending
    };
  } catch {
    return {
      state: 'ERROR',
      currentLevel: 'unknown',
      verifiedFactors: 0
    };
  }
}

export async function beginClientTotpEnrollment(): Promise<ClientTotpEnrollment> {
  if (isSupabaseConfigured() && (supabase.auth as any).mfa?.enroll) {
    const { data, error } = await (supabase.auth as any).mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Client Authenticator'
    });
    if (error) throw new ClientMfaError(error.message, (error as any).code);
    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret
    };
  }
  return {
    factorId: 'client-factor-' + Math.random().toString(36).substring(2, 9),
    qrCode: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23071A2E"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23D4A843" font-size="12">QR Code Placeholder</text></svg>',
    secret: 'HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ'
  };
}

export async function confirmClientTotpEnrollment(factorId: string, code: string): Promise<void> {
  if (isSupabaseConfigured() && (supabase.auth as any).mfa?.challengeAndVerify) {
    const { error } = await (supabase.auth as any).mfa.challengeAndVerify({
      factorId,
      code
    });
    if (error) throw new ClientMfaError(error.message, 'MFA_CODE_INVALID');
    return;
  }
  if (!code || code.length !== 6) {
    throw new ClientMfaError('Code must be 6 digits.', 'MFA_CODE_INVALID');
  }
}

export async function cancelClientTotpEnrollment(factorId: string): Promise<void> {
  if (isSupabaseConfigured() && (supabase.auth as any).mfa?.unenroll) {
    await (supabase.auth as any).mfa.unenroll({ factorId }).catch(() => {});
  }
}
