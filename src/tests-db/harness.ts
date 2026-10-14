import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { buildMigrationManifest } from '../../scripts/staging/migration-manifest.mjs';

// Non-production database harness: a throw-away local PostgreSQL server (embedded-postgres
// binaries) listening on 127.0.0.1 only, on a random free port, with a random password and a data
// directory that is deleted on stop. It never reads Supabase credentials or environment and never
// connects anywhere but loopback. Synthetic data only.
const ROOT = process.env.TAXGUARD_DB_TEST_DIR || path.join(os.tmpdir(), 'taxguard-db-tests');
if (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) {
  // Defence in depth: the harness never uses these, but refuse to run beside a configured project.
  throw new Error('Refusing to run database tests with a Supabase project configured in the environment.');
}

async function freePort() {
  return new Promise<number>((resolve, reject) => {
    const s = net.createServer(); s.unref(); s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const port = (s.address() as net.AddressInfo).port; s.close(() => resolve(port)); });
  });
}

export type TestDatabase = {
  /** A new independent connection (a separate backend session). */
  connect(): Promise<pg.Client>;
  pool: pg.Pool;
  restart(): Promise<void>;
  stop(): Promise<void>;
};

export async function startDatabase(options: { durable?: boolean } = {}): Promise<TestDatabase> {
  fs.mkdirSync(ROOT, { recursive: true });
  // Remove directories left by earlier runs (older than an hour, so a parallel run is never touched).
  for (const name of fs.readdirSync(ROOT).filter(n => n.startsWith('pg-'))) {
    const dir = path.join(ROOT, name);
    try {const target=path.resolve(dir),parent=path.resolve(ROOT);if(!target.startsWith(parent+path.sep)||!path.basename(target).startsWith('pg-'))throw new Error('DATABASE_CLEANUP_PATH_DENIED');
      if (Date.now() - fs.statSync(target).mtimeMs > 3_600_000) fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* still in use */ }
  }
  const databaseDir = path.join(ROOT, 'pg-' + process.pid + '-' + randomBytes(4).toString('hex'));
  const port = await freePort(), password = randomBytes(18).toString('hex');
  // Own cleanup with bounded Windows lock retries. The package's nonpersistent stop performs
  // an immediate recursive removal and can fail EBUSY before our guarded cleanup is reached.
  const server = new EmbeddedPostgres({ databaseDir, port, user: 'postgres', password, persistent: true, onLog: () => {},
    postgresFlags: ['-c', 'listen_addresses=127.0.0.1', '-c', 'max_connections=60', '-c', `fsync=${options.durable ? 'on' : 'off'}`] });
  await server.initialise();
  await server.start();
  const config = { host: '127.0.0.1', port, user: 'postgres', password, database: 'taxguard_test' };
  await server.createDatabase('taxguard_test');
  let pool = new pg.Pool({ ...config, max: 20 });
  try { await compose(pool); } catch (e) { await pool.end(); await server.stop(); throw e; }
  return {
    get pool() { return pool; },
    async connect() { const c = new pg.Client(config); await c.connect(); return c; },
    async restart() {
      if (!options.durable) throw new Error('DISPOSABLE_DURABLE_TEST_REQUIRED');
      await pool.end(); await server.stop(); await server.start();
      pool = new pg.Pool({ ...config, max: 20 });
    },
    async stop() {
      await pool.end(); await server.stop();
      // Windows may keep the data directory locked briefly after the server exits.
      try {
        const resolved = path.resolve(databaseDir), parent = path.resolve(ROOT);
        if (!resolved.startsWith(parent + path.sep) || !path.basename(resolved).startsWith('pg-')) throw new Error('DATABASE_CLEANUP_PATH_DENIED');
        fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
      }
      catch { console.warn('[db-tests] data directory still locked; it is removed on the next run'); }
    },
  };
}

/** Supabase shims, then supabase/migrations, then every proposal in name order (as PGlite composition does). */
export const MIGRATIONS = fs.readdirSync('supabase/migrations').filter(n => n.endsWith('.sql')).sort();
export const PROPOSALS = fs.readdirSync('docs/proposed-migrations').filter(n => /^\d{14}_.+\.sql$/.test(n)).sort();
async function compose(pool: pg.Pool) {
  const manifest = buildMigrationManifest();
  if (fs.readFileSync('docs/development/staging-migration-manifest.json', 'utf8').replace(/\r\n/g, '\n') !== JSON.stringify(manifest, null, 2) + '\n') throw new Error('STAGING_MIGRATION_MANIFEST_STALE');
  await pool.query(`CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS 'SELECT current_user::text';
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;`);
  for (const entry of manifest.entries) await apply(pool, path.dirname(entry.file), path.basename(entry.file));
}
async function apply(pool: pg.Pool, dir: string, name: string) {
  const sql = fs.readFileSync(path.join(dir, name), 'utf8').replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"[^"]+";/gi, '');
  try { await pool.query(sql); } catch (e: any) { throw new Error(`${dir}/${name}: ${e.message}`); }
}

/** Supabase-style rpc() over a real connection (or pool), matching the PGlite adapter used by the stores. */
export function pgRpc(db: pg.Pool | pg.Client) {
  return {
    async rpc(name: string, args: Record<string, unknown>) {
      if (!/^taxguard_[a-z0-9_]+$/.test(name)) throw new Error('unexpected rpc');
      const keys = Object.keys(args);
      const values = keys.map(k => { const v = args[k];
        if (Array.isArray(v) && v.every(x => x === null || typeof x !== 'object')) return v;
        return v !== null && typeof v === 'object' ? JSON.stringify(v) : v; });
      try {
        const r = await db.query(`SELECT public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(',')}) AS r`, values);
        return { data: JSON.parse(JSON.stringify(r.rows[0].r)), error: null };
      } catch (error: any) { return { data: null, error: { code: error.code, message: error.message, details: error.detail ?? null } }; }
    },
  };
}
