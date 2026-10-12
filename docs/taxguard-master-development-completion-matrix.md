# TaxGuard Master Development Completion Matrix

**PRODUCTION STATUS: NO-GO.** Last updated 2026-10-12 (Step 1: production Accountant API and mandatory staff MFA).

This is the cumulative, verifiable feature register requested by the Master Development Completion Directive. It complements, and does not replace:

- the per-requirement evidence in [taxguard-master-traceability.md](taxguard-master-traceability.md) / `.json`;
- the diagram-to-code map in [taxguard-master-development-requirements-matrix-20261011.md](taxguard-master-development-requirements-matrix-20261011.md);
- the H01–H11 / E01–E08 decision and dependency register in [taxguard-master-remaining-decisions.md](taxguard-master-remaining-decisions.md) and the requirements matrix §4.

## Status vocabulary

| Status | Meaning |
| --- | --- |
| COMPLETE AND VERIFIED | Implemented and covered by passing automated tests, within the stated bounded scope |
| IMPLEMENTED BUT INCOMPLETE | Working, but missing required parts |
| UI ONLY / MOCK DATA | Interface exists; data is synthetic, local or demonstration |
| BACKEND ONLY | Server capability without a working UI |
| NOT IMPLEMENTED | Absent |
| BLOCKED BY INTEGRATION | Requires an external provider or infrastructure (E01–E08) |
| BLOCKED BY OWNER DECISION | Requires H-decision |
| BLOCKED BY SECURITY OR COMPLIANCE | Requires legal, privacy or security sign-off |

"Verified" here always means local automated verification with synthetic data. **Nothing is verified against a deployed environment, a real browser, or a live provider.**

## 1. Security, authentication and tenant isolation (Phase 1)

