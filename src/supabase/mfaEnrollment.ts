/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from './config';

export interface TotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

export async function beginTotpEnrollment(): Promise<TotpEnrollment> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'DESTRIA TAX SERVICES LLC',
  });
  if (error || !data) {
    throw new Error(error?.message || 'Failed to begin TOTP enrollment');
  }
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function cancelTotpEnrollment(factorId: string): Promise<void> {
  await supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
}

export async function confirmTotpEnrollment(factorId: string, code: string): Promise<void> {
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) throw new Error(challenge.error.message);

  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });
  if (verify.error) throw new Error(verify.error.message);
}
