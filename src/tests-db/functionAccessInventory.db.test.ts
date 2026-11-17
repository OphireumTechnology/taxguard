import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDatabase, type TestDatabase } from './harness';

// Function access inventory (Block 79). On a disposable PostgreSQL with every migration and proposal applied in
// execution order, it reads the current definition of every function the server role can execute that takes an
// actor, and follows the calls it makes into other public functions. A function is SCOPED when it, or a function it
// calls, reaches an engagement, tax-year, case or return-version scope check. Every other one must be listed, with a
// reviewed reason, in docs/development/function-access-inventory.json; a new unlisted one fails this test (failing
// first), and so does a listed one that no longer exists or has become scoped. Synthetic database only.
const INVENTORY = 'docs/development/function-access-inventory.json';
const SCOPE_HELPERS = ['taxguard_staff_scope', 'taxguard_staff_record_scope', 'taxguard_case_actor', 'taxguard_case_slot_live', 'taxguard_ledger_year_scope',
  'taxguard_ledger_year_guard', 'taxguard_practice_item_scope', 'taxguard_practice_event_scope', 'taxguard_collection_scope', 'taxguard_tax_conclusion_scope',
  'taxguard_tax_research_scope', 'taxguard_tax_return_qc_scope', 'taxguard_tax_return_final_scope', 'taxguard_tax_return_qc_live', 'taxguard_tax_return_final_live'];
let db: TestDatabase;
let entries: { name: string; scoped: boolean }[] = [];

beforeAll(async () => {
  db = await startDatabase();
  const fns = (await db.pool.query<{ name: string; src: string; entry: boolean; actor: boolean }>(`
    SELECT p.proname AS name, p.prosrc AS src, has_function_privilege('service_role', p.oid, 'EXECUTE') AS entry,
      'p_actor' = ANY (COALESCE(p.proargnames, '{}')) AS actor
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'`)).rows;
  const byName = new Map<string, string[]>();
  for (const f of fns) byName.set(f.name, [...(byName.get(f.name) ?? []), f.src]);
  const names = [...byName.keys()];
  const calls = (src: string) => names.filter(n => new RegExp(`\\b${n}\\s*\\(`).test(src));
  const memo = new Map<string, boolean>();
  const reaches = (name: string, seen = new Set<string>()): boolean => {
    if (SCOPE_HELPERS.includes(name)) return true;
    if (memo.has(name)) return memo.get(name)!;
    if (seen.has(name)) return false;
    seen.add(name);
    const r = (byName.get(name) ?? []).some(src => calls(src).some(c => c !== name && reaches(c, seen)));
    memo.set(name, r); return r;
  };
  entries = [...new Set(fns.filter(f => f.entry && f.actor).map(f => f.name))].sort().map(name => ({ name, scoped: reaches(name) }));
  if (process.env.TG_INVENTORY_DUMP) fs.writeFileSync(process.env.TG_INVENTORY_DUMP, JSON.stringify(entries, null, 1));
}, 240_000);
afterAll(async () => { await db?.stop(); });

describe('function access inventory', () => {
  it('every server-callable actor function is engagement-scoped or listed with a reviewed reason', () => {
    const listed = JSON.parse(fs.readFileSync(INVENTORY, 'utf8')) as { categories: Record<string, string>; functions: Record<string, { category: string; reason: string }> };
    const unscoped = entries.filter(e => !e.scoped).map(e => e.name);
    expect(unscoped.filter(n => !listed.functions[n]), 'unscoped and not reviewed').toEqual([]);
    expect(Object.keys(listed.functions).filter(n => !unscoped.includes(n)), 'listed but no longer unscoped or no longer present').toEqual([]);
    for (const [name, f] of Object.entries(listed.functions)) {
      expect(Object.keys(listed.categories), name).toContain(f.category);
      expect(f.reason.length, name).toBeGreaterThanOrEqual(20);
    }
    expect(entries.filter(e => e.scoped).length).toBeGreaterThan(100);
  });
});
