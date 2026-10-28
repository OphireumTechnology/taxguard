import express from 'express';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { globalBookkeepingEngine } from '../server/taxguard/bookkeeping/bookkeeping.engine';
import { globalAccountingSyncService } from '../server/taxguard/bookkeeping/accountingSync.service';
import { setLedgerStoreForTesting } from '../server/taxguard/bookkeeping/ledgerBackend';
const session=vi.hoisted(()=>({role:'accountant',tenantId:'books-tenant',clients:['books-client-a']}));
vi.mock('../server/auth',async original=>({...await original<typeof import('../server/auth')>(),authenticateToken:(req:any,res:any,next:any)=>{if(req.get('x-test-auth')!=='yes')return res.status(401).json({code:'AUTH_REQUIRED'});req.user={id:'staff-a',name:'Synthetic accountant',role:session.role,status:'active',tenantId:session.tenantId,authorizedClientIds:session.clients};next();}}));
import { bookkeepingRouter } from '../server/routes/bookkeeping.routes';
// Regression guard. The handlers the ledger dispatch does not register (book-to-tax, document matching, accounting
// sync) use the in-memory engine and the in-memory sync service. The dispatch's final catch-all refuses them whenever
// the ledger is not in memory, which is always the case in production; these cases keep that refusal in place.
let server:Server;let origin:string;
beforeAll(async()=>{const app=express();app.use(express.json());app.use('/api/bookkeeping',bookkeepingRouter);server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
afterAll(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
beforeEach(()=>{vi.stubEnv('NODE_ENV','production');vi.stubEnv('TAXGUARD_TENANT_ID','books-tenant');vi.stubEnv('SUPABASE_URL','');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','');
  Object.assign(session,{role:'accountant',tenantId:'books-tenant',clients:['books-client-a']});});
afterEach(()=>{setLedgerStoreForTesting(null);vi.restoreAllMocks();vi.unstubAllEnvs();});
const call=(method:string,path:string,body?:unknown,auth=true)=>fetch(origin+'/api/bookkeeping'+path,{method,headers:{...(auth?{'x-test-auth':'yes'}:{}),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
const volatileSpies=()=>[globalBookkeepingEngine,globalAccountingSyncService].flatMap(service=>Object.getOwnPropertyNames(Object.getPrototypeOf(service))
  .filter(name=>name!=='constructor'&&typeof (service as any)[name]==='function').map(name=>vi.spyOn(service as any,name)));
const client='books-client-a';
const routes:[string,string,unknown?][]=[
  ['GET',`/book-to-tax?clientId=${client}&taxYear=2025`],
  ['POST','/book-to-tax',{clientId:client,taxYear:2025,description:'Synthetic adjustment',amount:100,adjustmentType:'PERMANENT'}],
  ['POST','/transactions/txn-a/match-document',{clientId:client,documentId:'doc-a'}],
  ['GET',`/sync/state?clientId=${client}&provider=QUICKBOOKS`],
  ['POST','/sync/read-only',{clientId:client,provider:'QUICKBOOKS',idempotencyKey:'synthetic-sync-0001'}],
  ['POST','/sync/write-authorize/client',{clientId:client,provider:'QUICKBOOKS'}],
  ['POST','/sync/write-authorize/accountant',{clientId:client,provider:'QUICKBOOKS'}],
  ['POST','/sync/write-authorize/reviewer',{clientId:client,provider:'QUICKBOOKS',accountantUid:'staff-b'}],
  ['POST','/sync/write-authorize/confirm',{clientId:client,provider:'QUICKBOOKS',phrase:'CONFIRM'}],
  ['POST','/sync/write-commit',{clientId:client,provider:'QUICKBOOKS',idempotencyKey:'synthetic-commit-01',entryIds:[]}],
];
it.each([['unavailable','DURABLE_ACCOUNTING_PROVIDER_REQUIRED'],['durable','DURABLE_FEATURE_NOT_AVAILABLE']] as const)('refuses every non-dispatched production handler with the %s ledger',async(mode,code)=>{
  if(mode==='durable')setLedgerStoreForTesting({} as any);
  for(const [method,path,body] of routes){
    const spies=volatileSpies();
    const response=await call(method,path,body);
    expect(response.status,`${method} ${path}`).toBe(503);
    expect(await response.json(),`${method} ${path}`).toMatchObject({code});
    for(const spy of spies)expect(spy,`${method} ${path}`).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  }
});
it('keeps authentication and the client scope ahead of the production refusal',async()=>{
  expect((await call('GET',`/book-to-tax?clientId=${client}`,undefined,false)).status).toBe(401);
  expect((await call('GET','/book-to-tax?clientId=books-client-b')).status).toBe(403);
});
it('leaves the in-memory handlers available outside production',async()=>{
  vi.stubEnv('NODE_ENV','test');
  const read=vi.spyOn(globalBookkeepingEngine,'getBookToTaxAdjustments').mockReturnValue([]);
  vi.spyOn((await import('../server/db')).db,'getClientBindings').mockReturnValue([{accountantId:'staff-a',status:'active',effectiveDate:'2020-01-01'}] as any);
  const response=await call('GET',`/book-to-tax?clientId=${client}&taxYear=2025`);
  expect(response.status).toBe(200);
  expect(read).toHaveBeenCalled();
});
