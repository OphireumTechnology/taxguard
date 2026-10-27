# Local development consolidation manifest (2026-10-27)

Repository `OphireumTechnology/taxguard`. Inventory of every TaxGuard Git location on drive D, compared against
every GitHub branch, pull-request head and tag. TaxGuard only: no unrelated project content was found (the
uncommitted Codex work was searched for Phumulani, donor, volunteer, VAWA and fundraising terms; none).

**Baseline.** `origin/main` = `7aca22a` (PR #22 through `563bbda`, fast-forwarded with Block 65 on 2026-10-27).
Previous `main` was `6e31a40`. No history was rewritten, no branch deleted, nothing reset or cleaned.

## Locations inspected

| Path | Git store | Branch @ HEAD | Local state |
|---|---|---|---|
| `D:\TaxGuard\Development\123` | own | `sync/taxguard-development-20261011` @ `d0c8173` | clean; 47 local branches |
| `D:\TaxGuard\Development\123-claude` | worktree of `123` | `claude/taxguard-phase13b-security-workflow-completion` @ `9a5c82a` | clean |
| `D:\TaxGuard\Development\123-integration` | worktree of `123` | detached @ `cc2db59` | clean |
| `D:\TaxGuard\Development\123-codex` | own | `codex/taxguard-phase12-staging-acceptance` @ `9205017` | untracked `qa/acceptance-results/` (browser run artifacts) |
| `…\123-codex\.worktrees\phase14` | worktree of `123-codex` | Phase 14 / Block 65 / this consolidation | clean |
| `…\123-codex\.worktrees\phase13b` | worktree of `123-codex` | `codex/taxguard-phase13b-mfa-session-security` @ `b080217` | clean |
| `…\123-codex\backend-completion` | own (nested) | `codex/taxguard-parallel-backend-completion` @ `29dd4b1` | 5 unpushed commits; 2 modified, 1 untracked |
| `D:\TaxGuard\Development\123-codex-phase15` | own | `codex/taxguard-phase15-phase14-reconciliation` @ `a27159f` | 31 modified, 54 untracked entries (Codex, to 2026-10-21) |
| `D:\TaxGuard\Development\123-codex-phase14-continuation` | worktree of `phase15` | `claude/taxguard-phase14-full-platform-development` @ `545115a` | 7 staged/modified, 1 untracked (Codex, 2026-10-19) |
| `D:\TaxGuard\Publication\phase52-main-based-20261021` | worktree of `phase15` | `codex/taxguard-phase52-main-based-publication-20261021` @ `6e31a40` | clean |
| `D:\TaxGuard\Temp\pr18-trial` | worktree of `123-codex` | `codex/taxguard-phase12c-frontend-recovery` @ `f7e900f` | working files deleted only (no additions) |
| `D:\TaxGuard\Backups\merge-snapshot-20261011-092005` | own | `integration/taxguard-drive-d-20261010-123950` | a backup frozen mid-merge |

Stashes: none in any store.

## Packages

`source → branch → change → purpose → on GitHub? → in main? → action`

| # | Source | Change | Purpose | GitHub | In `main` | Action |
|---|---|---|---|---|---|---|
| 1 | `123-codex` phase14 | PR #22 branch through `563bbda` | Phase 14 platform (Blocks 1-64) | yes | yes | none (merged) |
| 2 | `123-codex` phase14 | `7aca22a` Block 65 | evidence lineage for calculation inputs | yes | yes | none; CI pending (see GitHub) |
| 3 | `123` | `d0c8173` on `sync/taxguard-development-20261011` | staff MFA re-enrolment screen, administrator complete/retry/cancel | yes | superseded | skipped: `main` has its own later implementation of the same screen and actions (`5e99c18` and successors, server step model `/mfa-recovery/status`, recovery history, provider suite 09). Cherry-picking conflicted in 6 files and would add a second, competing implementation. |
| 4 | `123` | `82cda69` `claude/taxguard-phase12c-wip-snapshot` | unvalidated Phase 12C snapshot | no | yes (as `c7138f5`) | skipped: tree identical to `c7138f5`, which is in `main` |
| 5 | `123`, Backups | 18 legacy branches `taxguard-m7-5` … `taxguard-m16-gemini-integration` (87 commits, separate root `965ebe7`, 2026-09-15 to 09-26) | pre-rewrite M7-M16 history | no | yes (as content) | skipped: `main`'s root `557d238` is the rebuilt M16 baseline; trees differ only in the `@google/genai` version pin |
| 6 | `123-codex-phase15` | PRs #24-#34 (stacked Phase 15 financial work) | reporting integrity, monetary precision, idempotent billing, ledger retries, catalog concurrency | yes (draft PRs) | no | **blocked**, see below |
| 7 | GitHub | PR #23 `copilot/taxguard-ai-independent-qa-20261018` | CI path-filter coverage | yes (draft) | no | not local work; left for its owner |
| 8 | `backend-completion` | 5 commits `1544608`…`29dd4b1` + uncommitted fingerprint changes | tax-engine record validation, recovery tooling, schema-ownership fingerprint | no | no | **blocked**: Codex's unpublished backend commits (standing instruction: do not modify) |
| 9 | `123-codex-phase14-continuation` | uncommitted invoice-document completeness + onboarding wait test | invoice presentation completeness | no | no | **blocked**: Codex's uncommitted, unvalidated work |
| 10 | `123-codex-phase15` | uncommitted (31 modified, 54 untracked) | Phase 15 adaptations, sync reviews | no | no | **blocked**: Codex's active checkout |
| 11 | `123-codex` | untracked `qa/acceptance-results/` (533 KB) | browser run artifacts | no | n/a | excluded: test output, not development |
| 12 | `pr18-trial` | deletions only | abandoned trial worktree | n/a | n/a | excluded: nothing to preserve |

## Preservation

Everything local-only was copied, read-only, to `D:\TaxGuard\Backups\consolidation-20261027\`:
`local-only-branches.bundle` (18 heads: packages 4, 5 and 8; verified), and for packages 8-10 the uncommitted
tracked diff (`*-uncommitted-tracked.patch`), untracked files (`*-untracked.tgz`, npm cache excluded), `git status`
and HEAD. No source checkout was modified.

## Blockers to merging package 6 (Phase 15)

1. **Unresolved schema conflict** (`phase14-phase15-billing-overlap.md`): both phases define
   `taxguard_invoice_refunds` and a keyed refund function with different shapes; with `CREATE TABLE IF NOT EXISTS`
   whichever runs first silently wins. Needs an owner decision on the single design.
2. **Migration timestamp collisions**: Phase 15 `20261018000000_taxguard_financial_reporting` and
   `20261018010000_taxguard_report_cent_transport` share timestamps with Phase 14 proposals already in `main`.
   Standing instruction: conflicting Phase 15 migrations are not renamed by Claude.
3. **Textual conflicts** in 11 files (manifests, execution order, traceability, release-candidate script,
   billing routes, store and client service, composition test).
4. All Phase 15 PRs are Codex drafts.

Packages 8-10 additionally need Codex (or the owner) to finish, validate and publish them.