| ID | Requirement | Existing implementation | Missing work | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| P1-01 | Fail-closed auth configuration; no placeholder hosts; anon key never a service key | `supabase/config.ts`, `server/supabase.ts` | Real IdP (E03) | COMPLETE AND VERIFIED | `supabaseConfigFailClosed.test.ts` |
| P1-02 | Sign-in / registration / reset notices; reset never claims success on failure | `AuthPages.tsx` | Browser check (E06) | COMPLETE AND VERIFIED | `authConfigurationNotice.test.tsx` |
| P1-03 | Session revocation, suspension, membership / identity removal take effect next request | `SupabaseDurableSessions.verify` | Deployed check (E07) | COMPLETE AND VERIFIED | `durableSessionRevocation.test.ts` |
| P1-04 | Production client ownership and staff assignment scope | `verify()` + `getAuthorizedClientIds` (status selected) | — | COMPLETE AND VERIFIED | Same file (production-path suite) |
| P1-05 | Cross-tenant client selection denied (in-memory routes) | `resolveAuthorizedClientContext`, `clientAccess.ts` | Durable-store routes (E01) | COMPLETE AND VERIFIED | `documentUploadValidation.test.ts` |
| P1-06 | Object-level authorization: accountant task review, reconciliation sign-off / lock, journal review / post | `accountant.routes.ts` + `clientAccess.ts` | — | COMPLETE AND VERIFIED (cycle f) | `accountantObjectAuthorization.test.ts` |
| P1-07 | Object-level authorization: accounting integrations, staging, messages, appointments, practice console | Respective routers | — | COMPLETE AND VERIFIED (cycle f) | `integrationsAuthorization.test.ts`, `stagingAuthorization.test.ts`, `legacyRouteObjectAuthorization.test.ts` |
| P1-08 | Tenant ownership on admin-gated legacy routes: assignments, onboarding review / activation, calendar | Assignments already used `belongsToTenant` (now tested). Onboarding and calendar fixed in cycle (g). | — | COMPLETE AND VERIFIED (cycle g) | `assignmentsTenantOwnership.test.ts`, `onboardingReviewAuthorization.test.ts`, `calendarTenantOwnership.test.ts` |
| P1-12 | Payment webhook authenticity: secret required everywhere, signature always required, event id required | `payments.routes.ts` | Stripe's real signature scheme with timestamp tolerance (E04) | IMPLEMENTED BUT INCOMPLETE (cycle g); unsigned settlement closed | `paymentsRouteAuthority.test.ts` |
| P1-11 | Staff activation cannot grant roles outside the invitation vocabulary (privilege escalation) | `ACTIVATABLE_STAFF_ROLES` shared by invite and activation | — | COMPLETE AND VERIFIED (cycle g) | `onboardingReviewAuthorization.test.ts` |
| P1-09 | MFA, rate limiting and lockout | Audited in cycle (h). Legacy local login: MFA-code bypass closed (fails closed with no verifier); account-wide lockout (15 / any IP) added beside per-IP lockout (5); reset-token exposure and throttling fixed. | Production (Supabase) sessions do not enforce MFA assurance level (AAL2): needs the role → MFA policy and Supabase MFA configuration. No general API rate limiter verified on legacy routes. | IMPLEMENTED BUT INCOMPLETE; production MFA **BLOCKED BY OWNER DECISION (H06 / H09) + INTEGRATION (E03)** | `authBruteForceAndMfa.test.ts` |
| P1-17 | Mandatory staff MFA (AAL2) on durable sessions: sign-in gate and per-request check; session store failures fail closed | `staffMfa.ts`, `supabase.ts`, `supabase-db.ts`, `auth.ts`, browser MFA step | Migration (session `aal` column) and Supabase MFA configuration not applied; staff enrolment UI | IMPLEMENTED (development branch, Step 1); production **BLOCKED** pending migration approval, E03 and H06 / H09 | `staffMfaAccountantProductionApi.test.ts`, `supabaseStaffMfaClient.test.ts` |
| P1-13 | Password reset cannot be taken over outside production | `devResetToken` only with an explicit local-development opt-in; per-address throttle with neutral responses | — | COMPLETE AND VERIFIED (cycle h) | `authBruteForceAndMfa.test.ts` |
| P1-14 | Real super administrator sign-in (local): environment-provisioned account, password hash, mandatory TOTP (RFC 6238, replay-protected), server-side role, 30 min idle / 8 h absolute session, server-side logout, audit | `superAdminBootstrap.ts`, `totp.ts`, `auth.routes.ts`, `scripts/provision-super-admin.mjs`, staff sign-in page | Supabase-path super administrator with AAL2 (E03, H06 / H09) | COMPLETE AND VERIFIED (local, cycle i) for synthetic accounts; live browser sign-in verified on localhost with a synthetic account. **Owner's personal sign-in: UNVERIFIED (open issue)**. Troubleshooting utilities and opt-in diagnostics added (cycle j) | `superAdminAccess.test.ts` |
| P1-15 | No universal super-administrator override; maker-checker, locked periods and role-exclusive routes bind super administrators | `requireRole` (super admin = administrator superset only); five `accountant.routes.ts` exemptions removed | — | COMPLETE AND VERIFIED (cycle i) | `superAdminAccess.test.ts` (mutation-checked) |
| P1-16 | No hard-coded seed passwords | `initSeedPasswords` seeds only from `SEED_*`; seeded super administrator never seeded | — | COMPLETE AND VERIFIED (cycle i) | `superAdminAccess.test.ts` |
| P1-10 | RLS on deployed Supabase | Migrations + disposable PGlite tests | Platform verification | BLOCKED BY INTEGRATION (E01 / E07) | `aiGovernanceFixture.ts` suites |

## 2. Documents (Phase 6 / directive §9)

| ID | Requirement | Existing implementation | Missing work | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| DOC-01 | Metadata validation: type / extension / size / year / batch | `documentUploadValidation.ts` | — | COMPLETE AND VERIFIED | `documentUploadValidation.test.ts` |
| DOC-02 | File-signature (magic byte) validation when bytes are supplied | `matchesFileSignature`, deliverable route | Wire into a real byte-upload intake | IMPLEMENTED BUT INCOMPLETE | Same + `accountantObjectAuthorization.test.ts` |
| DOC-03 | Real byte storage, private bucket, malware scanning, OCR | Legacy routes are metadata-only; production returns 503 | Vault + scanner + OCR provider | BLOCKED BY INTEGRATION (E02) | `documentListAuthorizationAndUploadSecurity.test.ts` (production 503) |
| DOC-04 | Signed downloads | 5-minute in-memory tokens; streams simulated content | Real storage | UI ONLY / MOCK DATA | — |

## 3. Workflow (directive §6)

