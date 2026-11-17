/**
 * Contract C4: the signed-in staff member's own onboarding status. Combines the durable membership
 * record (proposal 20261016020000) with facts from the VERIFIED provider token (assurance level,
 * verified factor count) and the MFA recovery step. It never creates accounts, factors or approvals
 * and never reports on anyone other than the verified identity.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VerifiedSupabaseUser } from './supabase';
import { AuthorityError } from './taxguard/authority.repository';
import { recoveryStep } from './mfaRecoveryCompletion';

export type OnboardingStep =
  | 'NO_MEMBERSHIP' | 'NOT_STAFF' | 'AWAIT_INDEPENDENT_APPROVAL' | 'ENROLL_AUTHENTICATOR' | 'SIGN_IN_WITH_AUTHENTICATOR'
  | 'COMPLETE_MFA_RECOVERY' | 'AWAIT_ASSIGNMENT' | 'READY' | 'ACCOUNT_SUSPENDED' | 'ACCESS_ENDED';

export interface StaffOnboardingStatus {
  membershipStatus: string; role: string | null; memberSince: string | null; invitationAcceptedAt: string | null;
  activeAssignments: number; assignedClients: number;
  mfa: { sessionAssurance: 'aal1' | 'aal2' | 'unknown'; verifiedFactors: number | null; recovery: string };
  nextSteps: OnboardingStep[];
}

const STATUS: Record<string, number> = { STAFF_ONBOARDING_INPUT_INVALID: 400, STAFF_ONBOARDING_TENANT_UNAVAILABLE: 503 };
const STAFF_STATES = new Set(['pending_approval', 'active', 'suspended', 'disabled']);

export function nextOnboardingSteps(s: Omit<StaffOnboardingStatus, 'nextSteps'>): OnboardingStep[] {
  if (s.membershipStatus === 'NONE') return ['NO_MEMBERSHIP'];
  if (s.membershipStatus === 'NOT_STAFF') return ['NOT_STAFF'];
  if (s.membershipStatus === 'suspended') return ['ACCOUNT_SUSPENDED'];
  if (s.membershipStatus === 'disabled') return ['ACCESS_ENDED'];
  const steps: OnboardingStep[] = [];
  if (s.mfa.recovery !== 'none') steps.push('COMPLETE_MFA_RECOVERY');
  else if (s.mfa.verifiedFactors === 0) steps.push('ENROLL_AUTHENTICATOR');
  else if (s.mfa.sessionAssurance !== 'aal2') steps.push('SIGN_IN_WITH_AUTHENTICATOR');
  if (s.membershipStatus === 'pending_approval') steps.push('AWAIT_INDEPENDENT_APPROVAL');
  else if (s.activeAssignments === 0) steps.push('AWAIT_ASSIGNMENT');
  return steps.length ? steps : ['READY'];
}

export async function staffOnboardingStatus(client: SupabaseClient, tenant: string, identity: VerifiedSupabaseUser): Promise<StaffOnboardingStatus> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(tenant) || !/^[A-Za-z0-9_-]{1,128}$/.test(identity.uid)) throw new AuthorityError('STAFF_ONBOARDING_INPUT_INVALID', 400);
  let response;
  try { response = await client.rpc('taxguard_staff_onboarding_status', { p_tenant: tenant, p_uid: identity.uid }); }
  catch { throw new AuthorityError('STAFF_ONBOARDING_UNAVAILABLE', 503); }
  if (response?.error) {
    const m = response.error.message;
    throw new AuthorityError(response.error.code === 'P0001' && STATUS[m] ? m : 'STAFF_ONBOARDING_UNAVAILABLE', response.error.code === 'P0001' && STATUS[m] ? STATUS[m] : 503);
  }
  const d = response?.data as any;
  if (!d || typeof d.membershipStatus !== 'string' || !(['NONE', 'NOT_STAFF'].includes(d.membershipStatus) || STAFF_STATES.has(d.membershipStatus)))
    throw new AuthorityError('STAFF_ONBOARDING_UNAVAILABLE', 503);
  const staff = STAFF_STATES.has(d.membershipStatus);
  // The recovery step only exists for staff members; a store failure is reported, never guessed.
  const recovery = staff ? (await recoveryStep(client, tenant, identity)).step : 'none';
  const base = {
    membershipStatus: d.membershipStatus, role: staff && typeof d.role === 'string' ? d.role : null,
    memberSince: staff && typeof d.memberSince === 'string' ? d.memberSince : null, invitationAcceptedAt: staff && typeof d.invitationAcceptedAt === 'string' ? d.invitationAcceptedAt : null,
    activeAssignments: staff && Number.isInteger(d.activeAssignments) ? d.activeAssignments : 0, assignedClients: staff && Number.isInteger(d.assignedClients) ? d.assignedClients : 0,
    mfa: { sessionAssurance: identity.aal ?? 'unknown', verifiedFactors: Number.isInteger(identity.verifiedFactorCount) ? identity.verifiedFactorCount! : null, recovery },
  } as const;
  return { ...base, mfa: { ...base.mfa }, nextSteps: nextOnboardingSteps({ ...base, mfa: { ...base.mfa } }) };
}
