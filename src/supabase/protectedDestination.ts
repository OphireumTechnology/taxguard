export function isProtectedIdentityDestination(url?: string | null): boolean {
  const value = (url || '').trim().toLowerCase();
  if (!value) return false;
  return (
    value.includes('supabase.co') ||
    value.includes('destriataxservices.com') ||
    value.includes('artaxserv.com')
  );
}
