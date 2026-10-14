import {randomUUID,createHash} from 'node:crypto';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {startDatabase,pgRpc,type TestDatabase} from './harness';
import {PracticeStore} from '../server/taxguard/practice/practiceStore';
import {CollectionStore} from '../server/taxguard/collectionStore';
let db:TestDatabase,engagement='';
beforeAll(async()=>{db=await startDatabase({durable:true});
 await db.pool.query("INSERT INTO taxguard_tenants(id,name) VALUES('p11','Synthetic Phase 11');INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('p11','client','owner','Synthetic');INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES('p11','owner','client','active','client'),('p11','manager','practice_manager','active',NULL),('p11','outsider','client','active','other');");
 const practice=new PracticeStore(pgRpc(db.pool));engagement=(await practice.createEngagement('p11','client','manager','phase11-engagement',{title:'Synthetic',type:'tax_preparation',taxYears:[2025]})).engagementId;
 await practice.setEngagementStatus('p11','client','manager',engagement,'active',1);
});afterAll(async()=>{await db?.stop();});
it('serializes competing client replies and retains the winning revision after database restart',async()=>{
 const store=new CollectionStore(pgRpc(db.pool));const request=await store.requests('p11','client','manager',2025,'CREATE',{key:'phase11-request',requestType:'CLARIFICATION',title:'Synthetic question',message:'Synthetic clarification only'});
 const sessions=await Promise.all([db.connect(),db.connect()]);
 try{for(const session of sessions)await session.query('SET ROLE service_role');
  const results=await Promise.allSettled(sessions.map((session,index)=>new CollectionStore(pgRpc(session)).requests('p11','client','owner',2025,'RESPOND',{requestId:request.requestId,rowVersion:1,replyId:'phase11-reply-'+index,message:'Synthetic reply '+index})));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
  expect((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.message).toBe('COLLECTION_VERSION_CONFLICT');
 }finally{await Promise.all(sessions.map(s=>s.end()));}
 await db.restart();expect((await new CollectionStore(pgRpc(db.pool)).requests('p11','client','owner',2025,'LIST')).requests[0].rowVersion).toBe(2);
 await expect(new CollectionStore(pgRpc(db.pool)).requests('p11','client','outsider',2025,'LIST')).rejects.toThrow();
});
it('binds one-use scanner jobs to immutable document versions under competing verdicts',async()=>{
 const rpc=pgRpc(db.pool),id='doc_'+createHash('sha256').update('p11document').digest('hex').slice(0,32),digest=createHash('sha256').update('synthetic bytes').digest('hex');
 const registered=await rpc.rpc('taxguard_doc_begin_upload',{p_tenant:'p11',p_client:'client',p_actor:'owner',p_document_id:null,p_new_id:id,p_meta:{engagementId:engagement,taxYear:2025,caseId:null,category:'income',fileName:'synthetic.pdf',mimeType:'application/pdf',sizeBytes:15,sha256:digest}});expect(registered.error).toBeNull();
 expect((await rpc.rpc('taxguard_doc_complete_upload',{p_tenant:'p11',p_client:'client',p_actor:'owner',p_document_id:id,p_version:1,p_sha256:digest,p_size:15})).error).toBeNull();
 const binding={p_tenant:'p11',p_client:'client',p_document:id,p_version:1,p_request:randomUUID(),p_digest:digest,p_scanner:'synthetic-only',p_issued:Date.now()};
 expect((await rpc.rpc('taxguard_doc_scan_job',binding)).error).toBeNull();
 expect((await rpc.rpc('taxguard_doc_scan_verdict',{...binding,p_request:randomUUID(),p_result:'CLEAN'})).error?.message).toBe('DOCUMENT_SCAN_JOB_INVALID');
 expect((await rpc.rpc('taxguard_doc_scan_verdict',{...binding,p_digest:'0'.repeat(64),p_result:'CLEAN'})).error?.message).toBe('DOCUMENT_SCAN_JOB_INVALID');
 expect((await rpc.rpc('taxguard_doc_scan_verdict',{...binding,p_client:'other',p_result:'CLEAN'})).error?.message).toBe('DOCUMENT_SCAN_JOB_INVALID');
 await db.pool.query("UPDATE taxguard_document_scan_jobs SET expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[binding.p_request]);
 expect((await rpc.rpc('taxguard_doc_scan_verdict',{...binding,p_result:'CLEAN'})).error?.message).toBe('DOCUMENT_SCAN_EXPIRED');
 expect((await db.pool.query('SELECT status FROM taxguard_documents WHERE document_id=$1',[id])).rows[0].status).toBe('SCAN_PENDING');
 await db.pool.query("UPDATE taxguard_document_scan_jobs SET expires_at=clock_timestamp()+interval '60 seconds',storage_path=storage_path||'-tampered' WHERE request_id=$1",[binding.p_request]);
 expect((await rpc.rpc('taxguard_doc_scan_verdict',{...binding,p_result:'CLEAN'})).error?.message).toBe('DOCUMENT_SCAN_JOB_INVALID');
 await db.pool.query("UPDATE taxguard_document_scan_jobs j SET storage_path=d.storage_path FROM taxguard_documents d WHERE j.document_row=d.id AND j.request_id=$1",[binding.p_request]);
 const sessions=await Promise.all([db.connect(),db.connect()]);
 try{for(const session of sessions)await session.query('SET ROLE service_role');
  const results=await Promise.all(sessions.map(session=>pgRpc(session).rpc('taxguard_doc_scan_verdict',{...binding,p_result:'INFECTED'})));
  expect(results.filter(r=>!r.error)).toHaveLength(1);expect(results.find(r=>r.error)?.error?.message).toBe('DOCUMENT_SCAN_REPLAY_DENIED');
 }finally{await Promise.all(sessions.map(s=>s.end()));}
 expect((await db.pool.query('SELECT status FROM taxguard_documents WHERE document_id=$1',[id])).rows[0].status).toBe('REJECTED_MALWARE');
 expect((await rpc.rpc('taxguard_doc_authorize_download',{p_tenant:'p11',p_client:'client',p_actor:'owner',p_document_id:id,p_version:1})).error?.message).toBe('DOCUMENT_NOT_AVAILABLE');
});
it('denies direct table and unbound scanner bypass for browser and service roles',async()=>{
 for(const role of ['anon','authenticated','service_role']){
  const session=await db.connect();try{await session.query('SET ROLE '+role);
   for(const table of ['taxguard_collection_questionnaires','taxguard_collection_replies','taxguard_document_scan_jobs','taxguard_invoices','taxguard_invoice_lines'])await expect(session.query('SELECT * FROM '+table)).rejects.toThrow('permission denied');
   await expect(session.query("SELECT taxguard_doc_record_scan('p11','client','unknown',1,'CLEAN','fake')")).rejects.toThrow('permission denied');
  }finally{await session.end();}
 }
});
