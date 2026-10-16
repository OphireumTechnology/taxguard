/**
 * Contract C2: the signed-in client's multi-factor status as reported by the identity provider for
 * the provider's own session. Read-only: no parallel credential store, and no factor is enrolled,
 * verified or removed here. Client enrolment stays blocked until client sign-in verifies an enrolled
 * factor (AAL2) and the practice approves a client MFA policy; recovery belongs to the practice.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './config';

export type ClientMfaStatus =
  | { state: 'UNAVAILABLE' }
  | { state: 'NO_PROVIDER_SESSION' }
  | { state: 'ERROR' }
  | { state: 'READY'; currentLevel: 'aal1' | 'aal2' | 'unknown'; verifiedFactors: number; pendingFactors: number };

export async function readClientMfaStatus(injected?: { provider?: SupabaseClient; configured?: () => boolean }): Promise<ClientMfaStatus> {
  if (!(injected?.configured ?? isSupabaseConfigured)()) return { state: 'UNAVAILABLE' };
  const provider = injected?.provider ?? (supabase as unknown as SupabaseClient);
  try {
    const { data: session, error: sessionError } = await provider.auth.getSession();
    if (sessionError || !session?.session) return { state: 'NO_PROVIDER_SESSION' };
    const [{ data: aal, error: aalError }, { data: factors, error: factorError }] = await Promise.all([provider.auth.mfa.getAuthenticatorAssuranceLevel(), provider.auth.mfa.listFactors()]);
    if (aalError || factorError || !factors) return { state: 'ERROR' };
    const all = (factors.all ?? []) as Array<{ status?: string }>;
    const level = aal?.currentLevel === 'aal2' ? 'aal2' : aal?.currentLevel === 'aal1' ? 'aal1' : 'unknown';
    return { state: 'READY', currentLevel: level, verifiedFactors: all.filter(f => f.status === 'verified').length, pendingFactors: all.filter(f => f.status === 'unverified').length };
  } catch { return { state: 'ERROR' }; }
}
