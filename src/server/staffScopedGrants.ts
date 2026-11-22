/**
 * Engagement / tax-year scoped staff grants (owner decision 2026-10-19). An active assignment for one
 * engagement and tax year authorizes that client for that tax year only. It never joins the whole-client
 * `authorizedClientIds` list, so routes that treat that list as access to every year are unaffected. Routes
 * opt in through `hasClientYearAccess`, and the database keeps re-checking the assignment.
 */
export interface ScopedClientGrant { clientId: string; engagementId: string; taxYear: number }
type Grantee = { authorizedClientIds?: readonly string[] } & object;

const GRANTS = 'scopedClientGrants';

/** Attached server-side to durable staff sessions; non-enumerable so it is never serialized into responses. */
export function attachScopedClientGrants(user: object, grants: ScopedClientGrant[]): void {
  Object.defineProperty(user, GRANTS, { value: Object.freeze(grants.map(g => Object.freeze({ ...g }))), configurable: true, enumerable: false });
}
export function scopedClientGrants(user: object | undefined | null): readonly ScopedClientGrant[] {
  const value = user ? (user as Record<string, unknown>)[GRANTS] : undefined;
  return Array.isArray(value) ? value as readonly ScopedClientGrant[] : [];
}

/** The tax year a request names explicitly (query first, then body). Never defaulted: no year, no scoped access. */
export function explicitTaxYear(req: { query?: Record<string, unknown>; body?: unknown }): number | undefined {
  const raw = req.query?.taxYear ?? (req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>).taxYear : undefined);
  const year = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d{4}$/.test(raw) ? Number(raw) : NaN;
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : undefined;
}

/** A whole-client grant, or a scoped grant for exactly this client and explicit tax year. */
export function hasClientYearAccess(user: Grantee | undefined | null, clientId: string, taxYear: number | undefined): boolean {
  if (!user || !clientId) return false;
  if (user.authorizedClientIds?.includes(clientId)) return true;
  return taxYear !== undefined && scopedClientGrants(user).some(g => g.clientId === clientId && g.taxYear === taxYear);
}

/** Client ids reachable for at least one tax year (whole-client grants first), for client pickers. */
export function reachableClientIds(user: Grantee | undefined | null): string[] {
  if (!user) return [];
  return [...new Set([...(user.authorizedClientIds ?? []), ...scopedClientGrants(user).map(g => g.clientId)])];
}
