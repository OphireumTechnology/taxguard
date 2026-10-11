import { afterAll, beforeAll, expect, it } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';

// Executes existing policies as a non-owner database role; not a deployed Supabase security review.
let f: Awaited<ReturnType<typeof capabilityFixture>>;
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const reviewer = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const stranger = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
beforeAll(async () => {
  f = await capabilityFixture();
  await f.pg.exec(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public,auth TO authenticated;
    GRANT SELECT ON taxguard_clients,taxguard_cases,taxguard_documents,taxguard_members,taxguard_audit_log TO authenticated;
    UPDATE taxguard_clients SET owner_uid='${owner}' WHERE client_id='clientA';
    UPDATE taxguard_cases SET client_uid='${owner}',reviewer_uid='${reviewer}';`);
}, 30000);
afterAll(async () => { await f?.pg.close(); });
async function asIdentity(uid: string, work: () => Promise<void>) {
  await f.pg.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await f.pg.exec('SET ROLE authenticated');
  try { await work(); }
  finally { await f.pg.exec('RESET ROLE'); await f.pg.query("SELECT set_config('request.jwt.claim.sub','',false)"); }
}
it.each(['taxguard_clients', 'taxguard_cases', 'taxguard_documents', 'taxguard_members', 'taxguard_audit_log'])('denies unmatched identities through actual %s RLS', async table => {
  // Names are fixed test constants, never caller-provided SQL identifiers.
  await asIdentity(stranger, async () => { expect((await f.pg.query(`SELECT * FROM ${table}`)).rows).toEqual([]); });
});
it.each(['taxguard_clients', 'taxguard_cases', 'taxguard_documents', 'taxguard_members', 'taxguard_audit_log'])('denies missing identity through actual %s RLS', async table => {
  await asIdentity('', async () => { expect((await f.pg.query(`SELECT * FROM ${table}`)).rows).toEqual([]); });
});
it('permits only the owner client row and assigned case/document reads', async () => {
  await asIdentity(owner, async () => {
    expect((await f.pg.query('SELECT tenant_id,client_id FROM taxguard_clients')).rows).toEqual([{ tenant_id: 'tenantA', client_id: 'clientA' }]);
    const cases = (await f.pg.query<{ client_id: string }>('SELECT client_id FROM taxguard_cases')).rows;
    expect(cases).toHaveLength(1); expect(cases.every(row => row.client_id === 'clientA')).toBe(true);
    expect((await f.pg.query('SELECT id FROM taxguard_documents')).rows).toHaveLength(1);
  });
});
it('permits assigned reviewer case reads without granting client-owner visibility or writes', async () => {
  await asIdentity(reviewer, async () => {
    expect((await f.pg.query('SELECT case_id FROM taxguard_cases')).rows).toHaveLength(1);
    expect((await f.pg.query('SELECT client_id FROM taxguard_clients')).rows).toEqual([]);
    await expect(f.pg.query("UPDATE taxguard_cases SET reviewer_uid='other'")).rejects.toThrow('permission denied');
    await expect(f.pg.query('DELETE FROM taxguard_documents')).rejects.toThrow('permission denied');
  });
});
