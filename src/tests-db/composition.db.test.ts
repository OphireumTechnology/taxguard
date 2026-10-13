import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS, PROPOSALS, startDatabase, type TestDatabase } from './harness';

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
  it('applies every migration then every proposal in name order', async () => {
    expect(MIGRATIONS.length).toBeGreaterThan(0);
    expect(PROPOSALS).toEqual([...PROPOSALS].sort());
    const r = await db.pool.query(`SELECT current_setting('server_version_num')::int AS v, inet_server_addr()::text AS addr`);
    expect(r.rows[0].v).toBeGreaterThanOrEqual(150000);
    expect(r.rows[0].addr).toBe('127.0.0.1/32');
  });
  it('re-applies the Claude proposals idempotently', async () => {
    const fs = await import('node:fs');
    for (const name of PROPOSALS.filter(n => /^202610122[3-9]|^20261012[3-9]|^20261013|^20261014/.test(n)))
      await db.pool.query(fs.readFileSync('docs/proposed-migrations/' + name, 'utf8'));
  });
  it('every SECURITY DEFINER taxguard function pins search_path', async () => {
    const r = await db.pool.query(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard%'
      AND p.prosecdef AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')`);
    expect(r.rows.map(x => x.proname)).toEqual([]);
  });
  it('no Claude-proposal function is executable by anon or authenticated', async () => {
    const r = await db.pool.query(`SELECT DISTINCT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
      AND p.proname ~ '^taxguard_(ledger|practice|case|doc|docreq|client_notification|bill|b2t|comm|apt|audit_center|legal|consult|rar|portal)_?' AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))`);
    expect(r.rows.map(x => x.proname)).toEqual([]);
  });
});
