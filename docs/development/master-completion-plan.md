# TaxGuard AI — Master Completion Plan

**PRODUCTION STATUS: NO-GO.** This plan governs development on `sync/taxguard-development-20261011` (PR #10, draft). It never authorizes deployment, `main` merges, production Supabase access, production migrations, production identities, paid services, real taxpayer data or real filing.

Progress is recorded in [master-progress.md](master-progress.md). The cumulative feature register remains [../taxguard-master-development-completion-matrix.md](../taxguard-master-development-completion-matrix.md); owner decisions (H01–H11) and external dependencies (E01–E08) remain in [../taxguard-master-remaining-decisions.md](../taxguard-master-remaining-decisions.md).

## Status vocabulary (Definition of Done)

| Status | Meaning |
| --- | --- |
| Fully implemented and tested | Intended behaviour works end to end in development with synthetic data, server-enforced security and automated tests |
| Implemented, awaiting integration | Application side complete; needs an external provider or credential (E-dependency) |
| Prototype only | Code exists but is not authoritative (for example the draft Form 1040 calculation) |
| Reference catalog only | Metadata / reference, no preparation capability |
| Blocked by external dependency | Cannot proceed without H- or E- item |
| Not implemented | Absent |
| Production validated | Only after independent security, tax accuracy, compliance, integration, operational and acceptance reviews — **none so far** |

## Audit baseline (2026-10-12, commit `d6be0e5`)

- 618 application source files, 204 test files (3,945 tests passing), 34 route modules.
- Production app (`src/server/productionApp.ts`) releases: Supabase session bridge, AI governance, case authority, profile / stage workflow, bookkeeping, operations, Accountant dashboard (durable, AAL2), Tax Forms Library. Everything else is development-only (in-memory store) or unreleased (503).
- Staff MFA (AAL2) is enforced for durable sessions (Step 1); the session `aal` migration is proposed, not applied.
- Legacy staff invitation (`onboarding.routes.ts`) is development-only: in-memory, not tenant-scoped, claims MFA without enrolment, no password policy, no approval gate.

## Backlog (dependency and security-risk order)

| # | Area | Work | Depends on | Status at start |
| --- | --- | --- | --- | --- |
| 1 | Identity | **Durable staff invitation, Supabase sign-up, mandatory TOTP enrolment, invitation acceptance, administrator activation approval (maker-checker), suspension / reactivation, audit, rate limits; block client auto-provisioning of invited staff** | Step 1 | Not implemented (production) |
| 2 | Identity | MFA recovery and factor replacement (administrator-approved reset, re-enrolment) | 1 | Not implemented |
| 3 | Identity | Eleven-role model and least-privilege server permission matrix; reconcile legacy aliases | 1 | Development implementation authorized; production authorization review outstanding |
| 4 | Admin | Staff and role management UI (invitations, approvals, suspensions, access review) | 1 | Not implemented |
| 5 | Workflow | 18-stage workflow: missing transitions, ownership, approvals, audit (no stage changes) | H10 for labels | Partially implemented |
| 6 | Documents | Durable document metadata, versions, requests, checklists; storage / malware / OCR adapters | E02 | Metadata only |
| 7 | Dashboards | Reviewer, Bookkeeper, Practice Manager, Client Service production read routes on durable data | E01 data | Development only |
| 8 | Dashboards | Billing, Security / Compliance, Executive dashboards | 3 | Not implemented; development authorized |
| 9 | Tax | Form registry metadata per tax year; questionnaires; calculation engines only from verified rules | H07 | Reference catalog; 1040 prototype |
| 10 | Tax | State jurisdiction verification and form identifiers from official agencies | H07, network | Reference, unverified |
| 11 | Accounting | Ledger reversals for journal entries, period close, AP / AR, statements | E01 | Partial |
| 12 | Billing | Invoices, receipts, payment adapters (no live payments) | E04 | Partial |
| 13 | AI | Controlled AI features behind governance, consent and emergency stop | H01–H04 | Governance complete; agents draft |
| 14 | Integrations | E-signature, email, calendar, OCR, e-file adapters (no transmission) | E04 | Not commissioned |
| 15 | Platform | RLS review, idempotency, pagination, monitoring, backup / recovery documentation | E05, E07, H09 | Partial |
| 16 | Release | Deployment runbook, migration plan, rollback, production-readiness assessment | E08 | Documentation only |

Each item is delivered as: inspect → implement smallest coherent feature → tests → validation → docs → commit → push (after secret scan) → next item.

## Standing restrictions

No force-push, no history rewrite, no `main` merge, no deployment, no production Supabase, no production migrations (proposals live in `docs/proposed-migrations/`), no production identities, no paid services, no real taxpayer data, no transmission of returns. Unresolved security risks stay local and are documented here.

## Master directive re-audit — 2026-10-12

Local Git metadata was re-read, rather than assuming the previous report remains current:

- HEAD: `sync/taxguard-development-20261011` at `d6be0e5998ed1862888f79ebe7238b844410c95c`.
- Origin: `https://github.com/OphireumTechnology/taxguard.git`; upstream configuration targets the same development branch.
- Working tree (root Git audit): 11 tracked modified paths including traceability JSON, package metadata, AuthPages, AppContext, Supabase database/server modules and five existing fixtures. Untracked `.claude/`, `docs/development/`, two invitation proposals, MFA panel/helpers, invitation/activation modules and tests are present. No new commits yet. Preserve all unfinished Claude and existing development files; recheck exact staged changes before committing. This sub-audit used filesystem reads because shell launch returned sandbox `helper_unknown_error`.
- GitHub PR #10 draft / production NO-GO is the required policy; no remote state was accessed or changed by this audit.
- Prior 3,972-test, typecheck/build and traceability results are previous-slice evidence, not validation of new changes.
- Production entry point mounts the Accountant durable dashboard and existing auth/governance/case/profile/stage/bookkeeping/operations routes. Route mounting does not prove durability: Stage 02/03 questionnaire, requirements and request handlers still reference process-local stores. Re-audit every mounted route before describing it as durable.
- The frontend role union includes legacy aliases and lacks dedicated Billing/Finance and Security/Compliance roles. Existing founder/admin aliases do not establish the requested eleven-role authorization model.

The current master directive authorizes ordinary local architecture and feature choices. **H06 is no longer a blocker to implementing a conservative development role model and dashboards.** Define explicit capabilities, default deny, and negative tests; do not infer permission to grant production identities or broaden live access. Historical H06 references remain historical evidence. Preserve H01–H04/H07 legal, specialist-policy, practitioner and sensitive-data approvals; provider commissioning and all production gates remain unresolved. Preserve `LEGACY_18_V1` unchanged: a competing stage-label migration is unnecessary for development completion under the current directive.

## Concrete execution checklist

Unchecked items are unfinished or unverified. Complete coherent slices in dependency order; an unavailable provider blocks live integration, not safe adapters, schemas, UI states and synthetic tests.

### 1. Immediate security and identity

- [ ] Audit all production-mounted routes for object authorization, strict tax-year validation and process-local state; resolve defects before adding features. In particular, inspect Stage 02 snapshot/reconcile client selection against the shared authorized-client resolver.
- [ ] Complete atomic invitation issuance, hashed one-time tokens, expiry, revocation, bounded lookup, acceptance and independent activation approval; serialize invited staff against client auto-provisioning.
- [ ] Connect durable service/RPC interfaces to validated HTTP routes and replace legacy staff invitation UI without claiming provider delivery.
- [ ] Enforce confirmed provider email, mandatory TOTP enrollment/challenge and AAL2 on every staff request; never issue a TaxGuard staff session at AAL1.
- [ ] Complete password setup/reset, neutral error handling, rate limits and session renewal, absolute/idle expiration and revocation.
- [ ] Implement suspension/deactivation/reactivation and tenant membership management with transactional audit and session revocation.
- [ ] Implement independent, administrator-approved MFA recovery/factor replacement: suspend access, revoke sessions, replace factor through configured provider, require re-enrollment and renewed AAL2 before activation.
- [ ] Define all eleven roles and explicit server permissions; test tenant isolation, staff assignments, role changes and least privilege. Keep platform super administrator separate and dashboard inspection read-only.
- [ ] Deliver administrator staff/invitation/approval/lifecycle/access-review UI and proposed schema/RLS changes; no migrations applied to production.

### 2. Canonical workflow and documents

- [ ] Preserve the eighteen persisted stages: Onboard, Collect, Validate, Record, Reconcile, Review, Report, Plan, Prepare Taxes, Approve, Sign, File, Government Feedback, Resolve, Monitor, Archive, Renew, Repeat.
- [ ] Inventory each stage's actor, ownership, inputs, document dependencies, transition/exception/reopen conditions, maker-checker approval, version conflicts and audit events; implement missing checks against those canonical stages.
- [ ] Replace process-local workflow/questionnaire/request records with tenant-scoped durable interfaces and unapplied reviewed migration proposals; test restart/concurrency boundaries in isolated fixtures.
- [ ] Implement document metadata, versions, requests and checklists by tenant/client/engagement/year; strict byte/hash/type validation, quarantined intake and authorized downloads.
- [ ] Provide fail-closed private storage, malware scanning and OCR adapters; retention/legal-hold policies, human extraction verification and append-only audit. Real vault/scanner/OCR commissioning remains E02.

### 3. All eleven functional role experiences

| Role | Unfinished development checklist |
| --- | --- |
| Client / Taxpayer | Onboarding/profile/organizers, requests and documents, year selection/status, secure messages, engagement agreements/e-sign architecture, billing access, notifications and explicit approvals |
| Accountant / Tax Preparer | Durable assigned queue and case detail, documents/organizers/workpapers/calculations, federal/state preparation coverage, review submission, deadlines and requests, human-verified AI assistance; preserve collapsible branding/navigation |
| Reviewer | Durable assigned review discovery/workspace, source and calculation comparison, notes/corrections/risk flags, independent approval/rejection and audit; do not infer final regulated approval contracts |
| Bookkeeper | Chart of accounts/ledger/journals/reversals, reconciliations, AP/AR, statements/tax-ready reports and controlled period close |
| Practice Manager | Engagement oversight, assignments/workload, deadlines/workflow/service monitoring, analytics and escalations; unavailable capacity/SLA data stays unavailable |
| Client Service / Operations | Client intake/invitations, appointment adapters, document follow-ups, scoped communications, engagement and service requests |
| Billing / Finance | Invoices/receipts/AR/payment status, fail-closed payment adapter, independently approved refunds, reporting and audit |
| Administrator | Tenant settings, staff/role/permission management, integration configuration and controlled access reviews |
| Security / Compliance | MFA posture/security events/audit/access reviews, §7216 consent records, incidents, AI governance/evidence and security alerts |
| Executive / Owner | Practice/revenue/collections/client growth/pipeline/utilization/risk reporting from authorized records; no fabricated metrics |
| Super Administrator | Explicitly scoped platform governance/tenant administration interface, health/privileged audit/security policy/emergency stop and audited read-only dashboard inspection; no unrestricted impersonation |

For every experience: role-authorized server routes, durable repository interfaces, loading/error/empty/unavailable states, year/jurisdiction scope, accessible keyboard/responsive forms and meaningful synthetic integration tests. Durable read-only Reviewer queue is a coherent next independent feature after identity/security; reuse the existing SQL case-read preparation and accountant authorization patterns before adding approval mutations.

### 4. Federal and state preparation capabilities

- [ ] Maintain a per-year source/effective-date/version/evidence register from official IRS sources. Reverify every form's current status and applicability; catalog existence does not establish preparation support.
- [ ] Cover the eight core return families: 1040, 1041, 1065, 1120, 1120-S, 990, 706 and 709.
- [ ] Track 1040-SR/1040-X; Schedules 1/2/3/A/B/C/D/E/F/SE; 2441/8812/8863/8889/8962/8949/4797/4562/6251; fiduciary/partnership/S corporation K-1 and applicable K-2/K-3; 990-EZ/990-N/990-PF and schedules; 941/940/W-2/W-3; 1099-NEC/MISC/INT/DIV/K; 1040-ES/business estimates; 4868/7004/8868/4768; 1116/2555/5471/8938/8865; 2848/8821/8879; required statements/amendments/instructions.
- [ ] For each selected family deliver eligibility, questionnaire, validated data, schedules/calculation/workpapers, cross-form consistency, independent review and accurate output before reporting preparation readiness; record unsupported lines explicitly.
- [ ] Build all 50 states plus Washington, D.C. as versioned jurisdictions. Verify official agency identifiers and applicability for resident/nonresident/part-year individual, corporate/partnership/S corporation/fiduciary/PTE, franchise/gross receipts, sales/use, withholding/unemployment, estate/inheritance/gift/local, extensions and amendments.
- [ ] Implement allocation/apportionment/residency/credits only against verified year-specific authority and practitioner-reviewed fixtures. Never infer state applicability from a generic catalog.
- [ ] Keep e-file transmission disabled pending legal/provider authorization; adapters and acknowledgment/rejection state machines must report unavailable transmission honestly.

### 5. AI, integrations and platform

- [ ] Implement bounded classification/extraction/organizer/missing-document/research/anomaly/review/bookkeeping/drafting/automation adapters behind tenant scope, human verification, sources, uncertainty, approved data-use/§7216 consent, audit and emergency stop.
- [ ] Keep unconfigured models synthetic-only; do not fabricate successful research or provider results. No autonomous signing/approval/filing.
- [ ] Complete payment/refund, signature, email, calendar, OCR, research, federal/state filing, accounting and secure-message workflows with supported provider interfaces, idempotency and honest failure/delivery receipts; no paid/live activation.
- [ ] Complete schema/RLS/API validation, transactional writes, bounded pagination, concurrency/idempotency, append-only audit, safe errors, configuration/readiness/health/monitoring and retention.
- [ ] Document backup/restore, recovery objectives awaiting owner acceptance, migration/cutover/rollback proposals and dependency register. Isolated RLS/adversarial/restore evidence remains separate from local unit evidence.

## Validation, progress and Git checkpoints

For each major slice inspect existing implementation, implement the smallest complete behavior, add security/behavior tests, run and fix checks, update progress/completion evidence, then proceed. Required checks are typecheck, available lint, frontend/server build, relevant unit/integration/security suites, appropriate browser/responsive/accessibility tests, traceability, whitespace/diff and secret scans. Full suite is required at integration milestones. Record skipped/blocked checks with exact reason; do not label them passed.

Use the status vocabulary above consistently in the cumulative matrix and progress log. Distinguish local implementation, external integration, prototype, reference catalog, external blocker and absent capability; **none is production validated**. A passed build/test count never completes the application.

Before committing inspect current branch, full working tree and staged diff; preserve unfinished Claude files and unrelated user edits. Commit verified coherent development changes only. Before any allowed push inspect repository workflows for branch-triggered production deployment: if pushing could trigger production, keep changes local, record the blocker and continue. Never force-push/rewrite history/merge main, modify or connect to protected production Supabase, deploy the public site, provision production identities, transmit taxpayer data/returns or incur paid charges. Keep PR #10 draft and production NO-GO.

Maintain a precise session handoff with actual latest commit, changed files, validation evidence, blockers and next concrete slice. Work only while the session is active; do not claim background continuation after it ends.
