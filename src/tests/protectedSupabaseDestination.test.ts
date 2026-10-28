import { afterEach, expect, it, vi } from 'vitest';
import { isProtectedIdentityDestination } from '../supabase/protectedDestination';
import { resolveSupabaseBrowserConfig } from '../supabase/config';
import { getSupabaseAdmin, isSupabaseServerConfigured, setSupabaseAdmin, verifySupabaseAccessToken } from '../server/supabase';
afterEach(()=>{setSupabaseAdmin(null);vi.unstubAllEnvs();});
it.each(['https://cvrlhixxczerytiocxid.supabase.co','https://CVRLHIXXCZERYTIOCXID.supabase.co/rest/v1/','https://cvrlhixxczerytiocxid.supabase.co./','https://api.artaxserv.com','https://artaxserv.com','https://www.artaxserv.com'])('identifies protected destination %s without network',url=>{
  expect(isProtectedIdentityDestination(url)).toBe(true);expect(resolveSupabaseBrowserConfig(url,'synthetic-anon',true)).toMatchObject({configured:false,issues:['PROTECTED_PRODUCTION_DESTINATION']});
});
it.each(['https://synthetic-dev.supabase.co','http://localhost:54321','https://cvrlhixxczerytiocxid.supabase.co.example.invalid','not a url','https://cvrlhixxczerytiocxid.supabase.co@synthetic-dev.supabase.co'])('uses actual URL host rather than substring: %s',url=>{
  expect(isProtectedIdentityDestination(url)).toBe(false);
});
it('rejects URL credentials in browser configuration',()=>{expect(resolveSupabaseBrowserConfig('https://user:password@synthetic-dev.supabase.co','synthetic-anon',true)).toMatchObject({configured:false,issues:['URL_CREDENTIALS']});});
it('keeps an authorized development project available and does not change production resolution',()=>{
  expect(resolveSupabaseBrowserConfig('https://synthetic-dev.supabase.co','synthetic-anon',true).configured).toBe(true);
  expect(resolveSupabaseBrowserConfig('https://cvrlhixxczerytiocxid.supabase.co','synthetic-anon',false).configured).toBe(true);
});
it.each(['development','test',undefined])('blocks protected server config before cached client use in %s',async env=>{
  vi.stubEnv('NODE_ENV',env);vi.stubEnv('SUPABASE_URL','https://cvrlhixxczerytiocxid.supabase.co/rest/v1');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-key');
  const getUser=vi.fn();setSupabaseAdmin({auth:{getUser}} as any);
  expect(isSupabaseServerConfigured()).toBe(false);expect(()=>getSupabaseAdmin()).toThrow('SUPABASE_PRODUCTION_PROJECT_BLOCKED');
  await expect(verifySupabaseAccessToken('synthetic-token')).rejects.toThrow('SUPABASE_PRODUCTION_PROJECT_BLOCKED');expect(getUser).not.toHaveBeenCalled();
});
it('permits only an injected synthetic production client in this test; no production request occurs',()=>{
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('SUPABASE_URL','https://cvrlhixxczerytiocxid.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-key');
  const fake={auth:{getUser:vi.fn()}};setSupabaseAdmin(fake as any);expect(getSupabaseAdmin()).toBe(fake);expect(fake.auth.getUser).not.toHaveBeenCalled();
});

it('routes a protected development browser configuration to the blocked SDK fetch',async()=>{
  vi.stubEnv('DEV',true);vi.stubEnv('VITE_SUPABASE_URL','https://cvrlhixxczerytiocxid.supabase.co');vi.stubEnv('VITE_SUPABASE_ANON_KEY','synthetic-anon');
  const network=vi.fn(async()=>{throw Error('unexpected network');});vi.stubGlobal('fetch',network);vi.resetModules();
  try {
    const config=await import('../supabase/config');expect(config.isSupabaseConfigured()).toBe(false);expect(config.getSupabaseConfigIssues()).toContain('PROTECTED_PRODUCTION_DESTINATION');
    const cached={from:vi.fn()};config.setSupabaseClient(cached as any);
    const response=await config.getSupabase().from('synthetic_table').select('*').limit(1);expect(response.error?.message).toContain('SUPABASE_NOT_CONFIGURED');expect(network).not.toHaveBeenCalled();expect(cached.from).not.toHaveBeenCalled();
    config.setSupabaseClient(null);
  } finally {vi.unstubAllGlobals();vi.resetModules();}
});
