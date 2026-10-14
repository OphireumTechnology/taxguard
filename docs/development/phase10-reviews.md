# Phase 10 reviews: staging infrastructure, database readiness, security hardening, provider validation (2026-10-14)

Status vocabulary: **Implemented in source** · **Validated in local tests** · **Validated against
isolated staging** (none: no staging project exists) · **Approved for production** (none).

## Database readiness (Block 2)

See [migration-readiness-report.md](migration-readiness-report.md) and the generated
[migration-execution-manifest.md](migration-execution-manifest.md). The audit found a conditional
High-severity Data API exposure in the core bookkeeping policies (F1) and default client-role grants
(F2–F4); proposal **049** closes them. Historical migrations were not modified.

## Billing confidentiality in the database (Block 5) — proposal 047

`taxguard_bill_client_invoice_json` is an explicit allow-list (the same keys as the router's
`clientBillingView.ts`); `taxguard_bill_view` chooses it for any actor kind other than staff / manager
(fails closed). `taxguard_bill_list` and `taxguard_bill_record_payment` are superseded; every other
billing function already refuses clients. Clients no longer receive preparer / approver identities,
review notes, void reasons, rate-override reasons, credit reasons, requester / decider, requested or
rejected credits, or the payment provider. Staff responses are unchanged. The sandbox replay check now
also binds the client. The HTTP allow-list stays as defence in depth.
Tests (direct RPC, PGlite and real PostgreSQL): `billingClientProjection.test.ts`, `securityEvents.db.test.ts`.

## Durable security events (Block 6) — proposal 048

`db.logSecurityEvent` keeps a bounded in-memory list (now capped at 1,000) and, when a durable store
and `TAXGUARD_SECURITY_EVENT_FINGERPRINT_SECRET` are configured, enqueues a redacted copy to
`taxguard_security_event_record` (non-blocking, bounded queue of 200, never throws). Only events with a
security category are recorded (authentication failures, lockouts, session and access denials,
cross-tenant and isolation attempts, MFA requirement failures, scanner callback rejections, maker-checker
violations, malware detections); operational notices stay in memory. Free text and network addresses
never leave the process: the address becomes an HMAC fingerprint. The database keeps only allow-listed
identifier fields, bounds ingestion (20 per source and 600 per tenant per minute; one
`SECURITY_REPEATED_REQUESTS` marker per flood) and accepts unauthenticated events only for an existing
active tenant. Reads: administrators only, through the audit center (category SECURITY) and a summary of
suppressed counts. Privilege changes, MFA recovery, administrator security actions and AI emergency
stops were already durable audit rows (proposals 008–011, 034–037, AI governance).
Not durable (documented): events while no durable store is configured; production runtime (the durable
routers are not mounted in production).

## Legacy routes (Block 7)

Retired (answer 410 `LEGACY_ROUTE_RETIRED` with the replacement; their unused browser client methods
were removed):

| Route | Replacement | Evidence of no consumer |
|---|---|---|
| `/api/engagements` | `/api/practice`, `/api/client-portal` (025, 044) | `legacyRouteRetirement.test.ts` scans all application code |
| `/api/appointments` | `/api/scheduling` (040) | same |
| `/api/payments` | `/api/billing` (028, 047) | same |
| `/api/messages` | `/api/communications` (039) | same |
| `/api/legal` | `/api/legal-matters` (042) | same |
| `/api/assignments` | `/api/practice`, `/api/reassignment` (025, 045) | same |

Retained intentionally (development server only; none is mounted in the production app except tax forms):

| Route | Why retained |
|---|---|
| `/api/documents` | Reachable consumers (portal `DocumentsView` download, `ProductionDocumentService`) not yet migrated to `/api/vault` |
| `/api/onboarding` | Reachable `StaffOnboardingWizard`; no durable staff dossier yet |
| `/api/consultation-rooms` | Reachable `VirtualConsultationRoom`; no durable replacement |
| `/api/careers` | Public job catalog and applications; no durable replacement |
| `/api/tax-forms` | Public reference catalog (also in production) |
| `/api/admin`, `/api/super-admin`, `/api/security`, `/api/practice-console` | Local super-administrator console |
| `/api/accountant`, `/api/live-workflow`, `/api/stage-two-three`, `/api/bookkeeping`, `/api/operations`, `/api/profile*`, `/api/taxguard*`, `/api/accounting-intake`, `/api/monitoring` | Reachable consumers or production-released routers |
| `/api/integrations` | No consumer, but no durable replacement exists (rule: retire only with a replacement); in-memory only, not in production |
| `/api/calendar`, `/api/intake` | Only unreachable components call them (`LiveCalendarModule`, `ClientOnboardingWizard`, `GuidedIntakeWizard`); retire together with those components after the owner's deletion decision |

## Document scanning (Block 8) — proposal 050

Proposal 027 reviewed: verdicts are recorded only for `SCAN_PENDING` versions; `INFECTED` →
`REJECTED_MALWARE`; downloads require a reviewed status. New asynchronous boundary: durable scan
requests (15-minute expiry, one open request and at most five attempts per version), provider
submission of the private path and digest only, `POST /api/vault-scan/callback` authenticated by
HMAC-SHA256 over timestamp, tenant, request, verdict and provider (5-minute window, constant-time
comparison, 2 KB limit, strict body), single-use verdicts bound to the provider, `ERROR` and outages
keep the document quarantined, rejected callbacks become security events, backlog counts for
monitoring. Configuration: `TAXGUARD_MALWARE_SCANNER` unset / `disabled` → quarantine; `fake` → local
fake scanner only (requires `TAXGUARD_ALLOW_FAKE_SCANNER=1`, refused in production); any other value →
`SCANNER_PROVIDER_NOT_COMMISSIONED`. **No real provider is implemented or connected.**
Tests: `malwareScanning.test.ts` (25).

