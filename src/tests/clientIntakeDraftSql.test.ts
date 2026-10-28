import { readFileSync, readdirSync } from 'node:fs';
import { afterAll,beforeAll,beforeEach,describe,expect,it } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
const payload={clientCategory:'individual_taxpayer',preferredContactMethod:'portal',phone:'555-0100',selectedServices:['tax_preparation'],intakeNotes:'Synthetic intake only'};
const save=async(body:any=payload,revision=0,key='request-save-0001',actor='intake-owner',tenant='tenantA',client='001',engagement='intake-engagement',year=2025,schema=1)=>
  (await fixture.pg.query<{result:any}>('SELECT taxguard_save_client_intake($1,$2,$3,$4,$5,$6,$7,$8,$9) AS result',[tenant,actor,client,engagement,year,schema,revision,key,body])).rows[0].result;
const submit=async(revision=1,key='request-submit-001',actor='intake-owner',tenant='tenantA',client='001',engagement='intake-engagement',year=2025)=>
  (await fixture.pg.query<{result:any}>('SELECT taxguard_submit_client_intake($1,$2,$3,$4,$5,$6,$7) AS result',[tenant,actor,client,engagement,year,revision,key])).rows[0].result;
const get=async(actor='intake-owner',tenant='tenantA',client='001',engagement='intake-engagement',year=2025)=>
  (await fixture.pg.query<{result:any}>('SELECT taxguard_get_client_intake($1,$2,$3,$4,$5) AS result',[tenant,actor,client,engagement,year])).rows[0].result;
