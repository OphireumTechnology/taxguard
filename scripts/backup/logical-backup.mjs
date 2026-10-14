// Logical backup, restore and verification for REHEARSALS on disposable local PostgreSQL only.
// It refuses any connection that is not loopback, and restore additionally requires the caller to
// declare the target disposable. It is not the production backup mechanism: hosted projects are
// backed up by the provider (see docs/development/backup-restore-runbook.md); this proves that the
// schema can be recreated from the migration manifest and that data round-trips with verifiable
// per-table row counts and SHA-256 checksums. Never prints row contents.
import { createHash } from 'node:crypto';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

/** Throws unless the client is connected to a loopback server. */
export function assertLoopback(client) {
  const host = client?.connectionParameters?.host ?? client?.host ?? client?.options?.host;
  if (!LOOPBACK.has(String(host))) throw new Error('BACKUP_REHEARSAL_LOOPBACK_ONLY');
}

async function tables(client) {
  return (await client.query(`SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p') ORDER BY c.relname`)).rows.map(r => r.name);
}
const ident = name => { if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) throw new Error('BACKUP_IDENTIFIER_INVALID'); return `public."${name}"`; };
const column=name=>{if(!/^[a-z_][a-z0-9_]{0,62}$/.test(name))throw new Error('BACKUP_IDENTIFIER_INVALID');return `"${name}"`;};
/** Replica-mode inserts defer FK triggers; prove every previously validated FK before commit. */
async function verifyRestoredForeignKeys(client){
 const keys=(await client.query(`SELECT t.relname child,p.relname parent,c.confmatchtype,
  ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(n,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.n ORDER BY k.ord) child_columns,
  ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(n,ord) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.n ORDER BY k.ord) parent_columns
  FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_class p ON p.oid=c.confrelid
  WHERE c.contype='f' AND c.convalidated AND t.relnamespace='public'::regnamespace AND p.relnamespace='public'::regnamespace ORDER BY t.relname,c.conname`)).rows;
 for(const fk of keys){
  const cols=fk.child_columns.map(c=>'r.'+column(c)),present=cols.map(c=>c+' IS NOT NULL').join(' AND '),some=cols.map(c=>c+' IS NOT NULL').join(' OR '),empty=cols.map(c=>c+' IS NULL').join(' OR ');
  const match=cols.map((c,i)=>c+'=p.'+column(fk.parent_columns[i])).join(' AND ');
  const missing=`(${present}) AND NOT EXISTS(SELECT 1 FROM ${ident(fk.parent)} p WHERE ${match})`;
  const partial=fk.confmatchtype==='f'?` OR ((${some}) AND (${empty}))`:'';
  if((await client.query(`SELECT EXISTS(SELECT 1 FROM ${ident(fk.child)} r WHERE (${missing})${partial}) invalid`)).rows[0].invalid)throw new Error('RESTORE_FOREIGN_KEY_VIOLATION');
 }
}

/** Exports every public table as canonical JSON rows; returns { manifest, data }. */
async function exportSnapshot(client) {
  assertLoopback(client);
  const manifest = { format: 'taxguard-logical-backup-v1', createdAt: new Date().toISOString(), tables: {} }, data = {};
  for (const name of await tables(client)) {
    const rows = (await client.query(`SELECT to_jsonb(t)::text AS r FROM ${ident(name)} t`)).rows.map(r => r.r).sort();
    data[name] = rows;
    manifest.tables[name] = { rows: rows.length, sha256: createHash('sha256').update(rows.join('\n')).digest('hex') };
  }
  manifest.sha256 = createHash('sha256').update(JSON.stringify(manifest.tables)).digest('hex');
  return { manifest, data };
}
/** Owns a repeatable-read transaction on a dedicated connected local client. */
export async function exportDatabase(client){
 assertLoopback(client);if(!client.connectionParameters)throw new Error('BACKUP_CONNECTED_CLIENT_REQUIRED');
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{const backup=await exportSnapshot(client);await client.query('COMMIT');return backup;}
 catch(error){await client.query('ROLLBACK');throw error;}
}

