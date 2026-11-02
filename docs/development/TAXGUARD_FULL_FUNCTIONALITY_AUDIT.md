# TaxGuard AI: full functionality audit (Block 101)

Baseline: `main` at `83459b2` (Block 100). Audited on 2026-11-01. Synthetic data only. No hosted database,
deployed service or provider was used.

## How the audit was done

Each screen was traced through **UI → API route → authorization → service → database → audit evidence → UI
result**, using source and tests rather than descriptions:

- **UI to route.** `src/tests/frontendProductionRouteContract.test.ts` (new in Block 101) traces every file reachable
  from `src/main.tsx` and reads every `/api` path it names. It builds the production app in memory, mounts every
  cut-over durable router (17, including the new `public-consultations`), and records which production router, if any, serves each path. The result is checked in as
  `docs/development/frontend-production-route-contract.json`.
- **Route to authorization, service and database.** `docs/development/production-route-inventory.json` (Block 81,
  covering 222 routes probed with 10 roles) and the cutover catalog (`src/server/routeCutover.ts`, 16 durable routers before Block 101,
  each with the proposals it needs).
- **End-to-end evidence.** The browser suites (`src/tests-e2e`, 148 default and 44 provider journeys on the Block 100
  commit) run the real server, real PostgreSQL and a real browser. The PostgreSQL suites (363 tests) cover database
  authorization, concurrency and audit rows.

### Two environments, two answers

A feature can work in one environment and not the other, so every row gives two statuses:

- **Local.** The development server with the durable stores on local PostgreSQL, synthetic identities and the
  loopback provider emulation. "Operational" here means a browser journey proves the workflow end to end against
  persistent data.
- **Production as built.** What `createProductionApp` serves today. No database proposal is owner-approved, so **no
  durable router is mounted in production**. Routes backed by process memory refuse with 503. Only a small set of
  durable, stateless and diagnostic routes answer.

Statuses use the directive's terms:
- OPERATIONAL, PARTIAL, BLOCKED, PLACEHOLDER, DEFECTIVE, NOT IMPLEMENTED;
- a blocked item names its unblocking category: C database approval, D professional policy, E external provider,
  F tax-content validation.

### Correction (Block 104)

The first version of this audit took its browser evidence from the default suites only and did not count the seven
provider suites in `src/tests-e2e/provider`. It wrongly listed Stage 01 as having no completing browser journey;
provider suite 14 runs it end to end with synthetic consent wording. The rows above and below now count those suites.
Rows not changed by this correction were not otherwise re-verified.

This audit traces screens to routes. It does not yet cover every button, form and filter on each screen.

## Headline findings

1. **What production serves today.** Of the 222 production `/api` routes:

   | Routes | Kind | What they cover |
   |---|---|---|
   | 25 | DURABLE, answer from the database | session bridge, Stage 02 collection, the ordinary profile edit, AI governance reads, the accountant dashboard read, the bookkeeper client list |
   | 4 | STATELESS | stage-gate evaluation, the tax forms catalog |
   | 10 | DIAGNOSTIC | health and diagnostics |
   | 146 | VOLATILE_REFUSED | refuse with 503 |
   | 27 | DURABLE_GATED, the durable ledger | off until proposal 024 is approved |
   | 9 | RETIRED | answer 410 |
   | 1 | PROVIDER_REFUSED, the payment webhook | refuse |

   The 17 durable routers add 175 route paths. They mount only after owner approval of their proposals.
2. **Reachable screens calling routes production never serves: 53 call sites, now listed and guarded.** Production
   answers each with 503 `API_NOT_RELEASED`. Every one was reviewed:

   | Category | Count | Meaning |
   |---|---|---|
   | DEVELOPMENT_ONLY_ROUTER | 9 | `/api/staff-access` (staff directory, invitations, sessions, MFA recovery, onboarding status, re-enrolment) is mounted by the development server only, by design. **Production has no staff administration, session or MFA-recovery API at all**, not even behind the cutover gate. |
   | DEVELOPMENT_ONLY_FEATURE | 5 | Careers. Postings load only in development builds, so production shows none and the application form cannot be opened. |
   | LOCAL_CONSOLE_NOT_RELEASED | 3 | The local super administrator console, deliberately unreleased. |
   | LEGACY_FALLBACK | 2 | The client workflow router falls back to `/api/live-workflow` when the scoped bundle fails. It throws on the 503, so it fails closed. |
   | UNREACHED_CONTEXT_ACTION | 8 | Legacy AppContext actions (plan price, user status, client reassignment, onboarding, security suite) that no reachable component calls. |
   | UNUSED_MEMBER | 26 | Legacy `api.ts` members with no reachable caller (documents, integrations, accountant writes, administrator user list). |

   No call site was found that a working screen depends on in production without that being documented.
