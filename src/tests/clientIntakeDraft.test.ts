import { describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
import { getClientIntakeDraft, saveClientIntakeDraft, submitClientIntakeDraft } from '../server/clientIntakeDraft';

const scope = { tenantId: 'intake-tenant', clientId: '101', engagementId: 'engagement-1', taxYear: 2025 };
const actor = { id: 'intake-owner', tenantId: scope.tenantId, clientId: scope.clientId, role: 'client', status: 'active' } as User;
const time = '2025-01-01T00:00:00Z';
function draft(overrides: Record<string, unknown> = {}) {
  return { ...scope, ownerUid: actor.id, schemaVersion: 1, revision: 1, status: 'DRAFT', payload: {}, createdAt: time, updatedAt: time, submittedAt: null, ...overrides };
}
function fixture(data: unknown = { draft: draft(), resumed: false }) {
  const client: any = { rpc: vi.fn(async () => ({ data, error: null })) };
  const save = (input: unknown = { schemaVersion: 1, expectedRevision: 0, requestId: 'request-1', payload: {} }, user = actor, selectedScope = scope) =>
    saveClientIntakeDraft(client,scope.tenantId,user,selectedScope,input);
  return { client, save };
}

describe('service-only client intake draft helper', () => {
  it('forwards only server authority and whitelisted payload to the save RPC', async () => {
    const { client, save } = fixture();
    const payload = { clientCategory: 'individual_taxpayer', preferredContactMethod: 'portal', phone: '+1 555 0100', selectedServices: ['tax_planning'], intakeNotes: 'Synthetic intake' };
    await save({ schemaVersion: 1, expectedRevision: 0, requestId: 'request-1', payload });
    expect(client.rpc).toHaveBeenCalledWith('taxguard_save_client_intake', {
      p_tenant: scope.tenantId, p_actor: actor.id, p_client: scope.clientId, p_engagement: scope.engagementId, p_tax_year: scope.taxYear,
      p_schema_version: 1, p_expected_revision: 0, p_request_id: 'request-1', p_payload: payload
    });
  });
  it.each([
    { role: 'admin' }, { role: 'prospective_client' }, { status: 'suspended' }, { tenantId: 'other-tenant' }, { clientId: '102' }, { id: '../owner' }
  ])('denies actor authority mismatch %j before RPC', async patch => {
    const { client, save } = fixture();
    await expect(save(undefined,{ ...actor, ...patch } as User)).rejects.toMatchObject({ code: 'CLIENT_INTAKE_ACCESS_DENIED', status: 403 });
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { tenantId: 'other-tenant' }, { clientId: '102' }
  ])('denies scope authority mismatch %j before RPC', async patch => {
    const { client, save } = fixture();
    await expect(save(undefined,actor,{ ...scope, ...patch })).rejects.toMatchObject({ code: 'CLIENT_INTAKE_ACCESS_DENIED' });
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { taxYear: 1999 }, { taxYear: 2201 }, { taxYear: 2025.5 }, { engagementId: '../scope' }, { clientId: 'a'.repeat(65) }
  ])('rejects malformed scope %j before RPC', async patch => {
    const { client, save } = fixture();
    await expect(save(undefined,actor,{ ...scope, ...patch })).rejects.toMatchObject({ code: 'CLIENT_INTAKE_INPUT_INVALID' });
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { approval: true }, { documents: [] }, { ownerUid: 'attacker' }, { onboardingStatus: 'COMPLETED' }, { clientCategory: 'prospective_client' },
    { preferredContactMethod: 'fax' }, { phone: 'x'.repeat(33) }, { intakeNotes: 'x'.repeat(2001) }, { selectedServices: ['same','same'] },
    { selectedServices: ['UPPERCASE'] }, { selectedServices: ['a'.repeat(65)] }, { selectedServices: Array.from({ length: 21 }, (_, i) => 'service_' + i) },
    { phone: 'bad\u0000phone' }, { clientCategory: null }, { selectedServices: 'tax' }
  ])('rejects unsafe or invalid payload %j without RPC', async payload => {
    const { client, save } = fixture();
    await expect(save({ schemaVersion: 1, expectedRevision: 0, requestId: 'request-1', payload })).rejects.toMatchObject({ code: 'CLIENT_INTAKE_INPUT_INVALID' });
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { schemaVersion: 2 }, { expectedRevision: -1 }, { expectedRevision: 1.5 }, { expectedRevision: 2147483647 }, { requestId: 'short' },
    { requestId: 'r'.repeat(129) }, { requestId: '../request' }, { actor: 'attacker' }
  ])('rejects invalid mutation envelope %j', async patch => {
    const { client, save } = fixture();
    await expect(save({ schemaVersion: 1, expectedRevision: 0, requestId: 'request-1', payload: {}, ...patch })).rejects.toMatchObject({ code: 'CLIENT_INTAKE_INPUT_INVALID' });
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it('returns an absent draft only for GET and forwards no mutation parameters', async () => {
    const { client, save } = fixture({ draft: null, resumed: false });
    await expect(getClientIntakeDraft(client,scope.tenantId,actor,scope)).resolves.toEqual({ draft: null, resumed: false });
    expect(client.rpc).toHaveBeenCalledWith('taxguard_get_client_intake', { p_tenant: scope.tenantId, p_actor: actor.id, p_client: scope.clientId, p_engagement: scope.engagementId, p_tax_year: scope.taxYear });
    await expect(save()).rejects.toMatchObject({ code: 'CLIENT_INTAKE_STORE_UNAVAILABLE' });
  });
  it('preserves historical replay revision and content without adding server authority fields', async () => {
    const historical = draft({ revision: 2, payload: { intakeNotes: 'Original saved content' }, secret: 'not-public', approval: true });
    const { save } = fixture({ draft: historical, resumed: true, internal: 'not-public' });
    const result = await save({ schemaVersion: 1, expectedRevision: 1, requestId: 'request-1', payload: { intakeNotes: 'Original saved content' } });
    expect(result).toEqual({ draft: draft({ revision: 2, payload: { intakeNotes: 'Original saved content' } }), resumed: true });
    expect(result.draft!.payload).not.toBe(historical.payload);
  });
  it.each([
    { ownerUid: 'other-owner' }, { tenantId: 'other-tenant' }, { clientId: '102' }, { engagementId: 'other-engagement' }, { taxYear: 2024 },
    { schemaVersion: 2 }, { revision: 0 }, { revision: 1.5 }, { revision: 2 }, { status: 'APPROVED' }, { createdAt: '2025-02-30T00:00:00Z' },
    { updatedAt: '2024-01-01T00:00:00Z' }, { submittedAt: time }, { payload: { approved: true } },
    { status: 'SUBMITTED', submittedAt: null }, { status: 'SUBMITTED', submittedAt: '2026-01-01T00:00:00Z' }
  ])('fails closed on malformed or foreign RPC draft %j', async patch => {
    const { save } = fixture({ draft: draft(patch), resumed: false });
    await expect(save()).rejects.toMatchObject({ code: 'CLIENT_INTAKE_STORE_UNAVAILABLE', status: 503 });
  });
  it.each([null, [], {}, { draft: draft(), resumed: 'true' }, { draft: null, resumed: true }])('fails closed on invalid response envelope %j', async response => {
    const { client } = fixture(response);
    await expect(getClientIntakeDraft(client,scope.tenantId,actor,scope)).rejects.toMatchObject({ code: 'CLIENT_INTAKE_STORE_UNAVAILABLE' });
  });
  it('submits through its own RPC and validates submitted state', async () => {
    const { client } = fixture({ draft: draft({ status: 'SUBMITTED', revision: 2, submittedAt: time, payload: { clientCategory: 'individual_taxpayer', preferredContactMethod: 'email', phone: '5550100', selectedServices: ['tax'] } }), resumed: false });
    await expect(submitClientIntakeDraft(client,scope.tenantId,actor,scope,{ expectedRevision: 1, requestId: 'submit-1' })).resolves.toMatchObject({ draft: { status: 'SUBMITTED', revision: 2 } });
    expect(client.rpc).toHaveBeenCalledWith('taxguard_submit_client_intake', { p_tenant: scope.tenantId, p_actor: actor.id, p_client: scope.clientId, p_engagement: scope.engagementId, p_tax_year: scope.taxYear, p_expected_revision: 1, p_request_id: 'submit-1' });
    client.rpc.mockResolvedValueOnce({ data: { draft: draft(), resumed: false }, error: null });
    await expect(submitClientIntakeDraft(client,scope.tenantId,actor,scope,{ expectedRevision: 1, requestId: 'submit-1' })).rejects.toMatchObject({ code: 'CLIENT_INTAKE_STORE_UNAVAILABLE' });
  });
  it.each([
    ['CLIENT_INTAKE_INPUT_INVALID',400], ['CLIENT_INTAKE_ACCESS_DENIED',403], ['CLIENT_INTAKE_SCOPE_UNAVAILABLE',403],
    ['CLIENT_INTAKE_IDEMPOTENCY_CONFLICT',409], ['CLIENT_INTAKE_REVISION_CONFLICT',409], ['CLIENT_INTAKE_SUBMITTED',409], ['CLIENT_INTAKE_INCOMPLETE',400]
  ])('maps known SQL exception %s safely', async (message, status) => {
    const { client, save } = fixture();
    client.rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message } });
    await expect(save()).rejects.toMatchObject({ code: message, status });
  });
  it.each(['P0001','42883','08006'])('does not expose raw storage errors (%s)', async code => {
    const { client, save } = fixture();
    client.rpc.mockResolvedValueOnce({ data: null, error: { code, message: 'private database information' } });
    await expect(save()).rejects.toMatchObject({ code: 'CLIENT_INTAKE_STORE_UNAVAILABLE', message: 'CLIENT_INTAKE_STORE_UNAVAILABLE', status: 503 });
  });
  it('sanitizes thrown RPC failures', async () => {
    const { client, save } = fixture();
    client.rpc.mockRejectedValueOnce(new Error('private connection details'));
    await expect(save()).rejects.toMatchObject({ code: 'CLIENT_INTAKE_STORE_UNAVAILABLE', status: 503 });
  });
});
