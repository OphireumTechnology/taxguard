# TaxGuard AI master completion plan

Authoritative, evidence-based roadmap. Started 2026-10-19 on `claude/taxguard-phase14-full-platform-development`
(PR #22, draft). Live progress is recorded in `TAXGUARD_MASTER_COMPLETION_STATUS.md`. Release status: **staging
NO-GO, production NO-GO.**

## How status is assigned

| Status | Meaning in this plan |
|---|---|
| **COMPLETE** | Implemented, with passing automated evidence named below, and no unapproved dependency. |
| **REVIEW REQUIRED** | Implemented and locally verified, but it depends on a review-only SQL proposal or awaits independent review. None of these may be treated as live until the proposal is approved and applied through the protected gate. |
| **PARTIAL** | Some of the behaviour exists; a named gap remains. |
| **MISSING** | Not implemented. |
| **BLOCKED** | Needs an external dependency, infrastructure or an owner, legal or regulatory decision. |

Sources:
1. `docs/taxguard-master-traceability.json`: 230 requirements, built by `scripts/build-local-traceability.mjs`.
   It records 60 implemented and validated, 70 implemented but insufficiently tested, 24 missing or incomplete,
   68 requiring human policy or regulatory approval, and 8 requiring external infrastructure.
2. The source files and test suites named per row.
3. The Phase 14 security packages and the read-only Phase 15 comparison in
   `phase14-phase15-migration-integration-plan.md`.

A traceability status of "IMPLEMENTED AND VALIDATED" maps to COMPLETE only when no review-only proposal underlies
it; otherwise it maps to REVIEW REQUIRED.

## Repository facts (read from source, 2026-10-19)

- **Stack:**
  - backend: Express (`server.ts` for development, `src/server/productionApp.ts` for production) with 53 route
    modules under `src/server/routes`;
  - frontend: React and Vite (`src/App.tsx`, `src/public-v2`, `src/components/*`);
  - database: Supabase PostgreSQL. 13 core migrations ship in `supabase/migrations`, ending at `20261008060000`.
    67 review-only proposals are in `docs/proposed-migrations`; together with the core migrations they make the 80
    entries of `docs/development/migration-execution-order.json`.
- **AI:**
  - `src/ai/registry.ts`: 61 agents, A00–A60;
  - `src/server/ai/governance`: control plane, kill switch, SQL governance store;
  - `src/server/ai/gateway`: governed gateway, prompt and model resolver, structured output, usage.

  Every deployment is DRAFT; no agent is commissioned.
- **Production surface:** `createProductionApp` (`src/server/productionApp.ts`) mounts only:
  - auth;
  - health;
  - AI governance;
  - case authority;
  - bookkeeping;
  - operations;
  - the accountant dashboard;
  - tax forms.

  The durable case, billing, document, messaging, appointment, legal and practice routers are mounted by the
  development server (`server.ts`) only, and several say so in their headers ("not mounted in
  createProductionApp"). Production cutover of each is part of `CONTROL-DURABILITY`.
- **CI** (`.github/workflows/taxguard-development-ci.yml`) runs on every push:
  - diff check;
  - lint (`tsc --noEmit`) and typecheck;
  - build;
  - unit tests;
  - the offline migration and readiness checks;
  - disposable loopback PostgreSQL.

  The browser suites run locally (`npm run test:e2e`, default and provider profiles), not in CI.
- **Test inventory at the start of this plan:** 5764 unit tests (352 files), 126 PostgreSQL tests (29 files), 113
  default browser tests (18 files) and 40 provider browser tests (7 files).

## Workstream inventory

### Phase 14 and Phase 15 integration (Phase B)

| Item | Status | Evidence or gap |
|---|---|---|
| Engagement and tax-year scope: documents and Stage 02 | REVIEW REQUIRED | `20261018060000`, `engagementScopedAccess.db` (6) |
| Ledger, book-to-tax and work-queue year scope, insert triggers | REVIEW REQUIRED | `20261018070000`, `ledgerYearScope.db` (9) |
| Trial-balance "as of" bound (base and Phase 15 exact wrapper) | REVIEW REQUIRED | `20261018070000` amendment; verified on the merged schema |
| Document-request scope and client projection | REVIEW REQUIRED | `20261018080000`, `documentRequestScope.db` (7) |
| Case access follows the live assignment, including tax runs | REVIEW REQUIRED | `20261018090000`, `caseAssignmentRevocation.db` (6) |
| Practice client detail confidentiality and writes | REVIEW REQUIRED | `20261018100000`, `practiceClientDetailScope.db` (8) |
| Stage 01 durable onboarding | BLOCKED | `20261018030000`; no approved IRC § 7216 consent version |
| Migration version collision (`20261018000000` / `20261018010000`) | BLOCKED | Owner decision; plan and reproduction in the integration plan |
| Canonical refund (Phase 15) and withdrawal of Phase 14 `20261018010000` | BLOCKED | Owner confirmation, then Codex publication of `20261019070000` |
| BillingStore keyed RPC adoption | BLOCKED | Waits on the Phase 15 merge; `phase10Security.db` fails on the merged schema until adopted |
| Posting, reversal and adjustment replay year checks | PARTIAL | Codex candidate is unpublished; contract reproduced in `qa/phase15-scope` |
| General-ledger requested-year guard | PARTIAL | Codex candidate is unpublished |
| Prior-year opening balances | BLOCKED | Owner policy |
| Ledger engagement attribution | BLOCKED | Owner confirmation of client-and-year authority |
| Case-team reassignment (reviewed operation) | REVIEW REQUIRED | `20261018105000`, `caseRestaff.db` (7), `POST /api/cases/:caseId/team`; manager Case team form in Case Workflow (provider browser suite 14) |
| Messaging, appointments, legal: engagement-linked records | MISSING | Ready to implement after the general-record policy |
| Messaging, appointments, legal: general records | BLOCKED | Owner policy (`phase14-remaining-domain-access-policy.md`, option C recommended) |
| Native PostgreSQL 17 acceptance (concurrency, backup and restore) | BLOCKED | `pg_dump` / `pg_restore` 17 absent locally. The embedded loopback suite passes; it is preliminary evidence, not acceptance. |
| Windows `os.userInfo()` / `tsx` ENOMEM (Codex environment) | BLOCKED | Recorded by Codex; not reproduced in this worktree, where the suites run |

### Core application (Phase C)

| Workstream | Status | Evidence or gap (traceability ID) |
|---|---|---|
| Staff authentication, MFA, recovery, invitations, session revocation | REVIEW REQUIRED | `CONTROL-STAFF-ACCESS`, `CONTROL-MFA-RECOVERY`; loopback emulator suites pass; the real provider is BLOCKED (no project) |
| Client authentication and self-registration | REVIEW REQUIRED | `20261018020000`; provider journey B passes |
| Role workflows: client, accountant, reviewer, bookkeeper, practice manager, client service, admin | PARTIAL | `ROLE-*-FULL` (7 items): durable lineage, history and scoped authority contracts remain |
| Workflow stages 01–09, 14, 15, 17, 18: complete product experience | PARTIAL | `STAGE-xx-PRODUCT`: the gate engine is validated (`STAGE-xx` base items); provider-backed and professional-decision surfaces remain |
| Stages 10–13, 16 (filing, provider and payment dependent) | BLOCKED | `REQUIRES EXTERNAL INFRASTRUCTURE` / human policy |
| Process-local domain stores replaced by durable adapters | PARTIAL | `CONTROL-DURABILITY`; retained in-memory routes are listed in `phase10-reviews.md`. `unreachable-code-inventory.md` shows that `/api/documents`, `/api/calendar` and `/api/intake` now have no reachable consumer; retiring them with 274 unreachable modules awaits the owner's deletion decision. The production-mounted
`/api/case-authority` now refuses every scoped case operation (503 `DURABLE_CASE_AUTHORITY_PROVIDER_REQUIRED`)
rather than serve its in-memory adapter (Block 39). So do the Stage 02 accountant document-review routes (Block 40). |
| Tax engine: sources of law, versioned rule sets, tests and coverage, calculation runs | PARTIAL | API and database validated (`20261012330000`, `360000`, `380000`; `taxEngineHttp`, default browser suite 07). Tax Rules console added (`TaxRulesPanel`: sources, rule sets, tests and recorded test runs) and calculation runs with reviewer decisions in Case Workflow. Drafting rule sets and adding or removing tests are in the console too. Real rule content needs approved, verified sources (professional input). |
| Public website, honest public content | REVIEW REQUIRED | `CONTROL-FRONTEND-HONEST-PUBLIC`; accessibility and SEO not independently audited |

### Documents, communication, finance, AI, security (Phases D–G)

| Workstream | Status | Evidence or gap |
|---|---|---|
| Document vault, scan-gated release, client confidentiality | REVIEW REQUIRED | `CONTROL-DOCUMENT*`, `20261015030851`; a malware scanner provider is BLOCKED (local fake only) |
| Document requests | REVIEW REQUIRED | `20261012310000` and `20261018080000` |
| Messaging, appointments, rooms, legal coordination | REVIEW REQUIRED | Durable proposals `20261013390000`, `20261014400000`, `20261014420000`, `20261014430000`, `20261016010000`, `20261016030000`; engagement scope pending policy |
| Email and SMS delivery | BLOCKED | No provider; in-app only |
| Billing, invoices, credits, payments (sandbox) | REVIEW REQUIRED | `CONTROL-CLIENT-BILLING`; Phase 15 idempotency pending merge |
| Subscriptions | MISSING | No subscription model in source; needs product definition (owner) |
| Real payment provider | BLOCKED | Sandbox only by design |
| AI governance plane (registry, kill switch, gateway, budgets, commissioning matrix) | REVIEW REQUIRED | `CONTROL-AI-COMMISSIONING`, `aiGovernanceControlPlane.test` |
| AI agents A00–A60 | BLOCKED | 58 require human policy or regulatory approval; A00, A10 and A34 are bounded compatibility only. No commissioning without approval. |
| Audit center, security events, outbox | REVIEW REQUIRED | `CONTROL-AUDIT*`, proposals 041 and 048 |
| Backup and restore runbook | PARTIAL | `CONTROL-BACKUP-RESTORE`: rehearsed on disposable PostgreSQL; provider PITR BLOCKED |

### Production readiness (Phases H–J)

| Item | Status |
|---|---|
| Staging environment, hosting, secrets store | BLOCKED (owner provisions a separate project) |
| Observability and alerting | PARTIAL (`observability-and-alerts.md`; no log shipping) |
| Independent security review and SQL review | BLOCKED (independent reviewers) |
| Legal and privacy approvals (§ 7216 consent, policies) | BLOCKED |

## Next packages (independently executable, ordered by risk)

1. **Case-team reassignment.** A reviewed, manager-only operation to restaff a case's preparer or reviewer:
   - live assignment required;
   - segregation of duties kept;
   - audited, with optimistic concurrency;
   - attestation history preserved.

   This closes the availability gap left by `20261018090000` and the "scoped reassignment authority" item of
   `ROLE-PRACTICE-MANAGER-FULL`.
2. **Engagement-linked messaging, appointment and legal records.** Implementable without the general-record
   policy; general records stay unchanged until the policy is approved.
3. **Remaining client-level reads.** Re-run the function inventory after each package and scope anything newly
   found (failing-first).
4. **Durable adapters for retained in-memory routes (`CONTROL-DURABILITY`).** Route by route, with tests.
5. **Role workflow gaps (`ROLE-*-FULL`)** that need no provider or policy.

Protected gates (never executed without explicit approval):
- migration renumbering;
- SQL review acceptance;
- general-record policy;
- § 7216 wording;
- merges;
- hosted migrations;
- deployments;
- real financial operations;
- agent activation;
- destructive operations.
