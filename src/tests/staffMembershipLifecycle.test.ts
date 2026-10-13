import { describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
import { attachSessionAssuranceLevel } from '../server/staffMfa';
import { changeStaffMembershipStatus } from '../server/staffMembershipLifecycle';
const input = { targetUid: 'staff', action: 'suspend', reason: 'Synthetic access review' };
function actor(overrides: Partial<User> = {}, aal: 'aal1' | 'aal2' = 'aal2') {
  const user = { id: 'admin', role: 'admin', status: 'active', tenantId: 'tenantA', ...overrides } as User;
  attachSessionAssuranceLevel(user, aal); return user;
}
describe('staff membership lifecycle service', () => {
  it.each([['suspend', 'suspended'], ['deactivate', 'disabled'], ['reactivate', 'active']])('invokes bounded %s with trusted actor and tenant', async (action, status) => {
    const rpc = vi.fn(async () => ({ data: { status, revokedSessions: 2 }, error: null }));
    expect(await changeStaffMembershipStatus({ rpc } as any, 'tenantA', actor(), { ...input, action, reason: '  Synthetic review  ', tenantId: 'forged', actorId: 'forged' })).toEqual({ status, revokedSessions: 2 });
    expect(rpc).toHaveBeenCalledWith('taxguard_change_staff_membership_status', { p_tenant: 'tenantA', p_actor: 'admin', p_uid: 'staff', p_action: action, p_reason: 'Synthetic review' });
  });
  it.each([{ role: 'client' }, { status: 'suspended' }, { tenantId: 'tenantB' }])('denies untrusted administrator %j', async overrides => {
    const rpc = vi.fn();
    await expect(changeStaffMembershipStatus({ rpc } as any, 'tenantA', actor(overrides as any), input)).rejects.toMatchObject({ status: 403 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('requires AAL2 and disallows self action', async () => {
    const rpc = vi.fn();
    await expect(changeStaffMembershipStatus({ rpc } as any, 'tenantA', actor({}, 'aal1'), input)).rejects.toMatchObject({ status: 403 });
    await expect(changeStaffMembershipStatus({ rpc } as any, 'tenantA', actor(), { ...input, targetUid: 'admin' })).rejects.toMatchObject({ code: 'INDEPENDENT_ACTOR_REQUIRED' });
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([null, [], {}, { ...input, action: 'activate' }, { ...input, reason: '' }, { ...input, reason: 'x'.repeat(1001) }, { ...input, reason: 'line\nbreak' }, { ...input, targetUid: '../staff' }])('rejects invalid input %j before RPC', async value => {
    const rpc = vi.fn();
    await expect(changeStaffMembershipStatus({ rpc } as any, 'tenantA', actor(), value)).rejects.toBeDefined();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('redacts SQL denial and unexpected failures', async () => {
    for (const [code, expected] of [['P0001', 'STAFF_LIFECYCLE_DENIED'], ['42P01', 'STAFF_LIFECYCLE_STORE_UNAVAILABLE']]) {
      const rpc = vi.fn(async () => ({ error: { code, message: 'private details' } }));
      await expect(changeStaffMembershipStatus({ rpc } as any, 'tenantA', actor(), input)).rejects.toMatchObject({ code: expected });
    }
    const rpc = vi.fn(async () => { throw Error('private provider detail'); });
    await expect(changeStaffMembershipStatus({ rpc } as any, 'tenantA', actor(), input)).rejects.toMatchObject({ code: 'STAFF_LIFECYCLE_STORE_UNAVAILABLE', status: 503 });
  });
  it.each([{ status: 'active', revokedSessions: 1 }, { status: 'suspended', revokedSessions: -1 }, { status: 'suspended', revokedSessions: '2' }, null])('rejects inconsistent result %j', async data => {
    const rpc = vi.fn(async () => ({ data, error: null }));
    await expect(changeStaffMembershipStatus({ rpc } as any, 'tenantA', actor(), input)).rejects.toMatchObject({ status: 503 });
  });
});
