/** Public deployment identifiers supplied by the project owner; never credentials. */
const protectedHosts = new Set(['cvrlhixxczerytiocxid.supabase.co','artaxserv.com','www.artaxserv.com','api.artaxserv.com']);
export function isProtectedIdentityDestination(raw?: string): boolean {
  if (!raw) return false;
  try { return protectedHosts.has(new URL(raw.trim()).hostname.toLowerCase().replace(/\.$/,'')); } catch { return false; }
}
