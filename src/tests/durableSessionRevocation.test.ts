import { describe, it, expect, beforeEach } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { SupabaseDurableSessions } from '../server/supabase-db';

/**
 * Account suspension and session revocation take effect on the very next request:
 * SupabaseDurableSessions.verify re-reads session, identity and membership every time.
 * Uses an in-memory stand-in for the Supabase query builder; synthetic rows only.
 */
type Row = Record<string, any>;
function fakeSupabase(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: [string, unknown][] = [];
      let patch: Row | null = null;
      const rows = () => (tables[table] ??= []).filter(r => filters.every(([k, v]) => r[k] === v));
      const builder: any = {
        select: () => builder,
        eq: (k: string, v: unknown) => { filters.push([k, v]); return builder; },
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        update: (p: Row) => { patch = p; return builder; },
        insert: async (r: Row) => { (tables[table] ??= []).push(r); return { data: null, error: null }; },
        then: (resolve: any, reject: any) => {
          if (patch) { for (const r of rows()) Object.assign(r, patch); return Promise.resolve({ data: null, error: null }).then(resolve, reject); }
          return Promise.resolve({ data: rows(), error: null }).then(resolve, reject);
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
