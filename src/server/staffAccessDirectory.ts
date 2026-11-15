import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../types';
import type { StaffDirectoryPage, StaffMemberRecord, StaffInvitationRecord } from '../types/staffAccess';
import { requireStaffAdministrator } from './staffAccessPolicy';
import { AuthorityError } from './taxguard/authority.repository';

const MEMBER_STATUSES = ['all', 'active', 'pending_approval', 'suspended', 'disabled', 'deactivated'];
const INVITATION_STATUSES = ['all', 'pending', 'accepted', 'revoked'];
const TARGET_ROLES = ['accountant','reviewer','senior_reviewer','bookkeeper','practice_manager','operations','admin','administrator','consultant','managing_consultant','founder','legal_specialist','firm_manager','recruiter'];
const EXCLUDED_ROLES = ['client', 'prospective_client', 'super_admin', 'super_administrator'];
type Kind = 'members' | 'invitations';
type Position = { createdAt: string; id: string };
const invalid = () => new AuthorityError('STAFF_DIRECTORY_INPUT_INVALID', 400);
const unavailable = () => new AuthorityError('STAFF_DIRECTORY_STORE_UNAVAILABLE', 503);
function identifier(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value); }
function text(value: unknown, max = 255): value is string { return typeof value === 'string' && value.length <= max && !/[\x00-\x1f\x7f]/.test(value); }
function timestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!parts) return false;
  const [year, month, day, hour, minute, second] = parts.slice(1, 7).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] &&
    hour <= 23 && minute <= 59 && second <= 59 &&
    (parts[7] === undefined || (Number(parts[7]) <= 23 && Number(parts[8]) <= 59)) && Number.isFinite(Date.parse(value));
}
function micros(value: string): bigint {
  const fraction = /\.(\d+)(?:Z|[+-])/.exec(value)?.[1] || '';
  return BigInt(Date.parse(value)) * 1000n + BigInt(fraction.padEnd(6, '0').slice(3));
}
function compare(a: Position, b: Position): number {
  const x = micros(a.createdAt), y = micros(b.createdAt);
  return x === y ? (a.id === b.id ? 0 : a.id > b.id ? 1 : -1) : x > y ? 1 : -1;
}
function queryInput(query: unknown, tenant: string, kind: Kind) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) throw invalid();
  const input = query as Record<string, unknown>;
  const limit = input.limit === undefined ? 25 : typeof input.limit === 'string' && /^[1-9]\d*$/.test(input.limit) ? Number(input.limit) : input.limit;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 50) throw invalid();
  const status = input.status === undefined ? 'all' : input.status;
  if (typeof status !== 'string' || !(kind === 'members' ? MEMBER_STATUSES : INVITATION_STATUSES).includes(status)) throw invalid();
  let after: Position | null = null;
  if (input.cursor !== undefined) {
    if (typeof input.cursor !== 'string' || input.cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(input.cursor)) throw invalid();
    try {
      const decoded = Buffer.from(input.cursor, 'base64url');
      if (decoded.toString('base64url') !== input.cursor) throw invalid();
      const cursor = JSON.parse(decoded.toString('utf8'));
      if (!cursor || cursor.v !== 1 || cursor.tenant !== tenant || cursor.kind !== kind || cursor.status !== status || !timestamp(cursor.createdAt) || !identifier(cursor.id)) throw invalid();
      after = { createdAt: cursor.createdAt, id: cursor.id };
    } catch { throw invalid(); }
  }
  return { limit, status, after };
}
function nullableId(value: unknown): value is string | null { return value === null || identifier(value); }
function nullableTime(value: unknown): value is string | null { return value === null || timestamp(value); }
function member(row: Record<string, unknown>, actor: User): StaffMemberRecord {
  if (!identifier(row.uid) || !text(row.name) || !text(row.email) || !text(row.role, 128) || !row.role || EXCLUDED_ROLES.includes(row.role) || !text(row.status, 128) || !row.status || !timestamp(row.createdAt) ||
    !nullableId(row.invitedBy) || !nullableId(row.approvedBy) || !nullableTime(row.approvedAt) || !nullableId(row.statusChangedBy) || !nullableTime(row.statusChangedAt) || typeof row.mfaReenrollmentRequired !== 'boolean' || typeof row.identityConsistent !== 'boolean' || typeof row.mfaEnabled !== 'boolean') throw unavailable();
  const eligible = row.uid !== actor.id && row.identityConsistent && TARGET_ROLES.includes(row.role);
  return { uid: row.uid, name: row.name, email: row.email, role: row.role, status: row.status, createdAt: row.createdAt,
    invitedBy: row.invitedBy, approvedBy: row.approvedBy, approvedAt: row.approvedAt, statusChangedBy: row.statusChangedBy, statusChangedAt: row.statusChangedAt, mfaReenrollmentRequired: row.mfaReenrollmentRequired,
    actions: { approve: Boolean(eligible && row.status === 'pending_approval' && row.invitedBy && row.invitedBy !== actor.id),
      suspend: Boolean(eligible && row.status === 'active'), deactivate: Boolean(eligible && ['active','suspended'].includes(row.status)),
      reactivate: Boolean(eligible && row.status === 'suspended' && row.statusChangedBy && row.statusChangedBy !== actor.id && !row.mfaReenrollmentRequired && row.mfaEnabled) } };
}
function invitation(row: Record<string, unknown>): StaffInvitationRecord {
  if (!identifier(row.id) || !text(row.email) || !text(row.role,128) || !row.role || EXCLUDED_ROLES.includes(row.role) || !text(row.legalFirstName,128) || !text(row.legalLastName,128) || !['pending','accepted','revoked'].includes(row.status as string) || !timestamp(row.createdAt) || !timestamp(row.expiresAt) || !identifier(row.invitedBy) || !nullableId(row.acceptedUid) || !nullableTime(row.acceptedAt) || !nullableId(row.revokedBy) || !nullableTime(row.revokedAt)) throw unavailable();
  return { id: row.id, email: row.email, role: row.role, legalFirstName: row.legalFirstName, legalLastName: row.legalLastName,
    status: row.status as StaffInvitationRecord['status'], createdAt: row.createdAt, expiresAt: row.expiresAt, invitedBy: row.invitedBy,
    acceptedUid: row.acceptedUid, acceptedAt: row.acceptedAt, revokedBy: row.revokedBy, revokedAt: row.revokedAt,
    actions: { revoke: row.status === 'pending' } };
}
async function list<T extends StaffMemberRecord | StaffInvitationRecord>(client: SupabaseClient, tenant: string, actor: User, query: unknown, kind: Kind, map: (row: Record<string, unknown>) => T): Promise<StaffDirectoryPage<T>> {
  requireStaffAdministrator(actor, tenant);
  const { limit, status, after } = queryInput(query, tenant, kind);
  let response;
  try { response = await client.rpc(kind === 'members' ? 'taxguard_list_staff_members' : 'taxguard_list_staff_invitations', {
    p_tenant: tenant, p_actor: actor.id, p_status: status === 'all' ? null : status, p_page_size: limit + 1,
    p_after_created: after?.createdAt ?? null, p_after_id: after?.id ?? null }); }
  catch { throw unavailable(); }
  if (response?.error) throw new AuthorityError(response.error.code === 'P0001' ? 'STAFF_DIRECTORY_DENIED' : 'STAFF_DIRECTORY_STORE_UNAVAILABLE', response.error.code === 'P0001' ? 403 : 503);
  if (!Array.isArray(response?.data) || response.data.length > limit + 1) throw unavailable();
  let previous = after;
  const mapped = response.data.map((row: unknown) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw unavailable();
    const item = map(row as Record<string, unknown>);
    if (status !== 'all' && item.status !== status) throw unavailable();
    const position = { createdAt: item.createdAt, id: 'uid' in item ? item.uid : item.id };
    if (previous && compare(position, previous) >= 0) throw unavailable();
    previous = position; return item;
  });
  const items = mapped.slice(0, limit), last = items.at(-1);
  const nextCursor = mapped.length > limit && last ? Buffer.from(JSON.stringify({ v: 1, tenant, kind, status, createdAt: last.createdAt, id: 'uid' in last ? last.uid : last.id })).toString('base64url') : null;
  return { items, nextCursor, source: 'durable' };
}
/** Actor and tenant come from durable server session authority; cursors only select a page. */
export function listStaffMembers(client: SupabaseClient, tenant: string, actor: User, query: unknown = {}) {
  return list(client, tenant, actor, query, 'members', row => member(row, actor));
}
export function listStaffInvitations(client: SupabaseClient, tenant: string, actor: User, query: unknown = {}) {
  return list(client, tenant, actor, query, 'invitations', invitation);
}