## MFA real-provider readiness (Block 4)

The guarded runner now also requires, for a hosted target, a URL of the exact form
`https://<ref>.supabase.co`, `TAXGUARD_VALIDATION_PROJECT_REF` repeating the ref, and
`TAXGUARD_VALIDATION_PRODUCTION_PROJECT_REF` present and different. `--readiness` reports without
contacting anything. **Status: BLOCKED** (`CONFIRMATION_MISSING` — no separate non-production project).

## Staging configuration (Block 3)

`validateStagingEnvironment` checks 15 areas (application identity, API host, project, keys, database,
tenant, auth/MFA, storage, scanner, AI, billing, secrets, integrations, monitoring, backup); storage,
monitoring and backup are MANUAL owner confirmations. It refuses the protected project in any field,
proves staging differs from production (project ref, tenant, hosts), rejects live payment keys,
uncommissioned integrations and development shortcuts, and never returns values.
`check-staging-config.ts --config-file <path>` parses a file without loading it into the environment
(`--env-file` was avoided because Node would load it). Tests: `stagingEnvironmentValidator.test.ts` (43).

## AI (Block 9)

[ai-commissioning-matrix.md](ai-commissioning-matrix.md): 61 agents registered; handlers and local tests
for A00 (planning boundary), A10 and A34 (read-only advisory); provider configured, human-approved,
staging-validated and production-commissioned: **0**. AI-16 material-action approval, autonomous filing,
client messaging, accounting mutations, payments, tax signatures and document transmission stay blocked.

## Tax engine (Block 10) — unchanged, confirmed

Versioned rule sets with maker-checker approval (033), verification cases bound to the current case set
(036), structural coverage (038), fail-closed evaluation (`taxEngineFoundation.test.ts`: floats,
missing evidence, undeclared facts and missing inputs refused), synthetic fixtures labelled, stages
9–18 blocked (`STAGE_BLOCKED_VERIFIED_TAX_ENGINE_REQUIRED`, `caseWorkflowHttp.test.ts`), no return
generation, e-filing or tax signature. No rule was added or invented.

## Negative tests (Block 13)

| Scenario | Test |
|---|---|
| Protected project chosen as staging; protected ref in any field | `stagingEnvironmentValidator.test.ts`, `providerValidationTarget.test.ts` |
| Cross-tenant / cross-client billing | `billingClientProjection.test.ts` |
| Staff invoice metadata exposed to clients | `billingClientProjection.test.ts`, `securityEvents.db.test.ts` |
| Unauthorized security-event viewing | `securityEvents.test.ts` |
| Forged, stale, tampered, foreign-tenant, wrong-provider scanner callbacks | `malwareScanning.test.ts` |
| Missing scanner configuration | `malwareScanning.test.ts` |
| Verdict replay; expired request | `malwareScanning.test.ts` |
| Unauthenticated / non-administrator diagnostics | `healthEndpoints.test.ts` |
| Unapproved AI model execution | `aiGovernedGateway.test.ts`, `aiGovernanceControlPlane.test.ts` |
| Unauthorized document release (pending, infected) | `malwareScanning.test.ts` |
| Unsafe migration grants | `migrationReadinessAudit.test.ts`, `proposalCompositionSecurity.test.ts` |
| Lost database connection | `healthEndpoints.test.ts`, `securityEvents.test.ts` |
| Invalid environment | `stagingEnvironmentValidator.test.ts` |
| Rollback / restore failure leaves the target unchanged | `backupRestore.db.test.ts` |

Run them together: `npm run test:phase10-negative`. Mutation checks: `node scripts/mutation/phase10-mutations.mjs`
(19 mutants, all killed; two initial survivors exposed gaps that were then closed).

## Open owner decisions recorded in Phase 10

1. Approve proposals 047–050 (049 separately: Data API security model).
2. Retire direct client storage reads (would allow revoking the last authenticated table reads).
3. Choose a malware-scanning provider and approve its callback secret handling.
4. Provision the separate staging Supabase project (then run the MFA validation).
5. Recovery objectives (RPO / RTO), backup retention, bucket copy destination.
6. Alert destinations, on-call routing and log retention.
7. Whether durable stores are enabled in staging (`practiceStoreConfigured` refuses `NODE_ENV=production`
   today, so staging with `NODE_ENV=production` keeps the durable routers closed).
8. Delete the unreachable `LiveCalendarModule`, `ClientOnboardingWizard`, `GuidedIntakeWizard` and then
   retire `/api/calendar` and `/api/intake`.
9. Still open from Phase 9: consultation retention, reassignment limits and reviewer independence,
   legal referral approval, staff-access rate-limit policy, `trust proxy` for the development server
   (the production app sets `trust proxy` to 1), AI provider and AI-16.

## Staging GO / NO-GO

**NO-GO.** No isolated staging project exists; no proposal is applied anywhere; the MFA provider
validation is blocked; no malware scanner is commissioned; no monitoring or backup exists for a hosted
environment. Everything in this phase is implemented in source and validated in local tests only.
