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

- **Draft return preparation (Block 68).** Review-only proposals `20261019115000` (approval authority: separate
  verified eligibility, function designation and case assignment under owner-approved policies; fail closed) and
  `20261019120000` (versioned return templates and return versions assembled only from current Block 67 mappings;
  preparer submit; independent Stage 09 review; derived staleness; lineage to the source document SHA-256). Draft
  return panel in Case Workflow; production refused. PostgreSQL (11), unit, suite 07 journey. Report:
  `block68-draft-return-preparation-report.md`. **Owner review point:** approval policies, eligibility records and
  designations (nothing is configured; approvals fail closed).
- **Return verification, diagnostics, risk and independent QC (Blocks 69-72, stacked on Block 68).** Review-only
  proposals `20261019140000` (server re-execution of every calculation behind a return version; `VERIFIED` required
  for Stage 09 approval), `20261019150000` (return-level rules in the governed diagnostics table),
  `20261019160000` (immutable risk assessments; `BLOCKED` or `HUMAN_REVIEW_REQUIRED`, never `CONTINUE`, per OV-09)
  and `20261019170000` (a manager assigns QC to a third person independent of preparer and reviewer; checklist
  review under the `RETURN_QC_REVIEW` authority; final readiness reports `stage10: FINAL_AUTHORIZATION_REQUIRED` and
  `returnUse: BLOCKED`). Each branch passed its own full matrix (Block 69 within Block 70's). Integration branch
  `claude/taxguard-integration-68-72` combines the stack with the form-rule authority and the architecture
  reconciliation. **Owner review point:** QC policy, eligibility and designations, the QC checklist and the
  materiality policy (none configured; QC and readiness fail closed).
- **Tax engine privileges checked in execution order (2026-10-30).** The composition security test never checked
  `taxguard_tax_` functions, and its invariants ran after a re-application step that resets their grants. Privileges
  are now captured right after the in-order application; mutation checks confirmed. Operational note: re-running
  `20261012330000` alone after Blocks 66-72 removes service-role access to their entry points (fails closed), so any
  re-run must replay the full execution order.
- **Stage 10 final authorization (Block 73, stacked on Block 72; 2026-10-30).** Review-only proposal `20261019180000`:
  a manager assigns a ready return version to a final authorizer independent of the preparer, Stage 09 reviewer, QC
  reviewer and QC assigner; the authorizer records `AUTHORIZED` or `DECLINED` (no preselected outcome) only with a
  durable recent multi-factor session checked in the same transaction, the `RETURN_FINAL_AUTHORIZATION` authority
  (policy, eligibility, designation, case assignment) and acknowledgement of the current owner-approved attestation.
  Decisions are immutable, pin the forms hash and every upstream record, and lapse automatically when any changes. A
  decline is recorded only; nothing reopens or discards the return. Nothing is signed or filed (`stage11:
  CLIENT_SIGNATURE_REQUIRED`, `returnUse: BLOCKED`). Branch `claude/taxguard-block73-final-authorization` at `aa12178`
  (feature `f8c9608`; full matrix there passed except one QC immutability case caused by a foreign key to QC reviews,
  removed in `aa12178`; PostgreSQL then 57 files / 310 tests). Integration branch at `dbcdb17` (Blocks 68-73,
  form-rule authority, privilege sweep; synthetic `FORM_RULE_APPROVAL` policy and designation seeded in the Blocks
  69-73 fixtures) passed the full matrix: unit 6238, lint, typecheck, PostgreSQL 311, e2e default 137 and provider
  44, build, release candidate, NOT VALID, secrets, diff check, contamination. **Owner review point:** final
  authorization eligibility criteria, attestation wording (legal), any relaxation of independence, and the follow-up
  workflow after a decline (none configured; final authorization fails closed).
- **Positive Stage 10 browser journey (Block 73, 2026-10-30).** Suite 07 makes the version genuinely ready (the
  administrator, as an independent ledger reviewer, rejects the reviewer's own pending entry; diagnostics, risk and QC
  are recorded again), then a durable final authorizer signs in through the provider emulation and the real session
  exchange and authorizes in the browser. Checked: one recorded decision and what it pins, `stage10: AUTHORIZED`, a
  refused replay, and the decision lapsing after a diagnostics rerun (mutation check caught). Commits `d8e3ca6` and
  `05cccbf` (traceability). Integration at `b08b156`: full matrix green (unit 6238, PostgreSQL 311, browser 137 + 44).
- **Stage 11 signature package, without signing (Block 74, stacked on Block 73; 2026-10-30).** Review-only proposal
  `20261019190000`: an authorized, current version is released for client signature as an immutable package pinned to
  the Stage 10 decision and consent version, only with a durable recent multi-factor session, the
  `RETURN_SIGNATURE_RELEASE` authority (designation required), the owner's approved consent text and one to four
  active client-portal members as signers; the preparer cannot release. It lapses with the decision or the consent
  text and is withdrawn once. Clients see status only at `/api/client-signatures` (its own cutover entry). Nothing is
  rendered, sent, signed or filed (`signature: NOT_AVAILABLE`, `returnUse: BLOCKED`). Branch
  `claude/taxguard-block74-signature-package` at `45bc27b`: PostgreSQL 4/4 with three mutation checks caught; full
  matrix green (unit 6224, PostgreSQL 314, browser 136 + 44; the run was interrupted by a session restart after the
  default browser profile and its remaining stages were rerun on the same commit). Integration at `8f63641` (Blocks
  68-74): full matrix green (unit 6241, PostgreSQL 315, browser 137 + 44, build, release candidate, NOT VALID,
  secrets, diff check, contamination). **Owner review point:** release policy, consent wording (legal), who must sign,
  what the client sees, and the e-signature provider and identity verification method.
- **Return comparison with the previous version and the prior year (Block 75, stacked on Block 74; 2026-10-30).**
  Review-only proposal `20261019200000`: a read-only, deterministic line-by-line comparison of a return version with
  its previous version and with the client's prior-year return approved at Stage 09, matched only on identical line
  identifiers. Prior-year values need access to the prior-year case (otherwise `NOT_AVAILABLE`, nothing disclosed).
  Variance flags only under the owner's approved, immutable variance policy; none is seeded (`NOT_CONFIGURED`). It
  gates, records and changes nothing. Branch `claude/taxguard-block75-return-comparison` at `e856847`: PostgreSQL 5/5
  with three mutation checks caught; browser suites 01-07 59/59 in a clean single run. Integration at `7ddaafd` (Blocks
  68-75): full matrix green (unit 6243, PostgreSQL 59 files / 320, browser 137 + 44, build, release candidate (111
  entries), NOT VALID (13), secrets (1661 scanned), diff check, contamination). **Owner review point:** variance
  policy, a cross-year line crosswalk, prior-year returns prepared outside TaxGuard, and prior-year access for QC and
  the final authorizer.
- **Read-only AI evaluation view in the Control Center (Block 76, stacked on Block 75; 2026-10-30).** An Evaluations
  tab and `GET /api/ai-governance/control-center/evaluations` (governance roles, verified tenant): whether the review-only
  evaluation framework is applied, suites and runs with coverage per dimension, and whether each agent's current version
  would pass the activation gate. Nothing is evaluated, approved or activated. Branch
  `claude/taxguard-block76-ai-evaluation-view` at `164878d`: PGlite tests with two mutation checks caught; default
  browser profile 136/136. Integration at `9ef4fce` (Blocks 68-76): full matrix green (unit 6248, PostgreSQL 59 files /
  320, browser 137 + 44, build, release candidate (111 entries), NOT VALID (13), secrets (1664 scanned), diff check,
  contamination).
- **AI Architecture Overview recorded for review (2026-10-28).** The owner-supplied 11-page overview (SHA-256
  `f11ed12a…`) is transcribed in `src/ai/architectureOverview.ts`: names, responsibilities and human gates for 59
  agents, the page-9 example permission matrix narrowed by TaxGuard's human-only limits, and thirteen owner decisions.
  Read-only "Architecture overview" tab in the AI Control Center. Grants nothing: every agent stays DRAFT and the 58
  unmapped agents stay denied; governance does not read the record. Owner answers of 2026-10-28: people-only powers
  stay with people, always human review, "Staff" gate means REVIEWER, A10/A39 left unassigned. **Owner review point:**
  the ten open decisions in `docs/development/ai-architecture-overview-reconciliation.md`, then approval of any
  per-agent mapping.
- **Durable evidence-to-conclusion traceability (Block 66).** Review-only proposal `20261019100000`: versioned tax
  conclusions linked to verified evidence, calculation runs, approved research and workpapers with per-link snapshots;
  derived staleness blocks submission, approval and readiness; backward and forward traces; reviewer lineage panel;
  form-line foundation for Block 67. PostgreSQL (6), unit, production refusal, suite 07 browser journey through source
  replacement and re-approval. Reports: `block66-*.md`.
- **Deterministic form mapping (Block 67, stacked on Block 66).** Review-only proposal `20261019110000`: versioned,
  maker-checker mapping rules on a verified source; per-case mappings derived only from approved, current conclusions
  with an approved calculation run, refused with reasons when ambiguous, stale, uncalculated, mistyped or incomplete;
  every value stores conclusion, calculation, rule set, evidence, mapping rule and time; derived staleness and
  versioned re-mapping; Form mapping panel with a provenance table. Synthetic form only. PostgreSQL (7), unit,
  production refusal, suite 07 browser journey. Reports: `block67-*.md`.
- **Phase 15 integration (2026-10-27).** All published Phase 15 work (PRs #25-#34; #24 superseded) plus reviewed Codex
  unpublished and uncommitted packages, on `integration/taxguard-phase15`. One canonical refund function (Phase 15
  capabilities ported into `taxguard_bill_refund_keyed`); colliding migrations renamed to `20261018110000`/`120000`;
  three security fixes (general-ledger year guard, replay year scope, onboarding re-check after lock wait). Unit 6,193,
  PostgreSQL 258, browser 133 + 44. Record: `docs/development/phase15-integration-20261027.md`.
- **Calculation inputs cite durable evidence (Block 65).** Review-only proposal `20261018190000`: each input of a
  calculation run must cite a decided extracted value (value-checked) or a reviewed document of the case; recording and
  approval refuse unresolved citations, and approval records an immutable lineage snapshot shown per run in Case
  Workflow. PostgreSQL HTTP test, unit test, suite 07 browser journey. **Owner review point:** whether document-level
  citations are acceptable evidence.
- **Stage 03 requires decided extraction proposals (Block 64).** Review-only proposal `20261018180000`: Validate is refused
  while an OCR proposal on a current document is undecided; reviewed documents with undecided proposals stay in the
  review queue; failed gate checks read in plain language. PGlite (6), PostgreSQL transition test, suite 03 browser journey. **Owner review point:** confirm Validate (not Collect) is the right stage.
- **OCR human validation in the browser (Block 63),** published as `b160af5`. Suite 02 drives accept, correct and reject of synthetic OCR proposals in
  Document Review; the client sees none of it. The panel no longer clears its confirmation after a field decision.
- **Release checklist rewritten (Block 62),** published as `e041e5e`.
- **Production-readiness assessment (Block 61).** `docs/development/production-readiness-assessment.md`: staging and production NO-GO, with the evidence counts, the release blockers grouped by who decides, the stale release checklist, and the recommended path to a staging GO.
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
