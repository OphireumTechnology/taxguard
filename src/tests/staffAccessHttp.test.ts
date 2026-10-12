import express from 'express';
import { createServer, type Server } from 'node:http';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createStaffAccessRouter, staffAccessDevelopmentConfigured } from '../server/routes/staff-access.routes';
import { attachSessionAssuranceLevel } from '../server/staffMfa';
import { StaffAccessRateLimit } from '../server/staffAccessRateLimit';
let server: Server; let origin: string; let user: any;
const rpc = vi.fn(); const verifyIdentity = vi.fn();
const token = 'a'.repeat(64);
let httpTime = 1000;
const staffLimiter = new StaffAccessRateLimit(20, 60_000, 10_000, () => httpTime);
beforeAll(async () => {
  const app=express(); app.use(express.json({limit:'32kb'}));
  app.use('/staff',createStaffAccessRouter({ client: () => ({rpc} as any), tenantId: () => 'tenantA', verifyIdentity, limiter: staffLimiter,
    authenticate: (req: any,res,next) => {if (!user) return res.status(401).json({code:'AUTH_REQUIRED'}); req.user=user; next();} }));
  app.use('/closed',createStaffAccessRouter());
  app.use('/limited',createStaffAccessRouter({client:()=>({rpc} as any),limiter:new StaffAccessRateLimit(1)}));
  server=createServer(app); await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin='http://127.0.0.1:'+(server.address() as any).port;
});
afterAll(async()=> {server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve()));});
afterEach(()=>vi.unstubAllEnvs());
beforeEach(()=> {
  httpTime += 60_000; // Each test has its own limiter window; individual abuse tests remain bounded.
  vi.stubEnv('NODE_ENV','test'); vi.stubEnv('TAXGUARD_STAFF_ACCESS_DEVELOPMENT_ENABLED','false');
  user={id:'checker',tenantId:'tenantA',status:'active',role:'admin'}; attachSessionAssuranceLevel(user,'aal2');
  rpc.mockReset().mockResolvedValue({data:{status:'pending_approval'},error:null});
  verifyIdentity.mockReset().mockResolvedValue({uid:'staff',email:'staff@example.test',emailVerified:true,authTime:1,aal:'aal2',verifiedFactorCount:1});
});
async function post(path: string, body: unknown={}) { return fetch(origin+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); }
it('accepts a provider-verified identity without an application session and ignores spoofed authority',async()=> {
  user=null;
  const response=await post('/staff/invitation/accept',{token,providerAccessToken:'synthetic',tenantId:'tenantB',role:'super_admin',uid:'attacker'});
  expect(response.status).toBe(200); expect(await response.json()).toEqual({status:'pending_approval'});
  expect(rpc.mock.calls[0][1]).toMatchObject({p_tenant:'tenantA',p_uid:'staff',p_email:'staff@example.test'});
  expect(response.headers.get('cache-control')).toBe('no-store');
});
it('refuses malformed and rejected provider proof without calling storage',async()=> {
  expect((await post('/staff/invitation/accept',{token})).status).toBe(401);
  verifyIdentity.mockRejectedValue(new Error('private provider diagnostic'));
  const response=await post('/staff/invitation/accept',{token,providerAccessToken:'synthetic'});
  expect(response.status).toBe(401); expect(await response.text()).not.toContain('private'); expect(rpc).not.toHaveBeenCalled();
});
it('requires application admin authentication for issuance',async()=> {
  user=null; expect((await post('/staff/invitations')).status).toBe(401); expect(rpc).not.toHaveBeenCalled();
});
it('creates and returns the secret only to an AAL2 administrator',async()=> {
  rpc.mockImplementation(async (_name,args)=>({data:{id:args.p_id,expiresAt:'2099-01-01T00:00:00Z'},error:null}));
  const response=await post('/staff/invitations',{email:'staff@example.test',role:'accountant',legalFirstName:'Synthetic',legalLastName:'Staff'});
  expect(response.status).toBe(201); const body=await response.json(); expect(body.token).toMatch(/^[a-f0-9]{64}$/); expect(JSON.stringify(rpc.mock.calls)).not.toContain(body.token);
  attachSessionAssuranceLevel(user,'aal1'); expect((await post('/staff/invitations',{})).status).toBe(403);
});
it('uses generic unavailable errors without exposing database diagnostics',async()=> {
  rpc.mockRejectedValue(new Error('credential-sensitive database message'));
  const response=await post('/staff/invitation/accept',{token,providerAccessToken:'synthetic'});
  expect(response.status).toBe(503); expect(await response.json()).toEqual({code:'STAFF_ACCESS_UNAVAILABLE'});
});
it('fails closed before provider verification when development integration is disabled',async()=> {
  expect((await post('/closed/invitation/accept',{token,providerAccessToken:'synthetic'})).status).toBe(503);
  expect(verifyIdentity).not.toHaveBeenCalled();
});
it('bounds public provider-proof attempts and supplies retry guidance',async()=> {
  expect((await post('/limited/invitation/accept')).status).toBe(401);
  const response=await post('/limited/invitation/accept'); expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('60');
});
it('never enables integration for production runtime or protected Supabase project',()=> {
  vi.stubEnv('TAXGUARD_STAFF_ACCESS_DEVELOPMENT_ENABLED','true'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic'); vi.stubEnv('TAXGUARD_TENANT_ID','tenantA');
  vi.stubEnv('SUPABASE_URL','https://cvrlhixxczerytiocxid.supabase.co'); expect(staffAccessDevelopmentConfigured()).toBe(false);
  vi.stubEnv('SUPABASE_URL','http://127.0.0.1:54321'); expect(staffAccessDevelopmentConfigured()).toBe(true);
  vi.stubEnv('NODE_ENV','production'); expect(staffAccessDevelopmentConfigured()).toBe(false);
});

it('authorizes lifecycle changes from the session and path, ignoring spoofed actor and target',async()=> {
  rpc.mockResolvedValue({data:{status:'suspended',revokedSessions:2},error:null});
  const response=await post('/staff/members/staff/status',{action:'suspend',reason:'Synthetic access review',targetUid:'checker',actor:'spoof',tenantId:'tenantB'});
  expect(response.status).toBe(200); expect(await response.json()).toEqual({status:'suspended',revokedSessions:2});
  expect(rpc.mock.calls[0]).toEqual(['taxguard_change_staff_membership_status',{p_tenant:'tenantA',p_actor:'checker',p_uid:'staff',p_action:'suspend',p_reason:'Synthetic access review'}]);
});

const directoryMember = { uid:'directory-staff', name:'Synthetic Staff', email:'directory@example.test', role:'accountant', status:'pending_approval', createdAt:'2026-10-12T00:00:00.000002Z', invitedBy:'maker', approvedBy:null, approvedAt:null, statusChangedBy:null, statusChangedAt:null, mfaReenrollmentRequired:false, identityConsistent:true, mfaEnabled:true };
it('requires an application session for directory reads',async()=> {
  user=null; expect((await fetch(origin+'/staff/members')).status).toBe(401); expect(rpc).not.toHaveBeenCalled();
});
it.each(['aal1','client','suspended','wrong-tenant'])('refuses directory reads for %s authority',async condition=> {
  if(condition==='aal1')attachSessionAssuranceLevel(user,'aal1');
  if(condition==='client')user.role='client';
  if(condition==='suspended')user.status='suspended';
  if(condition==='wrong-tenant')user.tenantId='tenantB';
  expect((await fetch(origin+'/staff/members')).status).toBe(403); expect(rpc).not.toHaveBeenCalled();
});
it('serves explicit directory DTO fields and binds reads to the authenticated actor and tenant',async()=> {
  rpc.mockResolvedValue({data:[{...directoryMember,token_hash:'private-hash',providerAccessToken:'private-token',factorId:'private-factor'}],error:null});
  const response=await fetch(origin+'/staff/members?limit=25&tenantId=tenantB&actor=spoof');
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
  const body=await response.json();expect(body.source).toBe('durable');expect(body.items[0].uid).toBe('directory-staff');expect(body.items[0].actions.approve).toBe(true);
  expect(JSON.stringify(body)).not.toContain('private-');expect(body.items[0]).not.toHaveProperty('mfaEnabled');
  expect(rpc.mock.calls[0]).toEqual(['taxguard_list_staff_members',{p_tenant:'tenantA',p_actor:'checker',p_status:null,p_page_size:26,p_after_created:null,p_after_id:null}]);
});
it.each(['limit=51','limit=0','status=unknown','cursor=not_a_valid_cursor','limit=2&limit=3'])('rejects invalid directory query %s before RPC',async query=> {
  expect((await fetch(origin+'/staff/members?'+query)).status).toBe(400);expect(rpc).not.toHaveBeenCalled();
});
it('continues pagination using the original microsecond timestamp',async()=> {
  const second={...directoryMember,uid:'older-staff',createdAt:'2026-10-12T00:00:00.000001Z'};
  rpc.mockResolvedValueOnce({data:[directoryMember,second],error:null}).mockResolvedValueOnce({data:[second],error:null});
  const first=await (await fetch(origin+'/staff/members?limit=1')).json();expect(first.items).toHaveLength(1);expect(first.nextCursor).toEqual(expect.any(String));
  const next=await (await fetch(origin+'/staff/members?limit=1&cursor='+encodeURIComponent(first.nextCursor))).json();expect(next.items[0].uid).toBe('older-staff');expect(next.nextCursor).toBeNull();
  expect(rpc.mock.calls[1][1]).toMatchObject({p_after_created:directoryMember.createdAt,p_after_id:directoryMember.uid});
});
it('redacts storage diagnostic errors from directory responses',async()=> {
  rpc.mockRejectedValue(new Error('private database host and credential'));
  const response=await fetch(origin+'/staff/invitations');expect(response.status).toBe(503);expect(await response.json()).toEqual({code:'STAFF_DIRECTORY_STORE_UNAVAILABLE'});
});
it('directory remains unavailable before authentication/provider calls when integration is disabled',async()=> {
  expect((await fetch(origin+'/closed/members')).status).toBe(503);expect(rpc).not.toHaveBeenCalled();expect(verifyIdentity).not.toHaveBeenCalled();
});
