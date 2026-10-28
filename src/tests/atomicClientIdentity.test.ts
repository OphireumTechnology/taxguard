import { describe, expect, it, vi } from 'vitest';
import { provisionClientIdentity } from '../server/atomicClientIdentity';
import type { VerifiedSupabaseUser } from '../server/supabase';
const proof = (overrides: Record<string, unknown> = {}) => ({ uid: 'provider-user', email: ' VERIFIED@EXAMPLE.INVALID ', displayName: ' Verified Client ', emailVerified: true, authTime: 1000, ...overrides } as VerifiedSupabaseUser);
const result = (user: Record<string, unknown> = {}, data: Record<string, unknown> = {}) => ({ user: { id: 'provider-user', tenantId: 'tenantA', email: 'verified@example.invalid', name: 'Verified Client', role: 'client', status: 'active', clientId: '001', isVerified: true, onboardingStatus: 'NOT_STARTED', onboardingCompletedAt: null, createdAt: '2026-10-12T01:00:00.123456Z', ...user }, clientId: '001', resumed: false, ...data });
const client = (data: unknown = result()) => ({ rpc: vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ data, error: null })), from: vi.fn() });
describe('atomic client identity service', () => {
  it('uses only normalized verified proof and configured server tenant', async () => {
    const c = client();
    const response = await provisionClientIdentity(c as any, 'tenantA', proof({ role: 'super_admin', clientId: 'forged', tenantId: 'forged', token: 'secret', metadata: { role: 'admin', clientId: 'forged' }, aal: 'aal2', primaryAuthTime: 999 }));
    expect(c.rpc).toHaveBeenCalledExactlyOnceWith('taxguard_provision_client_identity', { p_tenant: 'tenantA', p_uid: 'provider-user', p_email: 'verified@example.invalid', p_name: 'Verified Client' });
    expect(c.from).not.toHaveBeenCalled();
    expect(response).toEqual(result());
    expect(JSON.stringify(response)).not.toMatch(/secret|forged|authTime|metadata/);
  });
  it('falls back to normalized email when display name is absent or blank', async () => {
    for (const displayName of [undefined, '  ']) {
      const c = client(result({ name: 'verified@example.invalid' }));
      await provisionClientIdentity(c as any, 'tenantA', proof({ displayName }));
      expect(c.rpc.mock.calls[0][1].p_name).toBe('verified@example.invalid');
    }
  });
  it('whitelists returned profile and strips response secrets and proof authority', async () => {
    const c = client(result({ token: 'secret', roleOverride: 'admin', authorizedClientIds: ['other'], mfaEnabled: true, sessionAssuranceLevel: 'aal2', metadata: { secret: true } }, { token: 'secret' }));
    expect(await provisionClientIdentity(c as any, 'tenantA', proof())).toEqual(result());
  });
  it.each([{ emailVerified: false }, { emailVerified: undefined }, { authTime: 0 }, { authTime: -1 }, { authTime: NaN }, { authTime: Infinity }, { authTime: '100' }, { email: '' }, { email: 'bad' }, { email: 'bad@@example.invalid' }, { email: 'a'.repeat(256)+'@example.invalid' }, { email: '\nverified@example.invalid' }, { displayName: 'x'.repeat(256) }, { displayName: 'A\nB' }, { displayName: 123 }])('refuses invalid provider proof %j before RPC', async override => {
    const c = client(); await expect(provisionClientIdentity(c as any, 'tenantA', proof(override))).rejects.toMatchObject({ status: 403 }); expect(c.rpc).not.toHaveBeenCalled(); expect(c.from).not.toHaveBeenCalled();
  });
  it.each(['', '../tenant', 'x'.repeat(129)])('refuses invalid configured tenant %s', async tenant => {
    const c = client(); await expect(provisionClientIdentity(c as any, tenant, proof())).rejects.toMatchObject({ status: 400 }); expect(c.rpc).not.toHaveBeenCalled();
  });
  it.each(['', '../uid', 'x'.repeat(129)])('refuses invalid provider UID %s', async uid => {
    const c = client(); await expect(provisionClientIdentity(c as any, 'tenantA', proof({ uid }))).rejects.toMatchObject({ status: 400 }); expect(c.rpc).not.toHaveBeenCalled();
  });
  it.each([null, [], {}, result({}, { resumed: 'true' }), result({}, { clientId: '../client' }), result({}, { clientId: '000' }), result({}, { user: null }), result({ id: 'other' }), result({ tenantId: 'tenantB' }), result({ email: 'other@example.invalid' }), result({ clientId: '002' }), result({ role: 'admin' }), result({ status: 'suspended' }), result({ isVerified: false }), result({ name: '' }), result({ name: 'A\nB' }), result({ onboardingStatus: 'invalid' }), result({ onboardingCompletedAt: undefined }), result({ onboardingCompletedAt: 'bad' }), result({ createdAt: '2026-02-31T00:00:00Z' }), result({ createdAt: undefined })])('fails closed on malformed or inconsistent RPC result %j', async data => {
    await expect(provisionClientIdentity(client(data) as any, 'tenantA', proof())).rejects.toMatchObject({ code: 'CLIENT_IDENTITY_STORE_UNAVAILABLE', status: 503 });
  });
  it('accepts replay result without changing durable onboarding state or issuing a session', async () => {
    const durable = result({ onboardingStatus: 'COMPLETED', onboardingCompletedAt: '2026-10-12T02:00:00Z', createdAt: '2024-02-29T23:00:00.123456+08:00' }, { resumed: true });
    const c = client(durable);
    const first = await provisionClientIdentity(c as any, 'tenantA', proof());
    const second = await provisionClientIdentity(c as any, 'tenantA', proof({ displayName: 'New Provider Display Name' }));
    expect(first).toEqual(durable); expect(second).toEqual(first); expect(c.rpc).toHaveBeenCalledTimes(2); expect(c.from).not.toHaveBeenCalled();
  });
  it('sanitizes SQL denials and storage failures without trusting arbitrary error text', async () => {
    for (const [code,message,expected,status] of [['P0001','STAFF_INVITATION_ACCEPTANCE_REQUIRED','STAFF_INVITATION_ACCEPTANCE_REQUIRED',403], ['P0001','CLIENT_INVITATION_EXISTS','STAFF_INVITATION_ACCEPTANCE_REQUIRED',403], ['P0001','CLIENT_IDENTITY_INPUT_INVALID','CLIENT_IDENTITY_INPUT_INVALID',400], ['P0001','CLIENT_IDENTITY_CONFLICT','CLIENT_IDENTITY_DENIED',403], ...['CLIENT_COUNTER_CORRUPT','CLIENT_ID_NAMESPACE_EXHAUSTED','CLIENT_ID_COLLISION'].map(message => ['P0001',message,'CLIENT_IDENTITY_STORE_UNAVAILABLE',503]), ['P0001','private SQL details','CLIENT_IDENTITY_DENIED',403], ['23505','private constraint','CLIENT_IDENTITY_STORE_UNAVAILABLE',503]]) {
      await expect(provisionClientIdentity({ rpc: async () => ({ error: { code,message } }) } as any, 'tenantA', proof())).rejects.toMatchObject({ code:expected, status });
    }
    await expect(provisionClientIdentity({ rpc: async () => { throw Error('private provider detail'); } } as any, 'tenantA', proof())).rejects.toMatchObject({ code:'CLIENT_IDENTITY_STORE_UNAVAILABLE', status:503 });
  });
});

it('preserves only validated optional saved contacts on identity replay', async()=>{
  const c=client(result({phone:'555-0100',companyName:'Synthetic Company'},{resumed:true}));
  expect((await provisionClientIdentity(c as any,'tenantA',proof())).user).toMatchObject({phone:'555-0100',companyName:'Synthetic Company'});
  for(const values of [{phone:123},{phone:'x'.repeat(65)},{companyName:'x'.repeat(256)},{companyName:'A\u0085B'}]) {
    await expect(provisionClientIdentity(client(result(values)) as any,'tenantA',proof())).rejects.toMatchObject({code:'CLIENT_IDENTITY_STORE_UNAVAILABLE'});
  }
});
