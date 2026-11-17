import assert from 'node:assert/strict';
import { schemaFingerprint, type SchemaQuery } from '../../../scripts/staging/schema-fingerprint.ts';

export interface FingerprintFixture extends SchemaQuery { exec(sql: string): Promise<unknown> }

/** Synthetic catalog fixtures only; the caller owns a disposable database and rollback. */
export async function setupFingerprintFixture(db: FingerprintFixture) {
  await db.exec(`
    CREATE ROLE fingerprint_owner NOLOGIN;
    CREATE ROLE fingerprint_group NOLOGIN;
    CREATE ROLE fingerprint_reader NOLOGIN INHERIT;
    REVOKE ALL ON SCHEMA public FROM PUBLIC;
    GRANT USAGE ON SCHEMA public TO fingerprint_group;
    CREATE TABLE public.fingerprint_evidence(tenant_id text NOT NULL);
    ALTER TABLE public.fingerprint_evidence ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.fingerprint_evidence FORCE ROW LEVEL SECURITY;
    CREATE POLICY tenant_scope ON public.fingerprint_evidence
      USING (tenant_id = current_setting('app.tenant_id', true));
    CREATE FUNCTION public.fingerprint_guard() RETURNS integer LANGUAGE sql
      SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS 'SELECT 1';
    REVOKE ALL ON FUNCTION public.fingerprint_guard() FROM PUBLIC;
  `);
}

const effective = (snapshot: Awaited<ReturnType<typeof schemaFingerprint>>) =>
  (snapshot.groups.schemaPrivileges as any[]).find(row => row.role_name === 'fingerprint_reader');

