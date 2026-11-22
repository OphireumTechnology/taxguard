#!/usr/bin/env node
/**
 * Production migration version map (review artifact; applies nothing).
 *
 * Historical proposal prefixes include invalid timestamp hours (for example 20261012240000), and the tested composition
 * order is the explicit dependency DAG (docs/development/staging-migration-manifest.json), not file-name order. A
 * migration tool that orders by version (Supabase CLI migration history) needs valid, strictly increasing versions in
 * exactly that DAG order. This derives them without changing any SQL:
 *   - each entry keeps its original version when it is a valid timestamp later than the previous entry's version;
 *   - otherwise it receives the next valid second after the previous entry.
 * The output records, per entry, the DAG position, the original file and version, the proposed version, whether it was
 * remapped and why, the kind (core or review-only proposal) and the SQL SHA-256 from the verified manifest.
 *
 * Usage: node scripts/staging/production-version-map.mjs [--write docs/development/production-migration-version-map.json]
 * Exits non-zero if the manifest is missing, its order is not the DAG order, or a hash is absent.
 */
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('docs/development/staging-migration-manifest.json', 'utf8'));
if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) throw new Error('MANIFEST_ENTRIES_REQUIRED');

const parse = v => {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(v);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  const t = Date.UTC(y, mo - 1, d, h, mi, s);
  const back = new Date(t);
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d && back.getUTCHours() === h
    && back.getUTCMinutes() === mi && back.getUTCSeconds() === s ? t : null;
};
const format = t => new Date(t).toISOString().replace(/[-:T]/g, '').slice(0, 14);

let previous = -Infinity;
const entries = manifest.entries.map((entry, index) => {
  if (entry.order !== index + 1) throw new Error(`MANIFEST_ORDER_INVALID at ${index + 1}`);
  if (!/^[0-9a-f]{64}$/.test(entry.sha256 || '')) throw new Error(`MANIFEST_HASH_MISSING ${entry.file}`);
  const name = entry.file.split('/').pop();
  const original = /^(\d{14})_/.exec(name)?.[1];
  const t = original ? parse(original) : null;
  let proposed; let reason = null;
  if (t !== null && t > previous) proposed = t;
  else { proposed = previous + 1000; reason = t === null ? 'INVALID_TIMESTAMP' : 'OUT_OF_DAG_ORDER'; }
  previous = proposed;
  return { order: entry.order, file: entry.file, kind: entry.kind, originalVersion: original, proposedVersion: format(proposed),
    remapped: reason !== null, reason, sha256: entry.sha256, dependsOn: entry.dependsOn };
});

const versions = entries.map(e => e.proposedVersion);
if (new Set(versions).size !== versions.length || versions.some((v, i) => i && v <= versions[i - 1])) throw new Error('VERSION_MAP_NOT_STRICTLY_INCREASING');
const result = { schemaVersion: 1, executionAllowed: false, manifestExecutionPlanSha256: manifest.executionPlanSha256,
  note: 'Review artifact. The SQL of every file is unchanged (same SHA-256); only the version under which a migration tool would record it differs. Applying anything to production requires owner approval.',
  counts: { total: entries.length, core: entries.filter(e => e.kind === 'core').length, proposals: entries.filter(e => e.kind !== 'core').length,
    remapped: entries.filter(e => e.remapped).length, invalidTimestamp: entries.filter(e => e.reason === 'INVALID_TIMESTAMP').length,
    outOfOrder: entries.filter(e => e.reason === 'OUT_OF_DAG_ORDER').length },
  entries };
const outIndex = process.argv.indexOf('--write');
if (outIndex > 0) fs.writeFileSync(process.argv[outIndex + 1], JSON.stringify(result, null, 2) + '\n');
console.log(`production-version-map: ${result.counts.total} entries, ${result.counts.remapped} remapped (${result.counts.invalidTimestamp} invalid timestamps, ${result.counts.outOfOrder} out of DAG order); versions strictly increasing.`);
