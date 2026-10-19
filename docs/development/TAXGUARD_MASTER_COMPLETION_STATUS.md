# TaxGuard AI master completion status

Live progress against `TAXGUARD_MASTER_COMPLETION_PLAN.md`. Verified facts are separated from planned work. Release
status: **staging NO-GO, production NO-GO.**

## Cycle 1 (2026-10-19): Phase A audit and Phase B integration

### Verified (with evidence)

| Item | Commit | CI | Evidence |
|---|---|---|---|
| Case access follows the live assignment (`20261018090000`) | `fc4f9a5` | run 39222567841 success | `caseAssignmentRevocation.db` (6, failing-first) |
| Practice client detail confidentiality (`20261018100000`) | `d30259b` | run 39232901991 success | `practiceClientDetailScope.db` (8, failing-first) |
| Phase 15 integration readiness findings | `acb2086` | run 39233897596 success | dossier section; read-only comparison of 10 Codex branches |
| Trial-balance "as of" bound, base and Phase 15 exact wrapper (`20261018070000` amended) | `8f207c9` | run 39244878809 success | `ledgerYearScope.db` (9, failing-first). Merged-schema wrapper check: 10/10 with the fix, 8/10 without. |
| Migration integration plan (collision, refund withdrawal, merge steps, reproduction) | `8f207c9` | run 39244878809 success | `phase14-phase15-migration-integration-plan.md` |

Local validation at the start of this cycle:
- unit 5764 (352 files);
- PostgreSQL 126 (29 files);
- lint (`tsc --noEmit`), typecheck and build;
- release candidate (80 entries), NOT VALID review, secret scan and diff check.

On `8f207c9`, before commit: default browser 113/113 and provider browser 40/40.

Case-team restaffing (`20261018105000_taxguard_case_restaff`, `CaseStore.restaff`, `POST /api/cases/:caseId/team`) was verified locally before publication. Its CI result is recorded in the next cycle.
- `caseRestaff.db`: 7 cases, all failing first while the function was absent;
- PostgreSQL 133 (30 files);
- unit 5764/5764 (352 files) after traceability regeneration;
- lint, typecheck, build, release candidate (81 entries), NOT VALID review, secret scan and diff check;
- default browser 113/113 and provider browser 40/40.

Audits completed in this cycle (documents):
- `production-route-parity.md`: 17 development-only routers, each with its proposal dependencies and cutover
  requirement. None was mounted, because each depends on review-only proposals. It also records the framing and
  HSTS header gap.
- `ai-workforce-audit.md`: 61 DRAFT definitions, 13 named and 48 placeholders. Two bounded read capabilities
  are executable; governance, gateway, kill switch and human review are tested.

### In progress (not yet verified)

- **Production framing and transport headers:** the failing-first test is drafted; the fix is next.

### Blocked (recorded, not worked around)

- **Owner decisions:**
  - the migration version collision;
  - withdrawal of the Phase 14 refund records;
  - prior-year balance policy;
  - ledger engagement attribution;
  - the general-record policy for messaging, appointments and legal matters;
  - the 5 pre-existing version inversions.
- **Codex:** renumbering, publication of the refund reconciliation, replay and general-ledger corrections.
- **Infrastructure:**
  - native PostgreSQL 17 `pg_dump` / `pg_restore` for backup and restore acceptance;
  - a staging project;
  - malware scanner, email and SMS, and payment providers.
- **Legal:** IRC § 7216 consent wording.
- **AI:** commissioning of any of the 61 agents (58 require human policy or regulatory approval).
- **Codex environment:** the Windows `os.userInfo()` / `tsx` ENOMEM failure remains recorded as BLOCKED. It is
  not reproduced in this worktree, and that is not evidence it is fixed in Codex's environment.

### Next priorities

1. Production framing and transport headers (`X-Frame-Options`, `frame-ancestors`, HSTS) in `createProductionApp`.
2. Engagement-linked messaging, appointment and legal records (no general-record change without the policy).
3. A re-run of the function inventory for any remaining client-level reads.
4. Durable adapters for retained in-memory routes (`CONTROL-DURABILITY`).
