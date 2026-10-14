import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildManifest, renderMarkdown, MANIFEST_JSON, MANIFEST_MD } from '../../scripts/migrations/build-migration-manifest.mjs';
import { staticHazards } from '../../scripts/migrations/migration-audit.mjs';

// Phase 10 migration readiness: composes every core migration and proposal in the canonical order
// on PGlite (with and without Supabase's default privileges) and enforces database-wide invariants.
// Offline; synthetic empty schema; nothing is applied anywhere else.
let m: any;
beforeAll(async () => { m = await buildManifest('.'); }, 240000);

// Files that existed before Phase 10 and are not re-runnable. They must be applied exactly once
// through the migration tool's version table; new proposals must be re-runnable.
const NOT_RERUNNABLE = ['20260930000000_taxguard_bookkeeping_schema', '20261008000000_taxguard_ai_registry_foundation', '20261008010000_taxguard_ai_governance_decisions',
  '20261008020000_taxguard_ai_orchestration_history', '20261008030000_taxguard_ai_gateway_admission', '20261008040000_taxguard_ai_capability_execution',
  '20261008050000_taxguard_ai_execution_ledger', '20261012020000_taxguard_staff_acceptance', '20261012070000_taxguard_client_intake_drafts',
  '20261012100000_taxguard_mfa_recovery_requests', 'taxguard-audit-append-only.proposal'];
const name = (f: string) => f.split('/').pop()!.replace(/\.sql$/, '');

describe('migration readiness audit', () => {
  it('applies every file in the canonical order, with and without Supabase default privileges', () => {
    expect(m.summary.core).toBe(13);
    expect(m.files.map((f: any) => f.kind)).toEqual([...Array(13).fill('core'), ...Array(m.summary.proposals).fill('proposal'), 'separate-proposal']);
    expect(m.files.filter((f: any) => !f.appliesInOrder).map((f: any) => f.file)).toEqual([]);
    // Names are strictly increasing, so the order is unambiguous.
    const proposals = m.files.filter((f: any) => f.kind === 'proposal').map((f: any) => name(f.file));
    expect([...proposals].sort()).toEqual(proposals);
    expect(new Set(proposals.map((p: string) => p.slice(0, 14))).size).toBe(proposals.length);
  });
  it('leaves no TaxGuard or AI function executable by anon or authenticated', () => {
    expect(m.summary.clientExecutableFunctionsWithSupabaseDefaults).toEqual([]);
    expect(m.summary.clientExecutableFunctionsWithoutDefaults).toEqual([]);
  });
  it('enables row-level security on every table and pins search_path on every SECURITY DEFINER function', () => {
    expect(m.files.flatMap((f: any) => f.tablesWithoutRls)).toEqual([]);
    expect(m.files.flatMap((f: any) => f.definerWithoutSearchPath)).toEqual([]);
  });
  it('every prerequisite comes earlier in the order', () => {
    for (const f of m.files) for (const p of f.prerequisites) expect(p, f.file).toBeLessThan(f.order);
  });
  it('only the recorded historical files are not re-runnable', () => {
    expect(m.files.filter((f: any) => f.reapply !== 'ok').map((f: any) => name(f.file))).toEqual(NOT_RERUNNABLE);
  });
  it('no proposal contains a non-transactional, destructive or privilege-widening top-level statement', () => {
    const forbidden = ['NON_TRANSACTIONAL_INDEX', 'ENUM_VALUE_ADDED', 'VACUUM', 'EXPLICIT_TRANSACTION', 'TABLE_DROPPED', 'COLUMN_DROPPED', 'TRUNCATE', 'RLS_DISABLED', 'GRANT_TO_CLIENT_ROLE', 'TABLE_LOCK'];
    for (const f of m.files.filter((x: any) => x.kind !== 'core')) expect(f.hazards.filter((h: string) => forbidden.includes(h)), f.file).toEqual([]);
    // Default-privilege changes only in the reviewed lock-down proposal.
    expect(m.files.filter((f: any) => f.hazards.includes('DEFAULT_PRIVILEGES')).map((f: any) => name(f.file))).toEqual(['20261014490000_taxguard_data_api_lockdown']);
  });
  it('after the lock-down, client-facing roles keep only the storage-policy reads on clients and cases', () => {
    const last = m.files.find((f: any) => name(f.file) === '20261014490000_taxguard_data_api_lockdown');
    expect(last.clientRoleAccess).toEqual([{ object: 'table taxguard_cases', write: false }, { object: 'table taxguard_clients', write: false }]);
    // Final state, whichever file granted it: no anon access and no client-role writes anywhere.
    expect(m.summary.clientReachableTablesWithSupabaseDefaults).toEqual([{ table: 'taxguard_cases', anon: false, authenticatedWrite: false },
      { table: 'taxguard_clients', anon: false, authenticatedWrite: false }]);
  });
  it('records every supersession with the file it replaces', () => {
    const sup = m.files.flatMap((f: any) => f.supersedes.map((s: any) => [name(f.file).slice(0, 14), s.function, s.previous && name(s.previous).slice(0, 14)]));
    expect(sup).toEqual(expect.arrayContaining([['20261014470000', 'taxguard_bill_list', '20261012280000'], ['20261014470000', 'taxguard_bill_record_payment', '20261012280000'],
      ['20261014480000', 'taxguard_audit_center_redact', '20261014410000'], ['20261012350000', 'taxguard_accept_staff_invitation', '20261012060000']]));
    for (const [, , previous] of sup) expect(previous).toBeTruthy();
  });
  it('the committed manifest is current', () => {
    expect(readFileSync(MANIFEST_JSON, 'utf8')).toBe(JSON.stringify(m, null, 2) + '\n');
    expect(readFileSync(MANIFEST_MD, 'utf8')).toBe(renderMarkdown(m));
  });
});

describe('static hazard detection', () => {
  it.each([
    ['CREATE INDEX CONCURRENTLY idx ON t(a);', 'NON_TRANSACTIONAL_INDEX'], ["ALTER TYPE s ADD VALUE 'x';", 'ENUM_VALUE_ADDED'], ['BEGIN; SELECT 1; COMMIT;', 'EXPLICIT_TRANSACTION'],
    ['DROP TABLE t;', 'TABLE_DROPPED'], ['ALTER TABLE t DROP COLUMN c;', 'COLUMN_DROPPED'], ['GRANT SELECT ON t TO anon;', 'GRANT_TO_CLIENT_ROLE'],
    ['GRANT EXECUTE ON FUNCTION f() TO service_role, authenticated;', 'GRANT_TO_CLIENT_ROLE'], ['ALTER TABLE t DISABLE ROW LEVEL SECURITY;', 'RLS_DISABLED'],
    ['UPDATE t SET a = 1;', 'DATA_UPDATE'], ['DELETE FROM t;', 'DATA_DELETE'],
  ])('flags %s', (sql, code) => { expect(staticHazards(sql).map((h: any) => h.code)).toContain(code); });
  it('ignores comments, string literals and function bodies', () => {
    expect(staticHazards(`-- DROP TABLE t;\nCREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $$ BEGIN DELETE FROM t; UPDATE t SET a = 1; END $$;\nSELECT 'DROP TABLE t';`)).toEqual([]);
  });
});
