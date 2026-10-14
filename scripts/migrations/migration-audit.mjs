// Offline migration readiness audit (Phase 10). Applies every core migration and every proposal, in
// the canonical execution order, to a throw-away in-process PGlite database and records, per file,
// the catalog changes it makes (tables, functions, policies, grants to client-facing roles), the
// functions it supersedes, its prerequisites and static hazards in its top-level statements. Then
// it re-applies every file to measure idempotency. It never reads environment credentials and never
// connects to any server. Synthetic, empty schema only.
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import {dependencyOrder} from '../staging/migration-order.mjs';

export const CORE_DIR = 'supabase/migrations';
export const PROPOSAL_DIR = 'docs/proposed-migrations';
export const SEPARATE_PROPOSAL = 'docs/sql/taxguard-audit-append-only.proposal.sql';

const SHIMS = `CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS 'SELECT current_user::text';
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;`;
// Supabase grants these by default on objects the migration role creates in public; reproduced so the
// audit sees what a Supabase project would expose when a file forgets to revoke.
const SUPABASE_DEFAULTS = `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;`;

/** The canonical execution order: core migrations by name, then proposals by name, then the separate audit proposal. */
export function executionOrder(root = '.') {
  const plan=JSON.parse(fs.readFileSync(path.join(root,'docs/development/migration-execution-order.json'),'utf8'));
  // The separate draft is analyzed in this disposable audit only, never in the executable manifest.
  return [...dependencyOrder(plan.entries).map(e=>({kind:e.file.startsWith('supabase/')?'core':'proposal',file:e.file})),{kind:'separate-proposal',file:SEPARATE_PROPOSAL}];
}

const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
const prepare = sql => sql.replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"[^"]+";/gi, '');

/** Top-level statement text: comments and dollar-quoted bodies removed (function bodies are not top-level DDL). */
export function topLevel(sql) {
  return sql.replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, ' $$body$$ ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ').replace(/'(?:[^']|'')*'/g, "''");
}

const HAZARDS = [
  ['NON_TRANSACTIONAL_INDEX', /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i, 'cannot run inside a transaction block'],
  ['ENUM_VALUE_ADDED', /\bALTER\s+TYPE\s+\S+\s+ADD\s+VALUE\b/i, 'cannot be used in the same transaction'],
  ['VACUUM', /\bVACUUM\b/i, 'not transactional'],
  ['EXPLICIT_TRANSACTION', /(^|;)\s*(BEGIN|COMMIT|ROLLBACK)\s*;/i, 'file manages its own transaction'],
  ['TABLE_DROPPED', /\bDROP\s+TABLE\b/i, 'data loss'],
  ['COLUMN_DROPPED', /\bDROP\s+COLUMN\b/i, 'data loss'],
  ['TRUNCATE', /\bTRUNCATE\b(?!\s+ON)/i, 'data loss'],
  ['DATA_DELETE', /(^|;)\s*DELETE\s+FROM\b/i, 'removes rows'],
  ['DATA_UPDATE', /(^|;)\s*UPDATE\s+\S+\s+SET\b/i, 'rewrites existing rows'],
  ['CONSTRAINT_NOT_VALID', /\bNOT\s+VALID\b/i, 'needs VALIDATE CONSTRAINT after data review'],
  ['DEFAULT_PRIVILEGES', /\bALTER\s+DEFAULT\s+PRIVILEGES\b/i, 'changes future grants'],
  ['GRANT_TO_CLIENT_ROLE', /\bGRANT\b[^;]*\bTO\s+(?:[^;]*,\s*)?(anon|authenticated|PUBLIC)\b/i, 'grants a client-facing role'],
  ['TABLE_LOCK', /\bLOCK\s+TABLE\b/i, 'explicit lock'],
  ['EXTENSION', /\bCREATE\s+EXTENSION\b/i, 'needs the extension enabled in the project'],
  ['RLS_DISABLED', /\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b/i, 'removes row-level security'],
];
export function staticHazards(sql) {
  const text = topLevel(sql);
  return HAZARDS.filter(([, re]) => re.test(text)).map(([code, , note]) => ({ code, note }));
}

