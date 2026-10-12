import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../types';
import { SESSION_REVOCATION_REASONS, type DurableSessionList, type DurableSessionRecord, type SessionRevocationReason } from '../types/staffSessions';
import { requireStaffAdministrator } from './staffAccessPolicy';
import { requiresStaffMfa, sessionAssuranceLevel } from './staffMfa';
import { AuthorityError, safeId } from './taxguard/authority.repository';

const invalid = () => new AuthorityError('SESSION_INPUT_INVALID', 400);
const unavailable = () => new AuthorityError('SESSION_STORE_UNAVAILABLE', 503);
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const timestamp = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::\d{2})?)$/.test(value) && Number.isFinite(Date.parse(value));
const DENIALS: Record<string, number> = {
  SESSION_INPUT_INVALID: 400, SESSION_CURRENT_USE_LOGOUT: 400, SESSION_TARGET_SELF: 400,
  SESSION_AUTHORITY_DENIED: 403, STAFF_ADMIN_REQUIRED: 403, STAFF_MFA_REENROLLMENT_REQUIRED: 403,
  STAFF_FRESH_SIGN_IN_REQUIRED: 403, STAFF_REAUTHENTICATION_REQUIRED: 403, SESSION_TARGET_PROTECTED: 403,
  SESSION_TARGET_NOT_FOUND: 404,
};

/** The proof is the hash of the bearer that durable authentication already verified; never browser input. */
function proof(actor: User, tenant: string, verifiedApplicationToken: string): string {
  safeId(tenant); safeId(actor?.id);
  if (actor.tenantId !== tenant || actor.status !== 'active') throw new AuthorityError('SESSION_AUTHORITY_DENIED', 403);
  if (requiresStaffMfa(actor.role) && sessionAssuranceLevel(actor) !== 'aal2') throw new AuthorityError('STAFF_MFA_REQUIRED', 403);
  if (typeof verifiedApplicationToken !== 'string' || !/^tg_live_[a-f0-9]{64}$/.test(verifiedApplicationToken)) throw new AuthorityError('AUTH_REQUIRED', 401);
  return createHash('sha256').update(verifiedApplicationToken).digest('hex');
}
async function rpc(client: SupabaseClient, name: string, parameters: Record<string, unknown>) {
  let response;
  try { response = await client.rpc(name, parameters); } catch { throw unavailable(); }
  if (response?.error) {
    if (response.error.code === '55P03') throw new AuthorityError('SESSION_STORE_BUSY', 409);
    if (response.error.code === 'P0001' && Object.hasOwn(DENIALS, response.error.message)) throw new AuthorityError(response.error.message, DENIALS[response.error.message]);
    throw unavailable();
  }
  return response?.data;
}
function count(data: unknown): number {
  const value = (data as Record<string, unknown> | null)?.revokedSessions;
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Number.isSafeInteger(value) || (value as number) < 0) throw unavailable();
  return value as number;
}
function record(row: unknown): DurableSessionRecord {
  const r = row as Record<string, unknown>;
  if (!r || typeof r !== 'object' || Array.isArray(r) || !uuid(r.sessionId) || !timestamp(r.createdAt) || !timestamp(r.authenticatedAt) ||
    !timestamp(r.expiresAt) || !['aal1', 'aal2'].includes(r.assuranceLevel as string) || typeof r.current !== 'boolean') throw unavailable();
  return { sessionId: r.sessionId, createdAt: r.createdAt, authenticatedAt: r.authenticatedAt, expiresAt: r.expiresAt,
    assuranceLevel: r.assuranceLevel as DurableSessionRecord['assuranceLevel'], current: r.current };
}

export async function listOwnSessions(client: SupabaseClient, tenant: string, actor: User, verifiedApplicationToken: string): Promise<DurableSessionList> {
  const hash = proof(actor, tenant, verifiedApplicationToken);
  const data = await rpc(client, 'taxguard_list_own_sessions', { p_tenant: tenant, p_uid: actor.id, p_hash: hash });
  if (!Array.isArray(data) || data.length > 50) throw unavailable();
  const items = data.map(record);
  if (items.filter(item => item.current).length !== 1 || new Set(items.map(item => item.sessionId)).size !== items.length) throw unavailable();
  return { items, source: 'durable' };
}
export async function revokeOwnSession(client: SupabaseClient, tenant: string, actor: User, verifiedApplicationToken: string, sessionId: unknown): Promise<{ revoked: boolean }> {
  const hash = proof(actor, tenant, verifiedApplicationToken);
  if (!uuid(sessionId)) throw invalid();
  const data = await rpc(client, 'taxguard_revoke_own_session', { p_tenant: tenant, p_uid: actor.id, p_hash: hash, p_session_id: sessionId });
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.revoked !== 'boolean') throw unavailable();
  return { revoked: data.revoked };
}
export async function revokeOtherOwnSessions(client: SupabaseClient, tenant: string, actor: User, verifiedApplicationToken: string): Promise<{ revokedSessions: number }> {
  const hash = proof(actor, tenant, verifiedApplicationToken);
  return { revokedSessions: count(await rpc(client, 'taxguard_revoke_other_own_sessions', { p_tenant: tenant, p_uid: actor.id, p_hash: hash })) };
}
/** Administrator step-up (fresh primary sign-in) and target rules are enforced inside the transaction. */
export async function revokeMemberSessions(client: SupabaseClient, tenant: string, actor: User, verifiedApplicationToken: string, input: unknown): Promise<{ revokedSessions: number }> {
  requireStaffAdministrator(actor, tenant);
  const hash = proof(actor, tenant, verifiedApplicationToken);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid();
  const { targetUid, reasonCategory, ...rest } = input as Record<string, unknown>;
  if (Object.keys(rest).length || typeof targetUid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(targetUid) ||
    !SESSION_REVOCATION_REASONS.includes(reasonCategory as SessionRevocationReason)) throw invalid();
  if (targetUid === actor.id) throw new AuthorityError('SESSION_TARGET_SELF', 400);
  return { revokedSessions: count(await rpc(client, 'taxguard_admin_revoke_member_sessions',
    { p_tenant: tenant, p_actor: actor.id, p_hash: hash, p_target: targetUid, p_reason_category: reasonCategory })) };
}
