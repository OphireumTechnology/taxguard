import { beforeAll,beforeEach,afterAll,it,expect,vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { capabilityFixture,sourceId } from './aiCapabilities.fixture';
import { GovernedCapabilityExecutor } from '../server/ai/capabilities/GovernedCapabilityExecutor';
import { ScopedReadRepository } from '../server/ai/capabilities/ScopedReadRepository';
import { SqlCapabilityStore } from '../server/ai/capabilities/SqlCapabilityStore';
import type { TransactionalSql } from '../server/ai/governance/SqlGovernanceStore';
import { findCanonicalAgent } from '../ai/registry';

let f:Awaited<ReturnType<typeof capabilityFixture>>;
beforeAll(async()=>{f=await capabilityFixture();},30000);
beforeEach(async()=>{await f.reset();});
afterAll(async()=>{await f?.pg.close();});
async function invocation(db:TransactionalSql=f.db) {
  const reads=new ScopedReadRepository(f.db),handler=vi.spyOn(reads,'read');
  const executor=new GovernedCapabilityExecutor(f.resolver,f.plane,new SqlCapabilityStore(db),reads);
  const request={context:await f.context(),proposal:{capability_id:'workflow.read',version:'1',arguments:{}}};
  return {executor,request,handler};
}

it('records admission before execution and append-only truthful phases',async()=>{
  const {executor,request}=await invocation();const result=await executor.execute('valid',request);
  const rows=(await f.pg.query<{status:string;handler_invoked:boolean}>(`SELECT status,handler_invoked FROM ai_capability_events WHERE invocation_id=$1 ORDER BY created_at`,[result.invocation_id])).rows;
  expect(rows).toEqual([{status:'ADMITTED',handler_invoked:false},{status:'EXECUTING',handler_invoked:false},{status:'EXECUTED',handler_invoked:true}]);
  const row=(await f.pg.query<Record<string,unknown>>('SELECT * FROM ai_capability_admissions WHERE invocation_id=$1',[result.invocation_id])).rows[0];
  expect(row.input_hash).toMatch(/^[a-f0-9]{64}$/);expect(row.evidence_hash).toMatch(/^[a-f0-9]{64}$/);expect(row.definition_hash).toBe(result.provenance.definition_hash);expect(row.tenant_id).toBe('tenantA');expect(row.actor_uid).toBe('preparer');expect(row.run_id).toBeNull();expect(row.execution_boundary).toBe('ISOLATED_TEST_ONLY');
});
it.each(['ai_capability_admissions','ai_capability_events'])('prevents update/delete of %s',async table=>{
  const {executor,request}=await invocation();const r=await executor.execute('valid',request);
  await expect(f.pg.query(`UPDATE ${table} SET actor_uid=actor_uid WHERE invocation_id=$1`,[r.invocation_id])).rejects.toThrow(/immutable/i);
  await expect(f.pg.query(`DELETE FROM ${table} WHERE invocation_id=$1`,[r.invocation_id])).rejects.toThrow(/immutable/i);
});
it('enables and forces RLS with no permissive capability policies',async()=>{
  const rows=(await f.pg.query<{relname:string;relrowsecurity:boolean;relforcerowsecurity:boolean}>(`SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname IN ('ai_capability_admissions','ai_capability_events')`)).rows;
  expect(rows).toHaveLength(2);expect(rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity)).toBe(true);
  expect((await f.pg.query(`SELECT * FROM pg_policies WHERE tablename IN ('ai_capability_admissions','ai_capability_events')`)).rows).toHaveLength(0);
});
it.each(['anon','authenticated'])('denies exposed API role %s',async role=>{
  await expect(f.pg.transaction(async sql=>{await sql.exec(`SET LOCAL ROLE ${role}`);await sql.query('SELECT * FROM ai_capability_admissions');})).rejects.toThrow(/permission denied/i);
  await expect(f.pg.transaction(async sql=>{await sql.exec(`SET LOCAL ROLE ${role}`);await sql.query('SELECT * FROM ai_capability_events');})).rejects.toThrow(/permission denied/i);
});
it.each([
  [1,()=>'tenantB','tenant'],[2,()=>'unassigned','actor'],[3,()=>randomUUID(),'case_record'],
  [4,()=>'clientB','client'],[5,()=>'caseB','case'],[6,()=>2024,'year'],
  [7,()=>randomUUID(),'root'],[8,()=>randomUUID(),'operation'],[9,()=>'A61','agent'],
  [10,()=>'nonexistent-version','agent_version'],[11,()=>'shell.execute','capability'],[12,()=>'2','capability_version'],
  [13,()=>19,'stage'],[14,()=>randomUUID(),'decision'],[15,()=>randomUUID(),'run'],[16,()=>randomUUID(),'attempt'],
  [17,()=>'not-a-hash','binding'],[18,()=>'not-a-hash','definition'],[19,()=>'not-a-hash','input'],
] as const)('database rejects altered admission %s/%s/%s',async(index,value,label)=>{
  // A new valid root/child is used for each attempted insert, avoiding a duplicate-key false positive.
  let databaseError='';
  const db:TransactionalSql={transaction:work=>f.db.transaction(sql=>work({query:async(query,params)=>{
    if(query.startsWith('INSERT INTO ai_capability_admissions')) {const altered=[...params!];altered[index]=value();try{return await sql.query(query,altered);}catch(error){databaseError=(error as Error).message;throw error;}}
    return sql.query(query,params);
  }}))};
  const {executor,request,handler}=await invocation(db);await expect(executor.execute('valid',request)).rejects.toThrow('AI_CAPABILITY_AUDIT_UNAVAILABLE');expect(handler).not.toHaveBeenCalled();expect(databaseError).toMatch(/invalid capability|AI_CASE_SCOPE_MISMATCH|violates|invalid input/);expect(databaseError).not.toMatch(/unique constraint/);
});
it('rejects orphan capability event',async()=>{await expect(f.pg.query(`INSERT INTO ai_capability_events(invocation_id,tenant_id,actor_uid,status,reason_code,handler_invoked,decision_id) VALUES($1,'tenantA','preparer','ADMITTED','AI_TEST',false,$2)`,[randomUUID(),randomUUID()])).rejects.toThrow(/invalid capability event|foreign key/);});
it('cannot record execution before executing admission',async()=>{
  const {executor,request}=await invocation();const result=await executor.execute('valid',request);
  const decision=result.provenance.decision_id;
  await expect(f.pg.query(`INSERT INTO ai_capability_events(invocation_id,tenant_id,actor_uid,status,reason_code,handler_invoked,output_hash,decision_id) VALUES($1,'tenantA','preparer','EXECUTED','AI_TEST',false,$2,$3)`,[result.invocation_id,'a'.repeat(64),decision])).rejects.toThrow(/completed capability|violates/);
});
it('read invocation leaves tax authority and approval tables untouched',async()=>{
  const before=(await f.pg.query(`SELECT * FROM taxguard_cases WHERE case_id='caseA'`)).rows;
  const {executor,request}=await invocation();await executor.execute('valid',request);
  expect((await f.pg.query(`SELECT * FROM taxguard_cases WHERE case_id='caseA'`)).rows).toEqual(before);
  for(const table of ['ai_proposals','ai_human_reviews','ai_authoritative_actions'])expect((await f.pg.query(`SELECT * FROM ${table}`)).rows).toHaveLength(0);
  expect(findCanonicalAgent('A00').status).toBe('DRAFT');expect(findCanonicalAgent('A34').status).toBe('DRAFT');
});
it('correlation cannot attach an unrelated completed provider run',async()=>{
  const {executor,request,handler}=await invocation();await expect(executor.execute('valid',{...request,gateway_correlation:{run_id:randomUUID(),attempt_id:randomUUID()}})).rejects.toThrow('AI_CAPABILITY_GATEWAY_DENIED');expect(handler).not.toHaveBeenCalled();
});
it('source selection is still authority checked even with an existing admission',async()=>{
  const {executor,request,handler}=await invocation();await executor.execute('valid',request);handler.mockClear();
  await f.pg.exec("UPDATE taxguard_staff_assignments SET status='REVOKED'");await expect(executor.execute('valid',{...request,proposal:{capability_id:'document.read',version:'1',arguments:{source_ids:[sourceId]}}})).rejects.toThrow('AI_CASE_ACCESS_DENIED');expect(handler).not.toHaveBeenCalled();
});
