import express from 'express';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { db } from '../server/db';
import { globalDurableJobQueueService } from '../server/taxguard/operations/durableJobQueue.service';
import { globalPracticeTaskService } from '../server/taxguard/operations/practiceTask.service';
import { globalStaffAssignmentService } from '../server/taxguard/operations/staffAssignment.service';
import { globalDeadlineEscalationService } from '../server/taxguard/operations/deadlineEscalation.service';
import { globalClientCommunicationService } from '../server/taxguard/operations/clientCommunication.service';
import { globalClientRequestService } from '../server/taxguard/operations/clientRequest.service';
import { globalNotificationOrchestratorService } from '../server/taxguard/operations/notificationOrchestrator.service';
import { globalEngagementBillingService } from '../server/taxguard/operations/engagementBilling.service';
import { globalOperationalSearchService } from '../server/taxguard/operations/operationalSearch.service';
import { globalPracticeAnalyticsService } from '../server/taxguard/operations/practiceAnalytics.service';
import { globalDataRetentionRecoveryService } from '../server/taxguard/operations/dataRetentionRecovery.service';
const session=vi.hoisted(()=>({id:'ops-admin',role:'admin',tenantId:'ops-tenant',clientId:undefined as string|undefined,clients:[] as string[]}));
vi.mock('../server/auth',async original=>({...await original<typeof import('../server/auth')>(),authenticateToken:(req:any,res:any,next:any)=>{if(req.get('x-test-auth')!=='yes')return res.status(401).json({code:'AUTH_REQUIRED'});req.user={id:session.id,name:'Synthetic user',role:session.role,status:'active',tenantId:session.tenantId,clientId:session.clientId,authorizedClientIds:session.clients};next();}}));
import { practiceOperationsRouter } from '../server/routes/practice-operations.routes';
// Every practice-operations service is an in-memory map. Production must refuse rather than serve or acknowledge it,
// after authentication and the client-context check.
const services=[globalDurableJobQueueService,globalPracticeTaskService,globalStaffAssignmentService,globalDeadlineEscalationService,globalClientCommunicationService,
  globalClientRequestService,globalNotificationOrchestratorService,globalEngagementBillingService,globalOperationalSearchService,globalPracticeAnalyticsService,globalDataRetentionRecoveryService];
const serviceSpies=()=>services.flatMap(service=>Object.getOwnPropertyNames(Object.getPrototypeOf(service))
  .filter(name=>name!=='constructor'&&typeof (service as any)[name]==='function').map(name=>vi.spyOn(service as any,name)));
