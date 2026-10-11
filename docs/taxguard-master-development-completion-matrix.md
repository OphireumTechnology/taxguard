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
