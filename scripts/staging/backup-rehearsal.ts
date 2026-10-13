import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { startDatabase } from '../../src/tests-db/harness';

// This rehearsal creates its own disposable loopback server. There is no target URL option,
// no .env loading and no ability to operate on a Supabase database. Password is passed in the
// child environment, never arguments/output. Real staging backup remains an owner operation.
for (const file of ['.env', '.env.local', '.env.development', '.env.development.local']) {
  if (fs.existsSync(file)) throw new Error('BACKUP_REHEARSAL_ENV_FILE_REFUSED');
}
const dump = process.env.TAXGUARD_PG_DUMP_BIN, restore = process.env.TAXGUARD_PG_RESTORE_BIN;
if (!dump || !restore || !path.isAbsolute(dump) || !path.isAbsolute(restore) || !fs.existsSync(dump) || !fs.existsSync(restore)) {
  console.error('BACKUP_TOOLS_REQUIRED: set absolute paths for TAXGUARD_PG_DUMP_BIN and TAXGUARD_PG_RESTORE_BIN (PostgreSQL 17+).');
  process.exit(2);
}
const db = await startDatabase();
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'taxguard-backup-rehearsal-'));
const archive = path.join(directory, 'synthetic.dump');
const config = db.pool.options;
const child = (executable: string, args: string[]) => new Promise<void>((resolve, reject) => {
  execFile(executable, args, { windowsHide: true, timeout: 120_000, env: { ...process.env, PGPASSWORD: String(config.password) } }, error => {
    if (error) reject(new Error(`BACKUP_TOOL_FAILED: ${path.basename(executable)} exit=${error.code ?? 'unknown'}`)); else resolve();
  });
});
let restored: pg.Client | undefined;
try {
  await db.pool.query("INSERT INTO taxguard_tenants(id,name) VALUES('backupSynthetic','Synthetic backup practice')");
  await db.pool.query("SELECT taxguard_security_record('backupSynthetic',NULL,gen_random_uuid(),'AUTH_FAILURE','warning')");
  const snapshot = async (client: pg.Pool | pg.Client) => {
    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
    const tablesSnapshot: Record<string, unknown> = {};
    for (const { tablename } of tables) {
      if (!/^[a-z0-9_]+$/.test(tablename)) throw new Error('BACKUP_TABLE_INVALID');
      const data = (await client.query(`SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data::text),'[]'::jsonb)::text data
        FROM (SELECT to_jsonb(t) row_data FROM public.${tablename} t) q`)).rows[0].data;
      const policy = (await client.query('SELECT relrowsecurity, relforcerowsecurity, relacl::text FROM pg_class WHERE oid=$1::regclass', [`public.${tablename}`])).rows[0];
      tablesSnapshot[tablename] = { sha256: createHash('sha256').update(data).digest('hex'), policy };
    }
    const functions = (await client.query("SELECT oid::regprocedure::text sig, pg_get_functiondef(oid) definition, proacl::text FROM pg_proc WHERE pronamespace='public'::regnamespace ORDER BY sig")).rows;
    return JSON.stringify({ tablesSnapshot, functions });
  };
  const before = await snapshot(db.pool);
  const connection = ['--host=127.0.0.1', `--port=${config.port}`, '--username=postgres'];
  await child(dump, [...connection, '--format=custom', '--no-owner', `--file=${archive}`, '--dbname=taxguard_test']);
  await db.pool.query('CREATE DATABASE taxguard_restore');
  await child(restore, [...connection, '--exit-on-error', '--no-owner', '--dbname=taxguard_restore', archive]);
  restored = new pg.Client({ host: '127.0.0.1', port: config.port, user: 'postgres', password: String(config.password), database: 'taxguard_restore' });
  await restored.connect();
  if (await snapshot(restored) !== before) throw new Error('BACKUP_RESTORE_INTEGRITY_FAILED');
  const row = (await restored.query("SELECT metadata FROM taxguard_audit_log WHERE tenant_id='backupSynthetic'")).rows[0];
  if (row.metadata.category !== 'SECURITY') throw new Error('BACKUP_AUDIT_MISSING');
  try { await restored.query("DELETE FROM taxguard_audit_log WHERE tenant_id='backupSynthetic'"); throw new Error('BACKUP_IMMUTABILITY_FAILED'); }
  catch (error: any) { if (error.message !== 'SECURITY_EVENT_IMMUTABLE') throw error; }
  console.log(JSON.stringify({ status: 'PASS', syntheticOnly: true, destination: 'disposable-loopback', archiveRetained: false }));
} finally {
  await restored?.end();
  await db.stop();
  const resolved = path.resolve(directory);
  if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('taxguard-backup-rehearsal-')) fs.rmSync(resolved, { recursive: true, force: true });
}
