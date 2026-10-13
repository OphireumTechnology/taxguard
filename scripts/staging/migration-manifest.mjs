import fs from 'node:fs';
import crypto from 'node:crypto';

// Offline inventory only. This command never connects to a database or applies SQL.
export const canonicalTextHash = content => crypto.createHash('sha256').update(content.toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
export function buildMigrationManifest() {
  const entries = [];
  const objects = new Map();
  const functions = new Map();
  for (const [directory, kind] of [['supabase/migrations', 'core'], ['docs/proposed-migrations', 'proposal']]) {
    for (const name of fs.readdirSync(directory).filter(n => n.endsWith('.sql')).sort()) {
      const file = `${directory}/${name}`;
      const sql = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
      const source = sql.replace(/^\s*--.*$/gm, '');
      const declared = [...source.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|FUNCTION|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z][a-z0-9_]*)/gi)].map(m => m[1]);
      const declaredFunctions = [...source.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-z][a-z0-9_]*)/gi)].map(m => m[1]);
      const supersededFunctions = declaredFunctions.filter(n => functions.has(n)).map(name => ({ name, previousFile: functions.get(name), review: 'Check overload signatures and final grants in composed PostgreSQL.' }));
      const references = [...new Set([...source.matchAll(/public\.([a-z][a-z0-9_]*)/gi)].map(m => m[1]))];
      const referencedDependencies = [...new Set(references.filter(n => !declared.includes(n) && objects.has(n)).map(n => objects.get(n)))];
      const version = name.match(/^(\d{14})_/)?.[1];
      const date = version && `${version.slice(0, 4)}-${version.slice(4, 6)}-${version.slice(6, 8)}T${version.slice(8, 10)}:${version.slice(10, 12)}:${version.slice(12, 14)}Z`;
      const validTimestamp = !!date && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().replace(/[-:TZ.]/g, '').slice(0, 14) === version;
      entries.push({ order: entries.length + 1, file, kind, version, sha256: canonicalTextHash(sql),
        validTimestamp, requiresOwnerReview: true, externalApplicationStatus: 'NOT_VERIFIED',
        dependsOn: entries.length ? [entries[entries.length - 1].file] : [],
        referencedDependencies, declaredObjects: [...new Set(declared)], supersededFunctions,
        rollback: sql.split(/\r?\n/).filter(line => /^--.*rollback/i.test(line)),
        grantsAndRevocations: source.split(/\r?\n/).filter(line => /\b(GRANT|REVOKE)\b/i.test(line)).map(line => line.trim()),
        securityDefinerDeclarations: (source.match(/SECURITY\s+DEFINER/gi) || []).length,
        notValidConstraints: (source.match(/NOT\s+VALID/gi) || []).length,
        header: sql.split(/\r?\n/).filter(line => line.startsWith('--')).slice(0, 12) });
      for (const name of declared) objects.set(name, file);
      for (const name of declaredFunctions) functions.set(name, file);
    }
  }
  return { schemaVersion: 1, executionAllowed: false, ordering: 'core filename order, then proposal filename order',
    notes: ['dependsOn encodes the conservative, tested complete execution chain. referencedDependencies and supersededFunctions are static review aids, not a SQL parser or proof of authorization.',
      'SHA-256 hashes use canonical LF text so Windows CRLF and GitHub/Linux checkouts share the same reviewed content identity.',
      'Historical proposal prefixes include invalid timestamp hours. Preserve tested composition order; do not treat them as CLI migration versions.',
      'docs/sql/taxguard-audit-append-only.proposal.sql is a separate draft, excluded from composition and requires explicit review.',
      'This manifest records file integrity and review findings; it does not authorize staging application.'], entries };
}

const target = 'docs/development/staging-migration-manifest.json';
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/migration-manifest.mjs')) {
  const result = JSON.stringify(buildMigrationManifest(), null, 2) + '\n';
  if (process.argv.includes('--write')) fs.writeFileSync(target, result);
  else if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== result) throw new Error('STAGING_MIGRATION_MANIFEST_STALE');
  console.log(`Migration manifest ${process.argv.includes('--write') ? 'written' : 'verified'} (offline).`);
}
