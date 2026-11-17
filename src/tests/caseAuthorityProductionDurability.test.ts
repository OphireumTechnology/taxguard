import express from 'express';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { TaxGuardAuthorityRepository, casePath } from '../server/taxguard/authority.repository';
import { globalAuthorityDatabase } from '../server/taxguard/transactionalDatabase';
import { db } from '../server/db';
const session=vi.hoisted(()=>({role:'reviewer',tenantId:'durability-tenant',clients:['durability-client']}));
vi.mock('../server/auth',async original=>({...await original<typeof import('../server/auth')>(),authenticateToken:(req:any,res:any,next:any)=>{if(req.get('x-test-auth')!=='yes')return res.status(401).json({code:'AUTH_REQUIRED'});req.user={id:'reviewer',name:'Independent reviewer',role:session.role,status:'active',tenantId:session.tenantId,authorizedClientIds:session.clients};next();}}));
import { caseAuthorityRouter } from '../server/routes/case-authority.routes';
// The case-authority adapter (TransactionalDocumentDatabase) is process-local. In production every scoped case
// operation must refuse explicitly instead of reading or acknowledging state that a restart or a second instance loses.
let server:Server;let origin:string;
const scope={tenantId:'durability-tenant',clientId:'durability-client',engagementId:'durability-eng',taxYear:2024};
const base=`/api/case-authority/${scope.tenantId}/${scope.clientId}/${scope.engagementId}/${scope.taxYear}`;
beforeAll(async()=>{const app=express();app.use(express.json());app.use('/api/case-authority',caseAuthorityRouter);server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
afterAll(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
beforeEach(async()=>{
  vi.stubEnv('NODE_ENV','test');vi.stubEnv('TAXGUARD_TENANT_ID',scope.tenantId);session.role='reviewer';session.tenantId=scope.tenantId;session.clients=[scope.clientId];
  globalAuthorityDatabase.records=new Map();const prefix=`taxguardTenants/${scope.tenantId}`;
  for(const [id,data] of Object.entries({admin:{role:'administrator'},owner:{role:'client',clientId:scope.clientId},preparer:{role:'accountant'},reviewer:{role:'reviewer',credentialVerified:true,credentialType:'CPA',credentialExpiresAt:'2099-01-01'}}))globalAuthorityDatabase.records.set(`${prefix}/members/${id}`,{...data,status:'active'});
  globalAuthorityDatabase.records.set(`${prefix}/clients/${scope.clientId}`,{ownerUid:'owner',name:'Synthetic durability client'});
  globalAuthorityDatabase.records.set(`${prefix}/clients/${scope.clientId}/engagements/${scope.engagementId}`,{clientId:scope.clientId,taxYears:[2024]});
  await new TaxGuardAuthorityRepository(globalAuthorityDatabase).createCase(scope,'admin',{clientUid:'owner',preparerUid:'preparer',reviewerUid:'reviewer'});
  vi.spyOn(db,'getClientBindings').mockReturnValue([{accountantId:'reviewer',status:'active',effectiveDate:'2020-01-01'}] as any);
});
afterEach(()=>{globalAuthorityDatabase.records=new Map();vi.restoreAllMocks();vi.unstubAllEnvs();});
const request=(method:string,path:string,body?:unknown)=>fetch(origin+path,{method,headers:{'x-test-auth':'yes','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
const storeSpies=()=>[vi.spyOn(globalAuthorityDatabase,'runTransaction'),vi.spyOn(globalAuthorityDatabase,'doc'),vi.spyOn(globalAuthorityDatabase,'collection')];
const write={version:1,revision:1,operationId:'production-durability-write'};
it.each([
  ['GET',base],['GET',base+'/stages'],['GET',base+'/stages/history'],['GET',base+'/documents'],['GET',base+'/workpapers'],
  ['GET',base+'/returns'],['GET',base+'/reports'],['GET',base+'/monitoring'],['GET',base.replace('/2024','')+'/cases'],
])('refuses the production read %s %s before touching the process-local store',async(method,path)=>{
  vi.stubEnv('NODE_ENV','production');
  const spies=storeSpies();
  const response=await request(method,path);
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toMatchObject({code:'DURABLE_CASE_AUTHORITY_PROVIDER_REQUIRED'});
  for(const spy of spies)expect(spy).not.toHaveBeenCalled();
});
it.each([
  ['PATCH',base,{...write,changes:{status:'ACTIVE'}}],['POST',base+'/activate',write],['POST',base+'/stages/2/transition',{...write,targetStatus:'IN_PROGRESS'}],
  ['POST',base+'/evidence',{...write,evidence:{kind:'note'}}],['POST',base+'/workpapers',{...write,title:'Synthetic workpaper'}],
  ['POST',base+'/returns/generate',write],['POST',base+'/signatures',write],['POST',base+'/filings',write],['POST',base+'/filings/filing-a/submit',write],
  ['POST',base+'/archive/manifest',write],['POST',base+'/repeat',write],
])('refuses the production write %s %s without acknowledging or recording it',async(method,path,body)=>{
  vi.stubEnv('NODE_ENV','production');
  const before=new Map(globalAuthorityDatabase.records);
  const spies=storeSpies();
  const response=await request(method,path,body);
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({code:'DURABLE_CASE_AUTHORITY_PROVIDER_REQUIRED',requiresHumanReview:true,externalSubmissionAllowed:false});
  for(const spy of spies)expect(spy).not.toHaveBeenCalled();
  expect(globalAuthorityDatabase.records).toEqual(before);
  expect(globalAuthorityDatabase.records.get(casePath(scope)).version).toBe(1);
});
it('keeps authentication ahead of the production refusal',async()=>{
  vi.stubEnv('NODE_ENV','production');
  expect((await fetch(origin+base)).status).toBe(401);
});
it('keeps the reviewer decision validation and its specific provider code in production',async()=>{
  vi.stubEnv('NODE_ENV','production');
  const decision={version:1,operationId:'production-approval',returnId:'return-a',confirmed:true,reason:'Independent human review confirmed the preparer certified return.'};
  expect((await (await request('POST',base+'/reviewer-decision',{...decision,decision:'APPROVE'})).json()).code).toBe('DURABLE_REVIEW_DECISION_PROVIDER_REQUIRED');
  expect((await (await request('POST',base+'/approvals',{...decision,rationale:decision.reason})).json()).code).toBe('DURABLE_REVIEW_DECISION_PROVIDER_REQUIRED');
  expect((await request('POST',base+'/approvals',{version:1,operationId:'unconfirmed',returnId:'return-a',rationale:decision.reason})).status).toBe(400);
});
it('leaves the development adapter available outside production',async()=>{
  const response=await request('GET',base);
  expect(response.status).toBe(200);
  expect((await request('GET',base.replace('/2024','')+'/cases')).status).toBe(200);
});
