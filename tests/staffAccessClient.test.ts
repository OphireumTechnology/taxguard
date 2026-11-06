import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStaffAccessClient } from '../src/services/staffAccessClient';
const config = vi.hoisted(() => ({ enabled: false, origin: 'http://127.0.0.1' }));
vi.mock('../src/supabase/config', () => ({ isStaffIdentityDevelopmentConfigured: () => config.enabled }));
vi.mock('../src/config/apiEndpoint', () => ({ apiEndpoint: (path: string) => config.origin + path }));
beforeEach(() => { config.enabled = false; config.origin = 'http://127.0.0.1'; });
afterEach(() => vi.unstubAllGlobals());

describe('staff management authority boundary', () => {
  it('requires authentication and the existing development gate', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(createStaffAccessClient(() => null).sessions()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    await expect(createStaffAccessClient(() => 'synthetic').sessions()).rejects.toMatchObject({ code: 'STAFF_ACCESS_DEVELOPMENT_UNAVAILABLE' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('refuses the protected public API even with development configured', async () => {
    config.enabled = true; config.origin = 'https://api.artaxserv.com';
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(createStaffAccessClient(() => 'synthetic').revokeOtherSessions()).rejects.toMatchObject({ code: 'STAFF_ACCESS_DEVELOPMENT_UNAVAILABLE' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('preserves maker-checker refusals', async () => {
    config.enabled = true;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ code: 'MAKER_CHECKER_REQUIRED' }, { status: 403 })));
    await expect(createStaffAccessClient(() => 'synthetic').approveRecovery('synthetic-request')).rejects.toMatchObject({ code: 'MAKER_CHECKER_REQUIRED', status: 403 });
  });
  it('sends invitation data without assigning a role locally', async () => {
    config.enabled = true;
    const issued = { id: 'synthetic-invitation', token: 'a'.repeat(64), expiresAt: '2099-01-01T00:00:00Z', delivery: 'administrator_handoff' };
    const fetch = vi.fn().mockResolvedValue(Response.json(issued)); vi.stubGlobal('fetch', fetch);
    const input = { email: 'synthetic@example.test', role: 'accountant', legalFirstName: 'Test', legalLastName: 'User' } as const;
    await expect(createStaffAccessClient(() => 'synthetic').createInvitation(input)).resolves.toEqual(issued);
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1/api/staff-access/invitations', expect.objectContaining({ method: 'POST', body: JSON.stringify(input), credentials: 'omit', headers: expect.objectContaining({ Authorization: 'Bearer synthetic' }) }));
  });
  it('rejects a revocation response after the identity changes', async () => {
    config.enabled = true; let token = 'synthetic';
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => { token = 'other'; return Response.json({ revoked: true }); }));
    await expect(createStaffAccessClient(() => token).revokeSession('synthetic-session')).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  });
  it('does not convert invalid responses or outages into success', async () => {
    config.enabled = true;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(null)).mockRejectedValueOnce(new Error('offline')));
    const client = createStaffAccessClient(() => 'synthetic');
    await expect(client.sessions()).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
    await expect(client.sessions()).rejects.toThrow('offline');
  });
});
