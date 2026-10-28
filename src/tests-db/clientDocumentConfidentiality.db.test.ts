import {beforeAll,afterAll,it,expect} from 'vitest';
import {startDatabase,pgRpc,type TestDatabase} from './harness';
import {PracticeStore} from '../server/taxguard/practice/practiceStore';
import {DocumentVaultStore} from '../server/taxguard/documents/documentVaultStore';
let db:TestDatabase,store:DocumentVaultStore;
const T='c9',C='client',secret='INTERNAL confidential reviewer discussion',reason='Please replace the unreadable second page.';
const ids:Record<string,string>={};
beforeAll(async()=>{
 db=await startDatabase();
 await db.pool.query("INSERT INTO taxguard_tenants(id,name) VALUES('c9','Synthetic C9'); INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('c9','client','owner','Synthetic'),('c9','other','other-owner','Other'); INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES('c9','owner','client','active','client'),('c9','other-owner','client','active','other'),('c9','reviewer-private','practice_manager','active',NULL),('c9','unassigned','accountant','active',NULL);");
 const practice=new PracticeStore(pgRpc(db.pool));const eng=await practice.createEngagement(T,C,'reviewer-private','c9-engagement',{title:'Synthetic',type:'tax_preparation',taxYears:[2025]});
 await practice.setEngagementStatus(T,C,'reviewer-private',eng.engagementId,'active',1);
 store=new DocumentVaultStore(pgRpc(db.pool),{async put(){},async signedUrl(){return 'https://storage.invalid';}},
  {name:'synthetic-c9',async scan(){return 'CLEAN';}});
 for(const decision of ['reject','request_replacement','approve','legacy']){
  const d=await store.upload(T,C,'owner',{engagementId:eng.engagementId,taxYear:2025,category:'income',fileName:decision+'.pdf',mimeType:'application/pdf',idempotencyKey:'c9-key-'+decision},Buffer.from('%PDF-1.4\nSynthetic only\n%%EOF'));
  ids[decision]=d.documentId;
  if(decision==='legacy')await db.pool.query('SELECT taxguard_doc_review($1,$2,$3,$4,1,$5,$6,3)',[T,C,'reviewer-private',d.documentId,'reject',secret]);
  else await store.review(T,C,'reviewer-private',d.documentId,1,decision,3,secret,decision==='approve'?undefined:reason);
 }
},60000);
afterAll(async()=>{await db?.stop();});
it('redacts direct database client list and every detail version without any frontend',async()=>{
 const session=await db.connect();try{await session.query('SET ROLE service_role');const rpc=pgRpc(session);
  const listed=await rpc.rpc('taxguard_doc_list',{p_tenant:T,p_client:C,p_actor:'owner',p_tax_year:null});expect(listed.error).toBeNull();
  expect(listed.data).toHaveLength(4);
  for(const documentId of Object.values(ids)){
   const detail=await rpc.rpc('taxguard_doc_detail',{p_tenant:T,p_client:C,p_actor:'owner',p_document_id:documentId});expect(detail.error).toBeNull();
   expect(detail.data.history).toEqual([]);expect(detail.data.extractions).toEqual([]);
   const text=JSON.stringify([listed.data,detail.data]);expect(text).not.toContain(secret);expect(text).not.toContain('reviewer-private');
   expect(text).not.toMatch(/reviewedBy|reviewNote|reviewedAt|uploadedBy|uploaderRole|actorUid|actorRole|verifiedBy|storagePath|sha256|scannedAt/);
  }
 }finally{await session.end();}
});
it('preserves explicitly authorized rejection/replacement reasons and keeps legacy notes private',async()=>{
 for(const decision of ['reject','request_replacement'])expect((await store.detail(T,C,'owner',ids[decision])).versions[0].clientReason).toBe(reason);
 expect((await store.detail(T,C,'owner',ids.legacy)).versions[0].clientReason).toBeNull();
 expect((await store.detail(T,C,'owner',ids.approve)).versions[0]).not.toHaveProperty('clientReason');
 const staff=await store.detail(T,C,'reviewer-private',ids.reject);expect(staff.versions[0]).toMatchObject({reviewNote:secret,reviewedBy:'reviewer-private',clientReason:reason});
 expect(staff.history.some((h:any)=>h.actorUid==='reviewer-private')).toBe(true);
});
it('denies other clients, unassigned staff, tenant substitution and revoked memberships in SQL',async()=>{
 for(const actor of ['other-owner','unassigned'])await expect(store.detail(T,C,actor,ids.reject)).rejects.toThrow('DOCUMENT_NOT_FOUND');
 await expect(store.list('foreign',C,'owner')).rejects.toThrow();
 await db.pool.query("UPDATE taxguard_members SET status='suspended' WHERE tenant_id='c9' AND uid='owner'");
 try{await expect(store.list(T,C,'owner')).rejects.toThrow('DOCUMENT_ACCESS_DENIED');}finally{await db.pool.query("UPDATE taxguard_members SET status='active' WHERE tenant_id='c9' AND uid='owner'");}
});
it('denies browser direct tables and forged staff actor arguments, including raw serializers',async()=>{
 for(const role of ['anon','authenticated']){
  const session=await db.connect();try{await session.query('SET ROLE '+role);
   for(const table of ['taxguard_documents','taxguard_audit_log'])await expect(session.query('SELECT * FROM '+table)).rejects.toThrow('permission denied');
   await expect(session.query("SELECT taxguard_doc_list('c9','client','reviewer-private',NULL)")).rejects.toThrow('permission denied');
   await expect(session.query("SELECT taxguard_doc_detail('c9','client','reviewer-private',$1)",[ids.reject])).rejects.toThrow('permission denied');
   for(const helper of ['taxguard_doc_json','taxguard_doc_client_json'])await expect(session.query('SELECT '+helper+'(NULL::taxguard_documents)')).rejects.toThrow('permission denied');
   await expect(session.query("SELECT taxguard_doc_review_with_reason('c9','client','reviewer-private',$1,1,'reject','private',4,'public reason')",[ids.reject])).rejects.toThrow('permission denied');
  }finally{await session.end();}
 }
});
it('pins helper invoker mode and definer paths and rejects default PUBLIC execute',async()=>{
 const rows=(await db.pool.query("SELECT proname,prosecdef,proconfig,has_function_privilege('anon',p.oid,'EXECUTE') a,has_function_privilege('authenticated',p.oid,'EXECUTE') b FROM pg_proc p WHERE proname IN ('taxguard_doc_client_json','taxguard_doc_review_with_reason','taxguard_doc_list','taxguard_doc_detail')")).rows;
 expect(rows).toHaveLength(4);for(const row of rows){expect(row.a).toBe(false);expect(row.b).toBe(false);expect(row.proconfig.join(' ')).toContain('search_path=pg_catalog, public, pg_temp');}
 expect(rows.find(r=>r.proname==='taxguard_doc_client_json').prosecdef).toBe(false);
});
it('redacts all historical versions while retaining their separately authorized reasons',async()=>{
 const previous=(await store.detail(T,C,'reviewer-private',ids.reject)).versions[0];
 const uploaded=await store.upload(T,C,'owner',{engagementId:previous.engagementId,taxYear:2025,category:'income',fileName:'replacement.pdf',mimeType:'application/pdf',idempotencyKey:'c9-second-version',documentId:ids.reject},Buffer.from('%PDF-1.4\nSynthetic replacement\n%%EOF'));
 await store.review(T,C,'reviewer-private',ids.reject,uploaded.version,'request_replacement',3,secret,'Please supply the missing last page.');
 const detail=await store.detail(T,C,'owner',ids.reject);expect(detail.versions).toHaveLength(2);
 expect(detail.versions.map((v:any)=>v.clientReason)).toEqual(['Please supply the missing last page.',reason]);
 expect(JSON.stringify(detail)).not.toMatch(/reviewedBy|reviewNote|actorUid|reviewer-private|INTERNAL/);
 await expect(store.review(T,C,'owner',ids.reject,2,'reject',4,'client spoof',reason)).rejects.toThrow('DOCUMENT_REVIEW_REQUIRES_STAFF');
 await expect(store.review(T,C,'reviewer-private',ids.reject,2,'reject',3,secret,reason)).rejects.toThrow('DOCUMENT_VERSION_CONFLICT');
});
it('validates public reason and private note independently and keeps rejected validation atomic',async()=>{
 const previous=(await store.detail(T,C,'reviewer-private',ids.reject)).versions[0];
 const uploaded=await store.upload(T,C,'owner',{engagementId:previous.engagementId,taxYear:2025,category:'income',fileName:'reason-validation.pdf',mimeType:'application/pdf',idempotencyKey:'c9-reason-validation'},Buffer.from('%PDF-1.4\nSynthetic validation\n%%EOF'));
 const args={p_tenant:T,p_client:C,p_actor:'reviewer-private',p_document_id:uploaded.documentId,p_version:1,p_decision:'reject',p_note:'x',p_row_version:3,p_client_reason:reason};
 const rpc=pgRpc(db.pool);
 for(const changed of [{p_client_reason:'no'},{p_client_reason:'x'.repeat(501)},{p_note:'x'.repeat(501)},{p_decision:'approve'}]){
  expect((await rpc.rpc('taxguard_doc_review_with_reason',{...args,...changed})).error?.message).toBe('DOCUMENT_INPUT_INVALID');
  expect((await store.detail(T,C,'reviewer-private',uploaded.documentId)).versions[0].status).toBe('PENDING_REVIEW');
 }
 expect((await rpc.rpc('taxguard_doc_review_with_reason',args)).error).toBeNull();
 expect((await store.detail(T,C,'reviewer-private',uploaded.documentId)).versions[0]).toMatchObject({reviewNote:'x',clientReason:reason});
 expect((await store.detail(T,C,'owner',uploaded.documentId)).versions[0]).not.toHaveProperty('reviewNote');
});
