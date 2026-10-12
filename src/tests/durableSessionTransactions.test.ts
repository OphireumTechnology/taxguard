import { describe, expect, it, vi } from 'vitest';
import { createDurableSession, revokeDurableSession } from '../server/durableSessionTransactions';
const hash = 'a'.repeat(64);
const input = (patch: Record<string, unknown> = {}) => ({ uid: 'verified-user', tokenHash: hash, authTime: Math.floor(Date.now()/1000), expiresAt: Date.now()+7_000_000, aal: 'aal2' as const, verifiedFactorCount: 1, ...patch });
const client = (data: unknown) => ({ rpc: vi.fn(async (_name: string, _parameters: Record<string, unknown>) => ({ data, error: null })), from: vi.fn() });
describe('durable session transaction adapter', () => {
  it('sends only verified server proof and hash to atomic mint', async () => {
    const c = client({ created: true, token: 'untrusted', role: 'super_admin' }); const proof = input({ token: 'raw-secret', role: 'super_admin', tenantId: 'other' });
    await createDurableSession(c as any, 'tenantA', proof);
    expect(c.rpc).toHaveBeenCalledWith('taxguard_create_session', { p_tenant: 'tenantA', p_uid: 'verified-user', p_token_hash: hash, p_auth_time: proof.authTime, p_expires_at: proof.expiresAt, p_aal: 'aal2', p_verified_factor_count: 1 });
    expect(c.from).not.toHaveBeenCalled(); expect(JSON.stringify(c.rpc.mock.calls)).not.toContain('raw-secret');
  });
  it.each([{ tokenHash: 'bad' },{ authTime: 0 },{ authTime: NaN },{ authTime: 1.5 },{ authTime: Math.floor(Date.now()/1000)+1000 },{ expiresAt: 1 },{ expiresAt: Date.now()+10_000_000 },{ aal: 'aal3' },{ verifiedFactorCount: -1 },{ verifiedFactorCount: 1.5 },{ verifiedFactorCount: 101 }])('rejects invalid proof %j without transport', async patch => {
    const c = client({ created: true }); await expect(createDurableSession(c as any,'tenantA',input(patch))).rejects.toMatchObject({code:'SESSION_INPUT_INVALID',status:400}); expect(c.rpc).not.toHaveBeenCalled();
  });
  it.each([null,[],{}, {created:false},{created:'true'}])('denies malformed mint response %j', async data => {
    await expect(createDurableSession(client(data) as any,'tenantA',input())).rejects.toMatchObject({code:'SESSION_STORE_UNAVAILABLE',status:503});
  });
  it.each(['SESSION_AUTHORITY_DENIED','STAFF_MFA_REQUIRED','STAFF_MFA_ENROLLMENT_REQUIRED','STAFF_MFA_REENROLLMENT_REQUIRED','STAFF_FRESH_SIGN_IN_REQUIRED'])('preserves safe authority denial %s', async message => {
    const c = { rpc: vi.fn(async()=>({ data:null,error:{code:'P0001',message} })) }; await expect(createDurableSession(c as any,'tenantA',input())).rejects.toMatchObject({code:message,status:403});
  });
  it('redacts storage and collision errors and never falls back', async () => {
    for (const error of [{code:'08006',message:'private database details'},{code:'P0001',message:'SESSION_TOKEN_CONFLICT'},{code:'P0001',message:'private database details'}]) {
      const c={rpc:vi.fn(async()=>({data:null,error}))};await expect(createDurableSession(c as any,'tenantA',input())).rejects.toMatchObject({code:'SESSION_STORE_UNAVAILABLE',status:503});
    }
    await expect(createDurableSession({rpc:vi.fn(async()=>{throw Error('private');})} as any,'tenantA',input())).rejects.toMatchObject({code:'SESSION_STORE_UNAVAILABLE'});
  });
  it.each([true,false])('uses tenant-scoped idempotent revocation (%s)', async revoked => {
    const c = client({ revoked }); expect(await revokeDurableSession(c as any,'tenantA',hash)).toBe(revoked);
    expect(c.rpc).toHaveBeenCalledExactlyOnceWith('taxguard_revoke_session',{p_tenant:'tenantA',p_token_hash:hash});expect(c.from).not.toHaveBeenCalled();
  });
  it.each([null,[],{}, {revoked:'true'}])('rejects malformed revoke response %j', async data => {
    await expect(revokeDurableSession(client(data) as any,'tenantA',hash)).rejects.toMatchObject({code:'SESSION_STORE_UNAVAILABLE',status:503});
  });
  it('does not call storage for invalid revoke input', async () => {
    const c=client({revoked:true});await expect(revokeDurableSession(c as any,'tenantA','raw-token')).rejects.toMatchObject({status:400});expect(c.rpc).not.toHaveBeenCalled();
  });
});