export const schemaFingerprintScenarios: Record<string, (db: FingerprintFixture) => Promise<void>> = {
  'detects table ownership changes with implicit ACLs and intact RLS': async db => {
    const before = await schemaFingerprint(db);
    await db.exec('ALTER TABLE public.fingerprint_evidence OWNER TO fingerprint_owner');
    const after = await schemaFingerprint(db);
    const table = (after.groups.tables as any[]).find(row => row.relname === 'fingerprint_evidence');
    assert.equal(table.owner, 'fingerprint_owner');
    assert.equal(table.relrowsecurity, true);
    assert.equal(table.relforcerowsecurity, true);
    assert.notEqual(after.sha256, before.sha256);
    assert.deepEqual(after.groups.policies, before.groups.policies);
  },
  'detects security-definer owner changes while the function body stays identical': async db => {
    const before = await schemaFingerprint(db);
    await db.exec('ALTER FUNCTION public.fingerprint_guard() OWNER TO fingerprint_owner');
    const after = await schemaFingerprint(db);
    const previous = (before.groups.functions as any[]).find(row => row.signature === 'fingerprint_guard()');
    const fn = (after.groups.functions as any[]).find(row => row.signature === 'fingerprint_guard()');
    assert.equal(fn.owner, 'fingerprint_owner');
    assert.equal(fn.definition, previous.definition);
    assert.equal(fn.prosecdef, true);
    assert.notEqual(after.sha256, before.sha256);
  },
  'detects materialized-view ownership changes': async db => {
    await db.exec('CREATE MATERIALIZED VIEW public.fingerprint_summary AS SELECT 1 AS synthetic_count');
    const before = await schemaFingerprint(db);
    await db.exec('ALTER MATERIALIZED VIEW public.fingerprint_summary OWNER TO fingerprint_owner');
    const after = await schemaFingerprint(db);
    const view = (after.groups.tables as any[]).find(row => row.relname === 'fingerprint_summary');
    assert.equal(view.relkind, 'm');
    assert.equal(view.owner, 'fingerprint_owner');
    assert.notEqual(after.sha256, before.sha256);
  },
  'records named ownership, grants and effective privileges without changing existing safeguards': async db => {
    const snapshot = await schemaFingerprint(db);
    const ownership = snapshot.groups.schemaOwnership as any[];
    assert.equal(ownership.length, 1);
    assert.equal(ownership[0].schema_name, 'public');
    assert.equal(typeof ownership[0].owner, 'string');
    assert.ok((snapshot.groups.schemaGrants as any[]).some(row => row.grantee === 'fingerprint_group' && row.privilege === 'USAGE'));
    assert.equal(effective(snapshot).usage, false);
    const table = (snapshot.groups.tables as any[]).find(row => row.relname === 'fingerprint_evidence');
    assert.equal(table.relrowsecurity, true);
    assert.equal(table.relforcerowsecurity, true);
    assert.ok((snapshot.groups.policies as any[]).some(row => row.policyname === 'tenant_scope'));
    const fn = (snapshot.groups.functions as any[]).find(row => row.signature === 'fingerprint_guard()');
    assert.equal(fn.prosecdef, true);
    assert.ok(fn.proconfig.some((setting: string) => setting.startsWith('search_path=')));
    assert.equal((await schemaFingerprint(db)).sha256, snapshot.sha256);
  },
  'detects schema owner replacement': async db => {
    const before = await schemaFingerprint(db);
    await db.exec('ALTER SCHEMA public OWNER TO fingerprint_owner');
    const after = await schemaFingerprint(db);
    assert.notEqual(after.sha256, before.sha256);
    assert.notDeepEqual(after.groups.schemaOwnership, before.groups.schemaOwnership);
  },
  'detects direct USAGE grants': async db => {
    const before = await schemaFingerprint(db);
    await db.exec('GRANT USAGE ON SCHEMA public TO fingerprint_reader');
    const after = await schemaFingerprint(db);
    assert.notEqual(after.sha256, before.sha256);
    assert.equal(effective(after).usage, true);
    assert.equal(effective(after).create, false);
  },
  'detects direct CREATE grants': async db => {
    const before = await schemaFingerprint(db);
    await db.exec('GRANT CREATE ON SCHEMA public TO fingerprint_reader');
    const after = await schemaFingerprint(db);
    assert.notEqual(after.sha256, before.sha256);
    assert.equal(effective(after).create, true);
  },
  'detects PUBLIC grants and their effective access': async db => {
    const before = await schemaFingerprint(db);
    await db.exec('GRANT USAGE ON SCHEMA public TO PUBLIC');
    const after = await schemaFingerprint(db);
    assert.notEqual(after.sha256, before.sha256);
    assert.equal(effective(after).usage, true);
    assert.ok((after.groups.schemaGrants as any[]).some(row => row.grantee === 'PUBLIC' && row.privilege === 'USAGE'));
  },
  'detects grant-option escalation independently of USAGE': async db => {
    await db.exec('GRANT USAGE ON SCHEMA public TO fingerprint_reader');
    const before = await schemaFingerprint(db);
    await db.exec('GRANT USAGE ON SCHEMA public TO fingerprint_reader WITH GRANT OPTION');
    const after = await schemaFingerprint(db);
    assert.notEqual(after.sha256, before.sha256);
    assert.equal(effective(before).usage, true);
    assert.equal(effective(before).usage_grantable, false);
    assert.equal(effective(after).usage_grantable, true);
    assert.ok((after.groups.schemaGrants as any[]).some(row => row.grantee === 'fingerprint_reader' && row.is_grantable));
  },
  'detects inherited access even when the schema ACL and owner do not change': async db => {
    const before = await schemaFingerprint(db);
    await db.exec('GRANT fingerprint_group TO fingerprint_reader');
    const after = await schemaFingerprint(db);
    assert.deepEqual(after.groups.schemaGrants, before.groups.schemaGrants);
    assert.deepEqual(after.groups.schemaOwnership, before.groups.schemaOwnership);
    assert.equal(effective(after).usage, true);
    assert.notEqual(after.sha256, before.sha256);
  },
  'detects loss of inherited access': async db => {
    await db.exec('GRANT fingerprint_group TO fingerprint_reader');
    const before = await schemaFingerprint(db);
    await db.exec('REVOKE fingerprint_group FROM fingerprint_reader');
    const after = await schemaFingerprint(db);
    assert.equal(effective(after).usage, false);
    assert.notEqual(after.sha256, before.sha256);
  },
  'canonicalizes equivalent ACLs created in different grant orders': async db => {
    await db.exec('GRANT CREATE ON SCHEMA public TO fingerprint_reader; GRANT USAGE ON SCHEMA public TO fingerprint_owner');
    const before = await schemaFingerprint(db);
    await db.exec(`REVOKE CREATE ON SCHEMA public FROM fingerprint_reader;
      REVOKE USAGE ON SCHEMA public FROM fingerprint_owner;
      GRANT USAGE ON SCHEMA public TO fingerprint_owner;
      GRANT CREATE ON SCHEMA public TO fingerprint_reader;`);
    assert.equal((await schemaFingerprint(db)).sha256, before.sha256);
  },
  'normalizes implicit default schema ACLs to equivalent explicit grants': async db => {
    await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    const before = await schemaFingerprint(db);
    await db.exec('GRANT ALL ON SCHEMA public TO CURRENT_USER');
    assert.equal((await schemaFingerprint(db)).sha256, before.sha256);
  },
  'keeps named grants stable when an equivalent grantee has a different catalog OID': async db => {
    const before = await schemaFingerprint(db);
    const oldRole = (await db.query("SELECT oid FROM pg_catalog.pg_roles WHERE rolname='fingerprint_group'")).rows[0].oid;
    await db.exec(`REVOKE ALL ON SCHEMA public FROM fingerprint_group;
      DROP ROLE fingerprint_group;
      CREATE ROLE fingerprint_group NOLOGIN;
      GRANT USAGE ON SCHEMA public TO fingerprint_group;`);
    const newRole = (await db.query("SELECT oid FROM pg_catalog.pg_roles WHERE rolname='fingerprint_group'")).rows[0].oid;
    assert.notEqual(newRole, oldRole);
    assert.equal((await schemaFingerprint(db)).sha256, before.sha256);
  },
  'propagates catalog failures rather than returning a partial fingerprint': async () => {
    await assert.rejects(schemaFingerprint({ query: async sql => {
      if (sql.includes('has_schema_privilege')) throw new Error('SYNTHETIC_CATALOG_FAILURE');
      return { rows: [] };
    } }), /SYNTHETIC_CATALOG_FAILURE/);
  },
  'keeps tenant RLS enforcement intact while fingerprinting catalog changes': async db => {
    await db.exec(`GRANT USAGE ON SCHEMA public TO fingerprint_reader;
      GRANT SELECT ON public.fingerprint_evidence TO fingerprint_reader;
      INSERT INTO public.fingerprint_evidence VALUES ('synthetic_a'),('synthetic_b');`);
    const before = await schemaFingerprint(db);
    await db.exec("SET LOCAL app.tenant_id='synthetic_a'; SET LOCAL ROLE fingerprint_reader");
    const rows = (await db.query('SELECT tenant_id FROM public.fingerprint_evidence')).rows;
    await db.exec('RESET ROLE');
    assert.deepEqual(rows, [{ tenant_id: 'synthetic_a' }]);
    assert.equal((await schemaFingerprint(db)).sha256, before.sha256);
  },
  'keeps security-definer execution denied to an ungranted role': async db => {
    await db.exec('GRANT USAGE ON SCHEMA public TO fingerprint_reader');
    const before = await schemaFingerprint(db);
    await db.exec('SAVEPOINT denied_execution; SET LOCAL ROLE fingerprint_reader');
    try {
      await assert.rejects(db.query('SELECT public.fingerprint_guard()'), { code: '42501' });
    } finally { await db.exec('ROLLBACK TO SAVEPOINT denied_execution'); }
    assert.equal((await schemaFingerprint(db)).sha256, before.sha256);
  },
};
