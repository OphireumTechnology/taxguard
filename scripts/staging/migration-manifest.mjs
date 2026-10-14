import fs from 'node:fs';
import crypto from 'node:crypto';
import { dependencyOrder } from './migration-order.mjs';

// Offline inventory only. This command never connects to a database or applies SQL.
export const canonicalTextHash = content => crypto.createHash('sha256').update(content.toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
export function buildMigrationManifest() {
  const entries = [];
  const objects = new Map();
  const functions = new Map();
  const planText=fs.readFileSync('docs/development/migration-execution-order.json','utf8');
  const plan=JSON.parse(planText), order=dependencyOrder(plan.entries);
  const known=['supabase/migrations','docs/proposed-migrations'].flatMap(directory=>fs.readdirSync(directory).filter(n=>n.endsWith('.sql')).map(n=>`${directory}/${n}`));
  if(order.length!==known.length || order.some(e=>!known.includes(e.file)))throw new Error('MIGRATION_PLAN_COVERAGE_FAILED');
  for (const planned of order) {
      const file=planned.file,name=file.split('/').at(-1),kind=file.startsWith('supabase/')?'core':'proposal';
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
        dependsOn: planned.dependsOn,
        referencedDependencies, declaredObjects: [...new Set(declared)], supersededFunctions,
        rollback: sql.split(/\r?\n/).filter(line => /^--.*rollback/i.test(line)),
        grantsAndRevocations: source.split(/\r?\n/).filter(line => /\b(GRANT|REVOKE)\b/i.test(line)).map(line => line.trim()),
        securityDefinerDeclarations: (source.match(/SECURITY\s+DEFINER/gi) || []).length,
        notValidConstraints: (source.match(/NOT\s+VALID/gi) || []).length,
        header: sql.split(/\r?\n/).filter(line => line.startsWith('--')).slice(0, 12) });
      for (const name of declared) objects.set(name, file);
      for (const name of declaredFunctions) functions.set(name, file);
  }
  return { schemaVersion: 2, executionAllowed: false, executionPlanSha256:canonicalTextHash(planText), ordering: 'explicit dependency DAG in migration-execution-order.json',
    notes: ['dependsOn follows the explicit conservative execution DAG; unknown files, missing prerequisites and cycles fail closed. referencedDependencies and supersededFunctions are static review aids, not a SQL parser or proof of authorization.',
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
