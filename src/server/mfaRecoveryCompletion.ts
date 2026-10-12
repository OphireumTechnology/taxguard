/**
 * Staff MFA recovery completion (proposal 034) and privileged reauthentication.
 *
 *  runMfaResetJob      server-side worker step: claim a fenced job, remove every provider factor,
 *                      re-list, and report a VERIFIED reset (empty inventory) or a classified failure.
 *  submitRecoveryEnrollment  the target proves re-enrolment through the provider (no TaxGuard session:
 *                      the member is suspended): fresh primary sign-in after the reset, AAL2, and a
 *                      newly created verified factor that was not removed.
 *  complete / cancel / retry  administrator actions; the database requires a recent AAL2 sign-in.
 *  requirePrivilegedSession  the same recent-sign-in check for other privileged actions.
 */
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../types';
import { AuthorityError, safeId } from './taxguard/authority.repository';
import { requireStaffAdministrator } from './staffAccessPolicy';
import { factorHash, MfaProviderError, type MfaFactorProvider } from './mfaResetProvider';
import type { VerifiedSupabaseUser } from './supabase';

export const PRIVILEGED_ADMIN_ROLES = ['admin', 'administrator', 'super_admin', 'super_administrator'];
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const STATUS: Record<string, number> = { STAFF_ADMIN_REQUIRED: 403, STAFF_FRESH_SIGN_IN_REQUIRED: 403, STAFF_RECENT_SIGN_IN_REQUIRED: 403, INDEPENDENT_ACTOR_REQUIRED: 403,
  INDEPENDENT_APPROVER_REQUIRED: 403, MFA_RECOVERY_NOT_FOUND: 404, MFA_RECOVERY_STATE_CONFLICT: 409, MFA_RECOVERY_NOT_READY_FOR_COMPLETION: 409,
  MFA_RECOVERY_NOT_READY_FOR_ENROLLMENT: 409, MFA_ENROLLMENT_AAL2_REQUIRED: 403, MFA_ENROLLMENT_FRESH_SIGN_IN_REQUIRED: 403, MFA_ENROLLMENT_NEW_FACTOR_REQUIRED: 409,
  MFA_ENROLLMENT_PROOF_INVALID: 400, MFA_RECOVERY_INPUT_INVALID: 400, MFA_JOB_FENCE_LOST: 409, MFA_JOB_NOT_FOUND: 404, MFA_JOB_INPUT_INVALID: 400 };

async function rpc<T = any>(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  let response;
  try { response = await client.rpc(name, args); } catch { throw new AuthorityError('MFA_RECOVERY_STORE_UNAVAILABLE', 503); }
  if (response?.error) {
    const { code, message } = response.error;
    if (code === '55P03') throw new AuthorityError('MFA_RECOVERY_BUSY', 409);
    if (code === 'P0001' && typeof message === 'string' && STATUS[message]) throw new AuthorityError(message, STATUS[message]);
    throw new AuthorityError('MFA_RECOVERY_STORE_UNAVAILABLE', 503);
  }
  return response?.data as T;
}
function bearerHash(token: string) {
  if (typeof token !== 'string' || !/^tg_live_[a-f0-9]{64}$/.test(token)) throw new AuthorityError('AUTH_REQUIRED', 401);
  return createHash('sha256').update(token).digest('hex');
}

/** Recent-sign-in check for privileged actions (actor from durable authentication, never the body). */
export async function requirePrivilegedSession(client: SupabaseClient, tenant: string, actor: User, verifiedApplicationToken: string, roles = PRIVILEGED_ADMIN_ROLES) {
  requireStaffAdministrator(actor, tenant);
  return rpc<{ role: string; authTime: number; ageSeconds: number; maxAgeSeconds: number }>(client, 'taxguard_privileged_session',
    { p_tenant: tenant, p_actor: actor.id, p_session_hash: bearerHash(verifiedApplicationToken), p_roles: roles });
}

export type ResetOutcome = { jobId: string; status: string; attempts: number; lastErrorCode: string | null } | null;
/** One worker step. Returns null when no job is runnable. Never reactivates anyone. */
export async function runMfaResetJob(client: SupabaseClient, tenant: string, provider: MfaFactorProvider | null, workerId: string, leaseSeconds = 120): Promise<ResetOutcome> {
  if (!provider) throw new AuthorityError('MFA_RESET_PROVIDER_UNAVAILABLE', 503);
  const job = await rpc<{ jobId: string; targetUid: string; fence: number } | null>(client, 'taxguard_mfa_job_claim', { p_tenant: tenant, p_worker: workerId, p_lease_seconds: leaseSeconds });
  if (!job) return null;
  safeId(job.targetUid);
  const report = (outcome: Record<string, unknown>) => rpc(client, 'taxguard_mfa_job_report', { p_tenant: tenant, p_job: job.jobId, p_worker: workerId, p_fence: job.fence, p_outcome: outcome });
  try {
    const before = await provider.listFactors(job.targetUid);
    for (const f of before) await provider.deleteFactor(job.targetUid, f.id);
    const after = await provider.listFactors(job.targetUid);
    if (after.length > 0) return await report({ kind: 'failed', errorCode: 'PROVIDER_FACTORS_REMAIN', retryable: true });
    return await report({ kind: 'reset_verified', remainingFactors: 0, removedFactorHashes: before.map(f => factorHash(tenant, job.targetUid, f.id)) });
  } catch (error) {
    if (error instanceof AuthorityError) throw error; // fence lost or store failure: report nothing further
    const e = error instanceof MfaProviderError ? error : new MfaProviderError('PROVIDER_UNEXPECTED_ERROR', true);
    return await report({ kind: 'failed', errorCode: e.code, retryable: e.retryable });
  }
}