const audits=async()=> (await fixture.pg.query("SELECT action,metadata FROM taxguard_audit_log WHERE action LIKE 'CLIENT_INTAKE_%'")).rows;
beforeAll(async()=> {
  fixture=await capabilityFixture();
  for(const name of readdirSync('docs/proposed-migrations').filter(n=>/^202610120[0-7]0000_/.test(n)).sort()) await fixture.pg.exec(readFileSync('docs/proposed-migrations/'+name,'utf8'));
},30000);
afterAll(async()=>{await fixture?.pg.close();});
beforeEach(async()=> {
  await fixture.pg.exec(`
    DELETE FROM taxguard_client_intake_requests; DELETE FROM taxguard_client_intake_drafts;
    DELETE FROM taxguard_tax_years WHERE engagement_id LIKE 'intake-%';
    DELETE FROM taxguard_engagements WHERE engagement_id LIKE 'intake-%';
    DELETE FROM taxguard_identities WHERE uid LIKE 'intake-%';
    DELETE FROM taxguard_clients WHERE owner_uid LIKE 'intake-%' OR client_id IN ('001','002');
    DELETE FROM taxguard_members WHERE uid LIKE 'intake-%';
    DELETE FROM taxguard_audit_log WHERE action LIKE 'CLIENT_INTAKE_%';
    UPDATE taxguard_tenants SET status='active';
    INSERT INTO taxguard_client_id_sequence(id,current_sequence) VALUES('primary',0) ON CONFLICT(id) DO UPDATE SET current_sequence=0;
    SELECT taxguard_provision_client_identity('tenantA','intake-owner','intake-owner@example.test','Synthetic Client');
    SELECT taxguard_provision_client_identity('tenantB','intake-other','intake-other@example.test','Other Client');
    INSERT INTO taxguard_engagements(tenant_id,client_id,engagement_id,status) VALUES('tenantA','001','intake-engagement','active'),('tenantB','002','intake-foreign','active');
    INSERT INTO taxguard_tax_years(tenant_id,client_id,engagement_id,tax_year,status) VALUES('tenantA','001','intake-engagement',2025,'active'),('tenantB','002','intake-foreign',2025,'active');
  `);
});
describe('proposed durable client intake against actual schema and all identity proposals',()=> {
  it('gets null until a real scoped draft exists and saves without inventing cases or changing stages',async()=> {
    expect(await get()).toEqual({draft:null,resumed:false});
    const caseCount=(await fixture.pg.query('SELECT count(*)::int AS count FROM taxguard_cases')).rows;
    const stageCount=(await fixture.pg.query('SELECT count(*)::int AS count FROM taxguard_stage_states')).rows;
    const engagementCount=(await fixture.pg.query('SELECT count(*)::int AS count FROM taxguard_engagements')).rows;
    const first=await save();
    expect(first).toMatchObject({resumed:false,draft:{tenantId:'tenantA',clientId:'001',engagementId:'intake-engagement',taxYear:2025,ownerUid:'intake-owner',schemaVersion:1,revision:1,status:'DRAFT',payload,submittedAt:null}});
    expect(await get()).toEqual(first);
    expect(Number.isFinite(Date.parse(first.draft.createdAt))).toBe(true);
    expect((await fixture.pg.query('SELECT count(*)::int AS count FROM taxguard_cases')).rows).toEqual(caseCount);
    expect((await fixture.pg.query('SELECT count(*)::int AS count FROM taxguard_stage_states')).rows).toEqual(stageCount);
    expect((await fixture.pg.query('SELECT count(*)::int AS count FROM taxguard_engagements')).rows).toEqual(engagementCount);
    expect((await fixture.pg.query("SELECT user_data->>'onboardingStatus' AS status FROM taxguard_identities WHERE uid='intake-owner'")).rows).toEqual([{status:'NOT_STARTED'}]);
    expect(await audits()).toEqual([{action:'CLIENT_INTAKE_SAVED',metadata:{clientId:'001',engagementId:'intake-engagement',taxYear:2025,revision:1}}]);
  });
  it('uses expected revisions, immutable scope and a closed submitted state',async()=> {
    await save();
    await expect(save({...payload,intakeNotes:'Stale'},0,'request-stale-001')).rejects.toThrow('CLIENT_INTAKE_REVISION_CONFLICT');
    const second=await save({...payload,intakeNotes:'Updated'},1,'request-save-0002');expect(second.draft.revision).toBe(2);
    await expect(submit()).rejects.toThrow('CLIENT_INTAKE_REVISION_CONFLICT');
    const submitted=await submit(2);
    expect(submitted.draft).toMatchObject({status:'SUBMITTED',revision:3,payload:{...payload,intakeNotes:'Updated'}});
    expect(Number.isFinite(Date.parse(submitted.draft.submittedAt))).toBe(true);
    await expect(save(payload,3,'request-after-001')).rejects.toThrow('CLIENT_INTAKE_SUBMITTED');
    await expect(submit(3,'request-resubmit1')).rejects.toThrow('CLIENT_INTAKE_SUBMITTED');
    expect((await get()).draft).toEqual(submitted.draft);
  });
  it('replays identical requests including after submission without new revision or audit',async()=> {
    const first=await save();
    expect(await save()).toEqual({...first,resumed:true});
    const submitted=await submit();
    expect(await submit()).toEqual({...submitted,resumed:true});
    expect(await save()).toEqual({...first,resumed:true});
    expect((await get()).draft.revision).toBe(2);expect(await audits()).toHaveLength(2);
  });
  it('rejects idempotency-key reuse with changed input/action even when revision is stale',async()=> {
    await save();
    await expect(save({...payload,phone:'Changed'},0)).rejects.toThrow('CLIENT_INTAKE_IDEMPOTENCY_CONFLICT');
    await expect(save(payload,1)).rejects.toThrow('CLIENT_INTAKE_IDEMPOTENCY_CONFLICT');
    await expect(submit(1,'request-save-0001')).rejects.toThrow('CLIENT_INTAKE_IDEMPOTENCY_CONFLICT');
    expect((await get()).draft.revision).toBe(1);expect(await audits()).toHaveLength(1);
  });
  it.each([{}, {phone:'555'}, {...payload,phone:'   '}, {...payload,selectedServices:[]}])('saves partial payload but refuses incomplete submission %#',async body=> {
    await save(body);await expect(submit()).rejects.toThrow('CLIENT_INTAKE_INCOMPLETE');
    expect((await get()).draft).toMatchObject({revision:1,status:'DRAFT'});
  });
  it('refuses submission before any draft and nonzero creation revision',async()=> {
    await expect(submit(0)).rejects.toThrow('CLIENT_INTAKE_INCOMPLETE');
    await expect(save(payload,1)).rejects.toThrow('CLIENT_INTAKE_REVISION_CONFLICT');
  });
  it.each([
    null,[],true,{role:'admin'},{status:'COMPLETED'},{ownerUid:'other'},{taxYear:2026},
    {clientCategory:'prospective_client'},{clientCategory:null},{preferredContactMethod:'fax'},
    {phone:'x'.repeat(33)},{phone:123},{intakeNotes:'x'.repeat(2001)},{intakeNotes:'line\nbreak'},
    {selectedServices:'tax_preparation'},{selectedServices:[1]},{selectedServices:['UPPER']},
    {selectedServices:['duplicate','duplicate']},{selectedServices:['x'.repeat(65)]},
    {selectedServices:Array.from({length:21},(_,i)=>'service_'+i)}
  ])('rejects unknown authority fields and malformed/bounded payload %#',async body=> {
    await expect(save(body)).rejects.toThrow('CLIENT_INTAKE_INPUT_INVALID');expect((await get()).draft).toBeNull();
  });
  it('accepts exact payload field bounds and rejects oversized total JSON',async()=> {
    const bounded={phone:'x'.repeat(32),intakeNotes:'x'.repeat(2000),selectedServices:Array.from({length:20},(_,n)=>('s'+n).padEnd(64,'x'))};
    expect((await save(bounded)).draft.payload).toEqual(bounded);
    await expect(save({intakeNotes:'😀'.repeat(5000)},1,'request-bigjson1')).rejects.toThrow('CLIENT_INTAKE_INPUT_INVALID');
  });
  it.each([['schema',2],['revision',-1],['revision',2147483647],['key','short'],['key','bad key with spaces']])('validates %s %s',async(kind,value)=> {
    await expect(save(payload,kind==='revision'?value as number:0,kind==='key'?value as string:'request-save-0001','intake-owner','tenantA','001','intake-engagement',2025,kind==='schema'?value as number:1)).rejects.toThrow('CLIENT_INTAKE_INPUT_INVALID');
  });
  it.each(['member-role','member-status','member-client','identity-role','identity-tenant','identity-client','identity-verification','owner','client-status','client-email','tenant-status'])('rechecks strict durable ownership before get/save/submit or replay: %s',async defect=> {
    await save();
    const changes:Record<string,string>={
      'member-role':"UPDATE taxguard_members SET role='accountant' WHERE uid='intake-owner'",
      'member-status':"UPDATE taxguard_members SET status='suspended' WHERE uid='intake-owner'",
      'member-client':"UPDATE taxguard_members SET client_id='002' WHERE uid='intake-owner'",
      'identity-role':`UPDATE taxguard_identities SET user_data=jsonb_set(user_data,'{role}','"admin"') WHERE uid='intake-owner'`,
      'identity-tenant':"UPDATE taxguard_identities SET tenant_id='tenantB' WHERE uid='intake-owner'",
      'identity-client':`UPDATE taxguard_identities SET user_data=jsonb_set(user_data,'{clientId}','"002"') WHERE uid='intake-owner'`,
      'identity-verification':`UPDATE taxguard_identities SET user_data=jsonb_set(user_data,'{isVerified}','false') WHERE uid='intake-owner'`,
      'owner':"UPDATE taxguard_clients SET owner_uid='changed-owner' WHERE tenant_id='tenantA' AND client_id='001'",
      'client-status':"UPDATE taxguard_clients SET status='disabled' WHERE tenant_id='tenantA' AND client_id='001'",
      'client-email':"UPDATE taxguard_clients SET email='different@example.test' WHERE tenant_id='tenantA' AND client_id='001'",
      'tenant-status':"UPDATE taxguard_tenants SET status='disabled' WHERE id='tenantA'"
    };
    await fixture.pg.exec(changes[defect]);
    for(const operation of [()=>get(),()=>save(),()=>submit()]) await expect(operation()).rejects.toThrow('CLIENT_INTAKE_ACCESS_DENIED');
  });
  it('denies other owners and tenants without revealing whether drafts exist',async()=> {
    await save();
    await expect(get('intake-other')).rejects.toThrow('CLIENT_INTAKE_ACCESS_DENIED');
    await expect(save(payload,0,'request-cross001','intake-other')).rejects.toThrow('CLIENT_INTAKE_ACCESS_DENIED');
    await expect(get('intake-owner','tenantB','002','intake-foreign')).rejects.toThrow('CLIENT_INTAKE_ACCESS_DENIED');
    expect(await get('intake-other','tenantB','002','intake-foreign')).toEqual({draft:null,resumed:false});
  });
  it('requires existing active engagement and matching active tax year',async()=> {
    await expect(save(payload,0,'request-noeng01','intake-owner','tenantA','001','missing')).rejects.toThrow('CLIENT_INTAKE_SCOPE_UNAVAILABLE');
    await expect(save(payload,0,'request-noyear1','intake-owner','tenantA','001','intake-engagement',2026)).rejects.toThrow('CLIENT_INTAKE_SCOPE_UNAVAILABLE');
    await fixture.pg.exec("UPDATE taxguard_engagements SET status='inactive' WHERE engagement_id='intake-engagement'");
    await expect(get()).rejects.toThrow('CLIENT_INTAKE_SCOPE_UNAVAILABLE');
    await fixture.pg.exec("UPDATE taxguard_engagements SET status='active' WHERE engagement_id='intake-engagement'; UPDATE taxguard_tax_years SET status='closed' WHERE engagement_id='intake-engagement'");
    await expect(save()).rejects.toThrow('CLIENT_INTAKE_SCOPE_UNAVAILABLE');
  });
  it.each(['save','submit'])('rolls back %s, request ledger and audit together when audit fails',async operation=> {
    if(operation==='submit') await save();
    const before=await get();const auditBefore=await audits();
    await fixture.pg.exec("CREATE FUNCTION intake_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action LIKE 'CLIENT_INTAKE_%' THEN RAISE EXCEPTION 'SYNTHETIC_AUDIT_FAILURE'; END IF; RETURN NEW; END $$; CREATE TRIGGER intake_reject_audit BEFORE INSERT ON taxguard_audit_log FOR EACH ROW EXECUTE FUNCTION intake_reject_audit();");
    try {await expect(operation==='save'?save():submit()).rejects.toThrow('SYNTHETIC_AUDIT_FAILURE');}
    finally {await fixture.pg.exec('DROP TRIGGER intake_reject_audit ON taxguard_audit_log; DROP FUNCTION intake_reject_audit();');}
    expect(await get()).toEqual(before);expect(await audits()).toEqual(auditBefore);
    expect((await fixture.pg.query('SELECT request_id FROM taxguard_client_intake_requests')).rows).toHaveLength(operation==='save'?0:1);
    expect((await (operation==='save'?save():submit())).resumed).toBe(false);
  });
  it('rolls back draft and audit if request persistence fails',async()=> {
    await fixture.pg.exec("CREATE FUNCTION intake_reject_request() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_REQUEST_FAILURE'; END $$; CREATE TRIGGER intake_reject_request BEFORE INSERT ON taxguard_client_intake_requests FOR EACH ROW EXECUTE FUNCTION intake_reject_request();");
    try {await expect(save()).rejects.toThrow('SYNTHETIC_REQUEST_FAILURE');}
    finally {await fixture.pg.exec('DROP TRIGGER intake_reject_request ON taxguard_client_intake_requests; DROP FUNCTION intake_reject_request();');}
    expect(await get()).toEqual({draft:null,resumed:false});expect(await audits()).toEqual([]);
  });
  it('denies browser table/RPC access and service-role invocation of the internal dispatcher',async()=> {
    for(const role of ['anon','authenticated']) {
      await fixture.pg.exec('SET ROLE '+role);
      try {
        await expect(get()).rejects.toThrow('permission denied');await expect(save()).rejects.toThrow('permission denied');await expect(submit()).rejects.toThrow('permission denied');
        for(const table of ['taxguard_client_intake_drafts','taxguard_client_intake_requests']) await expect(fixture.pg.query('SELECT * FROM '+table)).rejects.toThrow('permission denied');
      } finally {await fixture.pg.exec('RESET ROLE');}
    }
    await fixture.pg.exec('SET ROLE service_role');
    try {
      expect((await save()).draft.revision).toBe(1);
      expect((await submit()).draft.status).toBe('SUBMITTED');
      await expect(fixture.pg.query("SELECT taxguard_client_intake_operation('GET','tenantA','intake-owner','001','intake-engagement',2025,NULL,NULL,NULL,NULL)")).rejects.toThrow('permission denied');
    } finally {await fixture.pg.exec('RESET ROLE');}
  });
});
