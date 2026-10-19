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

- **Production framing and transport headers:** `src/server/securityHeaders.ts` is used by `createProductionApp`
  and by `server.ts` in production; `productionFrameHeaders.test` failed first. Local validation passes: PostgreSQL 133, unit 5770, lint,
  typecheck, build, release candidate (81 entries), secret scan, diff check, default browser 113/113 and provider
  browser 40/40.
  **Remaining:** GitHub Pages cannot send headers, so HTML served from Pages stays framable until it moves to a
  host or CDN that can. This is a hosting decision for the owner.

- **Production route cutover gate:** `src/server/routeCutover.ts` is wired into `createProductionApp`, with the
  admin-only `GET /api/route-cutover`; `routeCutover.test` (8). It fails closed: no proposal is approved, so nothing
  is mounted. Local validation passes: PostgreSQL 133, unit 5839 (including
  `aiWorkforceDenyByDefault.test`, 61 cases: 58 agents `UNMAPPED_DENIED` and 3 bounded, none with execution authority),
  lint, typecheck, build, release candidate (81 entries), secret scan, diff check, default browser 113/113 and provider
  browser 40/40. The security-header package was published as `7c26026` (CI run 39255408711 success).

- **Manager case-team form** in Case Workflow: `caseService.restaff`, `restaffCandidates`, Refresh team, specific refusal
  messages, entries kept on refusal. The browser test found a route-allowlist defect (`practiceManagerAccess.ts` did
  not list `POST /api/cases/:id/team`), now fixed with a failing-first allowlist test. Local validation passes:
  PostgreSQL 133, unit 5842, lint, typecheck, build, release candidate (81 entries), secret scan, diff check, default
  browser 113/113 and provider browser 41/41 (the new reassignment journey included). The route-cutover gate was
  published as `092e756` (CI run 39260819850 success).

- **Tax Rules console** (`TaxRulesPanel`, `taxEngineService`; manager and reviewer dashboards; coverage read allowed for
  managers): `taxRulesPanel.test` (5) and default browser suite 07. The manager case-team UI was published as
  `f5ae250` (CI run 39269700388 success). Local validation passes: PostgreSQL 133, unit 5847, lint, typecheck, build, release candidate (81 entries), secret
  scan, diff check, default browser 114/114 and provider browser 41/41.

- **Rule-set tests and calculation runs:** tests and the latest recorded run with a Run tests action in Tax Rules;
  calculation runs with reviewer decisions in Case Workflow. `taxRulesPanel.test` (6) and local validation passes:
  PostgreSQL 133, unit 5848, lint, typecheck, build, release candidate (81 entries), secret scan, diff check, default
  browser 115/115 and provider browser 41/41. The Tax Rules console was published as `91fc6a3`.

- **Engagement tax years and practice deadlines** in Clients & Engagements: `practiceClientsPanel.test` (6) and local validation passes:
  PostgreSQL 133, unit 5850, lint, typecheck, build, release candidate (81 entries), secret scan, diff check, default
  browser 115/115 and provider browser 42/42. The Tax Rules console (`91fc6a3`, CI run 39278170178) and rule-set tests
  and calculation runs (`57dab4b`, CI run 39283183667) are published with CI success.

- **Security event volume** in the audit center: `auditSecurityVolume.test` (2) and local validation passes:
  PostgreSQL 133, unit 5852, lint, typecheck, build, release candidate (81 entries), secret scan, diff check, default
  browser 115/115 and provider browser 42/42. Tax years and deadlines were published as `aafb24c` (CI run 39288880317 success).

- **Rule-set authoring** in the Tax Rules console: `taxRulesPanel.test` (8) and local validation passes: PostgreSQL 133,
  unit 5854, lint, typecheck, build, release candidate (81 entries), secret scan, diff check, default browser 116/116
  and provider browser 42/42. The audit security volume was published as `cb1bb29` (CI run 39294602087 success).

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

1. Production framing and transport headers (validation and publication).
2. AI capability reads: verify that `document.read` and `workflow.read` follow the requesting human's engagement and
   year scope; failing-first if not.
2. Engagement-linked messaging, appointment and legal records (no general-record change without the policy).
3. A re-run of the function inventory for any remaining client-level reads.
4. Durable adapters for retained in-memory routes (`CONTROL-DURABILITY`).
