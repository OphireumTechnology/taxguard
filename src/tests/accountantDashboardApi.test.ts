import express from 'express';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { db } from '../server/db';
import { AuthorityError, TaxGuardAuthorityRepository } from '../server/taxguard/authority.repository';
const state=vi.hoisted(()=>({role:'accountant'}));
vi.mock('../server/auth', async original => ({...await original<typeof import('../server/auth')>(),
  authenticateToken:(req:any,res:any,next:any)=>{
    if(req.get('x-test-auth')!=='yes') return res.status(401).json({error:'AUTH_REQUIRED'});
    req.user={id:'gate4-staff',name:'Staff',role:state.role,status:'active',tenantId:'gate4-tenant',authorizedClientIds:['gate4-client']}; next();
  },
}));
import { accountantRouter } from '../server/routes/accountant.routes';
let server:Server; let origin:string;
beforeAll(async()=>{const app=express();app.use('/api/accountant',accountantRouter);server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
afterAll(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
beforeEach(()=>{
  vi.stubEnv('NODE_ENV','production'); state.role='accountant';
  db.users.set('gate4-client',{id:'gate4-client',clientId:'gate4-canonical',name:'Authorized Client',tenantId:'gate4-tenant',role:'client'} as any);
  db.users.set('gate4-other',{id:'gate4-other',name:'Other Tenant',tenantId:'other-tenant',role:'client'} as any);
  for(const [id,clientId,taxYear] of [['gate4-eng','gate4-client',2024],['gate4-other-eng','gate4-other',2024],['gate4-year','gate4-client',2023]] as const) db.engagements.set(id,{id,clientId,taxYear,status:'in_preparation'} as any);
  vi.spyOn(TaxGuardAuthorityRepository.prototype,'getCase').mockImplementation(async(scope:any)=>{
    if(scope.taxYear!==2024) throw new AuthorityError('CASE_ACCESS_DENIED', 403);
    return {...scope,activeStage:9} as any;
  });
});
afterEach(()=>{for(const id of ['gate4-client','gate4-other'])db.users.delete(id);for(const id of ['gate4-eng','gate4-other-eng','gate4-year'])db.engagements.delete(id);vi.restoreAllMocks();vi.unstubAllEnvs();});
const get=(auth=true)=>fetch(origin+'/api/accountant/dashboard',{headers:auth?{'x-test-auth':'yes'}:{}});
it('rejects unauthenticated requests',async()=>{expect((await get(false)).status).toBe(401);});
it.each(['client','reviewer','operations'])('rejects unsupported server role %s',async role=>{state.role=role;expect((await get()).status).toBe(403);});
it('enforces tenant and durable engagement/year authority before case discovery',async()=>{
  const response=await get();expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
  const data=await response.json();expect(data.cases.map((c:any)=>c.id)).toEqual(['gate4-eng']);expect(data.cases[0].activeStage).toBe(9);
  expect(TaxGuardAuthorityRepository.prototype.getCase).toHaveBeenCalledWith({tenantId:'gate4-tenant',clientId:'gate4-canonical',engagementId:'gate4-eng',taxYear:2024},'gate4-staff');
});
it('fails closed when durable case access is denied',async()=>{
  vi.mocked(TaxGuardAuthorityRepository.prototype.getCase).mockRejectedValue(new AuthorityError('CASE_ACCESS_DENIED', 403));
  expect((await (await get()).json()).cases).toEqual([]);
});

it.each([new AuthorityError('AUTHORITY_UNAVAILABLE', 503), new Error('PRIVATE_PROVIDER_DETAIL')])('returns sanitized unavailability instead of an empty queue for authority failure %s', async error => {
  vi.mocked(TaxGuardAuthorityRepository.prototype.getCase).mockRejectedValue(error);
  const response = await get();
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({ error: 'ACCOUNTANT_DASHBOARD_UNAVAILABLE' });
});
it('does not expose partial case data when one authority read fails', async () => {
  vi.mocked(TaxGuardAuthorityRepository.prototype.getCase).mockImplementation(async (scope:any) => {
    if (scope.taxYear === 2023) throw new Error('PRIVATE_PROVIDER_DETAIL');
    return { ...scope, activeStage: 9 } as any;
  });
  const response = await get();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'ACCOUNTANT_DASHBOARD_UNAVAILABLE' });
});
