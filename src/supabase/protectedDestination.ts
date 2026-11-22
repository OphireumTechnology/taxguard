export function isProtectedIdentityDestination(url?: string | null): boolean {
  if (!url || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'destriataxservices.com' ||
      host.endsWith('.destriataxservices.com') ||
      host === 'artaxserv.com' ||
      host.endsWith('.artaxserv.com')
    );
  } catch {
    return false;
  }
}
