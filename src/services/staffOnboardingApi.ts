/**
 * Contract C4 browser client: the signed-in staff member's own onboarding status. Uses the identity
 * PROVIDER session (a member pending approval has no TaxGuard session yet). Reads only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { apiEndpoint } from '../config/apiEndpoint';
import { isStaffIdentityDevelopmentConfigured, supabase } from '../supabase/config';

export type OnboardingStep = 'NO_MEMBERSHIP' | 'NOT_STAFF' | 'AWAIT_INDEPENDENT_APPROVAL' | 'ENROLL_AUTHENTICATOR' | 'SIGN_IN_WITH_AUTHENTICATOR'
  | 'COMPLETE_MFA_RECOVERY' | 'AWAIT_ASSIGNMENT' | 'READY' | 'ACCOUNT_SUSPENDED' | 'ACCESS_ENDED';
export interface StaffOnboardingStatus {
  membershipStatus: string; role: string | null; memberSince: string | null; invitationAcceptedAt: string | null; activeAssignments: number; assignedClients: number;
  mfa: { sessionAssurance: string; verifiedFactors: number | null; recovery: string }; nextSteps: OnboardingStep[];
}
export class StaffOnboardingError extends Error { constructor(public readonly code: string) { super(code); } }

export const STEP_TEXT: Record<OnboardingStep, { title: string; detail: string }> = {
  NO_MEMBERSHIP: { title: 'No practice membership', detail: 'This sign-in is not a member of this practice. Accept your invitation link first, or contact your administrator.' },
  NOT_STAFF: { title: 'Client account', detail: 'This is a client account. Use the client portal instead.' },
  AWAIT_INDEPENDENT_APPROVAL: { title: 'Waiting for approval', detail: 'Your invitation is accepted. A different administrator must approve your activation before you can open client work.' },
  ENROLL_AUTHENTICATOR: { title: 'Set up your authenticator', detail: 'Staff access requires an authenticator app. Enrol one from Account Security after signing in.' },
  SIGN_IN_WITH_AUTHENTICATOR: { title: 'Sign in with your authenticator', detail: 'This session did not use your authenticator. Sign out and sign in again with your code.' },
  COMPLETE_MFA_RECOVERY: { title: 'Finish authenticator recovery', detail: 'An authenticator recovery is open for your account. Follow the recovery steps on the staff sign-in page.' },
  AWAIT_ASSIGNMENT: { title: 'Waiting for client assignments', detail: 'Your account is active. A practice manager assigns you to clients and engagements.' },
  READY: { title: 'Ready', detail: 'Your account is active, your authenticator is in use and you have client assignments.' },
  ACCOUNT_SUSPENDED: { title: 'Account suspended', detail: 'Access is paused. Contact your administrator.' },
  ACCESS_ENDED: { title: 'Access ended', detail: 'This membership has been deactivated.' },
};

export function createStaffOnboardingApi(injected?: { provider?: SupabaseClient; fetchImpl?: typeof fetch; available?: () => boolean }) {
  const provider = () => injected?.provider ?? (supabase as unknown as SupabaseClient);
  const available = () => (injected?.available ?? isStaffIdentityDevelopmentConfigured)();
  const doFetch = injected?.fetchImpl ?? fetch;
  return {
    available,
    async status(): Promise<StaffOnboardingStatus> {
      if (!available()) throw new StaffOnboardingError('UNAVAILABLE');
      const { data, error } = await provider().auth.getSession();
      const token = data?.session?.access_token;
      if (error || !token) throw new StaffOnboardingError('PROVIDER_IDENTITY_DENIED');
      const response = await doFetch(apiEndpoint('/api/staff-access/onboarding/status'), { method: 'POST', cache: 'no-store', credentials: 'omit',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerAccessToken: token }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new StaffOnboardingError(typeof body?.code === 'string' ? body.code : 'UNAVAILABLE');
      if (!body || typeof body.membershipStatus !== 'string' || !Array.isArray(body.nextSteps) || body.nextSteps.some((s: string) => !(s in STEP_TEXT))) throw new StaffOnboardingError('UNAVAILABLE');
      return body as StaffOnboardingStatus;
    },
  };
}
export const staffOnboardingApi = createStaffOnboardingApi();
