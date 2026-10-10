import express from 'express';
import {createServer,type Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {beforeAll,afterAll,beforeEach,afterEach,it,expect,vi} from 'vitest';
import {bookkeepingRouter} from '../server/routes/bookkeeping.routes';
import * as supabaseServer from '../server/supabase';
const durable=vi.hoisted(()=>({user:null as any}));
vi.mock('../server/supabase-db',async original=>({...await original<typeof import('../server/supabase-db')>(),SupabaseDurableSessions:class {async verify(){return durable.user;}}}));
import {SupabaseDurableSessions} from '../server/supabase-db';
import {db} from '../server/db';
import {globalBookkeepingEngine} from '../server/taxguard/bookkeeping/bookkeeping.engine';
let server:Server;let origin:string;const uid='gate6-bookkeeper-http';const token='gate6-bookkeeper-session';
const client='gate6-http-client';const tenant='gate6-http-tenant';
beforeAll(async()=>{const app=express();app.use(express.json());app.use('/api/bookkeeping',bookkeepingRouter);server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+(server.address() as AddressInfo).port;globalBookkeepingEngine.ingestTransactions(tenant,client,'bank','test','CSV_UPLOAD',[{transactionDate:'2024-02-12',description:'HTTP authorized record',amount:40},{transactionDate:'2023-02-12',description:'HTTP other year',amount:60}]);});
afterAll(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
beforeEach(()=>{vi.stubEnv('NODE_ENV','test');db.users.set(uid,{id:uid,name:'Bookkeeper fixture',email:'gate6@example.test',role:'bookkeeper',tenantId:tenant,authorizedClientIds:[client],status:'active',createdAt:'2024-01-01',isVerified:true});db.sessions.set(token,{userId:uid,expiresAt:Date.now()+60000} as any);});
afterEach(()=>{db.users.delete(uid);db.sessions.delete(token);vi.restoreAllMocks();vi.unstubAllEnvs();});
const get=(query='clientId='+client+'&taxYear=2024',auth=true)=>fetch(origin+'/api/bookkeeping/bookkeeper-dashboard?'+query,{headers:auth?{Authorization:'Bearer '+token}:{}});
it('rejects unauthenticated requests through real authentication',async()=>expect((await get(undefined,false)).status).toBe(401));
it.each(['accountant','client','reviewer','admin','super_admin'])('rejects unauthorized role %s',async role=>{db.users.get(uid)!.role=role as any;expect((await get()).status).toBe(403);});
it('serves only authorized client/year with no-store and no fake default period',async()=>{const res=await get();expect(res.status).toBe(200);expect(res.headers.get('cache-control')).toBe('no-store');const p=await res.json();expect(p.scope.taxYear).toBe(2024);expect(p.transactions.map((t:any)=>t.description)).toEqual(['HTTP authorized record']);expect(p.periods).toEqual([]);expect(p.capabilities.mutations).toBe(false);});
it.each(['clientId=other&taxYear=2024','clientId='+client+'&taxYear=2024&tenantId=other'])('rejects cross-scope selection %s',async query=>expect((await get(query)).status).toBe(403));
it('rejects revoked client grants immediately',async()=>{db.users.get(uid)!.authorizedClientIds=[];expect((await get()).status).toBe(403);});
it('requires explicit supported tax year',async()=>{expect((await get('clientId='+client)).status).toBe(400);expect((await get('clientId='+client+'&taxYear=2021')).status).toBe(400);});
it('denies unknown and cross-scope accounting periods',async()=>expect((await get('clientId='+client+'&taxYear=2024&periodId=foreign-period')).status).toBe(403));
it('denies mutation routes at real authentication boundary and leaves source records unchanged',async()=>{for(const path of ['/transactions/categorize','/journal-entries','/periods/close','/reconciliations']){const res=await fetch(origin+'/api/bookkeeping'+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({clientId:client,taxYear:2024})});expect(res.status).toBe(403);expect((await res.json()).code).toBe('BOOKKEEPER_CAPABILITY_DENIED');}expect(globalBookkeepingEngine.getTransactions(tenant,client)).toHaveLength(2);});
it('denies legacy read that would create default chart accounts',async()=>{expect((await fetch(origin+'/api/bookkeeping/chart-of-accounts?clientId='+client,{headers:{Authorization:'Bearer '+token}})).status).toBe(403);expect(globalBookkeepingEngine.getChartOfAccounts(tenant,client)).toEqual([]);});
it('rejects disabled sessions',async()=>{db.users.get(uid)!.status='disabled';expect((await get()).status).toBe(403);});

it('fails closed for production accounting without durable provider',async()=>{
 vi.stubEnv('NODE_ENV','production');vi.stubEnv('TAXGUARD_TENANT_ID',tenant);vi.spyOn(supabaseServer,'isSupabaseServerConfigured').mockReturnValue(true);durable.user=db.users.get(uid)!;const response=await fetch(origin+'/api/bookkeeping/bookkeeper-dashboard?clientId='+client+'&taxYear=2024',{headers:{Authorization:'Bearer tg_live_gate6_test'}});expect(response.status).toBe(503);expect((await response.json()).code).toBe('DURABLE_ACCOUNTING_PROVIDER_REQUIRED');
});

it('discovers only explicitly granted client IDs without profile PII',async()=>{const response=await fetch(origin+'/api/bookkeeping/bookkeeper-clients',{headers:{Authorization:'Bearer '+token}});expect(response.status).toBe(200);expect(await response.json()).toEqual({tenantId:tenant,clientIds:[client]});db.users.get(uid)!.authorizedClientIds=[];const revoked=await fetch(origin+'/api/bookkeeping/bookkeeper-clients',{headers:{Authorization:'Bearer '+token}});expect((await revoked.json()).clientIds).toEqual([]);});
