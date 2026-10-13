# Main reconciliation and cleanup (2026-10-13)

Integration branch `integration/taxguard-main-reconcile-20261013`, created from `origin/main`
(`fc36cac`). No history was rewritten, nothing was force-pushed, no branch was deleted, no
migration was applied anywhere, and the protected production project was not accessed.

## Branch audit (remote, relative to `origin/main` = `fc36cac`)

| Branch | Behind / ahead | Finding |
|---|---|---|
| `claude/taxguard-dev-20261012` (`5e99c18`) | 1 / 66 | Complete development line; contains all of `sync/taxguard-development-20261011` plus Phase 6. Merged. |
| `sync/taxguard-development-20261011` (`be15d7b`) | 1 / 65 | Fully contained in the Claude branch. Merged through it. |
| `fix/taxguard-dependency-security-20261010` | 2 / 1 | Squash-merged as PR #9 (`55f1c12`); content identical. |
| `integration/taxguard-pr6-pr7-safety` | 3 / 4 | Squash-merged as PR #8 (`2b0a4a3`); content identical. |
| `fix/taxguard-production-release-safety` | 3 / 1 | Included in PR #8; content identical. |
| `fix/taxguard-linux-rollup-main` | 3 / 3 | Superseded by PR #8; only differs in wording/comments of `deploy-pages.yml` (both manual-only). |
| `feature/taxguard-ai-agents`, `fix-ci-lockfile`, `fix-error-boundary-classification`, `sync/taxguard-development-20261010-053705`, `taxguard-m16-compliant-final`, `taxguard-m17-ai-tax-preparation-agent`, `taxguard-m18-3b-production-authority`, `taxguard-m18-4-complete-system` | n / 0 | Fully merged into main (no unique commits). |
| `backup-ophireum-main-before-taxguard` | unrelated history | Pre-TaxGuard project initialisation (2 commits). Backup; preserve. |

Local-only branches holding the only copies of their commits (M7–M16 milestone branches,
`backup-m16-*`, `backup-taxguard-m16-*`, `taxguard-m16-clean`, `taxguard-m16-gemini-integration`,
`taxguard-m16-linear-final`, `intelligence-core-sprint-1`, `taxguard-production-deployment`,
`taxguard-production-go-live`, `taxguard-production-integration`): pre-linear-history development,
superseded by the rebuilt linear history on main, but **preserved** (sole copies). No uncommitted
work exists in any worktree (`123`, `123-claude`, `123-integration`).

## Conflict resolution: main's `fc36cac` "migrate to Firebase and Google GenAI"

That commit changed only the lockfile, `src/main.tsx`, `vite.config.ts` and deletions; no source
was migrated (nothing imports `firebase` or `@google/genai`, and `package.json` still declares
`@supabase/supabase-js`, `openai` and `pg`). Per file:

| File(s) | Decision | Reason |
|---|---|---|
| `package-lock.json` (textual conflict) | development lockfile | main's lockfile does not match `package.json` (firebase/genai vs supabase/openai/pg); `npm ci` cannot succeed with that pair. |
| `supabase/migrations/20261008010000`–`060000` (6 AI governance / orchestration / gateway / capability / execution-ledger / advisory-routing migrations) | restored | Migration history is retained; required by the AI governance code (A00–A60) and its tests. |
| `tests/*.test.ts` (6 suites), `vitest.config.ts` | restored | Active, passing suites and the unit-test configuration. |
| `tools/**` (76 files: milestone build/repair generators, agent scripts, `*.before-*` copies, cached context dumps) | main's deletion kept | One-off generators and backups; not invoked by `package.json`, CI or scripts (referenced only in exclusion lists). Recoverable from history (`fc36cac^`). |
| `vite.config.ts.before-test-exclude-20260923-194246` | main's deletion kept | Backup copy. |
| `vite.config.ts`, `src/main.tsx` | main's changes kept | Unused import removed; React exposed on `window` (main's choice, kept). |

**Decision for the owner:** if a Firebase / Google GenAI migration is actually intended, it is a
separate, unstarted architecture change (identity, database, AI gateway, migrations, tests) and
should be planned as such; this reconciliation keeps the working Supabase/PostgreSQL stack.

## Obsolete code removed (cleanup commit)

| Removed | Verified | Replacement |
|---|---|---|
| `src/components/portal/views/{Amendment,AuditActivity,Expenses,FinancialConnections,Overview,TaxWorkspace,Approvals,Deliverables}View.tsx` (~4,100 lines) | Not rendered anywhere (two were imported but unused by `AuthenticatedClientDashboard`, the rest imported by no reachable module); not referenced by tests, scripts or traceability. They displayed fabricated demonstration records (`MOCK_*`, a named taxpayer, a sample 1040). | Durable client stage views, document vault (027), role dashboards (032). |
| `src/services/clientPortalService.ts` (`MOCK_*` / `INITIAL_*` demonstration data) | Imported only by the removed views. | None needed (no live data). |

Not removed (criteria not met): `src/demo/**` is unmounted but `src/demo/mockData` is imported by
`stageOneOnboarding.test.ts` and it is an explicitly labelled demo mode — owner decision.
Legacy in-memory routes remain (see `durable-workflow-inventory.md`): still called by active panels.

## Outstanding migration proposals (none applied anywhere)

`docs/proposed-migrations/`: 28 proposals, `20261012000000` … `20261012380000` (staff identity and
MFA 000–011 and 034/035/037, sessions 023, ledger 024, practice 025, cases 026, vault 027,
billing 028, book-to-tax 029, bookkeeper queue 030, document requests 031, dashboards 032, tax
engine 033/036/038). `supabase/migrations/` holds 13 migrations (7 on main before, plus the 6
restored AI governance migrations).

## Recommended remote branch deletions (awaiting approval; nothing deleted)

See the final report in the conversation; deletion of squash-merged branches removes their
original commit objects (content is in main).
