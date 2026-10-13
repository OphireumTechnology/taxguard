import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
import { attachSessionAssuranceLevel } from '../server/staffMfa';
import { INVITABLE_STAFF_ROLES, normalizedInvitationInput, requireStaffAdministrator } from '../server/staffAccessPolicy';
import { createStaffInvitation, lookupStaffInvitation, revokeStaffInvitation } from '../server/staffInvitationManagement';

const tenant = 'tenantA';
const input = { email: ' Staff@Example.Test ', role: 'accountant', legalFirstName: ' Synthetic ', legalLastName: ' Staff ' };
const token = 'a'.repeat(64);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const identity = { uid: 'staff-identity', email: ' Staff@Example.Test ', emailVerified: true, authTime: 1 };
function admin(overrides: Partial<User> = {}, aal: 'aal1' | 'aal2' | null = 'aal2') {
  const actor = { id: 'admin-maker', role: 'admin', status: 'active', tenantId: tenant, ...overrides } as User;
  if (aal) attachSessionAssuranceLevel(actor, aal);
  return actor;
}
function lookupStore(rows: Record<string, unknown>[] = [], error: unknown = null) {
  const filters: Array<[string, unknown]> = [];
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => { filters.push([column, value]); return builder; }),
    maybeSingle: vi.fn(async () => ({ data: rows.find(row => filters.every(([key, value]) => row[key] === value)) ?? null, error })),
  };
  return { client: { from: vi.fn(() => builder) } as any, builder, filters };
}
const pending = () => ({ tenant_id: tenant, token_hash: hash(token), email: 'staff@example.test', status: 'pending',
  role: 'accountant', legal_first_name: 'Synthetic', legal_last_name: 'Staff', expires_at: new Date(Date.now() + 60_000).toISOString() });

