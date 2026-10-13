import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
const migration = readFileSync('docs/proposed-migrations/20261012060000_taxguard_atomic_client_identity.sql','utf8');
const provision = async (uid='atomic-client',email=uid+'@example.test',tenant='tenantA',name='Synthetic Client') =>
  (await fixture.pg.query<{result:any}>('SELECT taxguard_provision_client_identity($1,$2,$3,$4) AS result',[tenant,uid,email,name])).rows[0].result;
const counter = async () => (await fixture.pg.query<{current_sequence:number}>("SELECT current_sequence FROM taxguard_client_id_sequence WHERE id='primary'")).rows[0].current_sequence;
// Independent reference: enumerate the numeric namespace, then prefix-width blocks.
function reference(sequence: number): string {
  if(sequence<=999999999) return String(sequence).padStart(3,'0');
  let offset=sequence-1000000000;
  for(let width=1;width<=9;width++) {
    const digits=9-width, suffixes=10**digits, capacity=26**width*suffixes;
    if(offset>=capacity) {offset-=capacity;continue;}
    let prefix=Math.floor(offset/suffixes), letters='';
    for(let p=0;p<width;p++) {letters=String.fromCharCode(65+prefix%26)+letters;prefix=Math.floor(prefix/26);}
    return letters+(digits?String(offset%suffixes).padStart(digits,'0'):'');
  }
  throw new Error('exhausted');
}
const namespaceSize=999999999+Array.from({length:9},(_,i)=>26**(i+1)*10**(8-i)).reduce((a,b)=>a+b,0);
beforeAll(async()=> {
  fixture=await capabilityFixture();
  for(const name of readdirSync('docs/proposed-migrations').filter(n=>/^202610120[0-6]0000_/.test(n)).sort()) await fixture.pg.exec(readFileSync('docs/proposed-migrations/'+name,'utf8'));
},30000);
afterAll(async()=>{await fixture?.pg.close();});
beforeEach(async()=> {
  await fixture.pg.exec(`
    DELETE FROM taxguard_staff_invitations;
    DELETE FROM taxguard_identities WHERE uid LIKE 'atomic-%';
    DELETE FROM taxguard_members WHERE uid LIKE 'atomic-%';
    DELETE FROM taxguard_clients WHERE owner_uid LIKE 'atomic-%';
    INSERT INTO taxguard_client_id_sequence(id,current_sequence,last_issued_client_id) VALUES('primary',0,NULL)
      ON CONFLICT(id) DO UPDATE SET current_sequence=0,last_issued_client_id=NULL;
    UPDATE taxguard_tenants SET status='active';
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','atomic-admin','admin','active') ON CONFLICT(tenant_id,uid) DO NOTHING;
  `);
});
describe('atomic identity-only client provisioning proposal',()=> {
  it('creates one coherent client mapping and resumes without allocation or extra audit',async()=> {
    const first=await provision();
    expect(first).toMatchObject({clientId:'001',resumed:false,user:{id:'atomic-client',tenantId:'tenantA',role:'client',status:'active',isVerified:true,onboardingStatus:'NOT_STARTED',onboardingCompletedAt:null}});
    expect(Number.isFinite(Date.parse(first.user.createdAt))).toBe(true);
    expect(await provision()).toEqual({...first,resumed:true});
    expect(await counter()).toBe(1);
    expect((await fixture.pg.query("SELECT action FROM taxguard_audit_log WHERE action='CLIENT_IDENTITY_PROVISIONED' AND actor_uid='atomic-client'")).rows).toHaveLength(1);
    expect((await fixture.pg.query("SELECT role,status,client_id FROM taxguard_members WHERE uid='atomic-client'")).rows).toEqual([{role:'client',status:'active',client_id:'001'}]);
    expect((await fixture.pg.query("SELECT client_id FROM taxguard_clients WHERE owner_uid='atomic-client'")).rows).toEqual([{client_id:'001'}]);
    expect((await fixture.pg.query("SELECT id FROM taxguard_cases WHERE client_uid='atomic-client'")).rows).toEqual([]);
    expect((await provision('atomic-other')).clientId).toBe('002');
  });
  it('replay preserves onboarding progression and excludes private identity metadata',async()=> {
    await provision();
    await fixture.pg.exec(`UPDATE taxguard_identities SET user_data=user_data||'{"onboardingStatus":"COMPLETED","onboardingCompletedAt":"2026-10-01T00:00:00Z","password":"PRIVATE"}'::jsonb WHERE uid='atomic-client'`);
    const replay=await provision();
    expect(replay.user).toMatchObject({onboardingStatus:'COMPLETED',onboardingCompletedAt:'2026-10-01T00:00:00Z'});
    expect(JSON.stringify(replay)).not.toContain('PRIVATE');
  });
  it.each(['unknown', '', 'missing'])('denies unsupported persisted onboarding state %s',async state=> {
    await provision();
    await fixture.pg.query("UPDATE taxguard_identities SET user_data=CASE WHEN $1='missing' THEN user_data-'onboardingStatus' ELSE jsonb_set(user_data,'{onboardingStatus}',to_jsonb($1::text)) END WHERE uid='atomic-client'",[state]);
    await expect(provision()).rejects.toThrow('CLIENT_IDENTITY_CONFLICT');
    expect(await counter()).toBe(1);
  });
  it.each(['bad','2026-02-30T00:00:00Z'])('denies malformed stored completion time %s',async value=> {
    await provision();
    await fixture.pg.query("UPDATE taxguard_identities SET user_data=jsonb_set(user_data,'{onboardingCompletedAt}',to_jsonb($1::text)) WHERE uid='atomic-client'",[value]);
    await expect(provision()).rejects.toThrow('CLIENT_IDENTITY_CONFLICT');
  });
  it('uses persisted creation timestamp and existing name on replay',async()=> {
    const first=await provision();
    await fixture.pg.exec(`UPDATE taxguard_identities SET user_data=user_data||'{"createdAt":"invalid private override"}'::jsonb WHERE uid='atomic-client'`);
    const replay=await provision('atomic-client','atomic-client@example.test','tenantA','Changed provider name');
    expect(replay.user.createdAt).toBe(first.user.createdAt);
    expect(replay.user.name).toBe('Synthetic Client');
  });
  it('matches independent numeric and every alphabetic block boundary',async()=> {
    const values=[1,999,1000,999999999,1000000000];
    let base=1000000000;
    for(let width=1;width<=9;width++) {values.push(base,base+26**width*10**(9-width)-1);base+=26**width*10**(9-width);}
    for(const [index,value] of [...new Set(values)].entries()) {
      await fixture.pg.query("UPDATE taxguard_client_id_sequence SET current_sequence=$1 WHERE id='primary'",[value-1]);
      expect((await provision('atomic-boundary-'+index)).clientId).toBe(reference(value));
    }
  });
  it.each(['pending','accepted','revoked'])('refuses any same-tenant invitation history: %s',async status=> {
    await fixture.pg.query("INSERT INTO taxguard_staff_invitations(id,tenant_id,email,role,legal_first_name,legal_last_name,token_hash,status,expires_at,invited_by) VALUES('atomic-invite','tenantA','atomic-client@example.test','accountant','Synthetic','Staff',repeat('a',64),$1,now()+interval '1 day','atomic-admin')",[status]);
    await expect(provision()).rejects.toThrow('CLIENT_INVITATION_EXISTS');expect(await counter()).toBe(0);
  });
  it('allows different-tenant invitation history without importing its staff mapping',async()=> {
    await fixture.pg.exec("INSERT INTO taxguard_staff_invitations(id,tenant_id,email,role,legal_first_name,legal_last_name,token_hash,expires_at,invited_by) VALUES('atomic-invite','tenantB','atomic-client@example.test','accountant','Synthetic','Staff',repeat('a',64),now()+interval '1 day','foreign')");
    expect((await provision()).clientId).toBe('001');
  });
  it.each(['identity','member','client'])('refuses partial %s mapping',async kind=> {
    if(kind==='identity') await fixture.pg.exec(`INSERT INTO taxguard_identities(uid,tenant_id,user_data) VALUES('atomic-client','tenantA','{"id":"atomic-client"}')`);
    if(kind==='member') await fixture.pg.exec("INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantA','atomic-client','client','active')");
    if(kind==='client') await fixture.pg.exec("INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid) VALUES('tenantA','777','atomic-client')");
    await expect(provision()).rejects.toThrow('CLIENT_IDENTITY_CONFLICT');expect(await counter()).toBe(0);
  });
  it.each(['tenant','staff','member-id','identity-id','status','email'])('refuses existing inconsistent %s mapping without repair',async kind=> {
    await provision();
    if(kind==='tenant') await fixture.pg.exec("UPDATE taxguard_identities SET tenant_id='tenantB' WHERE uid='atomic-client'");
    if(kind==='staff') await fixture.pg.exec("UPDATE taxguard_members SET role='accountant' WHERE uid='atomic-client'");
    if(kind==='member-id') await fixture.pg.exec("UPDATE taxguard_members SET client_id='wrong' WHERE uid='atomic-client'");
    if(kind==='identity-id') await fixture.pg.exec(`UPDATE taxguard_identities SET user_data=jsonb_set(user_data,'{id}','"wrong"') WHERE uid='atomic-client'`);
    if(kind==='status') await fixture.pg.exec("UPDATE taxguard_clients SET status='disabled' WHERE owner_uid='atomic-client'");
    if(kind==='email') await fixture.pg.exec("UPDATE taxguard_clients SET email='wrong@example.test' WHERE owner_uid='atomic-client'");
    await expect(provision()).rejects.toThrow('CLIENT_IDENTITY_CONFLICT');expect(await counter()).toBe(1);
  });
  it('rejects same email with another UID and same UID with another tenant',async()=> {
    await provision();
    await expect(provision('atomic-other','atomic-client@example.test')).rejects.toThrow('CLIENT_IDENTITY_CONFLICT');
    await expect(provision('atomic-client','atomic-client@example.test','tenantB')).rejects.toThrow('CLIENT_IDENTITY_CONFLICT');
    expect(await counter()).toBe(1);
  });
  it('rolls back all mapping rows and counter increment on audit failure',async()=> {
    await fixture.pg.exec("CREATE FUNCTION atomic_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_AUDIT_FAILURE'; END $$; CREATE TRIGGER atomic_reject_audit BEFORE INSERT ON taxguard_audit_log FOR EACH ROW EXECUTE FUNCTION atomic_reject_audit();");
    try {await expect(provision()).rejects.toThrow('SYNTHETIC_AUDIT_FAILURE');expect(await counter()).toBe(0);}
    finally {await fixture.pg.exec('DROP TRIGGER atomic_reject_audit ON taxguard_audit_log; DROP FUNCTION atomic_reject_audit();');}
    for(const table of ['taxguard_identities','taxguard_members']) expect((await fixture.pg.query('SELECT uid FROM '+table+" WHERE uid='atomic-client'")).rows).toEqual([]);
    expect((await fixture.pg.query("SELECT owner_uid FROM taxguard_clients WHERE owner_uid='atomic-client'")).rows).toEqual([]);
    expect((await provision()).clientId).toBe('001');
  });
  it('rejects a missing counter without guessing a bootstrap value',async()=> {
    await fixture.pg.exec("DELETE FROM taxguard_client_id_sequence WHERE id='primary'");
    await expect(provision()).rejects.toThrow('CLIENT_COUNTER_CORRUPT');
    expect((await fixture.pg.query("SELECT id FROM taxguard_client_id_sequence WHERE id='primary'")).rows).toEqual([]);
  });
  it('takes the member lock before identity to match activation and lifecycle',()=> {
    // This checks the documented acquisition protocol, not actual multi-session contention.
    const body=migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.taxguard_provision_client_identity'),migration.indexOf('-- Replacements preserve invitation'));
    expect(body.indexOf('INTO member_row')).toBeLessThan(body.indexOf('INTO identity_row'));
    expect(body.indexOf("hashtext('taxguard:identity-email:'")).toBeLessThan(body.indexOf('hashtext(p_uid)'));
    expect(body.indexOf('hashtext(p_uid)')).toBeLessThan(body.indexOf('INTO member_row'));
  });
  it('refuses corrupt, exhausted and colliding counters without gaps',async()=> {
    await fixture.pg.exec("UPDATE taxguard_client_id_sequence SET current_sequence=-1 WHERE id='primary'");
    await expect(provision()).rejects.toThrow('CLIENT_COUNTER_CORRUPT');expect(await counter()).toBe(-1);
    await fixture.pg.query("UPDATE taxguard_client_id_sequence SET current_sequence=$1 WHERE id='primary'",[namespaceSize]);
    await expect(provision()).rejects.toThrow('CLIENT_ID_NAMESPACE_EXHAUSTED');expect(await counter()).toBe(namespaceSize);
    await fixture.pg.exec("UPDATE taxguard_client_id_sequence SET current_sequence=0 WHERE id='primary'; INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid) VALUES('tenantB','001','atomic-collision')");
    await expect(provision()).rejects.toThrow('CLIENT_ID_COLLISION');expect(await counter()).toBe(0);
  });
  it('fails duplicate-owner preflight without changing legacy rows',async()=> {
    await fixture.pg.exec("DROP INDEX uq_taxguard_clients_tenant_owner; INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid) VALUES('tenantA','atomic-dupe1','atomic-duplicate'),('tenantA','atomic-dupe2','atomic-duplicate')");
    try {await expect(fixture.pg.exec(migration)).rejects.toThrow('CLIENT_OWNER_DUPLICATES_EXIST');expect((await fixture.pg.query("SELECT client_id FROM taxguard_clients WHERE owner_uid='atomic-duplicate'")).rows).toHaveLength(2);}
    finally {await fixture.pg.exec("DELETE FROM taxguard_clients WHERE owner_uid='atomic-duplicate'; CREATE UNIQUE INDEX uq_taxguard_clients_tenant_owner ON taxguard_clients(tenant_id,owner_uid)");}
  });
  it('requires an active existing tenant and normalized safe inputs',async()=> {
    for(const args of [['atomic-client','UPPER@example.test','tenantA','Synthetic'],['atomic-client','bad','tenantA','Synthetic'],['','a@example.test','tenantA','Synthetic'],['atomic-client','a@example.test','missing','Synthetic'],['atomic-client','a@example.test','tenantA','line\nbreak']]) await expect(provision(...args as [string,string,string,string])).rejects.toThrow('CLIENT_IDENTITY_INPUT_INVALID');
    await fixture.pg.exec("UPDATE taxguard_tenants SET status='disabled' WHERE id='tenantA'");await expect(provision()).rejects.toThrow('CLIENT_IDENTITY_INPUT_INVALID');
  });
  it('denies browser execution but allows service-only provisioning',async()=> {
    for(const role of ['anon','authenticated']) {await fixture.pg.exec('SET ROLE '+role);try {await expect(provision()).rejects.toThrow('permission denied');}finally {await fixture.pg.exec('RESET ROLE');}}
    await fixture.pg.exec('SET ROLE service_role');try {expect((await provision()).clientId).toBe('001');}finally {await fixture.pg.exec('RESET ROLE');}
  });
  it('prevents invitation issuance and acceptance reusing a provisioned client email',async()=> {
    await provision();
    await expect(fixture.pg.query("SELECT taxguard_create_staff_invitation('tenantA','atomic-admin','atomic-conflict','atomic-client@example.test','accountant','Synthetic','Staff',repeat('b',64))")).rejects.toThrow('IDENTITY_ALREADY_PROVISIONED');
    await fixture.pg.exec("INSERT INTO taxguard_staff_invitations(id,tenant_id,email,role,legal_first_name,legal_last_name,token_hash,expires_at,invited_by) VALUES('atomic-race','tenantA','atomic-client@example.test','accountant','Synthetic','Staff',repeat('c',64),now()+interval '1 day','atomic-admin')");
    await expect(fixture.pg.query("SELECT taxguard_accept_staff_invitation('tenantA',repeat('c',64),'atomic-staff','atomic-client@example.test')")).rejects.toThrow('IDENTITY_ALREADY_PROVISIONED');
    expect((await fixture.pg.query("SELECT status FROM taxguard_staff_invitations WHERE id='atomic-race'")).rows).toEqual([{status:'pending'}]);
    expect(await counter()).toBe(1);
  });
  it('retains invitation issuance rate limit and audit after replacement',async()=> {
    for(let n=0;n<10;n++) await fixture.pg.query("SELECT taxguard_create_staff_invitation('tenantA','atomic-admin',$1,$2,'accountant','Synthetic','Staff',$3)",['atomic-invite-'+n,'atomic-staff-'+n+'@example.test',(n+1).toString(16).repeat(64)]);
    await expect(fixture.pg.query("SELECT taxguard_create_staff_invitation('tenantA','atomic-admin','atomic-limited','atomic-limited@example.test','accountant','Synthetic','Staff',repeat('f',64))")).rejects.toThrow('INVITATION_RATE_LIMITED');
    expect((await fixture.pg.query("SELECT id FROM taxguard_staff_invitations WHERE id='atomic-limited'")).rows).toEqual([]);
    expect((await fixture.pg.query("SELECT action FROM taxguard_audit_log WHERE actor_uid='atomic-admin' AND action='STAFF_INVITATION_CREATED'")).rows).toHaveLength(10);
  });
  it('preserves invitation acceptance and independent activation after shared locking',async()=> {
    await fixture.pg.query("SELECT taxguard_create_staff_invitation('tenantA','atomic-admin','atomic-invite','atomic-staff@example.test','accountant','Synthetic','Staff',repeat('a',64))");
    await fixture.pg.query("SELECT taxguard_accept_staff_invitation('tenantA',repeat('a',64),'atomic-staff','atomic-staff@example.test')");
    await expect(fixture.pg.query("SELECT taxguard_approve_staff_activation('tenantA','atomic-admin','atomic-staff')")).rejects.toThrow('INDEPENDENT_APPROVER_REQUIRED');
    await expect(provision('atomic-staff')).rejects.toThrow('CLIENT_IDENTITY_CONFLICT');
  });
});

it('preserves saved contacts on coherent identity replay without allocating again',async()=>{
  const created=await provision();const before=await counter();
  await fixture.pg.exec("UPDATE taxguard_identities SET user_data=user_data||'{\"phone\":\"555-0100\",\"companyName\":\"Synthetic Company\"}'::jsonb WHERE uid='atomic-client'; UPDATE taxguard_clients SET phone='555-0100' WHERE owner_uid='atomic-client'");
  expect((await provision()).user).toMatchObject({phone:'555-0100',companyName:'Synthetic Company'});expect(await counter()).toBe(before);expect((await provision()).clientId).toBe(created.clientId);
  await fixture.pg.exec("UPDATE taxguard_clients SET phone='different' WHERE owner_uid='atomic-client'");await expect(provision()).rejects.toThrow('CLIENT_IDENTITY_CONFLICT');
});
