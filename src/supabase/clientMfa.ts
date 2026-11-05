/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, isSupabaseConfigured } from './config';

export class ClientMfaError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ClientMfaError';
  }
}

export interface ClientTotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

export interface ClientMfaStatus {
  state: 'READY' | 'UNAVAILABLE' | 'NO_PROVIDER_SESSION' | 'ERROR';
  currentLevel: 'aal1' | 'aal2' | 'unknown';
  verifiedFactors: number;
  pendingFactors?: number;
}

export const clientMfaEnrollmentAvailable = false;

export function clientMfaErrorText(error: any): string {
  if (typeof error === 'string') return error;
  return error?.message || 'Authenticator operation failed. Please try again.';
}

export async function readClientMfaStatus(): Promise<ClientMfaStatus> {
  if (!isSupabaseConfigured()) {
    return {
      state: 'UNAVAILABLE',
      currentLevel: 'unknown',
      verifiedFactors: 0,
    };
  }
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return {
        state: 'NO_PROVIDER_SESSION',
        currentLevel: 'unknown',
        verifiedFactors: 0,
      };
    }
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) {
      return {
        state: 'ERROR',
        currentLevel: 'unknown',
        verifiedFactors: 0,
      };
    }
    const verified = data.totp?.filter((f: any) => f.status === 'verified').length || 0;
    const pending = data.totp?.filter((f: any) => f.status === 'unverified').length || 0;
    const aal = sessionData.session.user?.app_metadata?.aal || (verified > 0 ? 'aal2' : 'aal1');

    return {
      state: 'READY',
      currentLevel: aal === 'aal2' ? 'aal2' : 'aal1',
      verifiedFactors: verified,
      pendingFactors: pending,
    };
  } catch {
    return {
      state: 'ERROR',
      currentLevel: 'unknown',
      verifiedFactors: 0,
    };
  }
}

export async function beginClientTotpEnrollment(): Promise<ClientTotpEnrollment> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'DESTRIA TAX SERVICES LLC',
  });
  if (error || !data) {
    throw new ClientMfaError(error?.message || 'Failed to start authenticator enrollment');
  }
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function cancelClientTotpEnrollment(factorId: string): Promise<void> {
  await supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
}

export async function confirmClientTotpEnrollment(factorId: string, code: string): Promise<void> {
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) throw new ClientMfaError(challenge.error.message);

  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });
  if (verify.error) throw new ClientMfaError(verify.error.message);
}
