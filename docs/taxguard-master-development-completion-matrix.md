# TaxGuard Master Development Completion Matrix

**PRODUCTION STATUS: NO-GO.** Last updated 2026-10-11 (cycle f).

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
| P1-08 | Tenant check on admin-only legacy routes (assignment suspend / restore / review, onboarding review / activation, calendar override / disconnect) | Role-gated only | Tenant ownership of the target record | IMPLEMENTED BUT INCOMPLETE | Scan list in cycle (f) report |
| P1-09 | MFA, session refresh, device / session monitoring, rate limiting | Partial / unknown | Audit and implementation | NOT IMPLEMENTED (unverified) | — |
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
| ACC-01 | Staging → ledger posting with maker-checker | IMPLEMENTED BUT INCOMPLETE | In-memory store; posted rollback now refused (`ROLLBACK_REQUIRES_REVERSAL`); a reversing-entry workflow is **NOT IMPLEMENTED** |
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
| Billing, Security / Compliance, Executive dashboards | NOT IMPLEMENTED or partial | H06 |
| Tax calculation engine and form coverage | IMPLEMENTED BUT INCOMPLETE; no jurisdiction certified | H07 |
| E-signature, filing, payments, email / calendar providers | BLOCKED BY INTEGRATION | E04 |
| Infrastructure, deployment and DR | BLOCKED BY INTEGRATION | E08 / E09 |

## 7. Open decisions (unchanged; not resolved by assumption)

- **Decisions:** H10 (stage list), H11 (stop deactivation), H06 (roles), H01a (agent names).
- **Platform conflict:** Supabase vs Firebase / Google GenAI on `main` (`fc36cac`).
- **Dependencies:** E01–E08.
