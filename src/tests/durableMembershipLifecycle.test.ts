import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseDurableSessions } from '../server/supabase-db';
import { db } from '../server/db';
import type { User } from '../types';
import { createMockSupabaseClient } from './helpers/mockSupabase';

const tenantId = 'lifecycle-tenant';
let serial = 0;
const touchedUsers: string[] = [];
afterEach(() => {
  for (const uid of touchedUsers.splice(0)) db.users.delete(uid);
  vi.unstubAllEnvs();
});
function fixture(status: string | undefined) {
  const { client, store } = createMockSupabaseClient();
  const uid = 'lifecycle-staff-' + ++serial;
  const user = { id: uid, email: uid + '@example.invalid', name: 'Synthetic Staff',
    tenantId, role: 'admin', status: 'active', isVerified: true } as User;
  // Both profile stores claim active: the durable membership must still win.
  store.identities.set(uid, { uid, tenant_id: tenantId, user_data: user });
  store.members.set(tenantId + '_' + uid, { uid, tenant_id: tenantId, role: 'admin', status });
  db.users.set(uid, user);
  touchedUsers.push(uid);
  const verified = { uid, email: user.email, emailVerified: true, authTime: 1, primaryAuthTime: 1,
    aal: 'aal2' as const, verifiedFactorCount: 1 };
  return { client, store, uid, verified, sessions: new SupabaseDurableSessions(client, tenantId) };
}

describe.each(['development', 'test', 'production'])('durable membership lifecycle in %s', environment => {
  it.each(['pending_approval', 'suspended', 'deactivated', 'unknown', undefined])(
    'denies %s membership before creating a session or changing profile state', async status => {
      vi.stubEnv('NODE_ENV', environment);
      const { store, uid, verified, sessions } = fixture(status);
      await expect(sessions.create(verified)).rejects.toMatchObject({ code: 'IDENTITY_DENIED', status: 403 });
      expect(store.sessions.size).toBe(0);
      expect(store.clients.size).toBe(0);
      expect(store.audit).toEqual([]);
      expect(store.members.get(tenantId + '_' + uid).status).toBe(status);
      expect(store.identities.get(uid).user_data.status).toBe('active');
    });
  it('requires fresh provider proof and rejects old sessions after reactivation', async () => {
    vi.stubEnv('NODE_ENV', environment);
    const { store, uid, verified, sessions } = fixture('active');
    const created = await sessions.create(verified);
    store.members.get(tenantId + '_' + uid).status_changed_at = new Date(2000).toISOString();
    expect(await sessions.verify(created.token)).toBeNull();
    await expect(sessions.create(verified)).rejects.toMatchObject({ code: 'STAFF_FRESH_SIGN_IN_REQUIRED' });
    await expect(sessions.create({ ...verified, authTime: 3, primaryAuthTime: 3 })).resolves.toMatchObject({ user: { status: 'active' } });
  });
  it('allows active AAL2 staff, then denies restoration and renewed sign-in after suspension', async () => {
    vi.stubEnv('NODE_ENV', environment);
    const { store, uid, verified, sessions } = fixture('active');
    const created = await sessions.create(verified);
    expect(created.user.status).toBe('active');
    expect(store.sessions.size).toBe(1);
    expect(await sessions.verify(created.token)).toMatchObject({ id: uid });
    store.members.get(tenantId + '_' + uid).status = 'suspended';
    expect(await sessions.verify(created.token)).toBeNull();
    await expect(sessions.create(verified)).rejects.toMatchObject({ code: 'IDENTITY_DENIED', status: 403 });
    expect(store.sessions.size).toBe(1);
  });
});
