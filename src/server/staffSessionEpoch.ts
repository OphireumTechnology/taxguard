import { requiresStaffMfa } from './staffMfa';
/** Status changes invalidate both stored sessions and provider proofs issued before reactivation. */
export function staffAuthProofIsCurrent(member: { role?: string; status_changed_at?: unknown }, authTimeSeconds: unknown): boolean {
  if (!requiresStaffMfa(member.role) || member.status_changed_at == null) return true;
  if (typeof member.status_changed_at !== 'string') return false;
  const changedAt = Date.parse(member.status_changed_at);
  const authTime = Number(authTimeSeconds);
  // Provider sign-in timestamps are second-resolution. Same-second proofs remain denied.
  return Number.isFinite(changedAt) && Number.isFinite(authTime) && authTime * 1000 > changedAt;
}
