import {it,expect} from 'vitest';
import {ScanCoordinator} from '../server/taxguard/documents/malwareScanning';
it('bounds a hanging provider submission, aborts it and retains durable quarantine for retry',async()=>{
 let aborted=false;const calls:string[]=[];
 const coordinator=new ScanCoordinator({rpc:async(name)=>{calls.push(name);return {data:{scanId:'synthetic',expiresAt:new Date(Date.now()+900000).toISOString(),created:true},error:null};}}, {name:'synthetic',submit:async(_request,signal)=>{signal?.addEventListener('abort',()=>{aborted=true;});return new Promise(()=>{});}},10);
 expect(await coordinator.request({tenantId:'t',clientId:'c',documentId:'d',version:1,storagePath:'synthetic',sha256:'a'.repeat(64),sizeBytes:10,mimeType:'application/pdf'})).toBe('SCANNER_UNAVAILABLE');
 expect(aborted).toBe(true);expect(calls).toEqual(['taxguard_doc_scan_request']);
});
