import {it,expect} from 'vitest';
import {SecurityEventRecorder} from '../server/securityEventRecorder';
import {SECURITY_EVENT_CATEGORIES} from '../server/taxguard/audit/securityEventSink';
it('hands off every existing security category through the minimal committed outbox contract',async()=>{
 const calls:any[]=[];const recorder=new SecurityEventRecorder({rpc:async(name,args)=>{calls.push({name,args});return {data:{eventId:args.p_event,acknowledged:true},error:null};}},'synthetic',100,'outbox');
 for(const eventType of Object.keys(SECURITY_EVENT_CATEGORIES))await recorder.recordDurably({eventType,severity:'warning',userId:'actor'});
 expect(calls).toHaveLength(Object.keys(SECURITY_EVENT_CATEGORIES).length);
 for(const call of calls){expect(call.name).toBe('taxguard_security_enqueue');expect(Object.keys(call.args).sort()).toEqual(['p_actor','p_code','p_event','p_severity','p_tenant']);expect(call.args.p_tenant).toBe('synthetic');}
 expect(recorder.status().acknowledged).toBe(calls.length);
});