| ID | Requirement | Status | Note |
| --- | --- | --- | --- |
| WF-01 | Durable server-authoritative 18-stage engine | IMPLEMENTED BUT INCOMPLETE | `LEGACY_18_V1` persisted; label set **BLOCKED BY OWNER DECISION (H10)**; many stage actions blocked (H03, H05, H07, E02, E04) |

## 4. Accounting (directive §5.4)

| ID | Requirement | Status | Note |
| --- | --- | --- | --- |
| ACC-01 | Staging → ledger posting with maker-checker, and controlled reversal | IMPLEMENTED BUT INCOMPLETE | Reversing-entry workflow **COMPLETE AND VERIFIED (cycle h)**: request → independent approval / rejection, offsetting entry, original preserved (`stagingReversalWorkflow.test.ts`). The store is still in-memory (durable ledger E01). |
| ACC-02 | Accounting-provider connections and write pipeline | BLOCKED BY INTEGRATION (E04) | Authorization gates real and tested; sync / commit return `ACCOUNTING_PROVIDER_NOT_COMMISSIONED` (previously fabricated success) |

## 5. AI governance (directive §11)

| ID | Requirement | Status | Note |
| --- | --- | --- | --- |
| AI-01 | Emergency stop, all scopes, server-enforced on every execution path | COMPLETE AND VERIFIED (activation) | Deactivation **BLOCKED BY OWNER DECISION (H11)** |
| AI-02 | Control Center read views (registry, runs, decisions, events, usage) | COMPLETE AND VERIFIED | Admin-only UI until H06 |
| AI-03 | Specialist agents A01–A60 | BLOCKED BY OWNER DECISION (H01 / H01a / H02) | All DRAFT |
| AI-04 | Accountant "AI tax assistant" | NOT IMPLEMENTED (honestly reported) | Previously returned a fixed canned paragraph labelled AI research; now 503 `AI_TAX_ASSISTANT_UNAVAILABLE` |

## 6. Dashboards, tax engine, integrations, operations, deployment

These are unchanged from the requirements matrix §3.2–3.5 and the remaining-work inventory:

| Area | Status | Blocked by |
| --- | --- | --- |
| Client, Accountant, Reviewer, Bookkeeper, Practice Manager, Client Service dashboards | IMPLEMENTED BUT INCOMPLETE | — |
| Super Administrator console: 10-dashboard selector (URL + local persistence, audited), inspection mode (layout only, no role data, no permission change) | COMPLETE AND VERIFIED (local, cycle i): `superAdminConsole.test.tsx`, `superAdminAccess.test.ts`, localhost browser walk-through | — |
| ACC-DASH-01 Accountant / Tax Preparer dashboard redesign: collapsible / icon sidebar, KPI cards, 18-stage pipeline summary, sortable work queue, deadlines, quick actions, responsive and accessible; unavailable metrics never shown as zero | COMPLETE AND VERIFIED (local, cycle k): `accountantDashboardRedesign.test.tsx`, browser check with synthetic data. Production read route implemented in Step 1 (durable, tenant-scoped, AAL2); public availability **BLOCKED** pending migration, data population (E01) and deployment approval | — |
| FORMS-01 Tax Forms Library (`/staff/forms`): 63 federal entries (59 official-source verified), eight core categories, 50 states + D.C. category catalog (unverified), honest capability states, read-only staff API | COMPLETE AND VERIFIED as a **reference catalog** (cycle k): `taxFormsLibrary.test.tsx`. Preparation, PDF and e-file **NOT IMPLEMENTED / BLOCKED (E04)**; state applicability unverified | — |
| Billing, Security / Compliance, Executive dashboards | NOT IMPLEMENTED or partial (shown as honest status cards in the console) | H06 |
| Tax calculation engine and form coverage | IMPLEMENTED BUT INCOMPLETE; no jurisdiction certified | H07 |
| E-signature, filing, payments, email / calendar providers | BLOCKED BY INTEGRATION | E04 |
| Infrastructure, deployment and DR | BLOCKED BY INTEGRATION | E08 / E09 |

## 7. Open decisions (unchanged; not resolved by assumption)

- **Decisions:** H10 (stage list), H11 (stop deactivation), H06 (roles), H01a (agent names).
- **Platform conflict:** Supabase vs Firebase / Google GenAI on `main` (`fc36cac`).
- **Dependencies:** E01–E08.

## Autonomous continuation — identity/security development (2026-10-12)