3. **Defect fixed: public consultation requests had no production path.** The public "request a consultation" form
   (proposal 043) was mounted only by the development server, so production could never serve it, whatever was
   approved. Block 101 adds it to the cutover catalog as `public-consultations`. It stays unmounted until its four
   proposals are owner-approved and the switch is set. Its 8 KB body limit now also holds behind the production app's
   256 KB global parser: a mutation-checked test sends a chunked oversized body.
4. **Runtime-dead code with a hard-coded tenant, recorded and left in place.** The client Stage 04–07 views call
   `/api/case-authority/tenantA/...` with a constructed engagement id. They can never render: stages 04–08 go to the
   durable `ClientCaseStageView` first. They are already recorded in `unreachable-code-inventory.md` (C2), and the
   repository's rule leaves deletion to the owner.
5. **Staff identity in production is the largest unbuilt integration.** The staff security screens work locally
   (suites 01 and 08 against the loopback provider emulation). Production has no route for them. Building one is
   identity architecture, not a routine cutover entry: the development router refuses non-development projects by
   design, and the administrator-invitation policy (HC7) is open. Category C and D; see the dependency register.

## Functionality matrix

Abbreviations: **OP** operational, **PART** partial, **BLK** blocked, **PH** placeholder, **NI** not implemented.
"Cutover `x`" means the durable router `x` in `routeCutover.ts`. Suites are `src/tests-e2e/NN-*`.

### Public website

| Feature | Location | Local | Production | Backend · database | Authorization | Evidence | Missing work | Priority | Next action |
|---|---|---|---|---|---|---|---|---|---|
| Consultation request form | `public/ConsultationRequestForm.tsx` | OP | BLK (C) | `consultations.routes` · `taxguard_consult_submit` | Public; consent version, idempotency key, honeypot, per-address and database limits | suite 12; `consultationRequests.test.ts` (7) | Retention period; no e-mail confirmation | P1 | Owner approval of proposals 025/027/040/043 and the `public-consultations` switch |
| Contact form (C8) | contact page | PART (disabled by design) | BLK (D) | `createPublicContactRouter` · none until enabled | Public | phase 13A tests | Consent wording, retention and rate policy | P2 | Owner decision C8 |
| Pricing | public pricing | OP (informational) | OP | none | none | `CONTROL-FRONTEND-HONEST-PUBLIC-FORMS` | No payment by design | P3 | none |
| Tax forms library | `taxForms/TaxFormsLibrary.tsx` | OP | OP | `/api/tax-forms` · static catalog | Practice staff | route inventory (STATELESS) | none | P3 | none |
| Careers | `public/CareersPage.tsx` | PART (in-memory) | PH | development in-memory careers service | Public apply; recruiter review | none durable | No durable postings or applications | P3 | Owner: is recruiting in scope? |
| Staff and client sign-in | `auth/AuthPages.tsx`, Supabase bridge | OP (local password and authenticator; provider emulation) | BLK (E) | `/api/auth/supabase-session` · `taxguard_sessions` | AAL2 for staff | suites 01, 08; provider suites 11 (client MFA), 15 (session restore) | Real non-production identity project | P1 | Owner: provision a non-production Supabase project |

### Client portal

