# Phase 12 feature gap matrix

Baseline: Phase 11 merge `dc9c96c072031e8949aeb07be2691664361675c2` (`origin/main`).
This is a source-backed inventory, not a staging or production acceptance claim. A route,
component, migration proposal or synthetic test proves only the scope named in its evidence.

| Domain | Current classification | Code and test evidence | Remaining gap / boundary |
|---|---|---|---|
| Staff authentication and MFA | Implemented locally; real provider commissioning blocked | `src/server/auth.ts`; `src/tests/providerOnlyIdentityFlow.test.ts`, `src/tests/staffAccessHardening.test.ts` | Real non-production provider enrollment/recovery and owner-approved rate policy. |
| Client identity and registration | Partial; provider commissioning blocked | `src/server/routes/client-portal.routes.ts`; `src/tests/clientRegistrationAndOnboardingFlow.test.ts`, `src/tests/clientDataIsolationSecurity.test.ts` | End-to-end real-provider acceptance and complete identity lifecycle. |
| Client and engagement lifecycle | Partial, with durable local foundations | `src/server/routes/practice.routes.ts`; `src/tests/practiceManagementHttp.test.ts` | Production-mode API cutover and complete independent journey acceptance. |
| Case stages 01–18 | Stages 01–08 have bounded evidence gates; 09–18 intentionally blocked | `src/server/routes/cases.routes.ts`, `src/server/taxguard/stageGateBridge.ts`; `src/tests/caseWorkflowHttp.test.ts` | Approved rule packs, practitioner authority, forms, signature and filing prerequisites. |
| Document requests and upload vault | Durable local workflow; storage commissioning blocked | `src/server/taxguard/documents/documentVaultStore.ts`; `src/tests/documentVaultHttp.test.ts`, `src/tests-db/phase11Boundaries.db.test.ts` | Real private-storage acceptance and approved lifecycle/retention policy. |
| Document review and scanning | Quarantine and authenticated adapter boundary implemented; real detection blocked | `src/server/taxguard/documents`; `src/tests/malwareScanning.test.ts`, `src/tests-db/phase11Boundaries.db.test.ts` | Commissioned provider and operational key custody; fake verdicts are not malware detection. |
| Messaging and notifications | Durable in-portal messages; outbound delivery uncommissioned | `src/server/routes/communications.routes.ts`; `src/tests/clientMessaging.test.ts` | Email/SMS provider, delivery retry policy and notification preferences. |
| Appointments and consultation requests | Durable local scheduling/intake; policy and calendar gaps remain | `src/server/routes/appointments-durable.routes.ts`, `src/server/routes/consultations.routes.ts`; `src/tests/appointments.test.ts`, `src/tests/consultationRequests.test.ts` | Calendar integration, consultation retention and proxy/rate policy decisions. |
| Advisor assignments and reassignment | Scoped local controls; policy decision remains | `src/server/routes/client-portal.routes.ts`; `src/tests/clientPortalReadsAndReassignment.test.ts` | Owner decision on independent approval for conflict-sensitive reassignment. |
| Bookkeeping and double-entry ledger | Durable exact-decimal ledger, review, reversal and period controls | `src/server/taxguard/bookkeeping/sqlLedgerStore.ts`; `src/tests/durableLedgerHttp.test.ts`, `src/tests-db/concurrency.db.test.ts` | Accounting-system commissioning and broader business acceptance. |
| Bank imports and reconciliation | Local/synthetic intake and ledger reconciliation only | `src/server/routes/bookkeeping.routes.ts`; `src/tests/durableLedgerHttp.test.ts`, `src/tests/ledgerIntegrityAndPeriodClose.test.ts`, `src/tests-db/concurrency.db.test.ts` | No bank feed is commissioned; imports remain user-supplied or synthetic. |
| Financial reporting | Narrow local ledger/dashboard projections | `src/server/routes/accountantDashboard.routes.ts`; `src/tests/reviewerDashboardHttp.test.ts`, `src/tests/ledgerIntegrityAndPeriodClose.test.ts` | Full reviewed report catalog, period-close acceptance and external accounting integration. |
| Book-to-tax adjustments | Durable workpaper foundation, not a complete tax reconciliation product | `src/server/routes/bookToTax.routes.ts`; `src/tests/bookToTaxHttp.test.ts` | Approved authority/fact adapters, reviewed mappings and practitioner completion. |
| Tax computation engine | Deterministic/versioned infrastructure; real rules require professional approval | `src/server/taxguard/taxEngine/taxEngineStore.ts`; `src/tests/taxEngineHttp.test.ts` | No approved federal/state tax-year content; incomplete rule sets fail closed. |
| Tax review and practitioner approval | Bounded stage/review records exist; professional authority is incomplete | `src/server/routes/cases.routes.ts`; `src/tests/caseWorkflowHttp.test.ts` | Firm-approved checklist, qualified reviewer authority and independent sign-off policy. |
| E-signatures and filing readiness | Intentionally disabled | `src/server/taxguard/stageGateBridge.ts`; `src/tests/taxAIKnowledgeBoundary.test.ts` | Approved forms, e-signature and filing providers, tax rules and practitioner authorization. |
| Billing, payments and receivables | Durable invoices, client projection and sandbox-only controls | `src/server/taxguard/billing/billingStore.ts`; `src/tests/billingHttp.test.ts`, `src/tests/billingClientProjection.test.ts`, `src/tests-db/phase11Boundaries.db.test.ts` | No live processor; approved sales-tax, invoice delivery and refund policies remain. |
| Legal coordination | Durable tracking only; referral authority undecided | `src/server/routes/legal-durable.routes.ts`; `src/tests/legalMatters.test.ts` | Counsel referral, client consent, engagement terms and retention decision. |
| Administrator and security dashboards | Local protected diagnostics and security-event custody | `src/server/productionApp.ts`, `src/server/securityEventRecorder.ts`; `src/tests/healthEndpoints.test.ts`, `src/tests/securityEventOutbox.test.ts` | External alert/log custody and approved retention/redrive operations. |
| Governed AI workforce A00–A60 | Registry inventory; three bounded handlers, all agents uncommissioned | `src/ai/registry.ts`, `src/ai/commissioningMatrix.ts`; `src/tests/aiCommissioningMatrix.test.ts` | Provider/model, per-agent evaluation and human approvals. AI-16/material actions remain blocked. |
| External integrations | Intentionally unavailable absent commissioning | `src/server/taxguard/providerReadiness.service.ts`; `src/tests/readinessProbeBoundaries.test.ts` | Scanner, AI, bank, calendar, email/SMS, signature, filing and live payment providers. |
| Staging deployment infrastructure | Offline preparation only; owner decision required | `src/server/config/stagingConfiguration.ts`, `scripts/staging/check-staging-config.ts`; `src/tests/stagingConfiguration.test.ts` | Isolated non-production project, API/frontend hosts, domain, managed secrets and release approval. |
| Production operational readiness | NO-GO; limited durable API surface is deliberately released | `src/server/productionApp.ts`; `src/tests/productionApiHttp.test.ts`, `src/tests/canonicalProductionRouting.test.ts` | Deployment, external migration approval, real integrations, recovery and independent acceptance. |

## Phase 12 migration release-candidate check

Run `npm run staging:migration:release-candidate` for an offline, disposable-PostgreSQL
composition check. It verifies the canonical manifest and every review-packet source checksum,
composes the dependency-ordered migration set on a fresh loopback server, checks selected
database security invariants, replays only the proposal subset already covered by the
PostgreSQL replay test, and compares canonical and review-packet schema fingerprints. The
command rejects arguments and inherited Supabase, database URL, or libpq connection variables.
The review packet remains `REVIEW_ONLY`; this command neither approves proposals nor contacts
or applies anything to an external database. It does not replace human migration review,
Supabase CLI validation, NOT VALID data review, or staging rehearsal.

## Commissioning state

Implemented in code and locally validated are separate from staging validated and production
commissioned. No Phase 12 staging or production validation is claimed. Staging and production
remain NO-GO pending isolated infrastructure, provider commissioning, migration review and the
human/professional decisions recorded in `phase11-owner-decisions.md`.