Production remains NO-GO. The original Step 1 inventory above is preserved; these rows record the newer uncommitted development slice.

| Capability | Current bounded status | Remaining | Evidence |
| --- | --- | --- | --- |
| Invitation issuance/revocation and confirmed-email lookup | Implemented, awaiting integration | Approved non-production provider commissioning; administrator UI | staffInvitationManagement service; actual-core SQL and HTTP fixture tests; unapplied 20261012030000 proposal |
| Provider-only invitation onboarding UI | Implemented, testing in progress | Browser interaction and authorized provider end-to-end validation | StaffInvitationFlow and staffInvitationApi; synthetic adapter tests |
| TOTP setup and challenge | Implemented, awaiting integration | Approved recovery for lost pending setup material; real provider/browser validation | TotpEnrollmentPanel, mfaEnrollment, supabaseStaffMfaClient and adapter tests |
| Acceptance and independent activation | Implemented, awaiting integration | Shared client/invitation transaction; administrator management UI | Acceptance/activation services; actual-core SQL tests; unapplied 20261012020000 proposal |
| Suspension/deactivation/independent reactivation | Implemented, testing in progress | Administrator UI; approved provider integration | Lifecycle service/proposal; session revocation and fresh sign-in proof tests |
| Durable inactive membership denial | Implemented and locally tested | Deployment/independent review | All-environment durableMembershipLifecycle tests |
| Stage 02 reconciliation authority | Implemented and locally tested | Durable tenant-aware adapter; production stays unavailable | stageTwoReconciliationAuthorization tests |
| MFA recovery and provider factor replacement | Not implemented | Approved recovery workflow and idempotent provider adapter | Future reenrollment gate cannot be cleared by ordinary reactivation |

Browser and server staff onboarding are disabled by default, development-only, and reject the protected Supabase project. No production connections, deployments, migrations, real identities or taxpayer data were used. Ordinary eleven-role local architecture is authorized by the new master instruction; external, legal and release approvals still apply.

### Administrator directory and staff management development slice

Durable, tenant/AAL2-authorized member/invitation directory services and a service-only SQL proposal now provide status filters and bounded, deterministic microsecond keyset pagination. Staff directory DTOs omit token hashes, factor/provider metadata and unrequested fields. The existing Practice Staff & Roles tab has connected invitation issuance/revocation, independent approval and reasoned lifecycle actions, with session-isolated forms, confirmations and once-only token handoff.

Status: implemented locally, validation in progress; authorized non-production provider/browser integration remains outstanding. New APIs and browser operations remain development-gated and unavailable for protected production destinations. This does not complete MFA recovery, shared provisioning transactions, the role model or the rest of the application.

## Development continuation — 2026-10-12 identity and intake

| Capability | Current classification | Evidence / remaining boundary |
| --- | --- | --- |
| Administrator paginated staff/invitation directory and lifecycle UI | Implemented and tested locally | Directory snapshot228files /4,356tests; no provider/browser/production validation |
| Atomic client identity and permanent ID allocation | Implemented and tested locally; awaiting integration | Service-only proposal006; confirmedemail, coherent replay, invitation serialization, rollback; counter commissioning and real PostgreSQL concurrency outstanding |
| Durable client session bridge | Implemented and tested locally; awaiting integration | Strict configured authority, RPC resume, no cached onboarding promotion; durable hierarchy explicitly unavailable |
| Client onboarding hierarchy | Prototype only / durable provider not implemented | Existing process-local route disabled for production/configured identity projects; no fabricated assignments or18stage completion |
| Client intake draft save/submit/read | Implemented, validation/integration pending | Proposed007 + server adapter; existing real engagement/year required, revisions/idempotency/audit; no HTTP/UI mount or provider commissioning yet |
| Provider identity change privacy in staff onboarding/MFA | Implemented, integration pending | UID/email/sign-out/new sign-in generation invalidation; refresh/MFA event continuity;59focusedtests, no real browser/provider evidence |
| MFA recovery / replacement | Not implemented | Independent approval, suspend/revoke/providerjob/re-enroll/re-AAL2 gates remain next identity dependency |

None of these capabilities is production validated. All migrations remain proposals. Existing historical synthetic workflow tests now explicitly describe demonstration adapters rather than production readiness.

Current integrated checkpoint: 236files /4,589 tests passed; typecheck/lint/build/diff pass. Browser/provider/production validation absent.