let server:Server;let origin:string;
beforeAll(async()=>{const app=express();app.use(express.json());app.use('/api/operations',practiceOperationsRouter);server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
afterAll(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
beforeEach(()=>{vi.stubEnv('NODE_ENV','production');vi.stubEnv('TAXGUARD_TENANT_ID','ops-tenant');Object.assign(session,{id:'ops-admin',role:'admin',tenantId:'ops-tenant',clientId:undefined,clients:[]});});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
const call=(method:string,path:string,body?:unknown,headers:Record<string,string>={'x-test-auth':'yes'})=>fetch(origin+'/api/operations'+path,{method,headers:{...headers,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
it.each([
  ['GET','/jobs'],['POST','/jobs',{jobType:'DOCUMENT_PROCESSING',payload:{}}],['POST','/jobs/job-a/retry'],['POST','/jobs/job-a/cancel'],
  ['GET','/tasks'],['POST','/tasks',{title:'Synthetic task'}],['PATCH','/tasks/task-a/status',{status:'DONE'}],
  ['GET','/assignments/client/ops-client-a'],['POST','/assignments',{clientId:'ops-client-a',accountantId:'staff-a'}],['GET','/workload'],
  ['GET','/deadlines'],['POST','/deadlines/sweep'],['GET','/communications/threads'],['POST','/communications/threads',{clientId:'ops-client-a',subject:'Synthetic'}],
  ['GET','/requests'],['POST','/requests',{clientId:'ops-client-a',title:'Synthetic'}],['GET','/notifications'],['POST','/notifications/dispatch',{}],
  ['PUT','/notifications/preferences',{}],['GET','/catalog'],['POST','/catalog',{}],['GET','/invoices'],['POST','/invoices',{clientId:'ops-client-a'}],
  ['POST','/invoices/inv-a/issue'],['POST','/invoices/inv-a/void'],['POST','/invoices/inv-a/payments',{amountCents:100}],['GET','/search?q=synthetic'],
  ['GET','/analytics'],['GET','/command-center/ops-client-a'],['GET','/retention/policies'],['POST','/retention/legal-hold',{}],['POST','/archive/verify',{}],['POST','/rollover',{}],
])('refuses the production %s %s before any process-local operations service',async(method,path,body?)=>{
  const spies=serviceSpies();
  const response=await call(method,path,body);
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toMatchObject({code:'DURABLE_OPERATIONS_STORE_REQUIRED'});
  for(const spy of spies)expect(spy).not.toHaveBeenCalled();
});
it('refuses the production payment webhook: no payment provider is commissioned',async()=>{
  vi.stubEnv('STRIPE_WEBHOOK_SECRET','synthetic-webhook-secret');
  const handle=vi.spyOn(globalEngagementBillingService,'handleStripeWebhook');
  const response=await call('POST','/payments/webhook',{id:'evt_synthetic',type:'payment_intent.succeeded'},{'stripe-signature':'t=1,v1=00'});
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({code:'PAYMENT_PROVIDER_NOT_COMMISSIONED'});
  expect(handle).not.toHaveBeenCalled();
});
it('keeps authentication and the client-context check ahead of the production refusal',async()=>{
  expect((await call('GET','/jobs',undefined,{})).status).toBe(401);
  Object.assign(session,{id:'ops-client-a',role:'client',clientId:'ops-client-a'});
  const response=await call('GET','/jobs?clientId=ops-client-b');
  expect(response.status).toBe(403);
  expect((await call('GET','/jobs')).status).toBe(503);
});
it('keeps job scoping outside production: a client lists only its own jobs and cannot widen the listing',async()=>{
  vi.stubEnv('NODE_ENV','test');
  await globalDurableJobQueueService.enqueue({tenantId:'ops-tenant',clientId:'ops-client-a',jobType:'DOCUMENT_PROCESSING',payload:{marker:'ops-client-a-job'}});
  await globalDurableJobQueueService.enqueue({tenantId:'ops-tenant',clientId:'ops-client-b',jobType:'DOCUMENT_PROCESSING',payload:{marker:'ops-client-b-job'}});
  Object.assign(session,{id:'ops-client-a',role:'client',clientId:'ops-client-a'});
  const own=await call('GET','/jobs');
  expect(own.status).toBe(200);
  const listing=await own.json();
  expect(listing.jobs.map((job:any)=>job.clientId)).toEqual(['ops-client-a']);
  expect(JSON.stringify(listing)).not.toContain('ops-client-b-job');
  const widened=await call('GET','/jobs?clientId=ops-client-b');
  expect(widened.status).toBe(403);
  expect(await widened.text()).not.toContain('ops-client-b-job');
});
it('keeps job cancellation scoped to an active assignment outside production',async()=>{
  vi.stubEnv('NODE_ENV','test');
  vi.spyOn(db,'getClientBindings').mockImplementation((clientId:string)=>clientId==='ops-client-a'?[{accountantId:'staff-a',status:'active',effectiveDate:'2020-01-01'}] as any:[]);
  const assigned=await globalDurableJobQueueService.enqueue({tenantId:'ops-tenant',clientId:'ops-client-a',jobType:'DOCUMENT_PROCESSING',payload:{marker:'assigned-job'}});
  const unassigned=await globalDurableJobQueueService.enqueue({tenantId:'ops-tenant',clientId:'ops-client-b',jobType:'DOCUMENT_PROCESSING',payload:{marker:'unassigned-job'}});
  Object.assign(session,{id:'staff-a',role:'accountant'});
  const allowed=await call('POST',`/jobs/${assigned.id}/cancel`);
  expect(allowed.status).toBe(200);
  expect(JSON.stringify(await allowed.json())).toContain('assigned-job');
  const denied=await call('POST',`/jobs/${unassigned.id}/cancel`);
  expect(denied.status).toBe(403);
  expect(await denied.text()).not.toContain('unassigned-job');
});
