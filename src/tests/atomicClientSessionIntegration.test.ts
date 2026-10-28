import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseDurableSessions } from '../server/supabase-db';
import { setSupabaseAdmin } from '../server/supabase';
import { db } from '../server/db';
import type { User } from '../types';
import { createMockSupabaseClient } from './helpers/mockSupabase';

const tenantId = 'atomic-integration-tenant';
let serial = 0;
const touchedUsers: string[] = [];
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('TAXGUARD_STAFF_ACCESS_DEVELOPMENT_ENABLED', 'true');
});
afterEach(() => {
  for (const uid of touchedUsers.splice(0)) db.users.delete(uid);
  setSupabaseAdmin(null);
  vi.unstubAllEnvs();
});
function fixture() {
  const { client, store } = createMockSupabaseClient();
  const uid = 'atomic-integration-' + ++serial;
  touchedUsers.push(uid);
  const verified = { uid, email: uid + '@example.invalid', displayName: 'Original Name', emailVerified: true, authTime: 1 };
  const builders: Array<{ table: string; builder: any }> = [];
  const from = client.from.getMockImplementation()!;
  client.from.mockImplementation((table: string) => {
    const builder = from(table);
    builders.push({ table, builder });
    return builder;
  });
  const sessions = new SupabaseDurableSessions(client, tenantId);
  return { client, store, uid, verified, sessions, builders };
}
function expectNoDirectIdentityWrites(builders: Array<{ table: string; builder: any }>) {
  for (const { table, builder } of builders) {
    if (!['taxguard_identities', 'taxguard_members', 'taxguard_clients', 'taxguard_client_id_sequence'].includes(table)) continue;
    expect(builder.insert).not.toHaveBeenCalled();
    expect(builder.upsert).not.toHaveBeenCalled();
    expect(builder.update).not.toHaveBeenCalled();
  }
}

