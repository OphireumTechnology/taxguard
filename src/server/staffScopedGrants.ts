const SCOPED_GRANTS = new WeakMap<object, ReadonlySet<string>>();

export function attachScopedClientGrants<T extends object>(user: T, clientIds: Iterable<string>): T {
  SCOPED_GRANTS.set(user, new Set(clientIds));
  return user;
}

export function scopedClientGrants(user: unknown): ReadonlySet<string> {
  if (!user || typeof user !== 'object') return new Set();
  const existing = SCOPED_GRANTS.get(user);
  if (existing) return existing;
  const fallback = (user as any).authorizedClientIds;
  if (Array.isArray(fallback)) {
    return new Set(fallback.filter((id): id is string => typeof id === 'string'));
  }
  return new Set();
}
