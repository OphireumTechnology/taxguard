import { describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
import { attachSessionAssuranceLevel } from '../server/staffMfa';
import { listStaffMembers, listStaffInvitations } from '../server/staffAccessDirectory';
function actor(overrides: Partial<User> = {}, aal: 'aal1' | 'aal2' = 'aal2') {
  const user = { id: 'admin', role: 'admin', status: 'active', tenantId: 'tenantA', ...overrides } as User;
  attachSessionAssuranceLevel(user, aal); return user;
}
const member = (overrides: Record<string, unknown> = {}) => ({ uid: 'staff', name: 'Synthetic Staff', email: 'staff@example.invalid', role: 'accountant', status: 'active', createdAt: '2026-10-12T01:00:00.123456Z', invitedBy: 'maker', approvedBy: null, approvedAt: null, statusChangedBy: null, statusChangedAt: null, mfaReenrollmentRequired: false, identityConsistent: true, mfaEnabled: true, ...overrides });
const invitation = (overrides: Record<string, unknown> = {}) => ({ id: 'invitation', email: 'staff@example.invalid', role: 'accountant', legalFirstName: 'Synthetic', legalLastName: 'Staff', status: 'pending', createdAt: '2026-10-12T01:00:00.123456Z', expiresAt: '2026-10-19T01:00:00Z', invitedBy: 'maker', acceptedUid: null, acceptedAt: null, revokedBy: null, revokedAt: null, ...overrides });
const client = (data: unknown) => ({ rpc: vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ data, error: null })) });
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
describe('durable staff access directory', () => {
  it('bounds page RPC and strips secrets and internal authority flags', async () => {
    const c = client([member({ tokenHash: 'secret', identity: { secret: true }, actions: { approve: true } })]);
    const result = await listStaffMembers(c as any, 'tenantA', actor(), {});
    expect(c.rpc).toHaveBeenCalledWith('taxguard_list_staff_members', { p_tenant: 'tenantA', p_actor: 'admin', p_status: null, p_page_size: 26, p_after_created: null, p_after_id: null });
    expect(result.source).toBe('durable'); expect(result.nextCursor).toBeNull();
    expect(result.items[0]).toMatchObject({ actions: { approve: false, suspend: true, deactivate: true, reactivate: false } });
    expect(JSON.stringify(result)).not.toMatch(/secret|identityConsistent|mfaEnabled|tokenHash/);
  });
  it('preserves microseconds and binds cursor to tenant, kind and filter', async () => {
    const c = client([member({ uid: 'z' }), member({ uid: 'a', createdAt: '2026-10-12T01:00:00.123455Z' })]);
    const page = await listStaffMembers(c as any, 'tenantA', actor(), { limit: '1', status: 'active' });
    expect(page.items).toHaveLength(1);
    expect(JSON.parse(Buffer.from(page.nextCursor!, 'base64url').toString())).toMatchObject({ createdAt: '2026-10-12T01:00:00.123456Z', id: 'z', tenant: 'tenantA', kind: 'members', status: 'active' });
    const next = client([member({ uid: 'a', createdAt: '2026-10-12T01:00:00.123455Z' })]);
    await listStaffMembers(next as any, 'tenantA', actor(), { limit: 1, status: 'active', cursor: page.nextCursor });
    expect(next.rpc.mock.calls[0][1]).toMatchObject({ p_after_created: '2026-10-12T01:00:00.123456Z', p_after_id: 'z' });
    for (const run of [() => listStaffMembers(c as any, 'tenantB', actor({ tenantId: 'tenantB' }), { cursor: page.nextCursor, status: 'active' }), () => listStaffMembers(c as any, 'tenantA', actor(), { cursor: page.nextCursor }), () => listStaffInvitations(c as any, 'tenantA', actor(), { cursor: page.nextCursor, status: 'pending' })]) await expect(run()).rejects.toMatchObject({ status: 400 });
  });
  it.each([null, [], { limit: 0 }, { limit: 51 }, { limit: 1.5 }, { limit: '1e1' }, { limit: ['1'] }, { status: 'bogus' }, { status: ['active'] }, { cursor: '' }, { cursor: '%%%'}])('rejects query %j before storage', async query => {
    const c = client([]); await expect(listStaffMembers(c as any, 'tenantA', actor(), query)).rejects.toMatchObject({ status: 400 }); expect(c.rpc).not.toHaveBeenCalled();
  });
  it.each([{ role: 'client' }, { status: 'suspended' }, { tenantId: 'tenantB' }])('denies actor %j', async override => {
    const c = client([]); await expect(listStaffMembers(c as any, 'tenantA', actor(override as Partial<User>), {})).rejects.toMatchObject({ status: 403 }); expect(c.rpc).not.toHaveBeenCalled();
  });
  it('requires AAL2 even with forged cursor', async () => {
    const c = client([]); await expect(listStaffMembers(c as any, 'tenantA', actor({}, 'aal1'), {})).rejects.toMatchObject({ status: 403 }); expect(c.rpc).not.toHaveBeenCalled();
  });
  it('derives independent approval and lifecycle hints only from safe authority', async () => {
    async function actions(override: Record<string, unknown>) { return (await listStaffMembers(client([member(override)]) as any, 'tenantA', actor(), {})).items[0].actions; }
    expect(await actions({ status: 'pending_approval' })).toMatchObject({ approve: true });
    for (const override of [{ uid: 'admin' }, { identityConsistent: false }, { role: 'unknown_staff' }, { status: 'unknown' }]) expect(Object.values(await actions(override))).toEqual([false,false,false,false]);
    expect(await actions({ status: 'pending_approval', invitedBy: 'admin' })).toMatchObject({ approve: false });
    expect(await actions({ status: 'pending_approval', invitedBy: null })).toMatchObject({ approve: false });
    expect(await actions({ status: 'suspended', statusChangedBy: 'maker' })).toEqual({ approve: false, suspend: false, deactivate: true, reactivate: true });
    for (const override of [{ statusChangedBy: 'admin' }, { statusChangedBy: null }, { mfaReenrollmentRequired: true }, { mfaEnabled: false }]) expect(await actions({ status: 'suspended', statusChangedBy: 'maker', ...override })).toMatchObject({ reactivate: false });
  });
  it.each([null, {}, [member({ uid: '../staff' })], [member({ createdAt: 'bad' })], [member({ approvedAt: 'bad' })], [member({ identityConsistent: 'true' })], [member({ role: 'client' })], [member(),member()], [member({ uid: 'a' }),member({ uid: 'z' })]])('rejects malformed or unordered storage %j', async data => {
    await expect(listStaffMembers(client(data) as any, 'tenantA', actor(), {})).rejects.toMatchObject({ status: 503 });
  });
  it('rejects overfetch excess, mismatched filters and cursor boundary replay', async () => {
    await expect(listStaffMembers(client([member(),member({ uid: 'a' }),member({uid:'b'})]) as any, 'tenantA', actor(), { limit: 1 })).rejects.toMatchObject({ status: 503 });
    await expect(listStaffMembers(client([member()]) as any, 'tenantA', actor(), { status: 'suspended' })).rejects.toMatchObject({ status: 503 });
    const cursor = encode({ v:1, tenant:'tenantA', kind:'members', status:'all', id:'staff', createdAt:member().createdAt });
    await expect(listStaffMembers(client([member()]) as any, 'tenantA', actor(), { cursor })).rejects.toMatchObject({ status: 503 });
  });
  it('lists only invitation DTO fields and disables revoke after acceptance', async () => {
    for (const status of ['pending','accepted','revoked']) {
      const c = client([invitation({ status, token: 'secret', token_hash: 'secret' })]);
      const page = await listStaffInvitations(c as any, 'tenantA', actor(), { status });
      expect(page.items[0].actions).toEqual({ revoke: status === 'pending' }); expect(JSON.stringify(page)).not.toContain('secret');
      expect(c.rpc.mock.calls[0][0]).toBe('taxguard_list_staff_invitations');
    }
  });
  it('sanitizes thrown and returned storage errors', async () => {
    const c = { rpc: vi.fn(async () => { throw Error('private provider detail'); }) };
    await expect(listStaffMembers(c as any, 'tenantA', actor(), {})).rejects.toMatchObject({ code: 'STAFF_DIRECTORY_STORE_UNAVAILABLE', status: 503 });
    for (const code of ['P0001','42P01']) await expect(listStaffMembers({ rpc: async () => ({ error: { code, message: 'private detail' } }) } as any, 'tenantA', actor(), {})).rejects.toMatchObject({ code: code === 'P0001' ? 'STAFF_DIRECTORY_DENIED' : 'STAFF_DIRECTORY_STORE_UNAVAILABLE', status: code === 'P0001' ? 403 : 503 });
  });
  it.each(['2026-02-31T01:00:00.123456Z', '2025-02-29T01:00:00Z', '2026-04-31T01:00:00Z', '2026-10-12T24:00:00Z'])('rejects impossible calendar timestamp %s in cursor and DB rows', async createdAt => {
    const c = client([]);
    const cursor = encode({ v: 1, tenant: 'tenantA', kind: 'members', status: 'all', id: 'staff', createdAt });
    await expect(listStaffMembers(c as any, 'tenantA', actor(), { cursor })).rejects.toMatchObject({ status: 400 });
    expect(c.rpc).not.toHaveBeenCalled();
    await expect(listStaffMembers(client([member({ createdAt })]) as any, 'tenantA', actor(), {})).rejects.toMatchObject({ status: 503 });
  });
  it('preserves valid leap-day microseconds and timezone offsets without granting query authority', async () => {
    const createdAt = '2024-02-29T23:00:00.123456+08:00';
    const c = client([member({ uid: 'z', createdAt }), member({ uid: 'a', createdAt })]);
    const page = await listStaffMembers(c as any, 'tenantA', actor(), { limit: 1, tenantId: 'forged', actorId: 'forged', token: 'secret', role: 'super_admin' });
    const decoded = JSON.parse(Buffer.from(page.nextCursor!, 'base64url').toString());
    expect(decoded.createdAt).toBe(createdAt);
    expect(c.rpc.mock.calls[0][1]).toEqual({ p_tenant: 'tenantA', p_actor: 'admin', p_status: null, p_page_size: 2, p_after_created: null, p_after_id: null });
    expect(JSON.stringify(page)).not.toMatch(/forged|secret/);
    const next = client([member({ uid: 'a', createdAt })]);
    await listStaffMembers(next as any, 'tenantA', actor(), { cursor: page.nextCursor });
    expect(next.rpc.mock.calls[0][1].p_after_created).toBe(createdAt);
  });

});