const SNAPSHOT = `
SELECT 'fn' AS k, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS name,
  json_build_object('definer', p.prosecdef, 'searchPath', (SELECT c FROM unnest(COALESCE(p.proconfig,'{}')) c WHERE c LIKE 'search_path=%' LIMIT 1),
    'body', md5(p.prosrc || COALESCE(array_to_string(p.proconfig, ','), '') || p.prosecdef::text), 'anon', has_function_privilege('anon', p.oid, 'EXECUTE'),
    'authenticated', has_function_privilege('authenticated', p.oid, 'EXECUTE'), 'service', has_function_privilege('service_role', p.oid, 'EXECUTE')) AS v
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
UNION ALL
SELECT 'table', c.relname, json_build_object('rls', c.relrowsecurity,
  'anon', has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('anon', c.oid, 'INSERT') OR has_table_privilege('anon', c.oid, 'UPDATE') OR has_table_privilege('anon', c.oid, 'DELETE'),
  'authenticated', has_table_privilege('authenticated', c.oid, 'SELECT') OR has_table_privilege('authenticated', c.oid, 'INSERT') OR has_table_privilege('authenticated', c.oid, 'UPDATE') OR has_table_privilege('authenticated', c.oid, 'DELETE'),
  'authenticatedWrite', has_table_privilege('authenticated', c.oid, 'INSERT') OR has_table_privilege('authenticated', c.oid, 'UPDATE') OR has_table_privilege('authenticated', c.oid, 'DELETE'),
  'cols', (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped))
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
UNION ALL
SELECT 'policy', tablename || '.' || policyname, json_build_object('cmd', cmd, 'roles', roles::text) FROM pg_policies WHERE schemaname = 'public'
UNION ALL
SELECT 'trigger', c.relname || '.' || t.tgname, json_build_object('fn', t.tgfoid::regproc::text) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND NOT t.tgisinternal
UNION ALL
SELECT 'index', i.relname, json_build_object('table', t.relname, 'unique', x.indisunique) FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid JOIN pg_class t ON t.oid = x.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public'
UNION ALL
SELECT 'constraint', t.relname || '.' || c.conname, json_build_object('type', c.contype, 'validated', c.convalidated) FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public'`;

async function snapshot(pg) {
  const rows = (await pg.query(SNAPSHOT)).rows;
  const out = new Map();
  for (const r of rows) out.set(r.k + ':' + r.name, typeof r.v === 'string' ? JSON.parse(r.v) : r.v);
  return out;
}

function diff(before, after) {
  const added = [], changed = [], removed = [];
  for (const [k, v] of after) {
    if (!before.has(k)) added.push(k);
    else if (JSON.stringify(before.get(k)) !== JSON.stringify(v)) changed.push(k);
  }
  for (const k of before.keys()) if (!after.has(k)) removed.push(k);
  return { added, changed, removed };
}
const of = (keys, kind) => keys.filter(k => k.startsWith(kind + ':')).map(k => k.slice(kind.length + 1)).sort();

