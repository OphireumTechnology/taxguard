import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseDurableSessions } from '../server/supabase-db';

const UID = 'd0000000-0000-4000-8000-000000000013';
const TOKEN = 'tg_live_' + 'a'.repeat(64);
function fixture(aal = 'aal1', role = 'client') {
  vi.stubEnv('TAXGUARD_STAFF_ACCESS_DEVELOPMENT_ENABLED', 'true');
  const row = { uid: UID, tenant_id: 'tenantA', expires_at: Date.now() + 60000, revoked: false, aal };
  const listFactors = vi.fn().mockResolvedValue({ data: { factors: [] }, error: null });
  const rpc = vi.fn(async () => { row.revoked = true; return { data: { revoked: true }, error: null }; });
  const client: any = { auth: { admin: { mfa: { listFactors } } }, rpc,
    from(table: string) {
      const rows: Record<string, unknown> = {
        taxguard_sessions: row,
        taxguard_identities: { tenant_id: 'tenantA', user_data: { id: UID, status: 'active' } },
        taxguard_members: { role, status: 'active' },
        taxguard_clients: { tenant_id: 'tenantA', owner_uid: UID, client_id: 'clientA' },
      };
      const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: rows[table], error: null }) };
      return q;
    } };
  return { sessions: new SupabaseDurableSessions(client, 'tenantA'), row, listFactors, rpc };
}
afterEach(() => vi.unstubAllEnvs());
describe('existing client sessions after provider MFA enrollment', () => {
  it('checks the current provider inventory on every AAL1 request and atomically revokes on enrollment', async () => {
    const f = fixture();
    expect(await f.sessions.verify(TOKEN)).toMatchObject({ id: UID });
    f.listFactors.mockResolvedValue({ data: { factors: [{ id: 'factor', status: 'verified', created_at: new Date().toISOString(), factor_type: 'totp' }] }, error: null });
    expect(await f.sessions.verify(TOKEN)).toBeNull();
    expect(f.listFactors).toHaveBeenLastCalledWith({ userId: UID });
    expect(f.rpc).toHaveBeenCalledWith('taxguard_revoke_session', expect.objectContaining({ p_tenant: 'tenantA' }));
    f.listFactors.mockResolvedValue({ data: { factors: [] }, error: null });
    expect(await f.sessions.verify(TOKEN)).toBeNull();
    expect(f.listFactors).toHaveBeenCalledTimes(2);
  });
  it.each([{ error: { status: 503 } }, { data: {} }, { data: { factors: [null] } }])('denies provider errors and malformed inventories', async response => {
    const f = fixture(); f.listFactors.mockResolvedValue(response);
    expect(await f.sessions.verify(TOKEN)).toBeNull();
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('denies provider exceptions and failed revocation without returning identity', async () => {
    const f = fixture(); f.listFactors.mockRejectedValue(new Error('unavailable'));
    expect(await f.sessions.verify(TOKEN)).toBeNull();
    f.listFactors.mockResolvedValue({ data: { factors: [{ id: 'factor', status: 'verified', created_at: new Date().toISOString() }] } });
    f.rpc.mockResolvedValue({ error: { code: 'unavailable' } } as any);
    expect(await f.sessions.verify(TOKEN)).toBeNull();
  });
  it('allows unfinished enrollment and preserves AAL2 sessions', async () => {
    const f = fixture(); f.listFactors.mockResolvedValue({ data: { factors: [{ id: 'factor', status: 'unverified', created_at: new Date().toISOString() }] } });
    expect(await f.sessions.verify(TOKEN)).toMatchObject({ id: UID });
    const strong = fixture('aal2');
    expect(await strong.sessions.verify(TOKEN)).toMatchObject({ id: UID });
    expect(strong.listFactors).not.toHaveBeenCalled();
  });
  it('does not query provider factors for expired or cross-tenant sessions', async () => {
    const f = fixture(); f.row.expires_at = Date.now() - 1;
    expect(await f.sessions.verify(TOKEN)).toBeNull();
    f.row.expires_at = Date.now() + 60000; f.row.tenant_id = 'tenantOther';
    expect(await f.sessions.verify(TOKEN)).toBeNull();
    expect(f.listFactors).not.toHaveBeenCalled();
  });
});