## Durable identity continuation — 2026-10-12

| Capability | Classification | Evidence / limits |
| --- | --- | --- |
| Atomic session mint/revoke/audit | Implemented and tested locally; awaiting integration | Proposed008; authority/AAL2/epoch recheck, suspension race ordering, audit rollback, tenant/idempotent revocation; actual provider/multi-connection PostgreSQL unverified |
| Ordinary client contact updates | Implemented and tested locally; awaiting integration | Proposed009, strict phone/companyName-only RPC and HTTP PATCH; no cache publication on failure, preserved authority/progress; historical contacts require independent reconciliation |
| Seven-section profiles and amendments | Prototype only; durable provider not implemented | Production/configured handlers fail503; isolated demonstration workflows retained; no durable name/approval/readiness claim |
| Contacts across client login | Implemented and tested locally |006 whitelisted optional contact replay, coherent phone check, Unicode boundaries; no broad profile JSON spread |
| Development production-destination guard | Implemented and tested locally |242 files/4,773 tests snapshot; known protected browser/server destinations refused, browser credentials rejected, cached browser override hardening included in final rerun |
| MFA recovery request/approval/outbox | Partial implementation; locally tested, awaiting integration | Proposed010 + service, independent current durable AAL2 actor proof, suspension/revoke/reenrollment/audit/pending job; HTTP/UI, provider reset/fenced worker, enrollment proof/final activation/cancellation unimplemented |

Session/profile checkpoint241files/4,755 tests passed. Entire application incomplete, production NO-GO; no migration applied or provider/production operation performed.

Current frozen-source checkpoint244files/4,853 tests passed; typecheck/lint/build/diff and scoped credential scan passed. Browser/provider/production validation absent. All proposed migrations unapplied.

## Claude branch `claude/taxguard-dev-20261012` — 2026-10-12 (not yet integrated into the shared branch)

