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
| Production refusal of the practice-operations services (Block 41); bookkeeping fallthrough regression guard | `ad56f24` | run 40102308061 **cancelled** at the 30-minute job timeout in automated tests (one-off, not reproduced); verified by run 40105263474 success on `2cf2a23`, which contains it | `practiceOperationsProductionDurability.test` (37, 35 failing first); `bookkeepingProductionFallthrough.test` (4) |
| Payment webhook signature verification: raw bytes, 300-second window, rotation, constant time (Block 42) | `2cf2a23` | run 40105263474 success (automated tests 3 min 45 s) | `stripeWebhookSignature.test` (10, 5 failing first) |
| Accessibility audit of the newer staff surfaces: Tax Rules module, expanded forms, audit security view (Block 43) | `98c0277` | run 40144714158 success | suite 16; default browser 118/118, provider 42/42 |
| Phone-width layout of the newer staff surfaces at 375 px (Block 44) | `634a4e0` | run 40273072871 success | suite 16; default browser 121/121, provider 42/42 (7 files) |
| Reviewer ledger and book-to-tax review; BookToTaxPanel stale-response fix; reviewer dashboard 375 px overflow (Block 45) | `7d54b5f` | run 40281778638 success | suite 03 (8 browser cases); default browser 125/125, provider 42/42 |

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

- **Full-pipeline certification (Block 60, tests only).** Provider journey B (first sign-in through Stage 08, Stage 09
  blocked) now ends with diagnostics and risk on the same case: only the missing approved calculation blocks, risk is
  BLOCKED for exactly that and the absent policy, the client is refused. TAX-DIAGNOSTICS and TAX-RISK PROVIDER_VERIFIED.
- **Prompt-injection regression (Block 59, tests only), published as `4df4fab`.** Stored injection text never reaches the provider; an approved
  prompt cannot displace the enforced boundary; 29 adversarial replies are rejected and an injected reply leaves no
  result or action. `aiPromptInjectionRegression.test` (31), `aiGovernedGateway.test` (5 new).
- **Agent permission completeness (Block 58, tests only), published as `c5ff7bc`.** All 58 unmapped agents refused at runtime under full synthetic
  grants (41 by the mapping check, 17 by the role check); the composed schema grants nothing and has explicit DENY rows for
  every agent, tool action, data class and stage. `aiGovernanceControlPlane.test`, `aiPermissionComposition.db.test` (4).
- **A00 and the case readiness gate (Block 57), published as `d44c503`.** A00 reads the diagnostics gate for the verified tenant, records and reports
  it, and never acts on it; anything unreadable is UNAVAILABLE. Case-key mapping verified on PostgreSQL.
  `aiA00Orchestration.test` (12 new), `a00CaseReadiness.db.test` (3).
- **Readiness and risk in Case Workflow (Block 56), published as `d3f0f69`.** Store, routes and `CaseReadinessPanel` over the diagnostics and risk
  proposals; AI confidence is never taken from a request; a never-diagnosed case is not ready (proposal change, review only).
  `caseReadinessHttp.db.test` (6), `caseReadinessPanel.test` (4), suite 07 e2e (3).
- **AI run reconstructability (Block 55, test only), published as `92df2b6`.** One query reconstructs every architecture field of an executed
  governed test run from recorded links; confidence and review fields stay NULL until set. `aiGovernedGateway.test`.
- **Risk, materiality and the decision gate (Block 54, database layer), published as `272bd2f`.** Review-only proposal `20261018170000`: versioned,
  independently approved materiality policies (none seeded) and immutable, audited assessments. BLOCKED, human review or
  CONTINUE only under an approved policy that allows it; AI confidence never removes a reason. `caseRiskMateriality.db.test` (6).
  **Owner decision:** the materiality thresholds.
- **Case readiness diagnostics (Block 53, database layer), published as `1ac5a95`.** Review-only proposal `20261018160000`: governed, versioned rule
  severities; persisted, immutable diagnostics that clear when the data changes; only INFO and WARNING waivable; a gate for
  future finalization. `caseDiagnostics.db.test` (5).
- **Tax research workspace (Block 52), published as `5536e68`.** `CaseResearchPanel` in Case Workflow over the development-only tax-engine router. Browser
  journey (suite 07): draft, cite and submit; the preparer's approval is refused; the reviewer approves; persistence after a
  reload; audit; a revoked assignment is refused on the open page; 375 px.
- **Block 51 CI repair, published as `d6b6222` (CI run 40318291470 success).** Run 40300291410 failed on `clientOnboarding.db`:
  a whole-row regex matched a microsecond timestamp. The stored TIN is now checked field by field, with a regression.
- **Tax research memos (Block 51, database layer), published as `e21b4d0`; verified by run 40318291470.** Review-only proposal `20261018150000`: case-scoped memos with
  classified citations; approval by the independent case reviewer requires verified authoritative support, never AI
  inference alone; no return is changed; a revoked assignment ends access. `taxResearch.db.test` (7).
- **Agent evaluation and the activation gate (Block 50), published as `a94dbcb`.** Review-only proposal `20261018140000` covers evaluation
  suites (independently approved), pinned runs, append-only results and database-derived outcomes. A trigger refuses an
  ACTIVE agent version without a passing evaluation of its exact agent, model and prompt versions.
  `aiAgentEvaluation.test` (9). No agent is activated.
- **Book-to-tax maker-checker coverage (Block 49), published as `56cbdbf`.** Self-approval of an adjustment and of a workpaper is refused,
  with no approval audit row. The current execution-order definitions keep the refusal. Each case failed when its
  check was removed.
- **AI emergency stop through the UI (Block 48), published as `bb386f3`.** Provider journey N: the administrator engages an agent stop with
  confirmation in the UI, the server records it, the agent shows as STOPPED, and the accountant has no control. Register
  corrected: kill switch `PROVIDER_VERIFIED`, AI Control Center `BROWSER_VERIFIED`.
- **Bookkeeper ledger workspace scope isolation (Block 47), published as `f5c095a`.** A slower response for the previously selected tax year
  appeared under the new year's heading, demonstrated deterministically in suite 03. Responses are now tagged with
  client and year and stale ones discarded, and a scope change clears the previous queue, totals and drafts.
- **Architecture implementation register (Block 46), published as `5967545` (CI run 40283021034 success).** `architecture-implementation-register.json` maps 42 components of
  the owner's full-development architecture to repository evidence. `architectureImplementationRegister.test`
  enforces that cited paths exist, that verified statuses have tests and blocked ones a blocker, and that nothing is
  production-ready while the release is NO-GO. Counts:
  - browser-verified (local): 11;
  - unit-verified: 12;
  - integration-verified: 1;
  - partial: 6;
  - not implemented: 4 (evaluation, tax research, diagnostics, risk and materiality);
  - blocked by external integration: 6;
  - blocked by policy: 2;
  - production-ready: 0.

  The multipage Architecture Overview is not in the repository, so no per-agent responsibility is inferred.

  **Recorded for the owner:** ordinary non-bookkeeper journal entries post without independent review under proposal
  024 (Block 45).

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
