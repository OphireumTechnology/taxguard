/**
 * Reads primary authentication evidence from an access token ALREADY verified by Supabase Auth.
 * This is not a JWT verifier. Call only after auth.getUser(accessToken) succeeds.
 * Refresh issuance, MFA challenges and mutable user last-sign-in timestamps are not primary proof.
 */
const PRIMARY_METHODS = new Set(['password', 'oauth', 'otp', 'sso', 'sso/saml', 'magiclink']);
const CLOCK_SKEW_SECONDS = 30;
export function verifiedPrimaryAuthTime(accessToken: string, nowMilliseconds = Date.now()): number | undefined {
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3 || !parts[1] || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || parts[1].length > 32_768) return undefined;
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!claims || typeof claims !== 'object' || !Array.isArray(claims.amr) || claims.amr.length > 32) return undefined;
    const now = Math.floor(nowMilliseconds / 1000);
    if (!Number.isSafeInteger(now) || now <= 0) return undefined;
    const primary: number[] = [];
    for (const entry of claims.amr) {
      // Fail closed for malformed AMR entries: do not salvage another entry from a corrupt claim.
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.method !== 'string' ||
          !Number.isSafeInteger(entry.timestamp) || entry.timestamp <= 0 || entry.timestamp > now + CLOCK_SKEW_SECONDS) return undefined;
      if (PRIMARY_METHODS.has(entry.method)) primary.push(entry.timestamp);
    }
    return primary.length ? Math.max(...primary) : undefined;
  } catch {
    return undefined;
  }
}