| Feature | Location | Local | Production | Backend · database | Authorization | Evidence | Missing work | Priority | Next action |
|---|---|---|---|---|---|---|---|---|---|
| Stage 01 onboarding | `onboarding/DurableStageOnePanel.tsx` | OP | BLK (C) | cutover `stage-one` · `taxguard_onb_*` | Own client | provider suite 14 (form, synthetic consent, submit, change request, verified document, approval, Stage 02 opens); suite 18; `clientOnboarding.db.test.ts`, `caseOnboardingGate.db.test.ts`; `stageOneLiveClientBoundary.test.ts` | Approved consent wording and identity verification policy (D): only synthetic wording has been exercised | P1 | Owner: approve consent wording; approve stage-one proposals |
| Stage 02 collection and questionnaire | `collection/DurableClientCollectionWorkspace.tsx` | OP | OP (DURABLE routes) | `/api/stage-two-three` · durable collection | Own client, engagement-scoped | suite 13; route inventory | Real storage and scanner for uploads | P1 | Provider: scanner (E02) |
| Stages 03–08 status | `ClientCaseStageView.tsx` | OP (read-only, C3) | BLK (C) | cutover `client-portal` · `taxguard_portal_case_stages` | Own client | suite 15 (13A) | none for reads | P2 | Approve client-portal proposals |
| Stages 09–18 | `TaxStageStatusView.tsx` | BLK (D/E/F) | BLK | none (truthful status only) | n/a | `clientStageActionTruthfulness.test.tsx` | Preparation, signing, filing, acknowledgements | P0 for the product, blocked | See the dependency register |
| Document vault and replacement | `documents/ClientDocumentVaultPanel.tsx` | OP (fake scanner) | BLK (C, E) | cutover `vault` · `taxguard_doc_*` | Own client; quarantine until a scan verdict | suites 02, 15, 18 | Storage and scanner commissioning; retention | P1 | Approve vault proposals; commission scanner |
| Document requests | `ClientDocumentRequestsPanel.tsx` | OP | BLK (C) | cutover `vault` | Own client | suite 05 | E-mail or SMS reminders (E) | P2 | Approve proposal 031 |
| Messages | `communications/ConversationPanel.tsx` | OP | BLK (C) | cutover `communications` · `taxguard_comm_*` | Client-scoped threads; internal notes hidden | suite 10 | E-mail and SMS delivery (E) | P2 | Approve proposal 039 |
| Appointments | appointments panels | OP | BLK (C) | cutover `scheduling` · `taxguard_apt_*` | Database-locked slots | suite 11; `appointments.db.test.ts` | Calendar sync (E) | P2 | Approve proposal 040 |
| Invoices | `billing/ClientInvoicesPanel.tsx` | OP | BLK (C, E) | cutover `billing` · client projection | Allow-list projection | suites 02, 17 | Payment provider (E04) | P1 | Approve billing proposals; sandbox payments |
| Signature packages | `ClientSignaturePackagesPanel.tsx` | PART (read-only) | BLK (C, E) | cutover `client-signatures` | Own client | suite 15 | No signing transport; Stage 11 not activated | P0, blocked | Owner: e-signature provider and policy |
| Notifications and preferences | `ClientNotifications*Panel.tsx` | OP (in-app) | BLK (C) | cutover `client-portal` | Own user | suite 15 (13A) | Outbound delivery (E) | P2 | Approve C6 proposal |
| Legal coordination and advisor reassignment | `ClientLegalAndAdvisorPanels.tsx` | OP | BLK (C) | cutover `legal-matters`, `reassignment` | Own client | suite 12 | Referral rule, request limits (D) | P2 | Owner decisions on proposals 042 and 045 |
| Consultation history | `ClientConsultationHistoryPanel.tsx` | OP | BLK (C) | cutover `client-portal` | Own client | suite 15 (13A) | none | P2 | Approve C1 proposal |
| Profile edit | `ClientProfileView.tsx` | PART | PART | `PATCH /api/profile/ordinary` (DURABLE); amendments refused | Own client | route inventory | Identity verification for amendments (D) | P2 | Owner policy |

### Preparer, reviewer and practice manager workspaces