| ID | Feature | Status | Evidence / remaining |
| --- | --- | --- | --- |
| STAFF-SESS-01 | Own-session list / revoke / sign out others; administrator member-session revocation with 15-minute step-up | IMPLEMENTED, AWAITING INTEGRATION | Proposal 023 (unapplied); `staffSessionManagementSql/Http`, `staffSessionsPanel` tests. Development-only router |
| ACC-03 | Ledger scope hardening, cent-exact balancing, period locks by date, reversal and close controls (in-memory engine) | COMPLETE AND VERIFIED (development) | `ledgerIntegrityAndPeriodClose.test.ts` (mutation-checked) |
| ACC-04 | Durable tenant/client-isolated ledger: accounts, periods, entries/lines, bank transactions, reconciliations, counters, audit; DB-enforced balance, immutability, period locks, idempotency | IMPLEMENTED, AWAITING INTEGRATION | Proposal 024 (unapplied); `durableLedgerSql.test.ts` incl. simulated restart (PGlite on disk); multi-connection PostgreSQL concurrency NOT VERIFIED |
| ACC-05 | Bookkeeping workflows on the durable store: review approve / reject / request correction, replacement entries, reversal, period open/close/reopen, bank ingestion & categorization, reconciliation, trial balance, P&L, balance sheet, general ledger, search, audit history | IMPLEMENTED, AWAITING INTEGRATION | `durableLedgerHttp.test.ts` (full synthetic cycle), UI panels in Accountant ledger tab; production requires `TAXGUARD_LEDGER_STORE=durable` after migration, otherwise 503 |
| ACC-06 | Book-to-tax, document matching and provider sync on the durable store | NOT IMPLEMENTED | Return 503 `DURABLE_FEATURE_NOT_AVAILABLE` in durable mode |
| ACC-07 | Bookkeeper dashboard on durable data; bookkeeper ledger mutations | BLOCKED BY ROLE POLICY | Bookkeeper operations remain `BOOKKEEPER_OPERATION_NOT_RELEASED`; read projection still uses the in-memory engine |
| CLIENT-01 | Client directory, engagement lifecycle, tax years, team assignment with history and segregation of duties, notes, tasks with dependencies, deadlines, archive / reactivate | IMPLEMENTED, AWAITING INTEGRATION | Proposal 025 (unapplied); `practiceManagementHttp.test.ts`; development-only `/api/practice`; Practice Manager *Clients & Engagements* |
| CLIENT-02 | Staff-initiated client creation; authorized representative records | BLOCKED (coordination / decision) | Must align with proposal 006 client identity; representative data needs a privacy decision |
| WF-02 | Durable case creation from engagement team, sequential LEGACY_18_V1 transitions with SQL-computed / reviewer-attested evidence, returns, holds, immutable history, queues, status report | IMPLEMENTED, AWAITING INTEGRATION | Proposal 026 (unapplied); `caseWorkflowHttp.test.ts`; stages 09–18 BLOCKED (H07, E04, filing not authorized); attestable-stage policy needs owner confirmation; reconcile with Codex intake (007) case materialization |
| STAFF-SEC-01 | Staff account-security page, own security history, suspension / re-enrolment messaging, session expiry and revocation coverage | IMPLEMENTED, AWAITING INTEGRATION | `/staff/account-security`; proposal 023 history function (unapplied); step-up extension to proposals 002-004 / 010 recommended, not applied (Codex-owned) |
| QA-BATCH-01 | Proposal composition (000-260), database security invariants, cross-module isolation and role matrix, dependency audit | COMPLETE AND VERIFIED (local) | `proposalCompositionSecurity.test.ts`; multi-connection concurrency and GitHub CI on this branch NOT VERIFIED; see `docs/development/batch-hardening-report.md` |
| DOC-VAULT-01 | Durable document vault: private storage, validation, quarantine and scan boundary, versioning, independent review, audited short-lived downloads, OCR proposals with human verification, client and staff UI | IMPLEMENTED, AWAITING INTEGRATION | Proposal 027 (unapplied); `documentVaultHttp.test.ts`; scanner / OCR not commissioned (E02) — uploads stay quarantined |
| BILL-01 | Durable billing: catalog with price history, invoice drafting, independent approval, gapless numbering, payments with idempotency and duplicate protection, refunds, approved credits, AR aging, staff and client UI | IMPLEMENTED, AWAITING INTEGRATION | Proposal 028 (unapplied); `billingHttp.test.ts`; sandbox payments only, no live provider (E04) |
| B2T-01 | Durable book-to-tax: firm categories, versioned reviewed mappings, reviewed adjustments with verified evidence, reconciled immutable workpapers linked to cases | IMPLEMENTED, AWAITING INTEGRATION | Proposal 029 (unapplied); `bookToTaxHttp.test.ts`; no tax computed; categories are firm-supplied (H07) |
| BK-DASH-02 | Bookkeeper ledger workspace on the durable ledger: work queue, reviewed journal entries and categorizations, reconciliation, period visibility, statements, search, history | IMPLEMENTED, AWAITING INTEGRATION | Proposals 024 (amended: bookkeeper postings forced to review) and 030 (unapplied); `bookkeeperDurableHttp.test.ts`; supersedes ACC-07 role-policy block for the durable store only |
| QA-E2E-01 | Browser E2E (Edge): staff sign-in with TOTP, replay refusal, sign-out revocation, role dashboards, engagements and staffing, document upload/scan/review/download, billing approval and sandbox payment, bookkeeper ledger and reconciliation, book-to-tax, case stages 1-8 (9 blocked), cross-tenant/client refusals | COMPLETE AND VERIFIED (local, synthetic) | `npm run test:e2e` (25 tests); real `server.ts` + local PostgreSQL; found and fixed dev start-up crash, client document page crash, manager capability gap; Supabase sign-in not exercised |
| QA-DB-01 | Real PostgreSQL: composition and ordering, idempotent re-apply, security invariants, concurrent postings / numbering / idempotency / reviews / period close, invoice numbering, duplicate payments, document review race, session revocation race, rollback | COMPLETE AND VERIFIED (local, synthetic) | `npm run test:db` (15 tests, mutation-checked) |
| DOC-REQ-01 | Document requests and firm checklists per engagement year: upload requirements, client upload into a request, review-driven fulfilment, waivers/withdrawals with reasons, reminders, missing-document tracker, request-aware review queue, in-app client notices, stage 2/3 gates, audit and isolation | IMPLEMENTED, AWAITING INTEGRATION | Proposal 031 (unapplied) + 026 hook; `documentRequestsHttp` (mutation-checked), `documentRequestsPanels`, browser `05-document-requests`; no e-mail/SMS provider |