/** Runs the audit; returns one entry per file plus database-wide findings. */
export async function auditMigrations(root = '.', { supabaseDefaults = true } = {}) {
  const order = executionOrder(root);
  const pg = new PGlite();
  const files = [], definedBy = new Map(), tableBy = new Map();
  try {
    await pg.exec(SHIMS);
    if (supabaseDefaults) await pg.exec(SUPABASE_DEFAULTS);
    let before = await snapshot(pg);
    for (const [index, entry] of order.entries()) {
      const sql = read(root, entry.file);
      let error = null;
      try { await pg.exec(prepare(sql)); } catch (e) { error = String(e.message || e).slice(0, 200); await pg.exec('ROLLBACK').catch(() => {}); }
      const after = await snapshot(pg);
      const d = diff(before, after);
      const functionsAdded = of(d.added, 'fn'), functionsChanged = of(d.changed, 'fn');
      // A supersession replaces the body or settings; a privilege-only change is reported separately.
      const replaced = functionsChanged.filter(fn => before.get('fn:' + fn).body !== after.get('fn:' + fn).body);
      const privilegesChanged = functionsChanged.filter(fn => !replaced.includes(fn));
      const supersedes = replaced.map(fn => ({ fn, originallyDefinedIn: definedBy.get(fn) ?? null }));
      for (const fn of [...functionsAdded, ...replaced]) definedBy.set(fn, entry.file);
      const tablesAdded = of(d.added, 'table');
      for (const t of tablesAdded) tableBy.set(t, entry.file);
      // Prerequisites: earlier files whose tables or functions this file names.
      const body = sql.replace(/--[^\n]*/g, ' ');
      const prereq = new Set();
      for (const [t, f] of tableBy) if (f !== entry.file && new RegExp('\\b' + t + '\\b').test(body)) prereq.add(f);
      for (const [fn, f] of definedBy) if (f !== entry.file && !replaced.includes(fn) && new RegExp('\\b' + fn.slice(0, fn.indexOf('(')) + '\\s*\\(').test(body)) prereq.add(f);
      const clientGrants = [];
      for (const k of [...d.added, ...d.changed].filter(k => k.startsWith('fn:') || k.startsWith('table:'))) {
        const v = after.get(k);
        if (v.anon || v.authenticated) clientGrants.push({ object: k, anon: !!v.anon, authenticated: !!v.authenticated, write: !!v.authenticatedWrite });
      }
      clientGrants.sort((x, y) => x.object.localeCompare(y.object));
      // Functions the service role could execute before this file and cannot after it.
      const serviceRevoked = functionsChanged.filter(fn => before.get('fn:' + fn).service && !after.get('fn:' + fn).service);
      const definerWithoutPath = [...functionsAdded, ...functionsChanged].filter(fn => { const v = after.get('fn:' + fn); return v.definer && !v.searchPath; });
      const tablesWithoutRls = tablesAdded.filter(t => !after.get('table:' + t).rls);
      files.push({
        order: index + 1, kind: entry.kind, file: entry.file, applied: error === null, error,
        tablesAdded, tablesAltered: of(d.changed, 'table'), functionsAdded, supersedes, privilegesChanged, functionsRemoved: of(d.removed, 'fn'),
        policiesAdded: of(d.added, 'policy'), triggersAdded: of(d.added, 'trigger'), indexesAdded: of(d.added, 'index'),
        notValidConstraints: of(d.added, 'constraint').filter(c => after.get('constraint:' + c).validated === false),
        prerequisites: [...prereq].sort((a, b) => order.findIndex(o => o.file === a) - order.findIndex(o => o.file === b)),
        clientGrants, serviceRevoked, definerWithoutPath, tablesWithoutRls, hazards: staticHazards(sql), reapply: null,
      });
      // Idempotency: apply the same file again at once; it must succeed and leave the catalog unchanged.
      let reapply = 'ok';
      if (error === null) {
        try { await pg.exec(prepare(sql)); } catch (e) { reapply = 'fails: ' + String(e.message || e).slice(0, 160); await pg.exec('ROLLBACK').catch(() => {}); }
      } else reapply = 'not applied';
      const again = await snapshot(pg);
      const drift = diff(after, again);
      if (reapply === 'ok' && drift.added.length + drift.changed.length + drift.removed.length) reapply = 'changes catalog: ' + [...drift.added, ...drift.changed, ...drift.removed].slice(0, 3).join(', ');
      files[files.length - 1].reapply = reapply;
      before = again;
    }
    const final = await snapshot(pg);
    const clientExecutable = [...final].filter(([k, v]) => k.startsWith('fn:') && (v.anon || v.authenticated)).map(([k]) => k.slice(3)).sort();
    const definerFns = [...final].filter(([k, v]) => k.startsWith('fn:') && v.definer).length;
    // Every table a client-facing role can still reach at the end (read, or write), whichever file granted it.
    const clientTables = [...final].filter(([k, v]) => k.startsWith('table:') && (v.anon || v.authenticated))
      .map(([k, v]) => ({ table: k.slice(6), anon: !!v.anon, authenticatedWrite: !!v.authenticatedWrite })).sort((a, b) => a.table.localeCompare(b.table));
    return { files, summary: { files: files.length, core: files.filter(f => f.kind === 'core').length, proposals: files.filter(f => f.kind === 'proposal').length,
      tables: [...final.keys()].filter(k => k.startsWith('table:')).length, functions: [...final.keys()].filter(k => k.startsWith('fn:')).length, definerFns, clientExecutable, clientTables } };
  } finally { await pg.close(); }
}
