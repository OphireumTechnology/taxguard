import express from 'express';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { TaxGuardAuthorityRepository, casePath } from '../server/taxguard/authority.repository';
import { globalAuthorityDatabase } from '../server/taxguard/transactionalDatabase';
import { db } from '../server/db';
const session=vi.hoisted(()=>({role:'reviewer',tenantId:'http-review-tenant',clients:['http-review-client']}));
vi.mock('../server/auth',async original=>({...await original<typeof import('../server/auth')>(),authenticateToken:(req:any,res:any,next:any)=>{if(req.get('x-test-auth')!=='yes')return res.status(401).json({code:'AUTH_REQUIRED'});req.user={id:'reviewer',name:'Independent reviewer',role:session.role,status:'active',tenantId:session.tenantId,authorizedClientIds:session.clients};next();}}));
import { caseAuthorityRouter } from '../server/routes/case-authority.routes';
let server:Server;let origin:string;
const scope={tenantId:'http-review-tenant',clientId:'http-review-client',engagementId:'http-review-eng',taxYear:2024};
const base=`/api/case-authority/${scope.tenantId}/${scope.clientId}/${scope.engagementId}/${scope.taxYear}`;
beforeAll(async()=>{const app=express();app.use(express.json());app.use('/api/case-authority',caseAuthorityRouter);server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
afterAll(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
beforeEach(async()=>{
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('TAXGUARD_TENANT_ID',scope.tenantId);session.role='reviewer';session.tenantId=scope.tenantId;session.clients=['http-review-client'];
  globalAuthorityDatabase.records=new Map();const prefix=`taxguardTenants/${scope.tenantId}`;
  for(const [id,data] of Object.entries({admin:{role:'administrator'},owner:{role:'client',clientId:scope.clientId},preparer:{role:'accountant'},reviewer:{role:'reviewer',credentialVerified:true,credentialType:'CPA',credentialExpiresAt:'2099-01-01'}}))globalAuthorityDatabase.records.set(`${prefix}/members/${id}`,{...data,status:'active'});
  globalAuthorityDatabase.records.set(`${prefix}/clients/${scope.clientId}`,{ownerUid:'owner',name:'Authorized HTTP client'});
  globalAuthorityDatabase.records.set(`${prefix}/clients/${scope.clientId}/engagements/${scope.engagementId}`,{clientId:scope.clientId,taxYears:[2024]});
  await new TaxGuardAuthorityRepository(globalAuthorityDatabase).createCase(scope,'admin',{clientUid:'owner',preparerUid:'preparer',reviewerUid:'reviewer'});
  const root=casePath(scope);globalAuthorityDatabase.records.set(root,{...globalAuthorityDatabase.records.get(root),activeStage:10});
  globalAuthorityDatabase.records.set(root+'/draftReturns/return-a',{id:'return-a',returnId:'return-a',...scope,status:'PREPARER_CERTIFIED',preparerCertifiedBy:'preparer',createdBy:'preparer',figures:{},forms:[],diagnostics:[]});
});
afterEach(()=>{globalAuthorityDatabase.records=new Map();vi.restoreAllMocks();vi.unstubAllEnvs();});
const get=(path:string,auth=true)=>fetch(origin+path,{headers:auth?{'x-test-auth':'yes'}:{}});
const post=(body:any)=>fetch(origin+base+'/reviewer-decision',{method:'POST',headers:{'x-test-auth':'yes','Content-Type':'application/json'},body:JSON.stringify(body)});
it('rejects unauthenticated review queue requests',async()=>{expect((await get('/api/case-authority/reviewer/dashboard',false)).status).toBe(401);});
it.each(['client','accountant','admin','operations'])('rejects server role %s',async role=>{session.role=role;expect((await get('/api/case-authority/reviewer/dashboard')).status).toBe(403);});
it('uses trusted session tenant despite supplied query and supplies no-store headers',async()=>{
  vi.stubEnv('NODE_ENV','test');
  const response=await get('/api/case-authority/reviewer/dashboard?tenantId=other');expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');expect((await response.json()).cases[0].scope).toEqual(scope);
});
it('does not discover a client after the durable session grant is revoked, even with a stale case assignment',async()=>{
  session.clients=[];
  const response=await get('/api/case-authority/reviewer/dashboard');
  expect(response.status).toBe(503);expect((await response.json()).cases).toBeUndefined();
  expect((await get(base+'/reviewer-workspace')).status).toBe(403);
});
it.each(['populated','empty'])('fails closed before reading the %s local production review queue',async state=>{
  if(state==='empty')globalAuthorityDatabase.records=new Map();
  const read=vi.spyOn(TaxGuardAuthorityRepository.prototype,'listReviewerQueue');
  const response=await get('/api/case-authority/reviewer/dashboard');
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({code:'DURABLE_REVIEW_QUEUE_PROVIDER_REQUIRED'});
  expect(read).not.toHaveBeenCalled();
});
it('checks the trusted production tenant before reporting queue provider availability',async()=>{
  session.tenantId='other-tenant';
  const response=await get('/api/case-authority/reviewer/dashboard?tenantId='+scope.tenantId);
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({code:'REVIEWER_TENANT_REQUIRED'});
});
it('rejects cross-tenant/client/year selected case requests through actual middleware and repository',async()=>{
  expect((await get(base.replace(scope.tenantId,'other-tenant')+'/reviewer-workspace')).status).toBe(403);
  expect((await get(base.replace(scope.clientId,'other-client')+'/reviewer-workspace')).status).toBe(403);
  expect((await get(base.replace('/2024','/2023')+'/reviewer-workspace')).status).toBe(403);
});
it('serves the scoped selected workspace without fallback taxpayer or private URL',async()=>{
  const response=await get(base+'/reviewer-workspace');expect(response.status).toBe(200);const snapshot=await response.json();expect(snapshot.scope).toEqual(scope);expect(snapshot.independentReviewer).toBe(true);expect(snapshot.decisionsAvailable).toBe(false);
});
it('requires correction details and confirmation at the HTTP mutation boundary',async()=>{
  const input={version:1,operationId:'http-return',returnId:'return-a',decision:'RETURN',reason:'Independent reviewer found an unreconciled withholding difference.'};
  expect((await post(input)).status).toBe(400);expect((await post({...input,confirmed:true,corrections:'fix'})).status).toBe(400);expect(globalAuthorityDatabase.records.get(casePath(scope)).version).toBe(1);
});
it('records actual approval acknowledgement and audit without advancing workflow',async()=>{
  // Development transaction fixture only: the live volatile adapter is not released for production decisions.
  vi.stubEnv('NODE_ENV','test');
  vi.spyOn(db,'getClientBindings').mockReturnValue([{accountantId:'reviewer',status:'active',effectiveDate:'2020-01-01'}] as any);
  const response=await post({version:1,operationId:'http-approval',returnId:'return-a',decision:'APPROVE',confirmed:true,reason:'Independent human review confirmed the preparer certified return.'});expect(response.status).toBe(200);expect((await response.json()).approvalId).toBeTruthy();
  expect(globalAuthorityDatabase.records.get(casePath(scope)).activeStage).toBe(10);expect(globalAuthorityDatabase.records.get(casePath(scope)+'/audit/http-approval').actorUid).toBe('reviewer');
});
it('fails closed for production decisions when the existing adapter cannot establish durable storage',async()=>{
  const response=await post({version:1,operationId:'production-approval',returnId:'return-a',decision:'APPROVE',confirmed:true,reason:'Independent human review confirmed the preparer certified return.'});
  expect(response.status).toBe(503);expect((await response.json()).code).toBe('DURABLE_REVIEW_DECISION_PROVIDER_REQUIRED');
  expect(globalAuthorityDatabase.records.get(casePath(scope)).version).toBe(1);
});
it('cannot bypass reviewer controls through legacy public approval/action routes',async()=>{
  const input={version:1,operationId:'legacy-approval',returnId:'return-a',rationale:'Independent review of the complete recorded tax return.'};
  const legacy=await fetch(origin+base+'/approvals',{method:'POST',headers:{'x-test-auth':'yes','Content-Type':'application/json'},body:JSON.stringify(input)});
  expect(legacy.status).toBe(400);expect((await legacy.json()).code).toBe('REVIEW_CONFIRMATION_REQUIRED');
  const generic=await fetch(origin+base+'/reviews/action',{method:'POST',headers:{'x-test-auth':'yes','Content-Type':'application/json'},body:JSON.stringify({version:1,operationId:'legacy-action',target:{type:'return',id:'return-a'},action:'ACCEPT',notes:'Independent review confirmed the recorded return.'})});
  expect(generic.status).toBe(409);expect(globalAuthorityDatabase.records.get(casePath(scope)).version).toBe(1);
});
