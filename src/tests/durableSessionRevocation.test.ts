import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { SupabaseDurableSessions } from '../server/supabase-db';

/**
 * Account suspension and session revocation take effect on the very next request:
 * SupabaseDurableSessions.verify re-reads session, identity and membership every time.
 * Uses an in-memory stand-in for the Supabase query builder; synthetic rows only.
 */
type Row = Record<string, any>;
/** `failing` simulates a database read error (not "no row") for the named tables. */
function fakeSupabase(tables: Record<string, Row[]>, failing: Set<string> = new Set()) {
  return {
    from(table: string) {
      const filters: [string, unknown][] = [];
      let patch: Row | null = null;
      let columns: string[] | null = null;
      // Like PostgREST, return only the selected columns (filters may use unselected columns).
      const project = (r: Row) => (columns ? Object.fromEntries(columns.map(c => [c, r[c]])) : { ...r });
      const rows = () => (tables[table] ??= []).filter(r => filters.every(([k, v]) => r[k] === v));
      const err = () => (failing.has(table) ? { message: 'synthetic read failure' } : null);
      const builder: any = {
        select: (cols = '*') => { columns = cols.trim() === '*' ? null : cols.split(',').map(c => c.trim()); return builder; },
        eq: (k: string, v: unknown) => { filters.push([k, v]); return builder; },
        maybeSingle: async () => (err() ? { data: null, error: err() } : { data: rows()[0] ? project(rows()[0]) : null, error: null }),
        update: (p: Row) => { patch = p; return builder; },
        insert: async (r: Row) => { (tables[table] ??= []).push(r); return { data: null, error: null }; },
        then: (resolve: any, reject: any) => {
          if (patch) { for (const r of rows()) Object.assign(r, patch); return Promise.resolve({ data: null, error: null }).then(resolve, reject); }
          return Promise.resolve(err() ? { data: null, error: err() } : { data: rows().map(project), error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  } as any;
}

const tenant = 'tenantRevocation';
let tables: Record<string, Row[]>, sessions: SupabaseDurableSessions, token: string;
const staffUser = { id: 'staff-synthetic-01', email: 'staff@example.invalid', name: 'Synthetic Staff', role: 'accountant', status: 'active' };

beforeEach(() => {
  token = 'tg_live_' + randomBytes(32).toString('hex');
  tables = {
    taxguard_sessions: [{ session_token_hash: createHash('sha256').update(token).digest('hex'), tenant_id: tenant, uid: staffUser.id, revoked: false, expires_at: Date.now() + 3_600_000 }],
    taxguard_identities: [{ uid: staffUser.id, tenant_id: tenant, user_data: staffUser }],
    taxguard_members: [{ tenant_id: tenant, uid: staffUser.id, role: 'accountant', status: 'active', client_id: '' }],
    taxguard_audit_log: [],
  };
  sessions = new SupabaseDurableSessions(fakeSupabase(tables), tenant);
});

describe('durable session revocation and suspension', () => {
  it('accepts an active member with a live, unexpired session (control)', async () => {
    const user = await sessions.verify(token);
    expect(user).toMatchObject({ id: staffUser.id, role: 'accountant', tenantId: tenant });
  });

  it.each(['suspended', 'revoked', 'pending', 'disabled'])('rejects the same token immediately once the membership is %s', async status => {
    expect(await sessions.verify(token)).not.toBeNull();
    tables.taxguard_members[0].status = status;
    expect(await sessions.verify(token)).toBeNull();
  });

  it('rejects a session after server-side revocation (logout / access revocation)', async () => {
    expect(await sessions.verify(token)).not.toBeNull();
    await sessions.revoke(token);
    expect(tables.taxguard_sessions[0].revoked).toBe(true);
    expect(await sessions.verify(token)).toBeNull();
  });

  it('rejects an expired session', async () => {
    tables.taxguard_sessions[0].expires_at = Date.now() - 1;
    expect(await sessions.verify(token)).toBeNull();
  });

  it('rejects when the membership is removed entirely, even after a prior successful verify cached the user', async () => {
    // Regression: verify() caches users in db.users; that cache must not resurrect a deleted membership.
    expect(await sessions.verify(token)).not.toBeNull();
    tables.taxguard_members.length = 0;
    expect(await sessions.verify(token)).toBeNull();
  });

  it('rejects when the identity row is removed, even after a prior successful verify', async () => {
    expect(await sessions.verify(token)).not.toBeNull();
    tables.taxguard_identities.length = 0;
    expect(await sessions.verify(token)).toBeNull();
  });

  it('rejects a session belonging to another tenant even with a valid token', async () => {
    tables.taxguard_sessions[0].tenant_id = 'otherTenant';
    expect(await sessions.verify(token)).toBeNull();
  });

  it('uses the server-recorded role, not a role claimed in stored profile data', async () => {
    tables.taxguard_identities[0].user_data = { ...staffUser, role: 'admin' };
    expect(await sessions.verify(token)).toMatchObject({ role: 'accountant' });
  });

  it.each(['', 'tg_live_short', 'Bearer x', 'tg_live_' + 'g'.repeat(64)])('rejects malformed token %j without lookup', async bad => {
    expect(await sessions.verify(bad)).toBeNull();
  });
});
describe('production-path session authorization', () => {
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const assignment = (patch: Row) => ({ tenant_id: tenant, user_id: staffUser.id, client_id: 'clientA', engagement_id: null, tax_year: null, status: 'ACTIVE', effective_from: past, effective_to: null, ...patch });
  const prodSessions = (failing?: Set<string>) => new SupabaseDurableSessions(fakeSupabase(tables, failing), tenant);
  beforeEach(() => { vi.stubEnv('NODE_ENV', 'production'); });
  afterEach(() => { vi.unstubAllEnvs(); });

  describe('staff in assignment-required roles', () => {
    it('authorizes exactly the active, effective, client-wide assignments in the tenant', async () => {
      tables.taxguard_staff_assignments = [
        assignment({ client_id: 'clientA' }),
        assignment({ client_id: 'clientB', effective_to: future }),
        assignment({ client_id: 'clientEngagementScoped', engagement_id: 'eng-1' }),
        assignment({ client_id: 'clientYearScoped', tax_year: 2025 }),
        assignment({ client_id: 'clientExpired', effective_to: past }),
        assignment({ client_id: 'clientFuture', effective_from: future }),
        assignment({ client_id: 'clientInactive', status: 'REVOKED' }),
        assignment({ client_id: 'clientOtherUser', user_id: 'someone-else' }),
        assignment({ client_id: 'clientOtherTenant', tenant_id: 'otherTenant' }),
      ];
      const user: any = await prodSessions().verify(token);
      expect(user).not.toBeNull();
      expect([...user.authorizedClientIds].sort()).toEqual(['clientA', 'clientB']);
      expect(Object.keys(user)).not.toContain('authorizedClientIds');
    });

    it('never carries a profile-claimed clientId into a staff session', async () => {
      tables.taxguard_identities[0].user_data = { ...staffUser, clientId: 'clientClaimed' };
      tables.taxguard_staff_assignments = [];
      const user: any = await prodSessions().verify(token);
      expect(user.clientId).toBeUndefined();
      expect(user.authorizedClientIds).toEqual([]);
    });

    it('refuses the session when the assignment store cannot be read', async () => {
      tables.taxguard_staff_assignments = [assignment({})];
      expect(await prodSessions(new Set(['taxguard_staff_assignments'])).verify(token)).toBeNull();
    });

    it('does not fall back to local stores when the membership read fails in production', async () => {
      expect(await prodSessions().verify(token)).not.toBeNull();
      expect(await prodSessions(new Set(['taxguard_members'])).verify(token)).toBeNull();
    });
  });

  describe('clients', () => {
    const clientUser = { id: 'client-synthetic-01', email: 'client@example.invalid', name: 'Synthetic Client', role: 'client', status: 'active' };
    beforeEach(() => {
      tables.taxguard_sessions[0].uid = clientUser.id;
      tables.taxguard_identities = [{ uid: clientUser.id, tenant_id: tenant, user_data: clientUser }];
      tables.taxguard_members = [{ tenant_id: tenant, uid: clientUser.id, role: 'client', status: 'active', client_id: 'clientOwned' }];
      tables.taxguard_clients = [{ tenant_id: tenant, client_id: 'clientOwned', owner_uid: clientUser.id }];
    });

    it('binds the session to the single client record the user owns', async () => {
      expect(await prodSessions().verify(token)).toMatchObject({ id: clientUser.id, role: 'client', clientId: 'clientOwned', tenantId: tenant });
    });
    it('refuses a client with no owned client record', async () => {
      tables.taxguard_clients = [];
      expect(await prodSessions().verify(token)).toBeNull();
    });
    it('refuses when the owned client record belongs to another tenant', async () => {
      tables.taxguard_clients = [{ tenant_id: 'otherTenant', client_id: 'clientOwned', owner_uid: clientUser.id }];
      expect(await prodSessions().verify(token)).toBeNull();
    });
    it('refuses when the membership points at a different client than the one owned', async () => {
      tables.taxguard_members[0].client_id = 'clientSomeoneElse';
      expect(await prodSessions().verify(token)).toBeNull();
    });
    it('refuses when stored profile data claims a different client', async () => {
      tables.taxguard_identities[0].user_data = { ...clientUser, clientId: 'clientSomeoneElse' };
      expect(await prodSessions().verify(token)).toBeNull();
    });
    it('refuses when the client ownership lookup errors', async () => {
      expect(await prodSessions(new Set(['taxguard_clients'])).verify(token)).toBeNull();
    });
  });
});
