import express from 'express';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {it,expect} from 'vitest';
import {requireOperationalAdministrator} from '../server/operationalDiagnostics';
import {createOperationalMetrics} from '../server/operationalMetrics';
import {proxyTrustHops} from '../server/config/proxyTrust';
it('rejects arbitrary proxy trust and defaults to direct hosting',()=>{
 expect(proxyTrustHops('')).toBe(0);expect(proxyTrustHops('1')).toBe(1);
 for(const value of ['true','*','3','-1','1,2','127.0.0.1'])expect(()=>proxyTrustHops(value)).toThrow('PROXY_TRUST_CONFIGURATION_INVALID');
});
it('protects probes with verified active administrator MFA and exposes only bounded counters',async()=>{
 const metrics=createOperationalMetrics(),app=express();let actor:any,probes=0;
 app.use(metrics.middleware);app.use((req:any,_res,next)=>{req.user=actor;next();});
 app.get('/diagnostics',requireOperationalAdministrator,(_req,res)=>{probes++;res.json(metrics.snapshot());});
 const server=createServer(app);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/diagnostics?secret=never-recorded';
 try{expect((await fetch(url)).status).toBe(401);
  for(const [role,status,aal] of [['client','active','aal2'],['admin','suspended','aal2'],['admin','active','aal1']]){actor={id:'synthetic',tenantId:'t',role,status,sessionAssuranceLevel:aal};expect((await fetch(url)).status).toBe(403);}
  expect(probes).toBe(0);actor={id:'synthetic',tenantId:'t',role:'admin',status:'active',sessionAssuranceLevel:'aal2'};
  const response=await fetch(url);expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');const data=await response.json();
  expect(data).toMatchObject({scope:'PROCESS_LOCAL',total:4,statusClasses:{'4xx':4}});expect(JSON.stringify(data)).not.toContain('secret');expect(JSON.stringify(data)).not.toContain('synthetic');
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
