/**
 * Extracts token-bound primary sign-in timestamp from a verified JWT's `amr` claim.
 * Fails closed (returns undefined) if malformed or missing verified primary authentication evidence.
 */
export function verifiedPrimaryAuthTime(accessToken: string): number | undefined {
  if (!accessToken || typeof accessToken !== 'string') return undefined;
  const parts = accessToken.split('.');
  if (parts.length !== 3) return undefined;
  try {
    const payloadRaw = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadRaw) as {
      amr?: Array<{ method?: string; timestamp?: number }>;
      iat?: number;
    };
    if (!Array.isArray(payload.amr)) return undefined;
    const primaryMethods = new Set(['password', 'oauth', 'sso/saml', 'magiclink', 'email_otp', 'otp', 'webauthn']);
    const primaryEntries = payload.amr.filter(
      (entry) =>
        entry &&
        typeof entry.method === 'string' &&
        primaryMethods.has(entry.method.toLowerCase()) &&
        typeof entry.timestamp === 'number' &&
        Number.isFinite(entry.timestamp) &&
        entry.timestamp > 0
    );
    if (primaryEntries.length === 0) return undefined;
    return Math.max(...primaryEntries.map((entry) => Math.floor(entry.timestamp!)));
  } catch {
    return undefined;
  }
}
