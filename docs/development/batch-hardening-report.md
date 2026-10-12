# Cross-module quality, security and integration pass (Module 6) — 2026-10-12

**PRODUCTION STATUS: NO-GO.** Branch `claude/taxguard-dev-20261012`. Local evidence only; GitHub CI does not run on this branch (NOT VERIFIED).

## Checks performed

| Check | Result | Evidence |
| --- | --- | --- |
| All proposals (Codex 000–110, Claude 230–260) applied in order on the actual core schema | PASS; Claude proposals re-apply idempotently | `proposalCompositionSecurity.test.ts` |
| Every `SECURITY DEFINER` taxguard function pins `search_path` (all proposals) | PASS (none missing) | same |
| New functions not executable by `anon` / `authenticated`; internal helpers not executable even by `service_role` | PASS | same |
| New tables not readable by `anon` / `authenticated` | PASS | same |
| Cross-module tenant isolation (ledger, practice, case) for a manager of another tenant | PASS (all refused) | same |
| Role matrix: client, recruiter, suspended administrator, unknown user refused in every module; unassigned staff refused; managers see practice detail but not the ledger without an assignment | PASS | same |
| Accounting balance, immutability and period locks (database level) | PASS, mutation-checked | `durableLedgerSql.test.ts` |
| Idempotency and replay (ledger postings / reversals, engagements, assignments, tasks, deadlines, cases) | PASS | ledger, practice and case HTTP tests |
| Optimistic concurrency (entries, engagements, tasks, cases) | PASS (version conflicts → 409) | same |
| True multi-connection concurrency (lock ordering, `FOR SHARE` / `FOR UPDATE`, `NOWAIT`) | **NOT VERIFIED** — PGlite is single-connection | requires commissioned non-production PostgreSQL |
| Simulated restart persistence | PASS (on-disk PGlite closed and reopened) | `durableLedgerSql.test.ts` |
| Dependency vulnerabilities (`npm audit`, prod and dev) | 0 known (info/low/moderate/high/critical) | run 2026-10-12 |
| Typecheck, lint, build, `git diff --check`, traceability, secret scan per checkpoint | PASS | checkpoint script output |
| UI loading / empty / error states, labels, captions | Present in all new panels (SSR tests) | panel tests; browser and assistive-technology testing NOT VERIFIED |

## Defects found and fixed during the batch

1. Cross-client approval / mutation by ID on the production-mounted bookkeeping router (commit `7471436`).
2. Hard-close bypass by naming a fabricated period; soft close ineffective; float balancing; double posting; close/reopen controls (`7471436`).
3. Accountant UI categorize call without credentials or client scope (`7471436`).
4. Staff-assignment `UNIQUE(tenant, client, role, status)` breaking repeated reassignment and multi-engagement staffing (proposal 025).
5. Archive allowed while draft engagements were open (proposal 025, found by test).
6. Task / deadline case links not validated against the client (proposal 025, found in review).
7. Nested aggregate in the trial-balance function; JavaScript `$$` replacement corrupting a proposal during editing (caught by the composition test before commit).
8. Non-deterministic event ordering in a test fixture (millisecond timestamp ties).

## Integration dependencies with the Codex workstream

- Branch not merged into `sync/taxguard-development-20261011`; merge at a coordinated checkpoint. Shared files touched append-only: completion matrix, decision register, master progress; small additive edits to `staff-access.routes.ts`, `api.ts`, `StaffAccessManagementPanel.tsx`, `server.ts`, routing files.
- Case materialization (proposal 026) overlaps the planned intake (007) → case path; agree a single creation path.
- Staff client creation needs proposal 006 alignment (decision HC2).
- Step-up re-authentication for proposals 002–004 / 010 recommended (Codex-owned).
- Legacy `20260930000000_taxguard_bookkeeping_schema.sql` tables are superseded by proposal 024 and unused by code (only a readiness probe checks `taxguard_journal_entries` exists); retire after review.
