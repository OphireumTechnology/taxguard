/**
 * Validates that a staff member's authentication proof post-dates any session revocation epoch.
 */
export function staffAuthProofIsCurrent(
  member: { session_revoked_before?: number | string | null; auth_epoch?: number | string | null } | null | undefined,
  authTime?: number | null
): boolean {
  if (!member) return false;
  const rawEpoch = member.session_revoked_before ?? member.auth_epoch;
  if (rawEpoch === undefined || rawEpoch === null || rawEpoch === '') return true;
  const epochSeconds =
    typeof rawEpoch === 'number'
      ? rawEpoch
      : Math.floor(Date.parse(String(rawEpoch)) / 1000);
  if (!Number.isFinite(epochSeconds) || epochSeconds <= 0) return true;
  if (typeof authTime !== 'number' || !Number.isFinite(authTime)) return false;
  return authTime >= epochSeconds;
}