describe('atomic client identity session integration', () => {
  it.each([false, undefined])('requires confirmed email (%s) before the provisioning RPC', async emailVerified => {
    const { client, store, uid, verified, sessions, builders } = fixture();
    await expect(sessions.create({ ...verified, emailVerified })).rejects.toMatchObject({ code: 'CLIENT_IDENTITY_DENIED', status: 403 });
    expect(client.rpc).not.toHaveBeenCalled();
    expectNoDirectIdentityWrites(builders);
    expect(store.identities.size).toBe(0);
    expect(store.sessions.size).toBe(0);
    expect(db.users.has(uid)).toBe(false);
  });

  it.each([
    ['taxguard_identities', 'IDENTITY_STORE_UNAVAILABLE'],
    ['taxguard_members', 'MEMBERSHIP_STORE_UNAVAILABLE'],
    ['taxguard_clients', 'CLIENT_STORE_UNAVAILABLE']
  ])('fails closed before provisioning when %s cannot be read', async (failedTable, code) => {
    const { client, store, uid, verified, sessions, builders } = fixture();
    const from = client.from.getMockImplementation()!;
    client.from.mockImplementation((table: string) => {
      const builder = from(table);
      if (table === failedTable) builder.maybeSingle.mockResolvedValue({ data: null, error: { code: '08006' } });
      return builder;
    });
    await expect(sessions.create(verified)).rejects.toMatchObject({ code, status: 503 });
    expect(client.rpc).not.toHaveBeenCalled();
    expectNoDirectIdentityWrites(builders);
    expect(store.identities.size).toBe(0);
    expect(store.members.size).toBe(0);
    expect(store.clients.size).toBe(0);
    expect(store.sessions.size).toBe(0);
    expect(store.audit).toEqual([]);
    expect(db.users.has(uid)).toBe(false);
  });

  it.each(['returned', 'thrown'])('fails closed when the atomic RPC has a %s storage failure', async failure => {
    const { client, store, uid, verified, sessions, builders } = fixture();
    if (failure === 'returned') client.rpc.mockResolvedValueOnce({ data: null, error: { code: '08006', message: 'Synthetic storage failure' } });
    else client.rpc.mockRejectedValueOnce(new Error('Synthetic storage failure'));
    await expect(sessions.create(verified)).rejects.toMatchObject({ code: 'CLIENT_IDENTITY_STORE_UNAVAILABLE', status: 503 });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expectNoDirectIdentityWrites(builders);
    expect(store.identities.size).toBe(0);
    expect(store.members.size).toBe(0);
    expect(store.clients.size).toBe(0);
    expect(store.sessions.size).toBe(0);
    expect(store.sequence.current_sequence).toBe(100);
    expect(store.audit).toEqual([]);
    expect(db.users.has(uid)).toBe(false);
  });

  it('resumes the same committed identity and progress after session persistence fails', async () => {
    const { client, store, uid, verified, sessions, builders } = fixture();
    const rpc = client.rpc.getMockImplementation()!;
    let failSession = true;
    client.rpc.mockImplementation((name: string, input: Record<string, any>) => {
      if (name === 'taxguard_create_session' && failSession) return Promise.resolve({ data: null, error: { code: '08006' } });
      return rpc(name, input);
    });
    await expect(sessions.create(verified)).rejects.toMatchObject({ code: 'SESSION_STORE_UNAVAILABLE', status: 503 });
    expect(store.sessions.size).toBe(0);
    expect(db.users.has(uid)).toBe(false);
    const committed = store.identities.get(uid).user_data;
    const clientId = committed.clientId;
    committed.name = 'Durable Profile Name';
    store.clients.get(clientId).name = 'Durable Profile Name';
    committed.onboardingStatus = 'IN_PROGRESS';
    failSession = false;
    const retried = await sessions.create({ ...verified, displayName: 'New Provider Name' });
    expect(retried.user).toMatchObject({ clientId, name: 'Durable Profile Name', onboardingStatus: 'IN_PROGRESS' });
    expect(client.rpc.mock.calls.filter(([name]: [string]) => name === 'taxguard_provision_client_identity')).toHaveLength(2);
    expect(client.rpc.mock.calls.filter(([name]: [string]) => name === 'taxguard_create_session')).toHaveLength(2);
    expect(store.sequence.current_sequence).toBe(101);
    expect(store.clients.size).toBe(1);
    expect(store.sessions.size).toBe(1);
    expect(store.audit.filter(row => row.action === 'CLIENT_IDENTITY_PROVISIONED')).toHaveLength(1);
    expectNoDirectIdentityWrites(builders);
  });

  it('does not promote cached completion on strict client resume or verification', async () => {
    const { store, uid, verified, sessions } = fixture();
    const created = await sessions.create(verified);
    const cacheComplete = () => db.users.set(uid, { ...created.user, onboardingStatus: 'COMPLETED', onboardingCompletedAt: '2025-01-01T00:00:00Z' } as User);
    cacheComplete();
    const resumed = await sessions.create(verified);
    expect(resumed.user.onboardingStatus).toBe('NOT_STARTED');
    expect(resumed.user.onboardingCompletedAt).toBeNull();
    cacheComplete();
    expect(await sessions.verify(created.token)).toMatchObject({ onboardingStatus: 'NOT_STARTED', onboardingCompletedAt: null });
    expect(store.identities.get(uid).user_data.onboardingStatus).toBe('NOT_STARTED');
  });

  it('uses durable authority for the configured default getter and rejects a missing tenant', async () => {
    const { client, verified } = fixture();
    vi.stubEnv('TAXGUARD_STAFF_ACCESS_DEVELOPMENT_ENABLED', 'false');
    vi.stubEnv('SUPABASE_URL', 'https://synthetic-project.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-service-role');
    vi.stubEnv('TAXGUARD_TENANT_ID', tenantId);
    setSupabaseAdmin(client);
    const configured = new SupabaseDurableSessions();
    expect(configured.usesDurableAuthority).toBe(true);
    expect(configured.getTenantId()).toBe(tenantId);
    await configured.create(verified);
    expect(client.rpc.mock.calls.filter(([name]: [string]) => name === 'taxguard_provision_client_identity')).toHaveLength(1);
    vi.stubEnv('TAXGUARD_TENANT_ID', '');
    expect(() => new SupabaseDurableSessions()).toThrow(/PRODUCTION_TENANT_REQUIRED/);
  });
});
