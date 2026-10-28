import express from 'express';
import {createServer, type Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {createVaultRouter} from '../server/routes/vault.routes';
let server:Server, origin:string;
const internal='INTERNAL reviewer alice@example.test';
const dirty={documentId:'doc1',version:1,clientId:'client1',fileName:'synthetic.pdf',status:'REPLACEMENT_REQUESTED',
 clientReason:'Please replace the unreadable page.',reviewedBy:internal,reviewNote:internal,uploadedBy:internal,
 uploaderRole:'accountant',reviewedAt:'private timestamp',sha256:internal,storagePath:internal,
 futureInternalField:{note:internal},category:{reviewNote:internal}};
beforeAll(async()=>{
 const app=express();app.use('/vault',createVaultRouter({store:()=>({list:async()=>[dirty],detail:async()=>({versions:[dirty],
  extractions:[{verifiedBy:internal}],history:[{actorUid:internal}],future:internal})}) as any,
  authenticate:(req:any,_res,next)=>{req.user={id:'owner',tenantId:'tenant1',clientId:'client1',status:'active',role:req.headers['x-test-role']||'client'};next();}}));
 server=createServer(app);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+(server.address() as AddressInfo).port;
});
afterAll(async()=>{server?.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));});
for(const role of ['client','prospective_client'])it(`enforces the ${role} HTTP allowlist even if an unmigrated store leaks nested metadata`,async()=>{
 for(const path of ['/documents?role=admin&actor=reviewer&fields=*','/documents/doc1?includeInternal=true']){
  const response=await fetch(origin+'/vault/clients/client1'+path,{headers:{'x-test-role':role}});expect(response.status).toBe(200);
  const data=await response.json(),text=JSON.stringify(data);expect(text).not.toContain(internal);
  expect(text).not.toMatch(/reviewedBy|reviewNote|uploadedBy|uploaderRole|reviewedAt|sha256|storagePath|futureInternal/);
  expect(text).toContain(dirty.clientReason);
  if(data.versions){expect(data.history).toEqual([]);expect(data.extractions).toEqual([]);}
 }
});
it('preserves staff metadata for an authenticated staff session',async()=>{
 const response=await fetch(origin+'/vault/clients/client1/documents/doc1',{headers:{'x-test-role':'senior_reviewer'}});
 expect((await response.json()).versions[0].reviewNote).toBe(internal);
});
it('refuses client review queues and other client paths before invoking the store',async()=>{
 expect((await fetch(origin+'/vault/review-queue')).status).toBe(403);
 expect((await fetch(origin+'/vault/clients/other/documents')).status).toBe(404);
});
