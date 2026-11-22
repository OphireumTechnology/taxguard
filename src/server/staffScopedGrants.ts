const SCOPED_GRANTS = new WeakMap<object, string[]>();

export function attachScopedClientGrants(user: object, grants: string[]): void {
  if (user && typeof user === 'object') {
    SCOPED_GRANTS.set(user, [...grants]);
  }
}

export function scopedClientGrants(user: any): string[] {
  if (!user || typeof user !== 'object') return [];
  return SCOPED_GRANTS.get(user) || (Array.isArray(user.authorizedClientIds) ? [...user.authorizedClientIds] : []);
}
