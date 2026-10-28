import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const migration=readFileSync('docs/proposed-migrations/20261012100000_taxguard_mfa_recovery_requests.sql','utf8');
const request=async(p:Partial<{tenant:string;actor:string;uid:string;id:string;category:string;reason:string;sessionHash:string}>={})=>{
 const v={tenant:'tenantA',actor:'recovery-maker',uid:'recovery-target',id,category:'lost_authenticator',reason:'Synthetic device loss',sessionHash:p.actor==='recovery-other'?'f'.repeat(64):'d'.repeat(64),...p};
 return (await fixture.pg.query<{result:any}>('SELECT taxguard_request_mfa_recovery($1,$2,$3,$4,$5,$6,$7) AS result',[v.tenant,v.actor,v.uid,v.id,v.category,v.reason,v.sessionHash])).rows[0].result;
};
const approve=async(actor='recovery-checker',tenant='tenantA',requestId=id,sessionHash=actor==='recovery-other'?'f'.repeat(64):'e'.repeat(64))=>(await fixture.pg.query<{result:any}>('SELECT taxguard_approve_mfa_recovery($1,$2,$3,$4) AS result',[tenant,actor,requestId,sessionHash])).rows[0].result;
const state=async()=>({
 members:(await fixture.pg.query<{status:string;mfa_reenrollment_required:boolean;status_changed_by:string|null;status_changed_at:string|null}>("SELECT status,mfa_reenrollment_required,status_changed_by,status_changed_at FROM taxguard_members WHERE uid='recovery-target'")).rows,
 identities:(await fixture.pg.query<{user_data:Record<string,unknown>}>("SELECT user_data FROM taxguard_identities WHERE uid='recovery-target'")).rows,
 sessions:(await fixture.pg.query<{tenant_id:string;revoked:boolean}>("SELECT tenant_id,revoked FROM taxguard_sessions WHERE uid='recovery-target' ORDER BY tenant_id,session_token_hash")).rows,
 requests:(await fixture.pg.query('SELECT * FROM taxguard_mfa_recovery_requests')).rows,
 jobs:(await fixture.pg.query('SELECT * FROM taxguard_mfa_reset_jobs')).rows,
 audits:(await fixture.pg.query<{action:string;metadata:{revokedSessions?:number}}>("SELECT action,metadata FROM taxguard_audit_log WHERE action LIKE 'STAFF_MFA_RECOVERY_%' ORDER BY action")).rows,
});
beforeAll(async()=>{fixture=await capabilityFixture();for(const name of readdirSync('docs/proposed-migrations').filter(n=>/^20261012(?:0[0-9]|10)0000_/.test(n)).sort())await fixture.pg.exec(readFileSync('docs/proposed-migrations/'+name,'utf8'));},30000);
afterAll(async()=>{await fixture?.pg.close();});
beforeEach(async()=>{await fixture.pg.exec(
 "DELETE FROM taxguard_mfa_reset_jobs; DELETE FROM taxguard_mfa_recovery_requests; DELETE FROM taxguard_sessions WHERE uid LIKE 'recovery-%'; DELETE FROM taxguard_identities WHERE uid LIKE 'recovery-%'; DELETE FROM taxguard_members WHERE uid LIKE 'recovery-%'; DELETE FROM taxguard_audit_log WHERE action LIKE 'STAFF_MFA_RECOVERY_%'; UPDATE taxguard_tenants SET status='active';"+
 "INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','recovery-maker','admin','active'),('tenantA','recovery-checker','administrator','active'),('tenantA','recovery-other','admin','active'),('tenantA','recovery-target','accountant','active');"+
 "INSERT INTO taxguard_identities(tenant_id,uid,user_data) VALUES('tenantA','recovery-target','{\"id\":\"recovery-target\",\"tenantId\":\"tenantA\",\"role\":\"accountant\",\"status\":\"active\",\"mfaEnabled\":true}');"+
 "INSERT INTO taxguard_identities(tenant_id,uid,user_data) SELECT tenant_id,uid,jsonb_build_object('id',uid,'tenantId',tenant_id,'role',role,'status',status) FROM taxguard_members WHERE uid IN ('recovery-maker','recovery-checker','recovery-other');"+
 "INSERT INTO taxguard_sessions(tenant_id,uid,session_token_hash,auth_time,expires_at,aal) VALUES('tenantA','recovery-target',repeat('a',64),1,(floor(extract(epoch FROM now())*1000)::bigint+3600000),'aal2'),('tenantA','recovery-target',repeat('b',64),1,(floor(extract(epoch FROM now())*1000)::bigint+3600000),'aal1'),('tenantB','recovery-target',repeat('c',64),1,(floor(extract(epoch FROM now())*1000)::bigint+3600000),'aal2'),('tenantA','recovery-maker',repeat('d',64),floor(extract(epoch FROM now()))::bigint,(floor(extract(epoch FROM now())*1000)::bigint+3600000),'aal2'),('tenantA','recovery-checker',repeat('e',64),floor(extract(epoch FROM now()))::bigint,(floor(extract(epoch FROM now())*1000)::bigint+3600000),'aal2'),('tenantA','recovery-other',repeat('f',64),floor(extract(epoch FROM now()))::bigint,(floor(extract(epoch FROM now())*1000)::bigint+3600000),'aal2');"
);});
describe('MFA recovery request and independent approval proposal composed with actual core and 000–009',()=>{
 it('requests without mutation, approves atomic suspension, epoch, revocation, audit and unavailable pending job',async()=>{
  expect(await request()).toEqual({requestId:id,targetUid:'recovery-target',status:'pending_approval',resumed:false});
  const pending=await state();expect(pending.members[0].status).toBe('active');expect(pending.jobs).toEqual([]);expect(pending.sessions.every(s=>!s.revoked)).toBe(true);
  expect(await approve()).toEqual({requestId:id,targetUid:'recovery-target',status:'approved',jobId:id,resumed:false});
  const done=await state();expect(done.members[0]).toMatchObject({status:'suspended',mfa_reenrollment_required:true,status_changed_by:'recovery-checker'});expect(done.members[0].status_changed_at).toBeTruthy();
  expect(done.identities[0].user_data).toMatchObject({status:'suspended',mfaEnabled:false});expect(done.sessions).toEqual([{tenant_id:'tenantA',revoked:true},{tenant_id:'tenantA',revoked:true},{tenant_id:'tenantB',revoked:false}]);
  expect(done.jobs).toHaveLength(1);expect(done.jobs[0]).toMatchObject({job_id:id,request_id:id,status:'pending',target_uid:'recovery-target'});expect(done.audits).toHaveLength(2);
  expect(done.audits.find(a=>a.action==='STAFF_MFA_RECOVERY_APPROVED')?.metadata.revokedSessions).toBe(2);
 });
 it('replays exact requests and checker approval without new audit, epoch or job',async()=>{
  await request();expect((await request()).resumed).toBe(true);await approve();const before=await state();
  expect((await request()).resumed).toBe(true);expect((await approve()).resumed).toBe(true);expect(await state()).toEqual(before);
  await expect(approve('recovery-other')).rejects.toThrow('MFA_RECOVERY_STATE_CONFLICT');
 });
 it.each([{reason:'Different reason'},{category:'device_replacement'},{actor:'recovery-other'}])('rejects reused request ID with changed input %j',async patch=>{
  await request();await expect(request(patch)).rejects.toThrow('MFA_RECOVERY_REQUEST_CONFLICT');expect((await state()).requests).toHaveLength(1);
 });
 it('rejects another outstanding request, foreign approval and foreign target authority',async()=>{
  await request();await expect(request({id:id2})).rejects.toThrow('MFA_RECOVERY_ALREADY_OUTSTANDING');await expect(approve('recovery-checker','tenantB')).rejects.toThrow('MFA_RECOVERY_NOT_FOUND');
  await expect(request({tenant:'tenantB',id:id2})).rejects.toThrow('STAFF_TARGET_DENIED');
 });
 it('denies self request, maker approval and target approval',async()=>{
  await expect(request({actor:'recovery-target'})).rejects.toThrow('INDEPENDENT_ACTOR_REQUIRED');await request();
  await expect(approve('recovery-maker')).rejects.toThrow('INDEPENDENT_APPROVER_REQUIRED');await expect(approve('recovery-target')).rejects.toThrow('INDEPENDENT_APPROVER_REQUIRED');expect((await state()).jobs).toEqual([]);
 });
 it.each(['client','prospective_client','super_admin','super_administrator','unknown'])('denies %s targets',async role=>{
  await fixture.pg.query("UPDATE taxguard_members SET role=$1 WHERE uid='recovery-target'",[role]);await expect(request()).rejects.toThrow('STAFF_TARGET_DENIED');
 });
 it.each(['disabled','deactivated','pending_approval'])('denies target %s at request and after request',async status=>{
  await request();await fixture.pg.query("UPDATE taxguard_members SET status=$1 WHERE uid='recovery-target'",[status]);await expect(approve()).rejects.toThrow('STAFF_TARGET_DENIED');await expect(request({id:id2})).rejects.toThrow('STAFF_TARGET_DENIED');expect((await state()).jobs).toEqual([]);
 });
 it('accepts already suspended target without clearing gate or restoring sessions',async()=>{
  await fixture.pg.exec("UPDATE taxguard_members SET status='suspended' WHERE uid='recovery-target'; UPDATE taxguard_identities SET user_data=jsonb_set(user_data,'{status}','\"suspended\"') WHERE uid='recovery-target'");await request();await approve();expect((await state()).members[0].mfa_reenrollment_required).toBe(true);
 });
 it.each(['maker','checker'])('rechecks active independent %s membership at approval',async kind=>{
  await request();await fixture.pg.query('UPDATE taxguard_members SET status=$1 WHERE uid=$2',['suspended','recovery-'+kind]);await expect(approve()).rejects.toThrow('STAFF_ADMIN_REQUIRED');expect((await state()).jobs).toEqual([]);
 });
 it('denies non-admin maker and checker, and gated administrators',async()=>{
  await fixture.pg.exec("UPDATE taxguard_members SET role='accountant' WHERE uid='recovery-maker'");await expect(request()).rejects.toThrow('STAFF_ADMIN_REQUIRED');
  await fixture.pg.exec("UPDATE taxguard_members SET role='admin' WHERE uid='recovery-maker'");await request();await fixture.pg.exec("UPDATE taxguard_members SET mfa_reenrollment_required=true WHERE uid='recovery-checker'");await expect(approve()).rejects.toThrow('STAFF_ADMIN_REQUIRED');
 });
 it.each(['id','tenantId','role','status'])('rejects target identity %s mismatch',async key=>{
  await request();await fixture.pg.query("UPDATE taxguard_identities SET user_data=jsonb_set(user_data,ARRAY[$1],to_jsonb('wrong'::text)) WHERE uid='recovery-target'",[key]);await expect(approve()).rejects.toThrow('STAFF_IDENTITY_INCONSISTENT');expect((await state()).jobs).toEqual([]);
 });
 it('denies existing reenrollment gate and subsequent ordinary lifecycle reactivation',async()=>{
  await fixture.pg.exec("UPDATE taxguard_members SET mfa_reenrollment_required=true WHERE uid='recovery-target'");await expect(request()).rejects.toThrow('STAFF_MFA_REENROLLMENT_REQUIRED');
  await fixture.pg.exec("UPDATE taxguard_members SET mfa_reenrollment_required=false WHERE uid='recovery-target'");await request();await approve();
  await expect(fixture.pg.query("SELECT taxguard_change_staff_membership_status('tenantA','recovery-maker','recovery-target','reactivate','Synthetic attempt')")).rejects.toThrow('STAFF_MFA_REENROLLMENT_REQUIRED');
 });
 it.each([{id:'bad'},{category:'other'},{reason:''},{reason:'x'.repeat(1001)},{reason:'line\ncontrol'},{reason:'del'+String.fromCharCode(127)}])('rejects malformed input %j',async patch=>{await expect(request(patch)).rejects.toThrow('MFA_RECOVERY_INPUT_INVALID');expect((await state()).requests).toEqual([]);});
 it('rolls back request and all approval side effects on audit failure',async()=>{
  await fixture.pg.exec("CREATE FUNCTION recovery_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'RECOVERY_AUDIT_FAILURE'; END $$; CREATE TRIGGER recovery_reject_audit BEFORE INSERT ON taxguard_audit_log FOR EACH ROW EXECUTE FUNCTION recovery_reject_audit();");
  try{await expect(request()).rejects.toThrow('RECOVERY_AUDIT_FAILURE');expect((await state()).requests).toEqual([]);}finally{await fixture.pg.exec('DROP TRIGGER recovery_reject_audit ON taxguard_audit_log');}
  await request();const before=await state();await fixture.pg.exec('CREATE TRIGGER recovery_reject_audit BEFORE INSERT ON taxguard_audit_log FOR EACH ROW EXECUTE FUNCTION recovery_reject_audit();');
  try{await expect(approve()).rejects.toThrow('RECOVERY_AUDIT_FAILURE');expect(await state()).toEqual(before);}finally{await fixture.pg.exec('DROP TRIGGER recovery_reject_audit ON taxguard_audit_log; DROP FUNCTION recovery_reject_audit();');}
 });
 it('denies browser RPC and direct outbox access, permits service audited RPC only',async()=>{
  for(const role of ['anon','authenticated']){await fixture.pg.exec('SET ROLE '+role);try{await expect(request()).rejects.toThrow('permission denied');await expect(approve()).rejects.toThrow('permission denied');await expect(fixture.pg.query('SELECT * FROM taxguard_mfa_reset_jobs')).rejects.toThrow('permission denied');}finally{await fixture.pg.exec('RESET ROLE');}}
  await fixture.pg.exec('SET ROLE service_role');try{await request();await approve();await expect(fixture.pg.query("UPDATE taxguard_mfa_reset_jobs SET status='pending'")).rejects.toThrow('permission denied');}finally{await fixture.pg.exec('RESET ROLE');}
 });
 it.each(['revoked','expired','aal1','foreign','wrong-user','epoch'])('denies %s current maker and checker session after application authentication',async kind=>{
  const change=async(actor:string)=>{
    if(kind==='revoked')await fixture.pg.query('UPDATE taxguard_sessions SET revoked=true WHERE uid=$1',[actor]);
    if(kind==='expired')await fixture.pg.query('UPDATE taxguard_sessions SET expires_at=1 WHERE uid=$1',[actor]);
    if(kind==='aal1')await fixture.pg.query("UPDATE taxguard_sessions SET aal='aal1' WHERE uid=$1",[actor]);
    if(kind==='foreign')await fixture.pg.query("UPDATE taxguard_sessions SET tenant_id='tenantB' WHERE uid=$1",[actor]);
    if(kind==='wrong-user')await fixture.pg.query("UPDATE taxguard_sessions SET uid='recovery-other' WHERE uid=$1",[actor]);
    if(kind==='epoch')await fixture.pg.query('UPDATE taxguard_members SET status_changed_at=clock_timestamp() WHERE uid=$1',[actor]);
  };
  await change('recovery-maker');await expect(request()).rejects.toThrow(kind==='epoch'?'STAFF_FRESH_SIGN_IN_REQUIRED':'STAFF_ADMIN_REQUIRED');expect((await state()).requests).toEqual([]);
  await fixture.pg.exec("UPDATE taxguard_members SET status_changed_at=null WHERE uid='recovery-maker'; DELETE FROM taxguard_sessions WHERE session_token_hash=repeat('d',64); INSERT INTO taxguard_sessions(tenant_id,uid,session_token_hash,auth_time,expires_at,aal) VALUES('tenantA','recovery-maker',repeat('d',64),floor(extract(epoch FROM now()))::bigint,(floor(extract(epoch FROM now())*1000)::bigint+3600000),'aal2');");
  await request();const before=await state();await change('recovery-checker');await expect(approve()).rejects.toThrow(kind==='epoch'?'STAFF_FRESH_SIGN_IN_REQUIRED':'STAFF_ADMIN_REQUIRED');expect(await state()).toEqual(before);
 });
 it('rejects absent/malformed actor hashes without storing session hashes in recovery history',async()=>{
  await expect(request({sessionHash:'bad'})).rejects.toThrow('MFA_RECOVERY_INPUT_INVALID');await request();await expect(approve('recovery-checker','tenantA',id,'')).rejects.toThrow('MFA_RECOVERY_INPUT_INVALID');await approve();
  const s=await state();expect(JSON.stringify([s.requests,s.jobs,s.audits])).not.toContain('d'.repeat(64));expect(JSON.stringify([s.requests,s.jobs,s.audits])).not.toContain('e'.repeat(64));
 });
 it('documents target-before-identity-session lock order and member NOWAIT rather than claiming real contention tests',()=>{
  const body=migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.taxguard_approve'));
  expect(body.indexOf('INTO m FROM')).toBeLessThan(body.indexOf('user_data INTO i'));expect(body.indexOf('user_data INTO i')).toBeLessThan(body.indexOf('UPDATE public.taxguard_sessions'));
  expect(body).toContain('FOR UPDATE NOWAIT');expect(body).toContain('FOR SHARE NOWAIT');expect(migration).toContain('Real PostgreSQL overlapping transactions');
 });
});

it.each([0,9007199254740991])('rejects malformed administrator primary time %s without recovery writes',async stamp=>{
  await fixture.pg.query("UPDATE taxguard_sessions SET auth_time=$1 WHERE uid='recovery-maker'",[stamp]);await expect(request()).rejects.toThrow('STAFF_FRESH_SIGN_IN_REQUIRED');expect((await state()).requests).toEqual([]);
});
it('rejects malformed checker primary proof before suspension or reset outbox',async()=>{
  await request();const before=await state();await fixture.pg.exec("UPDATE taxguard_sessions SET auth_time=0 WHERE uid='recovery-checker'");await expect(approve()).rejects.toThrow('STAFF_FRESH_SIGN_IN_REQUIRED');expect(await state()).toEqual(before);
});

it.each(['recovery-maker','recovery-checker'])('requires the current actor identity mapping %s as well as session/member proof',async uid=>{
  if(uid==='recovery-checker') await request();const before=await state();await fixture.pg.query('DELETE FROM taxguard_identities WHERE uid=$1',[uid]);
  await expect(uid==='recovery-maker'?request():approve()).rejects.toThrow('STAFF_ADMIN_REQUIRED');expect(await state()).toEqual(before);
});
