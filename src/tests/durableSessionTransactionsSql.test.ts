import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
const migration=readFileSync('docs/proposed-migrations/20261012080000_taxguard_session_transactions.sql','utf8');
const hash='8'.repeat(64);
const create=async (patch:Partial<{tenant:string;uid:string;hash:string;auth:number;expiry:number;aal:string;factors:number}>= {})=> {
  const p={tenant:'tenantA',uid:'session-subject',hash,auth:Math.floor(Date.now()/1000)-10,expiry:Date.now()+7190000,aal:'aal2',factors:1,...patch};
  return (await fixture.pg.query<{result:any}>('SELECT taxguard_create_session($1,$2,$3,$4,$5,$6,$7) AS result',[p.tenant,p.uid,p.hash,p.auth,p.expiry,p.aal,p.factors])).rows[0].result;
};
const revoke=async(tenant='tenantA',token=hash)=>(await fixture.pg.query<{result:any}>('SELECT taxguard_revoke_session($1,$2) AS result',[tenant,token])).rows[0].result;
const audits=async()=>(await fixture.pg.query<{action:string;tenant_id:string;actor_role:string}>("SELECT action,tenant_id,actor_role FROM taxguard_audit_log WHERE actor_uid='session-subject' ORDER BY action")).rows;
const sessions=async()=>(await fixture.pg.query("SELECT revoked,tenant_id FROM taxguard_sessions WHERE uid='session-subject'")).rows;
beforeAll(async()=>{fixture=await capabilityFixture();for(const name of readdirSync('docs/proposed-migrations').filter(n=>/^202610120[0-8]0000_/.test(n)).sort()) await fixture.pg.exec(readFileSync('docs/proposed-migrations/'+name,'utf8'));},30000);
afterAll(async()=>{await fixture?.pg.close();});
beforeEach(async()=>{await fixture.pg.exec(
  "DELETE FROM taxguard_sessions WHERE uid='session-subject'; DELETE FROM taxguard_clients WHERE owner_uid='session-subject'; DELETE FROM taxguard_identities WHERE uid='session-subject'; DELETE FROM taxguard_members WHERE uid='session-subject'; DELETE FROM taxguard_audit_log WHERE actor_uid='session-subject'; UPDATE taxguard_tenants SET status='active'; INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','session-subject','accountant','active'); INSERT INTO taxguard_identities(tenant_id,uid,user_data) VALUES('tenantA','session-subject','{\"id\":\"session-subject\",\"tenantId\":\"tenantA\",\"role\":\"accountant\",\"status\":\"active\"}');"
);});
describe('durable session transactions proposal composed with actual core and proposals 000–007',()=>{
  it('creates and audits atomically using the persisted role and expires in milliseconds',async()=>{
    expect(await create()).toEqual({created:true});expect(await sessions()).toEqual([{revoked:false,tenant_id:'tenantA'}]);
    expect(await audits()).toEqual([{action:'SESSION_CREATED',tenant_id:'tenantA',actor_role:'accountant'}]);
  });
  it.each(['tenant','member','identity','id','tenantId','role','status'])('denies changed %s authority before creation',async kind=>{
    if(kind==='tenant') await fixture.pg.exec("UPDATE taxguard_tenants SET status='disabled' WHERE id='tenantA'");
    else if(kind==='member') await fixture.pg.exec("UPDATE taxguard_members SET status='suspended' WHERE uid='session-subject'");
    else if(kind==='identity') await fixture.pg.exec("DELETE FROM taxguard_identities WHERE uid='session-subject'");
    else await fixture.pg.query("UPDATE taxguard_identities SET user_data=jsonb_set(user_data,ARRAY[$1],to_jsonb('wrong'::text)) WHERE uid='session-subject'",[kind]);
    await expect(create()).rejects.toThrow('SESSION_AUTHORITY_DENIED');expect(await sessions()).toEqual([]);expect(await audits()).toEqual([]);
  });
  it('binds legacy staff JSON without tenantId to authoritative same-tenant rows',async()=>{
    await fixture.pg.exec("UPDATE taxguard_identities SET user_data=user_data-'tenantId' WHERE uid='session-subject'");
    expect(await create()).toEqual({created:true});await expect(create({tenant:'tenantB',hash:'6'.repeat(64)})).rejects.toThrow('SESSION_AUTHORITY_DENIED');
  });
  it('denies foreign tenant creation without importing authority',async()=>{await expect(create({tenant:'tenantB'})).rejects.toThrow('SESSION_AUTHORITY_DENIED');expect(await sessions()).toEqual([]);});
  it('rejects collisions without another audit or mutation',async()=>{
    await create();await expect(create()).rejects.toThrow('SESSION_TOKEN_CONFLICT');expect(await audits()).toHaveLength(1);expect(await sessions()).toHaveLength(1);
  });
  it('denies an incoherent existing client mapping',async()=>{
    await fixture.pg.exec("UPDATE taxguard_members SET role='client',client_id='missing' WHERE uid='session-subject'; UPDATE taxguard_identities SET user_data=user_data||'{\"role\":\"client\",\"clientId\":\"missing\"}'::jsonb WHERE uid='session-subject'");
    await expect(create({aal:'aal1',factors:0})).rejects.toThrow('SESSION_AUTHORITY_DENIED');expect(await sessions()).toEqual([]);
  });
  it('actual lifecycle suspension revokes sessions and blocks minting',async()=>{
    await fixture.pg.exec("INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','session-admin','admin','active') ON CONFLICT(tenant_id,uid) DO NOTHING");
    await create();await fixture.pg.query("SELECT taxguard_change_staff_membership_status('tenantA','session-admin','session-subject','suspend','Synthetic suspension')");
    expect(await sessions()).toEqual([{revoked:true,tenant_id:'tenantA'}]);await expect(create({hash:'7'.repeat(64)})).rejects.toThrow('SESSION_AUTHORITY_DENIED');
    expect(await revoke()).toEqual({revoked:false});expect(await audits()).toHaveLength(1);
  });
  it('enforces staff AAL2, verified enrollment and reenrollment gate',async()=>{
    await expect(create({aal:'aal1'})).rejects.toThrow('STAFF_MFA_REQUIRED');
    await expect(create({factors:0})).rejects.toThrow('STAFF_MFA_ENROLLMENT_REQUIRED');
    await fixture.pg.exec("UPDATE taxguard_members SET mfa_reenrollment_required=true WHERE uid='session-subject'");
    await expect(create()).rejects.toThrow('STAFF_MFA_REENROLLMENT_REQUIRED');expect(await sessions()).toEqual([]);
  });
  it.each(['client','prospective_client'])('allows existing coherent %s authority at AAL1',async role=>{
    await fixture.pg.query("UPDATE taxguard_members SET role=$1 WHERE uid='session-subject'",[role]);
    await fixture.pg.query("UPDATE taxguard_identities SET user_data=jsonb_set(user_data,'{role}',to_jsonb($1::text)) WHERE uid='session-subject'",[role]);
    if(['client','prospective_client'].includes(role)) {
      await fixture.pg.exec("INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid) VALUES('tenantA','session-client','session-subject'); UPDATE taxguard_members SET client_id='session-client' WHERE uid='session-subject'; UPDATE taxguard_identities SET user_data=jsonb_set(user_data,'{clientId}',to_jsonb('session-client'::text)) WHERE uid='session-subject'");
    }
    expect(await create({aal:'aal1',factors:0})).toEqual({created:true});
  });
  it('denies same-second staff proof and accepts a later proof after lifecycle epoch',async()=>{
    const second=Math.floor(Date.now()/1000)-20;
    await fixture.pg.query("UPDATE taxguard_members SET status_changed_at=to_timestamp($1) WHERE uid='session-subject'",[second]);
    await expect(create({auth:second})).rejects.toThrow('STAFF_FRESH_SIGN_IN_REQUIRED');
    expect(await create({auth:second+1})).toEqual({created:true});
  });
  it.each([{hash:'short'},{auth:0},{auth:Math.floor(Date.now()/1000)+120},{expiry:Date.now()-1},{expiry:Date.now()+7300000},{aal:'unknown'}])('rejects malformed/bounded input %j',async patch=>{await expect(create(patch)).rejects.toThrow('SESSION_INPUT_INVALID');expect(await sessions()).toEqual([]);});
  it('revokes exactly once, missing and foreign tokens produce no audit',async()=>{
    await create();expect(await revoke('tenantB')).toEqual({revoked:false});expect(await revoke('tenantA','9'.repeat(64))).toEqual({revoked:false});
    expect(await sessions()).toEqual([{revoked:false,tenant_id:'tenantA'}]);expect(await audits()).toHaveLength(1);
    expect(await revoke()).toEqual({revoked:true});expect(await revoke()).toEqual({revoked:false});expect(await audits()).toHaveLength(2);
  });
  it('revokes a legacy session without member authority, auditing unknown role',async()=>{
    await create();await fixture.pg.exec("DELETE FROM taxguard_members WHERE uid='session-subject'");expect(await revoke()).toEqual({revoked:true});expect((await audits()).find(x=>x.action==='SESSION_REVOKED')?.actor_role).toBe('unknown');
  });
  it('rolls back both create and revoke on audit failure',async()=>{
    await fixture.pg.exec("CREATE FUNCTION session_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SESSION_AUDIT_FAILURE'; END $$; CREATE TRIGGER session_reject_audit BEFORE INSERT ON taxguard_audit_log FOR EACH ROW EXECUTE FUNCTION session_reject_audit();");
    try{await expect(create()).rejects.toThrow('SESSION_AUDIT_FAILURE');expect(await sessions()).toEqual([]);}finally{await fixture.pg.exec('DROP TRIGGER session_reject_audit ON taxguard_audit_log;');}
    await create();await fixture.pg.exec('CREATE TRIGGER session_reject_audit BEFORE INSERT ON taxguard_audit_log FOR EACH ROW EXECUTE FUNCTION session_reject_audit();');
    try{await expect(revoke()).rejects.toThrow('SESSION_AUDIT_FAILURE');expect(await sessions()).toEqual([{revoked:false,tenant_id:'tenantA'}]);expect(await audits()).toHaveLength(1);}finally{await fixture.pg.exec('DROP TRIGGER session_reject_audit ON taxguard_audit_log; DROP FUNCTION session_reject_audit();');}
  });
  it('denies browser RPC execution and permits service RPC execution',async()=>{
    for(const role of ['anon','authenticated']){await fixture.pg.exec('SET ROLE '+role);try{await expect(create()).rejects.toThrow('permission denied');await expect(revoke()).rejects.toThrow('permission denied');}finally{await fixture.pg.exec('RESET ROLE');}}
    await fixture.pg.exec('SET ROLE service_role');try{expect(await create()).toEqual({created:true});expect(await revoke()).toEqual({revoked:true});}finally{await fixture.pg.exec('RESET ROLE');}
  });
  it('documents consistent member-before-identity-before-session locks (not multi-connection contention)',()=>{
    const body=migration.slice(0,migration.indexOf('REVOKE ALL'));expect(body.indexOf('INTO member_row')).toBeLessThan(body.indexOf('INTO identity_row'));expect(body.indexOf('INTO identity_row')).toBeLessThan(body.indexOf('INSERT INTO taxguard_sessions'));
  });
});
