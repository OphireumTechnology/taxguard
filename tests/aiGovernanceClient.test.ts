import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAiGovernanceClient } from '../src/services/aiGovernanceClient';
vi.mock('../src/config/apiEndpoint', () => ({ apiEndpoint: (path: string) => `http://127.0.0.1${path}` }));
afterEach(() => vi.unstubAllGlobals());

describe('AI governance authority boundary', () => {
  it('refuses anonymous requests before contacting the service', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(createAiGovernanceClient(() => null).listAiKillSwitches()).rejects.toMatchObject({ code: 'AI_AUTH_REQUIRED' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('sends the session, encoded filters and abort signal', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ records: [] })); vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    await createAiGovernanceClient(() => 'synthetic-session').getAiControlCenter('runs', { cursor: 'a&b', empty: '' }, signal);
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1/api/ai-governance/control-center/runs?cursor=a%26b', expect.objectContaining({ signal, cache: 'no-store', headers: expect.objectContaining({ Authorization: 'Bearer synthetic-session', 'x-session-token': 'synthetic-session' }) }));
  });
  it('preserves server denial of a stop instead of reporting success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ code: 'AI_KILL_SWITCH_ROLE_DENIED' }, { status: 403 })));
    await expect(createAiGovernanceClient(() => 'synthetic-session').activateAiKillSwitch({ scope: 'GLOBAL', reason: 'Synthetic incident' })).rejects.toMatchObject({ status: 403, code: 'AI_KILL_SWITCH_ROLE_DENIED' });
  });
  it('posts the exact scoped stop and returns server confirmation', async () => {
    const result = { enabled: true, switch_id: 'synthetic-stop', target: 'A00' };
    const fetch = vi.fn().mockResolvedValue(Response.json(result)); vi.stubGlobal('fetch', fetch);
    const payload = { scope: 'AGENT', agent_id: 'A00', reason: 'Synthetic incident' } as const;
    await expect(createAiGovernanceClient(() => 'synthetic-session').activateAiKillSwitch(payload)).resolves.toEqual(result);
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }));
  });
  it('propagates network failures and rejects malformed success responses', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(Response.json(null)); vi.stubGlobal('fetch', fetch);
    const client = createAiGovernanceClient(() => 'synthetic-session');
    await expect(client.listAiKillSwitches()).rejects.toThrow('offline');
    await expect(client.listAiKillSwitches()).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
  });
  it('discards a response after the session changes', async () => {
    let token = 'synthetic-session';
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => { token = 'other-session'; return Response.json({ kill_switches: [] }); }));
    await expect(createAiGovernanceClient(() => token).listAiKillSwitches()).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  });
});
