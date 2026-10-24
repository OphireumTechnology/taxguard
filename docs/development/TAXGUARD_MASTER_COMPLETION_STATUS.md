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
| Production framing and transport headers (`securityHeaders.ts`) | `7c26026` | run 39255408711 success | `productionFrameHeaders.test` (failing-first). GitHub Pages cannot send headers: hosting decision for the owner. |
| Production route cutover gate (`routeCutover.ts`), AI deny-by-default regression | `092e756` | run 39260819850 success | `routeCutover.test` (8); `aiWorkforceDenyByDefault.test` (61: 58 `UNMAPPED_DENIED`, 3 bounded, none with execution authority) |
| Manager case-team form; route-allowlist defect fixed | `f5ae250` | run 39269700388 success | failing-first allowlist test; provider browser 41/41 |
| Tax Rules console (sources, rule sets, maker-checker) | `91fc6a3` | run 39278170178 success | `taxRulesPanel.test` (5), default browser suite 07 |
| Rule-set tests and calculation runs | `57dab4b` | run 39283183667 success | `taxRulesPanel.test` (6) |
| Engagement tax years and practice deadlines | `aafb24c` | run 39288880317 success | `practiceClientsPanel.test` (6), provider browser 42/42 |
| Security event volume in the audit center | `cb1bb29` | run 39294602087 success | `auditSecurityVolume.test` (2) |
| Rule-set authoring | `bc3ad5d` | run 39300321185 cancelled (superseded); verified by run 39300732135 on `84302a6` | `taxRulesPanel.test` (8), default browser 116/116 |
| Unreachable code inventory (read-only, nothing deleted) | `84302a6` | run 39300732135 success | `unreachable-code-inventory.md`: 274 modules |
| Production refusal of the process-local case authority, with Codex's reviewer patches (Block 39) and the removal proposal | `1a30705` | run 40094395819 success | `caseAuthorityProductionDurability.test` (23, 20 failing first); reviewer refusals (3 failing first); default browser 116/116, provider 42/42 |
| Production refusal of the Stage 02 accountant document-review store (Block 40) | `406978b` | run 40098439008 success | `stageTwoDocumentReviewProductionDurability.test` (8, 5 failing first); SEC-CLIENT-023 changed deliberately |

Local validation at the start of this cycle:
- unit 5764 (352 files);
- PostgreSQL 126 (29 files);
- lint (`tsc --noEmit`), typecheck and build;
- release candidate (80 entries), NOT VALID review, secret scan and diff check.

On `8f207c9`, before commit: default browser 113/113 and provider browser 40/40.

Case-team restaffing (`20261018105000_taxguard_case_restaff`, `CaseStore.restaff`, `POST /api/cases/:caseId/team`) was published as `3676f89` (CI run 39250380841 success). Local evidence before publication:
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

- **Practice-operations production refusal (Block 41), published as `ad56f24`.** Its CI run 40102308061 was **cancelled
  at the 30-minute job timeout** inside the automated tests step, which took 3.6 minutes on the previous run. No newer push was involved. The log needs authenticated access, and the full suite passes locally (5931) with no hanging handles. It is verified only once a later run passes on a head that contains it.
  Details: Every `/api/operations` service is in memory. In
  production all routes now answer 503 `DURABLE_OPERATIONS_STORE_REQUIRED` after authentication and the client
  check; the payment webhook answers `PAYMENT_PROVIDER_NOT_COMMISSIONED`. `practiceOperationsProductionDurability.test`
  (37): 35 failed first. SEC-CLIENT-021 and 022a changed deliberately from 200 to the refusal, and their scoping moved
  to development cases.
  - **Audit of the remaining routers.** The bookkeeping fallthrough is already refused (regression guard added).
    Profile, accountant and tax forms were checked, and nothing was changed.
- **Payment webhook signature verification (Block 42).** The development handler now verifies the raw bytes, bounds
  the timestamp to 300 seconds, accepts rotated `v1` signatures and compares in constant time.
  `stripeWebhookSignature.test` (10): 5 failed first. Production still refuses the webhook.

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

1. Durable providers for the refused production surfaces (case authority, Stage 02 document review, practice operations): `CONTROL-DURABILITY` cutover, after the owner approves the proposals.
2. Engagement-linked messaging, appointment and legal records (no general-record change without the policy).
3. A re-run of the function inventory for any remaining client-level reads.
4. Durable adapters for retained in-memory routes (`CONTROL-DURABILITY`).
