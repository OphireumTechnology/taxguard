import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS, PROPOSALS, startDatabase, type TestDatabase } from './harness';
import { schemaFingerprint } from '../../scripts/staging/schema-fingerprint';
import { buildMigrationManifest } from '../../scripts/staging/migration-manifest.mjs';

// Real PostgreSQL (not PGlite): migration + proposal composition, ordering, idempotent re-apply
// and database-wide security invariants.
let db: TestDatabase;
beforeAll(async () => { db = await startDatabase(); });
afterAll(async () => { await db?.stop(); });

describe('composition on a real PostgreSQL server', () => {
  it('enables RLS on every exposed public table after composing all files', async () => {
    const r = await db.pool.query("SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p') AND NOT relrowsecurity ORDER BY relname");
    expect(r.rows.map(row => row.relname)).toEqual([]);
  });
  it('composes every file in the explicitly checked dependency order on loopback', async () => {
    expect(MIGRATIONS.length).toBeGreaterThan(0);
    const manifest=buildMigrationManifest();const seen=new Set<string>();
    for(const entry of manifest.entries){for(const dependency of entry.dependsOn)expect(seen.has(dependency)).toBe(true);seen.add(entry.file);}
    expect(seen.size).toBe(MIGRATIONS.length+PROPOSALS.length);
    const r = await db.pool.query(`SELECT current_setting('server_version_num')::int AS v, inet_server_addr()::text AS addr`);
    expect(r.rows[0].v).toBeGreaterThanOrEqual(150000);
    expect(r.rows[0].addr).toBe('127.0.0.1/32');
  });
  it('re-applies the Claude proposals idempotently', async () => {
    const fs = await import('node:fs');
    const before=await schemaFingerprint(db.pool);
    for (const entry of buildMigrationManifest().entries.filter(e=>e.kind==='proposal'&&/^202610122[3-9]|^20261012[3-9]|^20261013|^20261014|^20261015|^20261016|^20261017|^20261018/.test(e.file.split('/').at(-1)!)))
      await db.pool.query(fs.readFileSync(entry.file, 'utf8'));
    const after=await schemaFingerprint(db.pool);
    for(const name of Object.keys(before.groups))expect(after.groups[name],`schema group ${name}`).toEqual(before.groups[name]);
    expect(after.sha256).toBe(before.sha256);
  });
  it('detects privilege and constraint drift and recovers the exact schema after rollback',async()=>{
    const baseline=await schemaFingerprint(db.pool);const session=await db.connect();
    try{await session.query('BEGIN');await session.query('GRANT SELECT ON taxguard_security_outbox TO anon');
      expect((await schemaFingerprint(session)).sha256).not.toBe(baseline.sha256);
      await session.query('ROLLBACK');expect((await schemaFingerprint(db.pool)).sha256).toBe(baseline.sha256);
      await session.query('BEGIN');await session.query('ALTER TABLE taxguard_collection_questionnaires ADD CONSTRAINT synthetic_drift_check CHECK (revision>0)');
      expect((await schemaFingerprint(session)).sha256).not.toBe(baseline.sha256);
      await session.query('ROLLBACK');expect((await schemaFingerprint(db.pool)).sha256).toBe(baseline.sha256);
    }finally{await session.query('ROLLBACK');await session.end();}
  });
  it('every SECURITY DEFINER taxguard function pins search_path', async () => {
    const r = await db.pool.query(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard%'
      AND p.prosecdef AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')`);
    expect(r.rows.map(x => x.proname)).toEqual([]);
  });
  it('no Claude-proposal function is executable by anon or authenticated', async () => {
    const r = await db.pool.query(`SELECT DISTINCT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
      AND p.proname ~ '^taxguard_(ledger|practice|case|doc|docreq|client_notification|bill|b2t|comm|apt|audit_center|legal|consult|rar|portal|security|collection)_?' AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))`);
    expect(r.rows.map(x => x.proname)).toEqual([]);
  });
});
