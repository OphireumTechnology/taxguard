import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { acceptStaffInvitation } from '../server/staffInvitationAcceptance';
const verified = { uid: 'synthetic-staff', email: 'staff@example.test', emailVerified: true, authTime: 1, aal: 'aal2' as const, verifiedFactorCount: 1 };
const token = 'a'.repeat(64);
describe('durable invitation acceptance', () => {
  it('passes only hashed token and verified identity to the atomic RPC', async () => {
    const rpc = vi.fn(async () => ({ data: { status: 'pending_approval' }, error: null }));
    expect(await acceptStaffInvitation({ rpc } as any, 'tenantA', token, verified)).toEqual({ status: 'pending_approval' });
    expect(rpc).toHaveBeenCalledWith('taxguard_accept_staff_invitation', { p_tenant: 'tenantA', p_token_hash: createHash('sha256').update(token).digest('hex'), p_uid: verified.uid, p_email: verified.email });
  });
  it.each([{ aal: 'aal1', verifiedFactorCount: 1 }, { aal: 'aal2', verifiedFactorCount: 0 }])('requires enrolled MFA and AAL2', async assurance => {
    const rpc = vi.fn();
    await expect(acceptStaffInvitation({ rpc } as any, 'tenantA', token, { ...verified, ...assurance } as any)).rejects.toMatchObject({ status: 403 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('requires confirmed provider email', async () => {
    await expect(acceptStaffInvitation({ rpc: vi.fn() } as any, 'tenantA', token, { ...verified, emailVerified: false })).rejects.toMatchObject({ code: 'IDENTITY_DENIED' });
  });
  it('rejects malformed tokens before calling the store', async () => {
    const rpc = vi.fn();
    await expect(acceptStaffInvitation({ rpc } as any, 'tenantA', {}, verified)).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([{ code: 'P0001', status: 403 }, { code: '42P01', status: 503 }])('sanitizes storage errors', async error => {
    await expect(acceptStaffInvitation({ rpc: async () => ({ data: null, error }) } as any, 'tenantA', token, verified)).rejects.toMatchObject({ status: error.status });
  });
});
