# Production readiness assessment (2026-10-27, Phase 14, local and offline only)

**Verdict: staging NO-GO, production NO-GO.** Nothing has been deployed, no migration has been applied anywhere, the
protected production project `cvrlhixxczerytiocxid` has never been accessed, and no AI agent is active. This assessment
is drawn from the evidence register (`architecture-implementation-register.json`), the staging plan
(`staging-readiness.md`), the route inventory (`production-route-parity.md`) and the owner decision register
(`phase11-owner-decisions.md`). It records no decision on the owner's behalf.

## 1. What the evidence shows

The architecture register holds 42 components. No component is `PRODUCTION_READY`, and none can be while the
underlying proposals are review-only.

| Status | Count | Meaning (register rule) |
|---|---|---|
| PROVIDER_VERIFIED | 3 | covered on the provider-emulation profile (kill switch, diagnostics, risk) |
| BROWSER_VERIFIED | 13 | a local synthetic browser journey drives the UI on the real server |
| INTEGRATION_VERIFIED | 2 | disposable PostgreSQL or real-server HTTP tests |
| UNIT_VERIFIED | 10 | unit or PGlite tests |
| PARTIAL | 6 | part built, gap named |
| BLOCKED_BY_EXTERNAL_INTEGRATION | 6 | a provider must be chosen and commissioned |
| BLOCKED_BY_POLICY | 2 | an owner or regulatory decision is required |
| PRODUCTION_READY | 0 | not used while staging and production are NO-GO |

Local validation at this checkpoint (branch `claude/taxguard-phase14-full-platform-development`, draft PR #22): 369 unit
test files, 6051 tests; the disposable-PostgreSQL suite; the browser and provider-emulation e2e profiles; lint,
typecheck, build, secret scan, the migration release-candidate check and the NOT VALID constraint review all pass. CI
passed on every pushed block, after one fix to a test that depended on database collation (Block 56). **None of this is independent release acceptance.**

**The furthest the pipeline is certified** (provider journey B): a new client's first portal sign-in provisions their
identity; an engagement is opened; Stage 01 onboarding completes with synthetic consent wording and staff verification;
stages 02-08 pass with independent review at every step; Stage 09 is refused (`STAGE_BLOCKED_VERIFIED_TAX_ENGINE_REQUIRED`).
On that case the readiness diagnostics report only the missing approved calculation and the risk gate reports BLOCKED.

**Security properties with direct evidence:**
- tenant, client, engagement and tax-year isolation, tested negatively at the unit, database and browser layers;
- staff AAL2 MFA, recovery and recent sign-in, on the provider emulator;
- maker-checker on ledger, book-to-tax, rule sets, calculations and research;
- immutable audit and history tables;
- AI: UNMAPPED = DENY proven for all 58 unmapped agents; the composed schema grants nothing; kill switches; the
  prompt-injection corpus; counts-only model input.

## 2. Why it is not ready: release blockers

Each blocker below is outside what development can close on its own. The owner column names who decides.

### 2.1 Approvals of existing work (owner, reviewers)
| Blocker | Evidence | Decides |
|---|---|---|
| 13 core migrations, 72 review-only SQL proposals and the separate append-only audit proposal, applied in manifest order | `migration-execution-manifest.json`, release-candidate check | Owner, with Codex review; the six Phase 14 scoping proposals per `phase14-proposal-review-dossier.md` |
| 13 NOT VALID constraints need a validation window | `not-valid-constraint-review.md` | Owner |
| IRC § 7216 consent wording (purposes, recipients, duration, revocation) | Stage 01 is consent-gated; no approved version exists | Counsel or a qualified practitioner, then the owner |
| Materiality policy (thresholds, minimum AI confidence, whether automated continuation is ever allowed) | none seeded; every case goes to a person | Owner |
| Unreachable-code deletion, general-record policy | `unreachable-code-inventory.md` | Owner |

### 2.2 Infrastructure (owner provisions; each step needs explicit go-ahead)
Dedicated non-production Supabase project; staging API and frontend hosts with a header-capable edge (framing and HSTS
are open in `production-route-parity.md`); managed secrets per environment; log shipping and alerting
(OPS-MONITORING is PARTIAL); provider backups with point-in-time recovery and an approved RPO/RTO; a staging rehearsal of
restore and rollback. The order is in `staging-readiness.md` (steps 1-12).

### 2.3 Providers (owner chooses and commissions)
Malware scanner (uploads stay quarantined until one exists); OCR (the Document AI adapter is hardened but not
commissioned; a human validation queue is missing); email; accounting connector (QuickBooks or Xero); government
transcripts and notices; payments (sandbox only by design); e-signature and e-file (live filing needs explicit
approval); AI provider, models, prompts and budgets.

### 2.4 Tax content (licensed sources, professional review)
Stages 09-18 need approved federal and state rule content with year and jurisdiction provenance and practitioner test
cases. TaxGuard ships no tax rules; every calculation, research memo, diagnostic and risk result states
`returnUse: BLOCKED`. Form mapping has no evidence-to-line lineage; durable evidence-to-conclusion lineage is missing
(TAX-EVIDENCE, TAX-FORM-MAPPING are PARTIAL).

### 2.5 AI workforce (policy)
All 61 agents are DRAFT, with no model, prompt or budget. A00, A10 and A34 have bounded, test-only compatibility.
Commissioning any agent needs a per-agent responsibility matrix, a passed evaluation and owner approval; the material
action chain (AI-16) needs an owner-approved preparer, reviewer and CPA/EA attestation design. The standing
instruction is not to activate real agents.

### 2.6 Production cutover
No durable router is mounted in production: `createProductionApp` refuses every process-local authority, and the
development-only durable routers answer 503 unless explicitly configured against a non-production project
(REC-AUTHORITATIVE is PARTIAL). Cutover is a reviewed change after the proposals are applied.

## 3. Release checklist

`docs/RELEASE_CHECKLIST.md` (1.0.0-RC1) cited 78 test files and at least 1,065 tests, listed only the first four
migrations and referred to an AI Studio sandbox without Git. It was rewritten on 2026-10-27 from `staging-readiness.md` and
this assessment: every gate names the command, report or approver that closes it, and every box is open. The sign-off
block (roles and names) is unchanged; filling it is the owner's.

## 4. Recommended path to a staging GO (each step needs the owner's go-ahead)

1. Owner review and approval of the proposals in manifest order, and of the NOT VALID validation windows.
2. Counsel approval of the § 7216 consent wording; the owner records the approved version.
3. Provision the non-production project, hosts and secrets (`staging-readiness.md` steps 1-2, 12).
4. Apply the approved migrations to staging only, restore-first, one transaction per file; seed synthetic data only.
5. Run the e2e and provider suites against staging with synthetic users; the real-provider MFA validation.
6. Choose and commission the malware scanner; leave every other provider uncommissioned until its own decision.
7. Monitoring, backup and rollback rehearsal on staging.
8. Every gate in `docs/RELEASE_CHECKLIST.md` closed with a recorded result, and the checklist signed by the owner's named roles.

Production stays NO-GO until staging is accepted, approved tax content exists for the stages the practice intends to
use, and the owner signs the release. Live payments, live filing, live AI agents, production data changes and
production credentials each need their own explicit approval.
