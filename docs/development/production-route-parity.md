# Production route parity (verified inventory, 2026-10-19)

Read from `server.ts`, `src/server/productionApp.ts`, `src/server/taxguard/practice/practiceStoreConfig.ts` and
every router file named below. **No route was added to production.** Staging NO-GO, production NO-GO.

## How the two entry points relate

- With `NODE_ENV=production`, `server.ts` sends every `/api/*` and `/webhooks/*` request to
  `createProductionApp()`. The development-only routers mounted later in `server.ts` are never reached.
- Outside production, `server.ts` mounts the development-only durable routers (`server.ts`, lines 469–503) and
  the AI governance router (line 659).
- `practiceStoreConfigured()` returns **false** in each of these cases:
  - in production;
  - unless `TAXGUARD_PRACTICE_STORE=durable`;
  - unless the server-side Supabase credentials are configured;
  - whenever `SUPABASE_URL` names the protected production project `cvrlhixxczerytiocxid`.

  Every durable router answers 503 `*_STORE_UNAVAILABLE` in those cases. The development-only status is a
  deliberate gate, not an omission.

## Mounted in production (`createProductionApp`)

| Path | Router | Authentication | Notes |
|---|---|---|---|
| `/api/health` | `createHealthRouter` plus a static liveness route | Liveness and readiness public with no dependency details; diagnostics authenticated | |
| `/api/provider-readiness`, `/api/operational-metrics`, `/api/readiness` | inline | `authenticateToken` + `requireOperationalAdministrator` | Readiness returns 503 when the database, authentication or schema is not ready |
| `/api/auth` | `authRouter` | Supabase session bridge; local password and TOTP routes return 410 in production | |
| `/api/ai-governance` | `createAiGovernanceRouter` | Authenticated and governed; every agent is DRAFT | |
| `/api/case-authority` | `caseAuthorityRouter` | Authenticated | |
| `/api/profile`, `/api/profile-amendment` | `profileAmendmentRouter` | Authenticated | |
| `/api/stage-two-three`, `/api/stage-workflow` | `stageTwoThreeRouter` | Authenticated | |
| `/api/bookkeeping` | `bookkeepingRouter` | Authenticated, scoped grants (`staffScopedGrants.ts`) | |
| `/api/operations` | `practiceOperationsRouter` | Authenticated | |
| `/api/accountant` | `createAccountantDashboardRouter` | Durable, tenant-scoped, AAL2 staff sessions, read-only | |
| `/api/tax-forms` | `taxFormsRouter` | Authenticated, read-only catalogue | |
| `/api/*` (other) | inline | — | JSON 404; never falls through to the SPA |

**Production-wide middleware:**
- `x-powered-by` disabled;
- origin allowlist (`artaxserv.com`, `www.artaxserv.com`), with 403 `ORIGIN_DENIED` for others;
- `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`;
- `Cache-Control: no-store` on `/api`;
- fail-closed 503 `PRODUCTION_RUNTIME_REQUIRED` if the runtime is not production;
- a 256 kB JSON limit;
- server build artifacts protected;
- operational metrics.

## Development only (deliberately not in production)

All of these use `authenticateToken` (or an injected authenticator in tests) and the practice-store gate above.
They need the listed review-only proposals approved and applied. Some dependencies come transitively through the
shared practice-store module: `20261012250000`, `320000`, `20261018090000` and `100000`.

| Path | Router file | Proposals it depends on (current definitions) | Cutover requirement |
|---|---|---|---|
| `/api/practice` | `practice.routes.ts` | 250000, 320000, 20261018090000, 100000 | Proposals approved and applied; practice-manager capability map reviewed |
| `/api/stage-one` | `onboarding-durable.routes.ts` | plus 20261018030000 | Approved § 7216 consent version |
| `/api/cases` | `cases.routes.ts` | plus 260000, 20261018105000 | Case liveness and restaff proposals applied |
| `/api/vault` | `vault.routes.ts` | 270000, 310000, 20261014500000, 20261015030851, 050000, 20261016040000, 20261018060000, 080000 | Private bucket; malware scanner provider with callback secret |
| `/api/vault-scan` | `vault-scan.routes.ts` | 20261014500000, 20261015050000 | HMAC callback secret; the scanner configured (otherwise 503) |
| `/api/billing` | `billing.routes.ts` | 280000, 20261015010000, 070000, 20261018010000, 040000 | **Phase 15 merge first** (keyed RPCs, canonical refund); sandbox payments only |
| `/api/book-to-tax` | `bookToTax.routes.ts` | 240000, 290000, 20261018070000 | Phase 15 replay and general-ledger corrections; prior-year policy |
| `/api/tax-engine` | `taxEngine.routes.ts` | 330000, 360000, 380000 | Approved, source-cited rule sets |
| `/api/communications` | `communications.routes.ts` | 20261013390000 | General-record access policy (owner) |
| `/api/scheduling` | `appointments-durable.routes.ts` | 20261014400000, 20261016030000 | General-record access policy |
| `/api/legal-matters` | `legal-durable.routes.ts` | 20261014420000 | General-record access policy |
| `/api/audit-center` | `audit-center.routes.ts` | 20261014410000, 460000, 480000 | Append-only audit proposal decision |
| `/api/consultations`, `/api/public/consultation-requests` | `consultations.routes.ts` | 20261014430000 | Public intake rate limits reviewed |
| `/api/public/contact` | `contact-intake.routes.ts` | 20261014430000, 20261016050000 | Unauthenticated by design; abuse controls reviewed |
| `/api/client-portal` | `client-portal.routes.ts` | 20261014440000, 20261016000000, 010000 | Client projections (C9 sweep) re-run on staging |
| `/api/reassignment` | `reassignment.routes.ts` | 20261014450000 | — |
| `/api/staff-access` | `staff-access.routes.ts` | direct table reads (no RPC) | Staff directory policy reviewed |

**Rule:** no router moves into `createProductionApp` until all of the following hold:
- its proposals are approved and applied through the protected gate;
- its providers are configured;
- its suites pass on the staging project.

A route that would answer 503 in production is not production-ready, and mounting it would only advertise an
unavailable feature.

## Findings

1. **Framing and transport headers (fixed in this package, see the status document).** Neither entry point set
   `X-Frame-Options`, a `frame-ancestors` policy or HSTS. The development server deliberately removes
   `X-Frame-Options` for preview tools. In production that leaves the authenticated portals framable
   (clickjacking). The production app now sends:
   - `X-Frame-Options: DENY`;
   - `Content-Security-Policy: frame-ancestors 'none'`;
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains`.

   The development server is unchanged.
2. **No full Content-Security-Policy.** A script and style CSP needs tuning against the built bundle (inline
   styles, the asset host). It is recorded as remaining hardening, not guessed.
3. **CORS methods:** the production allowlist sends `GET, POST, PATCH, OPTIONS`. No router under
   `src/server/routes` registers `PUT` or `DELETE`, so cutover needs no change here.