describe('staff administrator policy', () => {
  it.each(['admin', 'administrator', 'super_admin', 'super_administrator'])('allows active same-tenant %s with AAL2', role => {
    expect(() => requireStaffAdministrator(admin({ role } as any), tenant)).not.toThrow();
  });
  it.each([{ role: 'accountant' }, { role: 'client' }, { role: 'security_compliance' }, { tenantId: 'tenantB' },
    { status: 'pending_approval' }, { status: 'suspended' }, { status: 'deactivated' }])('denies unauthorized actors %j', async overrides => {
    const rpc = vi.fn();
    const actor = admin(overrides as Partial<User>);
    expect(() => requireStaffAdministrator(actor, tenant)).toThrow('STAFF_ADMIN_REQUIRED');
    await expect(createStaffInvitation({ rpc } as any, tenant, actor, input)).rejects.toMatchObject({ status: 403 });
    await expect(revokeStaffInvitation({ rpc } as any, tenant, actor, 'invite')).rejects.toMatchObject({ status: 403 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each(['aal1', null] as const)('denies %s assurance', aal => {
    expect(() => requireStaffAdministrator(admin({}, aal), tenant)).toThrow('STAFF_ADMIN_REQUIRED');
  });
});

describe('invitation input validation', () => {
  it.each(INVITABLE_STAFF_ROLES)('accepts explicitly supported %s role with normalized data', role => {
    expect(normalizedInvitationInput({ ...input, role, tenantId: 'untrusted-tenant', invitedBy: 'untrusted-actor' })).toEqual({
      email: 'staff@example.test', role, legalFirstName: 'Synthetic', legalLastName: 'Staff' });
  });
  it.each([null, [], 'text', {}, { ...input, email: '' }, { ...input, email: 'staff' },
    { ...input, email: 'a@@example.test' }, { ...input, email: 'a b@example.test' }, { ...input, email: 'a'.repeat(256) + '@example.test' },
    { ...input, legalFirstName: '' }, { ...input, legalFirstName: '   ' }, { ...input, legalLastName: 123 },
    { ...input, legalLastName: 'a'.repeat(129) }, { ...input, legalFirstName: 'Synthetic\u0000Staff' }, { ...input, legalLastName: 'Staff\u007f' }])(
    'rejects invalid input %j', value => expect(() => normalizedInvitationInput(value)).toThrow('INVITATION_INPUT_INVALID'));
  it.each(['client', 'super_admin', 'super_administrator', 'ADMIN', undefined, ['admin']])('rejects unsupported role %j', role => {
    expect(() => normalizedInvitationInput({ ...input, role })).toThrow('INVITATION_ROLE_INVALID');
  });
});

describe('invitation creation and revocation', () => {
  it('passes only hashed token and authoritative actor/tenant to RPC and returns fresh handoff tokens', async () => {
    const rpc = vi.fn(async (_name: string, args: any) => ({ data: { id: args.p_id, expiresAt: '2027-01-01T00:00:00Z', token: 'untrusted-store-token' }, error: null }));
    const client = { rpc } as any;
    const first = await createStaffInvitation(client, tenant, admin(), { ...input, tenantId: 'tenantB', actor: 'spoof' });
    const second = await createStaffInvitation(client, tenant, admin(), input);
    expect(first).toEqual({ id: expect.any(String), token: expect.stringMatching(/^[a-f0-9]{64}$/), expiresAt: '2027-01-01T00:00:00Z', delivery: 'administrator_handoff' });
    expect(first.token).not.toBe(second.token);
    expect(first.id).not.toBe(second.id);
    expect(rpc.mock.calls[0]).toEqual(['taxguard_create_staff_invitation', {
      p_tenant: tenant, p_actor: 'admin-maker', p_id: first.id, p_email: 'staff@example.test', p_role: 'accountant',
      p_first: 'Synthetic', p_last: 'Staff', p_token_hash: hash(first.token),
    }]);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(first.token);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(second.token);
  });
  it.each([
    [{ code: 'P0001', message: 'INVITATION_RATE_LIMITED' }, 'INVITATION_RATE_LIMITED', 429],
    [{ code: 'P0001', message: 'private database details' }, 'INVITATION_CREATION_DENIED', 409],
    [{ code: '23505', message: 'private email collision' }, 'INVITATION_CREATION_DENIED', 409],
    [{ code: '42P01', message: 'private missing schema' }, 'STAFF_INVITATION_STORE_UNAVAILABLE', 503],
  ])('sanitizes creation errors %j', async (error, code, status) => {
    await expect(createStaffInvitation({ rpc: async () => ({ data: null, error }) } as any, tenant, admin(), input)).rejects.toMatchObject({ code, status, message: code });
  });
  it.each([null, { id: 'incorrect', expiresAt: '2027-01-01' }, { id: 'incorrect' }])('fails closed on malformed creation response %j', async data => {
    await expect(createStaffInvitation({ rpc: async () => ({ data, error: null }) } as any, tenant, admin(), input)).rejects.toMatchObject({ code: 'STAFF_INVITATION_STORE_UNAVAILABLE', status: 503 });
  });
  it('revokes only the authoritative tenant invitation', async () => {
    const rpc = vi.fn(async () => ({ data: { status: 'revoked', token: 'must-not-return' }, error: null }));
    expect(await revokeStaffInvitation({ rpc } as any, tenant, admin(), 'invite-1')).toEqual({ status: 'revoked' });
    expect(rpc).toHaveBeenCalledWith('taxguard_revoke_staff_invitation', { p_tenant: tenant, p_actor: 'admin-maker', p_id: 'invite-1' });
  });
  it.each([
    [{ code: 'P0001', message: 'private detail' }, 'INVITATION_REVOCATION_DENIED', 409],
    [{ code: '42P01', message: 'private detail' }, 'STAFF_INVITATION_STORE_UNAVAILABLE', 503],
  ])('sanitizes revocation errors %j', async (error, code, status) => {
    await expect(revokeStaffInvitation({ rpc: async () => ({ data: null, error }) } as any, tenant, admin(), 'invite')).rejects.toMatchObject({ code, status, message: code });
  });
  it.each([null, { status: 'pending' }])('denies invalid revocation response %j', async data => {
    await expect(revokeStaffInvitation({ rpc: async () => ({ data, error: null }) } as any, tenant, admin(), 'invite')).rejects.toMatchObject({ status: 503 });
  });
});

describe('confirmed identity invitation lookup', () => {
  it('binds normalized confirmed email, tenant, pending status and hashed token without requiring staff MFA', async () => {
    const row = pending();
    const { client, builder, filters } = lookupStore([row]);
    expect(await lookupStaffInvitation(client, tenant, token, identity)).toEqual({ role: 'accountant', legalFirstName: 'Synthetic', legalLastName: 'Staff', expiresAt: row.expires_at });
    expect(client.from).toHaveBeenCalledWith('taxguard_staff_invitations');
    expect(builder.select).toHaveBeenCalledWith('role,legal_first_name,legal_last_name,expires_at');
    expect(filters).toEqual([['tenant_id', tenant], ['token_hash', hash(token)], ['email', 'staff@example.test'], ['status', 'pending']]);
    expect(JSON.stringify(filters)).not.toContain(token);
  });
  it('denies unconfirmed email before querying', async () => {
    const { client } = lookupStore([pending()]);
    await expect(lookupStaffInvitation(client, tenant, token, { ...identity, emailVerified: false })).rejects.toMatchObject({ code: 'IDENTITY_DENIED', status: 403 });
    expect(client.from).not.toHaveBeenCalled();
  });
  it.each(['', 'a'.repeat(63), 'A'.repeat(64), {}, null])('rejects malformed token %j before querying', async value => {
    const { client } = lookupStore([pending()]);
    await expect(lookupStaffInvitation(client, tenant, value, identity)).rejects.toMatchObject({ code: 'INVITATION_INVALID', status: 404 });
    expect(client.from).not.toHaveBeenCalled();
  });
  it.each([{ tenant_id: 'tenantB' }, { email: 'other@example.test' }, { status: 'revoked' }, { status: 'accepted' },
    { token_hash: hash('b'.repeat(64)) }, { expires_at: new Date(Date.now() - 1000).toISOString() }, { expires_at: 'invalid-date' }])(
    'denies mismatched or expired invitation %j', async patch => {
      const { client } = lookupStore([{ ...pending(), ...patch }]);
      await expect(lookupStaffInvitation(client, tenant, token, identity)).rejects.toMatchObject({ code: 'INVITATION_INVALID', status: 404 });
    });
  it('sanitizes unavailable lookup store', async () => {
    const { client } = lookupStore([], { message: 'private database schema details' });
    await expect(lookupStaffInvitation(client, tenant, token, identity)).rejects.toMatchObject({ code: 'STAFF_INVITATION_STORE_UNAVAILABLE', status: 503, message: 'STAFF_INVITATION_STORE_UNAVAILABLE' });
  });
});
