import { describe, expect, it, vi } from 'vitest';
import { denyInvitedStaffClientProvisioning } from '../server/staffInvitationGuard';
function fixture(result: any) {
  const query: any = { select: vi.fn(() => query), eq: vi.fn(() => query), limit: vi.fn(async () => result) };
  const client: any = { from: vi.fn(() => query) };
  return { client, query };
}
describe('invited staff cannot enter client auto-provisioning', () => {
  it('checks normalized email within the server tenant', async () => {
    const { client, query } = fixture({ data: [], error: null });
    await denyInvitedStaffClientProvisioning(client, 'tenantA', ' STAFF@EXAMPLE.TEST ');
    expect(query.eq.mock.calls).toEqual([['tenant_id', 'tenantA'], ['email', 'staff@example.test']]);
  });
  it('refuses any invitation history, including revoked or expired invitations', async () => {
    const { client } = fixture({ data: [{ id: 'synthetic-invite' }], error: null });
    await expect(denyInvitedStaffClientProvisioning(client, 'tenantA', 'staff@example.test')).rejects.toMatchObject({ code: 'STAFF_INVITATION_ACCEPTANCE_REQUIRED', status: 403 });
  });
  it.each([{ data: null, error: { code: '42P01' } }, { data: null, error: null }])('fails closed on unavailable storage', async result => {
    await expect(denyInvitedStaffClientProvisioning(fixture(result).client, 'tenantA', 'staff@example.test')).rejects.toMatchObject({ status: 503 });
  });
});
