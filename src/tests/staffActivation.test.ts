import { describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
import { attachSessionAssuranceLevel } from '../server/staffMfa';
import { approveStaffActivation } from '../server/staffActivation';
import { createHash } from 'node:crypto';
const TOKEN = 'tg_live_' + 'a'.repeat(64), TOKEN_HASH = createHash('sha256').update(TOKEN).digest('hex');
function actor(overrides: Partial<User> = {}, aal: 'aal1' | 'aal2' = 'aal2') {
  const user = { id: 'checker', name: 'Synthetic Admin', email: 'admin@example.test', role: 'admin', status: 'active', tenantId: 'tenantA', ...overrides } as User;
  attachSessionAssuranceLevel(user, aal); return user;
}
describe('activation service', () => {
  it('uses only the durable administrator tenant and identity', async () => {
    const rpc = vi.fn(async () => ({ data: { status: 'active' }, error: null }));
    expect(await approveStaffActivation({ rpc } as any, 'tenantA', actor(), TOKEN, 'staff')).toEqual({ status: 'active' });
    expect(rpc).toHaveBeenCalledWith('taxguard_approve_staff_activation_proven', { p_tenant: 'tenantA', p_actor: 'checker', p_actor_session_hash: TOKEN_HASH, p_uid: 'staff' });
  });
  it.each([{ role: 'client' }, { tenantId: 'tenantB' }, { status: 'suspended' }])('rejects non-authoritative administrators', async overrides => {
    const rpc = vi.fn();
    await expect(approveStaffActivation({ rpc } as any, 'tenantA', actor(overrides as any), TOKEN, 'staff')).rejects.toMatchObject({ status: 403 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('requires AAL2 and denies self approval', async () => {
    const rpc = vi.fn();
    await expect(approveStaffActivation({ rpc } as any, 'tenantA', actor({}, 'aal1'), TOKEN, 'staff')).rejects.toMatchObject({ status: 403 });
    await expect(approveStaffActivation({ rpc } as any, 'tenantA', actor(), TOKEN, 'checker')).rejects.toMatchObject({ code: 'INDEPENDENT_APPROVER_REQUIRED' });
    expect(rpc).not.toHaveBeenCalled();
  });
});