| Feature | Location | Local | Production | Backend · database | Authorization | Evidence | Missing work | Priority | Next action |
|---|---|---|---|---|---|---|---|---|---|
| Client directory, engagements, team, tasks | `PracticeClientsPanel.tsx` | OP | BLK (C) | cutover `practice` | Tenant, assignment and year scope | suites 02, 04 | Staff client creation and representatives (D) | P1 | Approve practice proposals |
| My work, workload, deadline escalation, notifications, search | `PracticeOperationsPanel.tsx`, `TeamWorkloadPanel.tsx`, `DeadlineEscalationsPanel.tsx` | OP | BLK (C) | cutover `practice` | Scoped | suites 06, 16 | Escalation thresholds are placeholders pending policy (D) | P2 | Owner thresholds |
| Accountant dashboard and case detail | `AccountantDashboard.tsx` | OP (Block 102) | PART: queue answers; case detail BLK (C) | `/api/accountant/dashboard` (DURABLE, now with the case id); case detail from cutover `cases` and `tax-engine` | AAL2 staff; the record must match the selected case | `accountantCaseDetail.test.ts`; suite 07 (Block 102 journey); `staffMfaAccountantProductionApi.test.ts` | General case workpapers have no durable record | P3 | none (Block 103 removed the queue's in-memory stage enrichment) |
| Case workflow (18 stages, transitions) | `CaseWorkflowPanel.tsx` | OP (stages 01–08) | BLK (C, D) | cutover `cases` · `taxguard_case_*` | Assignment and maker-checker | suite 03; provider suite 14 (stages 01 to 08, Stage 09 stays blocked) | Stages 09–18 attestable-stage policy | P0, blocked | Owner policy H-series |
| Document review | `StaffDocumentReviewPanel.tsx` | OP | BLK (C) | cutover `vault` | Independent reviewer | suite 02 | OCR provider (E) | P1 | Approve vault proposals |
| Tax rules, research, form mapping, draft return, verification, risk, QC, final authorization, comparison | `TaxRulesPanel.tsx`, `Case*Panel.tsx`, `QualityControlQueuePanel.tsx`, `FinalAuthorizationQueuePanel.tsx` | PART (structure only) | BLK (C, D, F) | cutover `tax-engine` (25 proposals) | Independent approval; eligibility and designation under owner policies; fails closed | suite 07; tax DB suites | No real rule content; QC and final-authorization policy | P0, blocked | Tax-content review (F); owner policy (D) |
| Ledger, reconciliation, book-to-tax | `BookkeeperLedgerWorkspace.tsx`, `BookToTaxPanel.tsx` | OP | BLK (C) | `/api/bookkeeping` (DURABLE_GATED), cutover `book-to-tax` | Forced independent review | suite 03; ledger DB suites | Firm categories (H07); accounting sync (E) | P1 | Approve proposals 024, 029 and 030 |
| Ledger reports (journal search, general ledger, history) | `LedgerReportsPanel.tsx` | OP | BLK (C) | `/api/bookkeeping` (DURABLE_GATED) | Staff, year-scoped | suite 03; `ledgerYearScope.db.test.ts` | none beyond approval | P2 | Approve proposal 024 |
| Document matching and accounting sync | `bookkeepingService` | PH | BLK (E) | VOLATILE_REFUSED routes | Staff | route inventory | No durable implementation; accounting connector | P2 | Provider decision |
| Billing workspace (draft, approve, numbering, payments, refunds, credits) | `BillingWorkspacePanel.tsx` | OP | BLK (C, E) | cutover `billing` | Independent approval; gapless numbering | suites 02, 17; billing DB suites | Payment provider; refund policy | P1 | Approve billing proposals |
| Reassignment and consultation review | `ReassignmentRequestsPanel.tsx`, `ConsultationRequestsPanel.tsx` | OP | BLK (C) | cutover `reassignment`, `consultations` | Leadership review | suite 12 | Reviewer independence policy (D) | P2 | Owner decision |

### Administration, security and AI

| Feature | Location | Local | Production | Backend · database | Authorization | Evidence | Missing work | Priority | Next action |
|---|---|---|---|---|---|---|---|---|---|
| Staff directory, invitations, membership | `StaffAccessManagementPanel.tsx` | OP (development router) | NI | `/api/staff-access` (development only) | Administrator, AAL2, recent sign-in | suite 08; provider suites 10, 12 | **No production route**; HC7 policy | P1 | Decision package: production staff identity (C, D) |
| Staff sessions and account security | `StaffSessionsPanel.tsx`, `StaffAccountSecurityPage.tsx` | OP | NI | `/api/staff-access` | Own sessions; administrator step-up | suites 01, 08; `concurrency.db.test.ts` | No production route | P1 | Same decision package |
| MFA recovery and re-enrolment | `StaffMfaRecoveryPanel.tsx` | OP (provider emulation) | NI | `/api/staff-access` | Independent approval | suite 08; provider suite 09 | Real non-production provider (E); no production route | P1 | Same decision package |
| Audit center and security view | `AuditCenterPanel.tsx` | OP | BLK (C) | cutover `audit-center` | Administrator only; redacted | suites 11, 16 | Append-only trigger proposal | P2 | Approve proposals 041 and 046 |
| Durable job queue | `AdminJobQueuePanel.tsx` | OP | BLK (C) | cutover `jobs` | Operational administrator | suite 11 | Operations-role access policy (D) | P2 | Approve proposal 20261019240000 |
| Route cutover status | `/api/route-cutover` | OP | OP | `productionApp.ts` | Operational administrator | `routeCutover.test.ts` | none | P3 | none |
| AI control center (commissioning readiness, decisions, emergency stop) | `AiControlCenterPanel.tsx` and related | OP (read-only) | OP (DURABLE reads; nothing commissioned) | `/api/ai-governance` | Administrator | route inventory; AI governance tests; provider suite 13 (uncommissioned agents refused) | All 61 agents DRAFT; no provider | P0 for AI, blocked | Owner: AI commissioning (not authorized) |
| Super administrator console | `SuperAdminConsole.tsx` | PART (local) | NI by design | local console routes | Local super administrator | none in production | Not released by design | P3 | none |
| Health and diagnostics | `/api/health*` | OP | OP | diagnostics | Administrator for details | route inventory | Log shipping and alert routing (E) | P2 | Provider |

### Filing and payments

| Feature | Local | Production | Missing work | Next action |
|---|---|---|---|---|
| E-signature (Stage 11) | NI | NI | Signature transport, proof format, taxpayer authorization wording (D, E) | Owner decision; Stage 11 stays inactive |
| Filing and transmission (Stage 12) | NI | NI | IRS transmitter credentials and approved package (E, D) | Not authorized; stays inactive |
| Acknowledgements (Stage 13) | NI | NI | Receipt transport (E) | Blocked on filing |
| Live payments | Sandbox only | PROVIDER_REFUSED | Payment provider commissioning (E04) | Not authorized |

## Dependency register (what unblocks what)

| Unblocks | Category | Exact action needed |
|---|---|---|
| Every BLK (C) row | C | Owner review and approval of that cutover entry's proposals (`routeCutover.ts`; 108 review-only proposals), applied by the owner, then the cutover switch |
| Production staff administration, sessions and MFA recovery | C, D | Owner decision on a production staff identity design (the development router refuses non-development projects by design), plus the HC7 administrator-invitation policy |
| Real sign-in and MFA validation | E | A separate non-production Supabase project |
| Uploads, OCR | E | Scanner (E02) and OCR provider commissioning |
| E-mail, SMS, calendar sync | E | Delivery providers, channel-consent wording and retention (D) |
| Payments | E | Payment provider (E04); refund records policy |
| Tax preparation stages 09–18 | D, F | Professional eligibility and attestation policy; reviewed rule content and verification cases |
| Signing and filing | D, E | E-signature and transmitter decisions; explicit authorization (not given) |
| AI agents | owner | Commissioning approval (not given) |

## What this audit changes in the code

- `src/tests/frontendProductionRouteContract.test.ts` with `docs/development/frontend-production-route-contract.json`.
  A new reachable call to a route production never serves fails the build until it is reviewed, and a fixed entry
  must be removed from the list.
- The `public-consultations` cutover entry and factory (`routeCutover.ts`, `productionApp.ts`), plus the 8 KB body
  guard in `consultations.routes.ts`.

## Category A and B work identified (implementable now)

1. **Accountant case detail: done in Block 102.** Found on the way: the durable accountant queue ignored engagement /
   tax-year scoped grants, so a preparer staffed for one engagement year saw no cases. It now reads current
   assignments from the database at request time. The case detail reads the durable case (stage state) and its return
   versions by case id, and the workpapers tab says plainly that general case workpapers have no durable record.
   Block 103 removed the queue's per-row stage enrichment from the in-memory case authority; the durable rows carry
   the stage.
2. **Stage 01 live client boundary: done in Block 104.** A prospective client, or a client with no e-mail on record,
   was not treated as live, so the wizard offered the demonstration environment selector and a browser-held dossier. Every
   client role is now live. An uncalled function holding a fabricated signer, IP address and consent version was removed.
3. **Legacy `api.ts` members and AppContext actions with no caller** (34 call sites). The repository's unreachable-code
   rule asks for an owner deletion decision. The evidence is in the contract file, categories UNUSED_MEMBER and
   UNREACHED_CONTEXT_ACTION.

The next development priority is the control-level pass the route trace did not cover: the reachability audit's leads
for buttons without handlers, simulated values and other evidence patterns (`scripts/frontend/reachability-audit.mjs`).
