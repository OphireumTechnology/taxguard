export const PRODUCT_QA_ORIGIN = 'http://127.0.0.1:4180';
/** A local test-mode declaration, not governance approval or service commissioning. */
export function requireAnonymousProductMode(mode) {
  if (mode !== 'SYNTHETIC_ANONYMOUS_ONLY') throw new Error('PRODUCT_ANONYMOUS_QA_DISABLED');
  return { origin: PRODUCT_QA_ORIGIN, releaseAuthorized: false, fullProductAcceptance: 'NOT VERIFIED' };
}
export function allowAnonymousProductRequest(rawURL, method) {
  try {
    const url = new URL(rawURL);
    if (url.origin !== PRODUCT_QA_ORIGIN || method !== 'GET' || url.username || url.password) return false;
    // Reject credentials/query payloads and encoded path separators rather than forwarding them to a local server.
    if (url.search || /%(?:2f|5c|00)/i.test(url.pathname)) return false;
    if (url.pathname.startsWith('/api/')) return url.pathname === '/api/auth/me' && !url.search;
    return ['/', '/portal/login', '/portal/dashboard', '/portal/profile', '/staff/login', '/staff/workspace'].includes(url.pathname)
      || /^\/(?:assets\/[^/]+\.(?:js|css|woff2?)|[^?]*\.(?:png|jpg|jpeg|svg|ico|woff2?))$/.test(url.pathname);
  } catch { return false; }
}
