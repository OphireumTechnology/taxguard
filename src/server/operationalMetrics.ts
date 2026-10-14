import {performance} from 'node:perf_hooks';
import type {RequestHandler} from 'express';
/** Process-local operational counters, not audit custody. No request labels or payloads. */
export function createOperationalMetrics(){
 let active=0,total=0,aborted=0;const statuses=[0,0,0,0,0,0],latency=[0,0,0,0,0];
 const middleware:RequestHandler=(_req,res,next)=>{
  const start=performance.now();active++;let done=false;
  const finish=(closed:boolean)=>{if(done)return;done=true;active--;total++;if(closed)aborted++;
   const elapsed=performance.now()-start;latency[elapsed<10?0:elapsed<100?1:elapsed<1000?2:elapsed<10000?3:4]++;
   statuses[Math.min(5,Math.max(0,Math.floor(res.statusCode/100)))]++;
  };res.once('finish',()=>finish(false));res.once('close',()=>finish(!res.writableFinished));next();
 };
 return {middleware,snapshot:()=>({scope:'PROCESS_LOCAL',active,total,aborted,statusClasses:{'1xx':statuses[1],'2xx':statuses[2],'3xx':statuses[3],'4xx':statuses[4],'5xx':statuses[5]},latencyMs:{below10:latency[0],below100:latency[1],below1000:latency[2],below10000:latency[3],atLeast10000:latency[4]}})};
}