/** Recomputes the manifest of a backup's data (detects tampering or truncation of a backup file). */
export function verifyBackupIntegrity(backup) {
  const problems = [];
  for (const [name, rows] of Object.entries(backup.data)) {
    const m = backup.manifest.tables[name];
    if (!m) { problems.push({ table: name, code: 'TABLE_NOT_IN_MANIFEST' }); continue; }
    if (m.rows !== rows.length) problems.push({ table: name, code: 'ROW_COUNT_MISMATCH' });
    if (m.sha256 !== createHash('sha256').update([...rows].sort().join('\n')).digest('hex')) problems.push({ table: name, code: 'CHECKSUM_MISMATCH' });
  }
  for (const name of Object.keys(backup.manifest.tables)) if (!(name in backup.data)) problems.push({ table: name, code: 'TABLE_MISSING_FROM_DATA' });
  if (backup.manifest.sha256 !== createHash('sha256').update(JSON.stringify(backup.manifest.tables)).digest('hex')) problems.push({ table: '*', code: 'MANIFEST_CHECKSUM_MISMATCH' });
  return problems;
}

/**
 * Restores a verified backup into a DISPOSABLE loopback database whose schema was recreated from
 * the migration manifest. Replaces all rows of every public table, in one transaction, with
 * triggers and foreign-key checks deferred by session_replication_role (local superuser only).
 */
export async function restoreDatabase(client, backup, { disposable = false } = {}) {
  assertLoopback(client);
  if (disposable !== true) throw new Error('RESTORE_TARGET_NOT_DECLARED_DISPOSABLE');
  const problems = verifyBackupIntegrity(backup);
  if (problems.length) throw new Error('BACKUP_INTEGRITY_FAILED');
  const present = await tables(client);
  const missing = Object.keys(backup.manifest.tables).filter(t => !present.includes(t));
  if (missing.length) throw new Error('RESTORE_SCHEMA_MISMATCH');
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL session_replication_role = replica');
    await client.query(`TRUNCATE ${present.map(ident).join(', ')}`);
    for (const name of Object.keys(backup.data)) {
      const rows = backup.data[name];
      if (!rows.length) continue;
      const cols = (await client.query(`SELECT a.attname FROM pg_attribute a WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = '' ORDER BY a.attnum`,
        [ident(name)])).rows.map(r => `"${r.attname}"`).join(', ');
      for (let i = 0; i < rows.length; i += 500) {
        await client.query(`INSERT INTO ${ident(name)} (${cols}) OVERRIDING SYSTEM VALUE SELECT ${cols} FROM jsonb_populate_recordset(NULL::${ident(name)}, $1::jsonb)`,
          ['[' + rows.slice(i, i + 500).join(',') + ']']);
      }
    }
    // Owned sequences continue after the restored maximum.
    await client.query('SET LOCAL session_replication_role = origin');
    await verifyRestoredForeignKeys(client);
    const seqs = (await client.query(`SELECT s.oid::regclass::text AS seq, t.relname AS tbl, a.attname AS col FROM pg_class s JOIN pg_depend d ON d.objid = s.oid AND d.deptype IN ('a','i')
      JOIN pg_class t ON t.oid = d.refobjid JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE s.relkind = 'S' AND n.nspname = 'public'`)).rows;
    for (const s of seqs) await client.query(`SELECT setval($1, COALESCE((SELECT max("${s.col}") FROM ${ident(s.tbl)}), 0) + 1, false)`, [s.seq]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
}

/** Compares a database with a backup manifest: per-table row counts and checksums. */
export async function compareWithManifest(client, manifest) {
  const { manifest: now } = await exportDatabase(client);
  const differences = [];
  for (const [name, m] of Object.entries(manifest.tables)) {
    const c = now.tables[name];
    if (!c) differences.push({ table: name, code: 'TABLE_MISSING' });
    else if (c.rows !== m.rows) differences.push({ table: name, code: 'ROW_COUNT_MISMATCH' });
    else if (c.sha256 !== m.sha256) differences.push({ table: name, code: 'CHECKSUM_MISMATCH' });
  }
  return differences;
}
