/**
 * Production Password Recovery & Redirect Policy for TaxGuard AI
 * Strictly enforces canonical recovery endpoints on destriataxservices.com (the legacy artaxserv.com host is
 * still accepted as an authorized recovery host during the domain transition).
 * Never allows arbitrary domains, unencrypted HTTP, or credential-bearing URLs.
 */

export const CANONICAL_PRODUCTION_ORIGIN = 'https://destriataxservices.com';
/** Production hosts. The legacy host stays authorized until the owner retires it. */
export const PRODUCTION_SITE_HOSTS = ['destriataxservices.com', 'www.destriataxservices.com', 'artaxserv.com', 'www.artaxserv.com'] as const;
export const CANONICAL_RECOVERY_ROUTE = '#/client/reset-password';
export const CANONICAL_RECOVERY_URL = `${CANONICAL_PRODUCTION_ORIGIN}/${CANONICAL_RECOVERY_ROUTE}`;
export const CANONICAL_ADMIN_RECOVERY_PATH = '/admin/reset-password';
export const CANONICAL_ADMIN_RECOVERY_URL = `${CANONICAL_PRODUCTION_ORIGIN}${CANONICAL_ADMIN_RECOVERY_PATH}`;

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
    const host = window.location.hostname;
    if ((PRODUCTION_SITE_HOSTS as readonly string[]).includes(host)) {
      return CANONICAL_RECOVERY_URL;
    }
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return `${origin}/${CANONICAL_RECOVERY_ROUTE}`;
    }
  }

  return CANONICAL_RECOVERY_URL;
}

/**
 * Resolves the strictly validated administrator password recovery redirect URL.
 * Always targets https://destriataxservices.com/admin/reset-password in production
 * (or the local loopback /admin/reset-password route during local development).
 */
export function getAuthorizedAdminRecoveryRedirectUrl(customUrl?: string): string {
  if (customUrl && typeof customUrl === 'string' && customUrl.trim()) {
    const validated = sanitizeAndValidateRecoveryUrl(customUrl.trim());
    const parsed = new URL(validated);
    if (parsed.pathname.replace(/\/+$/, '') !== CANONICAL_ADMIN_RECOVERY_PATH) {
      throw new Error(`Unauthorized administrator recovery target route: ${parsed.pathname}`);
    }
    return validated;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return sanitizeAndValidateRecoveryUrl(`${window.location.origin}${CANONICAL_ADMIN_RECOVERY_PATH}`);
    }
  }

  return CANONICAL_ADMIN_RECOVERY_URL;
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

  const allowedHosts: string[] = [...PRODUCTION_SITE_HOSTS, 'localhost', '127.0.0.1'];
  if (!allowedHosts.includes(url.hostname)) {
    throw new Error(`Unauthorized recovery host: ${url.hostname} is not an authorized domain.`);
  }

  if (url.username || url.password) {
    throw new Error('Unauthorized recovery URL: user credentials in URL are prohibited.');
  }

  const allowedCleanPaths = ['/portal', '/portal/login', '/portal/reset-password', '/staff', '/staff/login', '/admin/login', '/admin/reset-password'];
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

export interface ParsedAdminRecoveryCallback {
  isCallback: boolean;
  isResetPath: boolean;
  hashAccessToken: string | null;
  pkceCode: string | null;
  tokenHash: string | null;
  hasExplicitError: boolean;
  isExpiredError: boolean;
}

/**
 * Parses browser location to determine whether the request is an administrator
 * password recovery callback (dedicated /admin/reset-password route, Supabase
 * implicit fragment #type=recovery&access_token=..., PKCE ?code=..., OTP
 * ?token_hash=...&type=recovery, or recovery error callback).
 * Never treats ordinary sign-ins or signup callbacks as password recovery.
 */
export function parseAdminRecoveryCallback(
  location: Pick<Location, 'pathname' | 'hash'> & Partial<Pick<Location, 'search'>>
): ParsedAdminRecoveryCallback {
  const normalizedPath = (location.pathname || '').replace(/\/+$/, '').toLowerCase();
  const isResetPath = normalizedPath === CANONICAL_ADMIN_RECOVERY_PATH;

  const hashParams = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  const searchParams = new URLSearchParams((location.search || '').replace(/^\?/, ''));

  const hashType = (hashParams.get('type') || '').toLowerCase();
  const queryType = (searchParams.get('type') || '').toLowerCase();

  const rawHashToken = hashParams.get('access_token');
  const hashAccessToken = hashType === 'recovery' && rawHashToken ? rawHashToken : null;

  const rawCode = searchParams.get('code');
  const pkceCode =
    rawCode && (isResetPath || queryType === 'recovery') ? rawCode : null;

  const rawTokenHash = searchParams.get('token_hash');
  const tokenHash =
    rawTokenHash && (queryType === 'recovery' || isResetPath) ? rawTokenHash : null;

  const errorCode = (
    hashParams.get('error_code') ||
    searchParams.get('error_code') ||
    ''
  ).toLowerCase();
  const errorParam = (
    hashParams.get('error') ||
    searchParams.get('error') ||
    ''
  ).toLowerCase();
  const errorDescription = (
    hashParams.get('error_description') ||
    searchParams.get('error_description') ||
    ''
  ).toLowerCase();

  const hasRecoveryError =
    Boolean(errorCode || errorParam) &&
    (isResetPath ||
      hashType === 'recovery' ||
      queryType === 'recovery' ||
      errorCode === 'otp_expired');

  const isExpiredError =
    hasRecoveryError &&
    (errorCode === 'otp_expired' ||
      errorDescription.includes('expired') ||
      errorDescription.includes('invalid') ||
      errorParam === 'access_denied');

  const isCallback = Boolean(
    isResetPath ||
      hashAccessToken ||
      pkceCode ||
      tokenHash ||
      hasRecoveryError
  );

  return {
    isCallback,
    isResetPath,
    hashAccessToken,
    pkceCode,
    tokenHash,
    hasExplicitError: hasRecoveryError,
    isExpiredError
  };
}

export function isAdminRecoveryCallback(
  location: Pick<Location, 'pathname' | 'hash'> & Partial<Pick<Location, 'search'>>
): boolean {
  return parseAdminRecoveryCallback(location).isCallback;
}