/**
 * The target proves re-enrolment with a provider access token verified by the server. The newest
 * verified factor created after the reset (and not among the removed factors) is bound to the job.
 */
export async function submitRecoveryEnrollment(client: SupabaseClient, tenant: string, provider: MfaFactorProvider | null, identity: VerifiedSupabaseUser) {
  if (!provider) throw new AuthorityError('MFA_RESET_PROVIDER_UNAVAILABLE', 503);
  safeId(tenant); safeId(identity.uid);
  const job = await rpc<{ jobId: string; status: string; resetAt: string | null; removedFactorHashes: string[] } | null>(client, 'taxguard_mfa_job_for_target', { p_tenant: tenant, p_uid: identity.uid });
  if (!job) throw new AuthorityError('MFA_RECOVERY_NOT_FOUND', 404);
  if (job.status !== 'reset_verified' && job.status !== 'enrollment_verified') throw new AuthorityError('MFA_RECOVERY_NOT_READY_FOR_ENROLLMENT', 409);
  let factors;
  try { factors = await provider.listFactors(identity.uid); } catch { throw new AuthorityError('MFA_RESET_PROVIDER_UNAVAILABLE', 503); }
  const resetAt = Date.parse(job.resetAt ?? '');
  const candidate = factors.filter(f => f.status === 'verified' && Date.parse(f.createdAt) > resetAt && !job.removedFactorHashes.includes(factorHash(tenant, identity.uid, f.id)))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  if (!candidate) throw new AuthorityError('MFA_ENROLLMENT_NEW_FACTOR_REQUIRED', 409);
  return rpc(client, 'taxguard_mfa_job_enrollment_proof', { p_tenant: tenant, p_uid: identity.uid, p_proof: { aal: identity.aal ?? 'aal1',
    primaryAuthTime: identity.primaryAuthTime ?? null, factorHash: factorHash(tenant, identity.uid, candidate.id), factorCreatedAt: candidate.createdAt } });
}

const adminCall = (name: string) => async (client: SupabaseClient, tenant: string, actor: User, verifiedApplicationToken: string, requestId: unknown, extra: Record<string, unknown> = {}) => {
  requireStaffAdministrator(actor, tenant);
  if (!uuid(requestId)) throw new AuthorityError('MFA_RECOVERY_INPUT_INVALID', 400);
  return rpc(client, name, { p_tenant: tenant, p_actor: actor.id, p_request_id: requestId, p_actor_session_hash: bearerHash(verifiedApplicationToken), ...extra });
};
export const completeMfaRecovery = adminCall('taxguard_complete_mfa_recovery');
export const retryMfaResetJob = adminCall('taxguard_retry_mfa_reset_job');
const cancelCall = adminCall('taxguard_cancel_mfa_recovery');
export function cancelMfaRecovery(client: SupabaseClient, tenant: string, actor: User, verifiedApplicationToken: string, requestId: unknown, reason: unknown) {
  if (typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 1000 || /[\x00-\x1f\x7f]/.test(reason)) throw new AuthorityError('MFA_RECOVERY_INPUT_INVALID', 400);
  return cancelCall(client, tenant, actor, verifiedApplicationToken, requestId, { p_reason: reason.trim() });
}

/**
 * Development worker loop: drains runnable reset jobs every interval. Started by the server only
 * when the development staff-access APIs and a reset provider are both configured. Logs codes only.
 */
export function startMfaResetWorker(options: { client: () => SupabaseClient; tenant: string; provider: MfaFactorProvider; workerId: string; intervalMs?: number }) {
  let running = false;
  const tick = async () => {
    if (running) return; running = true;
    try {
      for (let i = 0; i < 20; i++) { if (!(await runMfaResetJob(options.client(), options.tenant, options.provider, options.workerId))) break; }
    } catch (error) {
      console.warn('[mfa-reset-worker]', error instanceof AuthorityError ? error.code : 'MFA_RESET_WORKER_ERROR');
    } finally { running = false; }
  };
  const timer = setInterval(() => { void tick(); }, options.intervalMs ?? 30_000);
  timer.unref();
  return { stop: () => clearInterval(timer), tick };
}
