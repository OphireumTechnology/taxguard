import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../types';
import type { VerifiedSupabaseUser } from './supabase';
import { AuthorityError, safeId } from './taxguard/authority.repository';

const unavailable = () => new AuthorityError('CLIENT_IDENTITY_STORE_UNAVAILABLE', 503);
const denied = () => new AuthorityError('CLIENT_IDENTITY_DENIED', 403);
const ONBOARDING_STATUSES = ['not_started','in_progress','submitted','approved','completed','NOT_STARTED','IN_PROGRESS','COMPLETED'];
function boundedText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
}
function time(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!parts) return false;
  const [year,month,day,hour,minute,second] = parts.slice(1,7).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31,leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month-1] && hour <= 23 && minute <= 59 && second <= 59 &&
    (parts[7] === undefined || (Number(parts[7]) <= 23 && Number(parts[8]) <= 59)) && Number.isFinite(Date.parse(value));
}
/** Verified provider proof and configured tenant are supplied by the server, never browser metadata. */
export async function provisionClientIdentity(client: SupabaseClient, tenantId: string, verified: VerifiedSupabaseUser): Promise<{ user: User; clientId: string; resumed: boolean }> {
  safeId(tenantId);
  if (!verified || typeof verified !== 'object') throw denied();
  safeId(verified.uid);
  if (verified.emailVerified !== true || !Number.isFinite(verified.authTime) || verified.authTime <= 0 || typeof verified.email !== 'string' || /[\x00-\x1f\x7f]/.test(verified.email)) throw denied();
  const email = verified.email.trim().toLowerCase();
  if (!boundedText(email,255) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw denied();
  if (verified.displayName !== undefined && (typeof verified.displayName !== 'string' || /[\x00-\x1f\x7f]/.test(verified.displayName))) throw denied();
  const name = verified.displayName?.trim() || email;
  if (!boundedText(name,255)) throw denied();
  let response;
  try { response = await client.rpc('taxguard_provision_client_identity', { p_tenant: tenantId, p_uid: verified.uid, p_email: email, p_name: name }); }
  catch { throw unavailable(); }
  if (response?.error) {
    if (response.error.code === 'P0001') {
      const message = response.error.message;
      if (message === 'CLIENT_IDENTITY_INPUT_INVALID') throw new AuthorityError('CLIENT_IDENTITY_INPUT_INVALID', 400);
      if (['CLIENT_COUNTER_CORRUPT','CLIENT_ID_NAMESPACE_EXHAUSTED','CLIENT_ID_COLLISION'].includes(message)) throw unavailable();
      throw new AuthorityError(['CLIENT_INVITATION_EXISTS','STAFF_INVITATION_ACCEPTANCE_REQUIRED'].includes(message) ? 'STAFF_INVITATION_ACCEPTANCE_REQUIRED' : 'CLIENT_IDENTITY_DENIED', 403);
    }
    throw unavailable();
  }
  const data = response?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.resumed !== 'boolean' ||
    typeof data.clientId !== 'string' || !/^[A-Z0-9]{3,9}$/.test(data.clientId) || /^0+$/.test(data.clientId)) throw unavailable();
  const row = data.user;
  if (!row || typeof row !== 'object' || Array.isArray(row) || row.id !== verified.uid || row.tenantId !== tenantId || row.email !== email ||
    !boundedText(row.name,255) || row.role !== 'client' || row.status !== 'active' || row.clientId !== data.clientId || row.isVerified !== true ||
    !ONBOARDING_STATUSES.includes(row.onboardingStatus) || !(row.onboardingCompletedAt === null || time(row.onboardingCompletedAt)) || !time(row.createdAt)) throw unavailable();
  for (const [key, limit] of [['phone',64],['companyName',255]] as const) {
    if (Object.hasOwn(row,key) && (typeof row[key] !== 'string' || Array.from(row[key]).length > limit || /[\x00-\x1f\x7f-\x9f]/.test(row[key]))) throw unavailable();
  }
  const user: User = { id: row.id, tenantId: row.tenantId, email: row.email, name: row.name, role: 'client', status: 'active', clientId: data.clientId,
    isVerified: true, onboardingStatus: row.onboardingStatus, onboardingCompletedAt: row.onboardingCompletedAt, createdAt: row.createdAt, ...(Object.hasOwn(row,'phone') ? { phone: row.phone } : {}), ...(Object.hasOwn(row,'companyName') ? { companyName: row.companyName } : {}) };
  return { user, clientId: data.clientId, resumed: data.resumed };
}
