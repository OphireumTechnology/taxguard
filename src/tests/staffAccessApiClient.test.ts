import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const config=vi.hoisted(()=>({enabled:true,base:'http://127.0.0.1:3000'}));
vi.mock('../supabase/config',()=>({isStaffIdentityDevelopmentConfigured:()=>config.enabled}));
vi.mock('../config/apiEndpoint',()=>({apiEndpoint:(path:string)=>config.base+path}));
import { api, setStoredToken, clearStoredToken, getStoredToken } from '../services/api';
const transport=vi.fn();
beforeEach(()=>{config.enabled=true;config.base='http://127.0.0.1:3000';transport.mockReset().mockImplementation(async()=>new Response(JSON.stringify({items:[],nextCursor:null,source:'durable'}),{status:200}));vi.stubGlobal('fetch',transport);setStoredToken('synthetic-session-A');});
afterEach(()=>{clearStoredToken();vi.unstubAllGlobals();});
it('sends directory scope through approved fixed paths with authenticated no-store requests',async()=>{
  await api.staffAccess.members({limit:25,status:'pending_approval',cursor:'opaque_cursor'});
  const [url,options]=transport.mock.calls[0];const parsed=new URL(url);expect(parsed.pathname).toBe('/api/staff-access/members');expect(parsed.searchParams.get('limit')).toBe('25');expect(parsed.searchParams.get('cursor')).toBe('opaque_cursor');
  expect(url).not.toContain('synthetic-session');expect(options.headers.Authorization).toBe('Bearer synthetic-session-A');expect(options.cache).toBe('no-store');expect(options.credentials).toBe('omit');
});
it.each(['api.artaxserv.com','artaxserv.com','www.artaxserv.com'])('does not request protected public API %s',async host=>{
  config.base='https://'+host;await expect(api.staffAccess.members()).rejects.toMatchObject({code:'STAFF_ACCESS_DEVELOPMENT_UNAVAILABLE',status:503});expect(transport).not.toHaveBeenCalled();
});
it('refuses disabled development features and unauthenticated directory reads before transport',async()=>{
  config.enabled=false;await expect(api.staffAccess.invitations()).rejects.toMatchObject({status:503});expect(transport).not.toHaveBeenCalled();
  config.enabled=true;clearStoredToken();await expect(api.staffAccess.members()).rejects.toMatchObject({status:401});expect(transport).not.toHaveBeenCalled();
});
it('rejects late old-session directory and one-time invitation responses',async()=>{
  let resolve!:(response:Response)=>void;transport.mockImplementation(()=>new Promise<Response>(yes=>{resolve=yes;}));
  const request=api.staffAccess.createInvitation({email:'staff@example.test',role:'accountant',legalFirstName:'Synthetic',legalLastName:'Staff'});
  setStoredToken('synthetic-session-B');resolve(new Response(JSON.stringify({id:'invite',token:'a'.repeat(64),expiresAt:'2099-01-01T00:00:00Z',delivery:'administrator_handoff'}),{status:201}));
  await expect(request).rejects.toMatchObject({code:'SESSION_CHANGED'});expect(getStoredToken()).toBe('synthetic-session-B');
});
it('encodes fixed mutation target paths and does not accept caller authority arguments',async()=>{
  transport.mockImplementation(async()=>new Response(JSON.stringify({status:'active',revokedSessions:1}),{status:200}));
  await api.staffAccess.approveMember('staff/id');expect(transport.mock.calls[0][0]).toBe(config.base+'/api/staff-access/members/staff%2Fid/approve');
  await api.staffAccess.changeMemberStatus('staff-id','suspend','Synthetic review reason');expect(JSON.parse(transport.mock.calls[1][1].body)).toEqual({action:'suspend',reason:'Synthetic review reason'});
  await api.staffAccess.revokeInvitation('invitation-id');expect(transport.mock.calls[2][0]).toBe(config.base+'/api/staff-access/invitations/invitation-id/revoke');
});
it('propagates abort signals and API unavailable codes without fabricating rows',async()=>{
  const controller=new AbortController();transport.mockResolvedValue(new Response(JSON.stringify({code:'STAFF_DIRECTORY_STORE_UNAVAILABLE'}),{status:503}));
  await expect(api.staffAccess.members({},controller.signal)).rejects.toMatchObject({code:'STAFF_DIRECTORY_STORE_UNAVAILABLE',status:503});expect(transport.mock.calls[0][1].signal).toBe(controller.signal);
});

it('uses guarded recovery endpoints with query scope, encoded IDs, signals and no body authority',async()=>{
  const controller=new AbortController();
  await api.staffAccess.recoveries({status:'pending_approval',limit:25},controller.signal);
  expect(transport.mock.calls[0][0]).toBe(config.base+'/api/staff-access/mfa-recoveries?limit=25&status=pending_approval');
  expect(transport.mock.calls[0][1]).toMatchObject({signal:controller.signal,cache:'no-store',credentials:'omit'});
  const input={requestId:'11111111-1111-4111-8111-111111111111',targetUid:'staff-target',reasonCategory:'lost_authenticator' as const,reason:'Synthetic report'};
  await api.staffAccess.requestRecovery(input,controller.signal);
  expect(JSON.parse(transport.mock.calls[1][1].body)).toEqual(input);
  await api.staffAccess.approveRecovery('request/id',controller.signal);
  expect(transport.mock.calls[2][0]).toBe(config.base+'/api/staff-access/mfa-recoveries/request%2Fid/approve');
  expect(transport.mock.calls[2][1].body).toBeUndefined();
});
it('keeps recovery endpoints unavailable in protected environments',async()=>{
  config.enabled=false;await expect(api.staffAccess.recoveries()).rejects.toMatchObject({status:503});
  await expect(api.staffAccess.approveRecovery('request-id')).rejects.toMatchObject({status:503});expect(transport).not.toHaveBeenCalled();
});
