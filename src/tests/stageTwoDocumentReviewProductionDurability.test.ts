import express from 'express';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { AccountantDocumentReviewService, serverDocumentReviewStore } from '../server/taxguard/accountantDocumentReview.service';
const session=vi.hoisted(()=>({role:'accountant',tenantId:'review-tenant',clients:['review-client-a']}));
vi.mock('../server/auth',async original=>({...await original<typeof import('../server/auth')>(),authenticateToken:(req:any,res:any,next:any)=>{if(req.get('x-test-auth')!=='yes')return res.status(401).json({code:'AUTH_REQUIRED'});req.user={id:'staff-a',name:'Synthetic accountant',role:session.role,status:'active',tenantId:session.tenantId,authorizedClientIds:session.clients};next();}}));
import { stageTwoThreeRouter } from '../server/routes/stage-two-three.routes';
// The Stage 02 accountant document-review store (serverDocumentReviewStore) is process-local and nothing in production
// populates it. Production must refuse explicitly instead of reporting an empty queue or "not found".
let server:Server;let origin:string;
beforeAll(async()=>{const app=express();app.use(express.json());app.use('/api/stage-two-three',stageTwoThreeRouter);server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
afterAll(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
const item={documentId:'review-doc-a',tenantId:'review-tenant',clientId:'review-client-a',taxYear:2025,engagementId:'eng-review',extractedFields:[],exceptions:[],version:1,reviewStatus:'PENDING_REVIEW'};
beforeEach(()=>{
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('TAXGUARD_TENANT_ID','review-tenant');vi.stubEnv('SUPABASE_URL','');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','');
  session.role='accountant';session.tenantId='review-tenant';session.clients=['review-client-a'];
  serverDocumentReviewStore.set(item.documentId,structuredClone(item) as any);
});
afterEach(()=>{serverDocumentReviewStore.delete(item.documentId);vi.restoreAllMocks();vi.unstubAllEnvs();});
const call=(method:string,path:string,body?:unknown,auth=true)=>fetch(origin+'/api/stage-two-three'+path,{method,headers:{...(auth?{'x-test-auth':'yes'}:{}),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
const serviceSpies=()=>[vi.spyOn(AccountantDocumentReviewService,'getReviewQueue'),vi.spyOn(AccountantDocumentReviewService,'getReviewItem'),
  vi.spyOn(AccountantDocumentReviewService,'executeReviewAction'),vi.spyOn(AccountantDocumentReviewService,'verifyEvidenceAndInvalidateDownstream')];
it.each([
  ['GET','/accountant/review-queue?clientId=review-client-a',undefined],
  ['GET','/accountant/review-item/review-doc-a',undefined],
  ['POST','/accountant/review-action',{documentId:'review-doc-a',expectedVersion:1,action:'CLAIM'}],
  ['POST','/accountant/verify-evidence',{documentId:'review-doc-a'}],
])('refuses the production %s %s instead of serving the process-local review store',async(method,path,body)=>{
  const spies=serviceSpies();
  const response=await call(method,path,body);
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toMatchObject({code:'DURABLE_DOCUMENT_REVIEW_PROVIDER_REQUIRED'});
  for(const spy of spies)expect(spy).not.toHaveBeenCalled();
  expect(serverDocumentReviewStore.get(item.documentId)).toEqual(item);
});
it('reports a refusal, not an empty queue, when the production store holds nothing',async()=>{
  serverDocumentReviewStore.delete(item.documentId);
  const response=await call('GET','/accountant/review-queue?clientId=review-client-a');
  expect(response.status).toBe(503);
  expect(await response.json()).not.toHaveProperty('items');
});
it('keeps authentication, role and client scope ahead of the production refusal',async()=>{
  expect((await call('GET','/accountant/review-queue?clientId=review-client-a',undefined,false)).status).toBe(401);
  expect((await call('GET','/accountant/review-queue?clientId=review-client-b')).status).toBe(403);
  session.role='client';
  expect((await call('GET','/accountant/review-item/review-doc-a')).status).toBe(403);
  expect((await call('POST','/accountant/review-action',{documentId:'review-doc-a',expectedVersion:1,action:'CLAIM'})).status).toBe(403);
});
it('still refuses another client\'s review item and action by assignment outside production',async()=>{
  vi.stubEnv('NODE_ENV','test');
  const { db } = await import('../server/db');
  vi.spyOn(db,'getClientBindings').mockImplementation((clientId:string)=>clientId==='review-client-a'?[{accountantId:'staff-a',status:'active',effectiveDate:'2020-01-01'}] as any:[]);
  serverDocumentReviewStore.set('review-doc-b',{...structuredClone(item),documentId:'review-doc-b',clientId:'review-client-b'} as any);
  try{
    const action=vi.spyOn(AccountantDocumentReviewService,'executeReviewAction');
    expect((await call('GET','/accountant/review-item/review-doc-b')).status).toBe(403);
    expect((await call('POST','/accountant/review-action',{documentId:'review-doc-b',expectedVersion:1,action:'CLAIM'})).status).toBe(403);
    expect(action).not.toHaveBeenCalled();
  }finally{serverDocumentReviewStore.delete('review-doc-b');}
});
it('leaves the development review store available outside production',async()=>{
  vi.stubEnv('NODE_ENV','test');
  vi.spyOn(AccountantDocumentReviewService,'getReviewQueue').mockReturnValue([]);
  expect((await call('GET','/accountant/review-queue?clientId=review-client-a')).status).not.toBe(503);
});
