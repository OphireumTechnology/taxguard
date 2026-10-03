/**
 * Production Password Recovery & Redirect Policy for TaxGuard AI
 * Strictly enforces canonical recovery endpoints on artaxserv.com
 * Never allows arbitrary domains, unencrypted HTTP, or credential-bearing URLs.
 */

export const CANONICAL_PRODUCTION_ORIGIN = 'https://artaxserv.com';
export const CANONICAL_RECOVERY_ROUTE = '#/client/reset-password';
export const CANONICAL_RECOVERY_URL = `${CANONICAL_PRODUCTION_ORIGIN}/${CANONICAL_RECOVERY_ROUTE}`;

/**
 * Validates and normalizes the password recovery redirect URL.
 * Rejects untrusted origins, insecure protocols, and open redirect attempts.
 */
export function getAuthorizedRecoveryRedirectUrl(customUrl?: string): string {
  // 1. If explicit URL passed, validate it strictly
  if (customUrl && typeof customUrl === 'string' && customUrl.trim()) {
    return sanitizeAndValidateRecoveryUrl(customUrl.trim());
  }

  // 2. Check environment variable if configured
  const envUrl = (import.meta.env.VITE_AUTH_RECOVERY_REDIRECT_URL || '').trim();
  if (envUrl) {
    return sanitizeAndValidateRecoveryUrl(envUrl);
  }

  // 3. Fallback based on browser origin (supports local development / testing)
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (origin.includes('artaxserv.com')) {
      return CANONICAL_RECOVERY_URL;
    }
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return `${origin}/${CANONICAL_RECOVERY_ROUTE}`;
    }
  }

  return CANONICAL_RECOVERY_URL;
}

export function sanitizeAndValidateRecoveryUrl(candidate: string): string {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('Invalid recovery redirect URL format.');
  }

  // Security checks
  const isHttps = url.protocol === 'https:';
  const isLocalHttp = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');

  if (!isHttps && !isLocalHttp) {
    throw new Error('Insecure protocol: Password recovery redirect must use HTTPS.');
  }

  const allowedHosts = ['artaxserv.com', 'www.artaxserv.com', 'localhost', '127.0.0.1'];
  if (!allowedHosts.includes(url.hostname)) {
    throw new Error(`Unauthorized recovery host: ${url.hostname} is not an authorized domain.`);
  }

  if (url.username || url.password) {
    throw new Error('Unauthorized recovery URL: user credentials in URL are prohibited.');
  }

  const allowedCleanPaths = ['/portal', '/portal/login', '/portal/reset-password', '/staff', '/staff/login'];
  const cleanPath = url.pathname.replace(/\/+$/, '');

  const isCleanPath = allowedCleanPaths.includes(cleanPath);
  const isRootPath = url.pathname === '/' || url.pathname === '';

  if (!isCleanPath && !isRootPath) {
    throw new Error(`Unauthorized recovery target route: ${url.pathname}`);
  }

  // If root path was used, ensure hash points to client recovery or login hash
  if (isRootPath) {
    const hash = url.hash.toLowerCase();
    const allowedHashes = ['#/client/reset-password', '#/client/login', '#client/reset-password', '#client/login'];
    if (!hash || !allowedHashes.some(h => hash.startsWith(h))) {
      throw new Error(`Unauthorized recovery target route: ${url.hash || 'missing-recovery-hash'}`);
    }
  }

  return url.href;
}
