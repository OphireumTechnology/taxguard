import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createProductionApp } from '../server/productionApp';
import { setSupabaseAdmin } from '../server/supabase';
import { createMockSupabaseClient } from './helpers/mockSupabase';

const state = vi.hoisted(() => ({
  verify: vi.fn(),
  user: {
    uid: 'uid1',
    email: 'client@example.com',
    displayName: 'Client',
    emailVerified: true,
    authTime: Math.floor(Date.now() / 1000)
  }
}));

vi.mock('../server/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/supabase')>();
  return {
    ...actual,
    verifySupabaseAccessToken: (...args: any[]) => state.verify(...args),
    isSupabaseServerConfigured: () => true
  };
});

let server: Server;
let origin: string;
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('TAXGUARD_TENANT_ID', 'tenantA');
  vi.stubEnv('SUPABASE_URL', 'https://mock.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'mock-service-key');
  mockSupabase = createMockSupabaseClient();
  setSupabaseAdmin(mockSupabase.client);
  server = createServer(createProductionApp());
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  vi.unstubAllEnvs();
});

beforeEach(() => {
  mockSupabase = createMockSupabaseClient();
  setSupabaseAdmin(mockSupabase.client);
  state.verify.mockReset().mockResolvedValue(state.user);
});

const call = (path: string, token?: string) =>
  fetch(origin + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

const session = () =>
  fetch(origin + '/api/auth/supabase-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://artaxserv.com' },
    body: JSON.stringify({ accessToken: 'verified-supabase-token', role: 'super_admin' })
  });

it('creates a server-owned client session and restores authenticated identity via Supabase', async () => {
  const response = await session();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const result = await response.json();
  expect(result.user.role).toBe('client');
  expect((await (await call('/api/auth/me', result.token)).json()).user.id).toBe('uid1');
  expect(state.verify).toHaveBeenCalledWith('verified-supabase-token');
});

it('rejects invalid Supabase token without provisioning', async () => {
  state.verify.mockRejectedValue(new Error('private diagnostics'));
  const response = await session();
  expect(response.status).toBe(401);
  expect(await response.text()).not.toContain('private diagnostics');
});

it('protects profile and case routes without a session', async () => {
  expect((await call('/api/auth/me')).status).toBe(401);
  expect((await call('/api/case-authority/t/c/e/2025')).status).toBe(401);
});

it('revokes the durable session on logout', async () => {
  const { token } = await (await session()).json();
  expect(
    (await fetch(origin + '/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }))
      .status
  ).toBe(200);
  expect((await call('/api/auth/me', token)).status).toBe(401);
});

it('allows production CORS preflight and denies foreign origins', async () => {
  const response = await fetch(origin + '/api/auth/supabase-session', {
    method: 'OPTIONS',
    headers: { Origin: 'https://artaxserv.com' }
  });
  expect(response.status).toBe(204);
  expect(response.headers.get('access-control-allow-origin')).toBe('https://artaxserv.com');
  expect((await fetch(origin + '/api/health', { headers: { Origin: 'https://evil.example' } })).status).toBe(403);
});

it.each(['/api/documents/upload', '/api/admin', '/api/live-workflow/complete-stage'])(
  'blocks unfinished legacy API %s',
  async path => {
    expect((await fetch(origin + path, { method: 'POST' })).status).toBe(503);
  }
);

it.each(['/api/case-authority/client-onboarding/workflow?taxYear=2025','/api/case-authority/client-onboarding/stage-1'])(
  'refuses volatile client onboarding in a durable production configuration: %s', async path => {
    const created = await (await session()).json();
    expect(created.onboardingAvailability).toEqual({ status: 'unavailable', code: 'DURABLE_ONBOARDING_PROVIDER_REQUIRED' });
    expect(created).not.toHaveProperty('workflow');
    const response = await fetch(origin + path, { method: path.includes('stage-1') ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + created.token, 'Content-Type': 'application/json' }, ...(path.includes('stage-1') ? { body: JSON.stringify({ completeStage: true, taxYear: 2025 }) } : {}) });
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ code: 'DURABLE_ONBOARDING_PROVIDER_REQUIRED' });
  }
);

it('reports logout storage failure without claiming success or revoking a cached substitute', async () => {
  const { token } = await (await session()).json(); const original = mockSupabase.client.rpc.getMockImplementation();
  mockSupabase.client.rpc.mockImplementation((name: string, input: any) => name === 'taxguard_revoke_session' ? Promise.resolve({ data:null,error:{code:'08006',message:'private failure'} }) : original(name,input));
  const response = await fetch(origin+'/api/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+token}});
  expect(response.status).toBe(503);expect(await response.json()).toEqual({error:'Session revocation unavailable.',code:'SESSION_REVOCATION_UNAVAILABLE'});
  expect((await call('/api/auth/me',token)).status).toBe(200);
});
it('does not return a token when atomic session creation fails', async () => {
  const original=mockSupabase.client.rpc.getMockImplementation();
  mockSupabase.client.rpc.mockImplementation((name:string,input:any)=>name==='taxguard_create_session'?Promise.resolve({data:null,error:{code:'08006',message:'private'}}):original(name,input));
  const response=await session();expect(response.status).toBe(503);const data=await response.json();expect(data).not.toHaveProperty('token');expect(data.code).toBe('SESSION_STORE_UNAVAILABLE');expect(mockSupabase.store.sessions.size).toBe(0);
});
it('updates durable ordinary contacts and refuses unsupported profile fields',async()=>{
  const {token}=await(await session()).json();const patch=(body:unknown)=>fetch(origin+'/api/profile/ordinary',{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const response=await patch({phone:'555-0100',companyName:'Synthetic Office'});expect(response.status).toBe(200);expect((await response.json()).user).toMatchObject({phone:'555-0100',companyName:'Synthetic Office',role:'client',onboardingStatus:'NOT_STARTED'});
  expect(mockSupabase.store.identities.get('uid1').user_data.phone).toBe('555-0100');
  expect((await patch({phone:'555-0200',role:'admin'})).status).toBe(400);
  expect((await patch({mailingAddress:{street:'Synthetic'}})).status).toBe(503);
  expect(mockSupabase.store.identities.get('uid1').user_data.phone).toBe('555-0100');
});
it.each(['/api/profile/authoritative','/api/profile/amendments'])('refuses volatile profile evidence %s',async path=>{
  const {token}=await(await session()).json();const response=await call(path,token);expect(response.status).toBe(503);expect(await response.json()).toEqual({code:'DURABLE_PROFILE_PROVIDER_REQUIRED'});
});
