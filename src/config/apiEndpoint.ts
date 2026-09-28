export function resolveApiBaseUrl(raw: string | undefined, production: boolean, sameOrigin = false, frontendOrigin?: string): string {
  const value = (raw || '').trim().replace(/\/+$/, '');
  if (!value) {
    if (production && (!sameOrigin || !frontendOrigin || isStaticHost(new URL(frontendOrigin).hostname))) throw new Error('The secure TaxGuard API is not configured. Please contact support.');
    return '';
  }
  const url = new URL(value);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && !production && ['localhost', '127.0.0.1'].includes(url.hostname))) ||
      url.username || url.password || url.search || url.hash ||
      (url.pathname !== '/' && !(url.hostname.endsWith('.cloudfunctions.net') && /^\/[A-Za-z][A-Za-z0-9_-]*$/.test(url.pathname)))) throw new Error('Invalid TaxGuard API origin configuration.');
  if (isStaticHost(url.hostname)) throw new Error('GitHub Pages cannot host the TaxGuard API.');
  return url.origin + (url.pathname === '/' ? '' : url.pathname);
}
function isStaticHost(host: string): boolean {
  return ['artaxserv.com', 'www.artaxserv.com', 'github.io'].includes(host) || host.endsWith('.github.io');
}
export function apiEndpoint(path: string): string {
  if (!path.startsWith('/api/')) throw new Error('Invalid API path.');
  return resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL, import.meta.env.PROD, import.meta.env.VITE_API_SAME_ORIGIN === 'true', typeof window !== 'undefined' ? window.location.origin : undefined) + path;
}
