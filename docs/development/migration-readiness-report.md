# Migration readiness report (Phase 10, 2026-10-14)

**Status: NOT APPROVED for any hosted database.** Nothing has been applied to a Supabase project.
The protected production project `cvrlhixxczerytiocxid` was not accessed. Every proposal still needs
human review and approval, in the order given by the canonical manifest.

- Canonical order and per-file inventory: [migration-execution-manifest.md](migration-execution-manifest.md)
  (machine-readable: `migration-execution-manifest.json`).
- Audit tool: `scripts/migrations/migration-audit.mjs`; manifest: `node scripts/migrations/build-migration-manifest.mjs`
  (`--check` fails when stale). Enforced by `src/tests/migrationReadinessAudit.test.ts`.

## Method

Every file is applied, in the canonical order, to a throw-away in-process PGlite database, twice:
once with Supabase's default privileges reproduced (`ALTER DEFAULT PRIVILEGES … GRANT ALL … TO anon,
authenticated, service_role`) and once without. After each file the catalog is snapshotted and diffed:
tables, functions (body and settings hash, `SECURITY DEFINER`, `search_path`, EXECUTE by anon /
authenticated / service_role), policies, triggers, indexes, constraints (validated or not). Each file is
then applied a second time at once: it must succeed and leave the catalog unchanged (idempotency).
Top-level statements (comments, string literals and function bodies removed) are scanned for
non-transactional, destructive and privilege-widening statements. The same order is applied on a real
PostgreSQL server by `src/tests-db` (composition, concurrency, restore rehearsal).

Scope: 13 core migrations, 40 proposals (000–011, 023–050) and the separate append-only audit
proposal (`docs/sql/taxguard-audit-append-only.proposal.sql`) — 54 files.

## Findings

| # | Finding | Severity | Resolution |
|---|---|---|---|
| F1 | Seven core bookkeeping tables (`20260930`) have a permissive `FOR ALL TO public` policy keyed on a top-level `tenant_id` JWT claim. With an access-token hook adding that claim, any signed-in user of a tenant — a client included — could read **and write** journal entries, bank transactions, reconciliations, chart of accounts, periods, book-to-tax adjustments and sync state through the Data API with the public anon key. | High (conditional on a token hook) | Proposal **049** drops the seven policies. |
| F2 | With Supabase defaults every core table is granted to anon and authenticated; core migrations rely on RLS alone. The application never reads tables from the browser (all stores use the service role). | Medium | **049** revokes all client-role table, sequence and function privileges on `taxguard_*` / `ai_*` objects except authenticated SELECT on `taxguard_clients` and `taxguard_cases` (needed by the vault storage policies of `20261004`), and changes the migration role's default privileges. |
| F3 | `taxguard_is_staff_assigned_to_client` / `_engagement` (SECURITY DEFINER) are granted to authenticated (and to anon by default), so any caller can ask whether an arbitrary user is assigned to an arbitrary client. | Low (information disclosure) | **049** revokes them from client roles; their only callers are policies on tables no longer granted to client roles. |
| F4 | Fourteen trigger functions and `taxguard_privileged_max_age_seconds()` are executable by PUBLIC. Trigger functions cannot be called directly; the constant function is called only inside definer functions. | Informational | **049** revokes PUBLIC EXECUTE. The service role never calls them directly (manifest section "service-role execution depended only on PUBLIC"). |
| F5 | Eleven historical files are not re-runnable (six AI core migrations, `20260930`, Codex proposals 016 / 021 / 024, the separate audit proposal): they fail on a second application. | Operational | Apply exactly once through the migration tool's version table; never re-run by hand. New proposals 047–050 are re-runnable (enforced). |
| F6 | The AI core migrations (`20261008*`) contain explicit `BEGIN; … COMMIT;`. | Operational | Apply each as its own migration; the Supabase CLI tolerates the nested transaction (warning only). |
| F7 | Twelve constraints are added `NOT VALID` (025, 026, 027, 028, 039). | Operational | After applying, inspect existing rows, then `ALTER TABLE … VALIDATE CONSTRAINT …` in a maintenance window (listed in the manifest). |
| F8 | Superseded functions: 16 functions are replaced by later proposals (18 replacements) (for example `taxguard_accept_staff_invitation` 016 → 020 → 035; `taxguard_bill_list` 028 → 047). | Ordering hazard | Apply strictly in manifest order; applying an earlier file after a later one would silently restore a weaker version. The manifest lists every supersession with the file it replaces. |
| F9 | `CREATE EXTENSION` in the core schema. | Operational | Supabase provides `pgcrypto` / `uuid-ossp`; confirm they are enabled in the target project. |
| F10 | No file contains `CREATE INDEX CONCURRENTLY`, `ALTER TYPE … ADD VALUE`, `VACUUM`, `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DISABLE ROW LEVEL SECURITY`, data `UPDATE`/`DELETE`, or a `GRANT` to anon / authenticated / PUBLIC in any proposal. Every table has RLS enabled; every `SECURITY DEFINER` function pins `search_path`. | — | Enforced by the audit test. |

Final state (all 54 files, Supabase defaults): **no TaxGuard or AI function is executable by anon or
authenticated; the only client-reachable tables are `taxguard_clients` and `taxguard_cases`, read-only,
for authenticated users, limited by their own-row policies.**

## Duplicates and conflicts

- No duplicate migration timestamps; proposal names strictly increase (enforced).
- No two files create the same table. Function redefinitions are intentional supersessions (F8).
- Grants: 049 is the only file that changes default privileges (enforced); later proposals still
  revoke explicitly (050 does).

## Approvals required (owner)

1. Review and approve each proposal in manifest order (000–011, 023–050), including 047–050 added in Phase 10.
2. Approve **049** separately: it changes the security model of the Data API (decision recorded in
   `phase10-reviews.md`). Decide whether direct client storage reads (and therefore the remaining
   authenticated reads on clients and cases) are retired.
3. Approve the `NOT VALID` validation window (F7).
4. Approve the separate append-only audit proposal (`docs/sql`) and its custody arrangement.

## Rollback

Each proposal documents its rollback. For 047, 048 and 050, executable rollback scripts are in
`docs/proposed-migrations/rollback/` and are rehearsed on disposable local PostgreSQL (roll back, verify
data unchanged, re-apply) by `src/tests-db/backupRestore.db.test.ts`. 049 is intentionally not given an
automatic rollback: undoing it restores the exposure in F1–F3; a rollback would be a manual,
reviewed change.
