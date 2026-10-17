# Phase 13B — staff identity hardening and client session assurance

**PRODUCTION STATUS: NO-GO.** No deployment, no production Supabase access, no proposal applied
anywhere external. All tests use synthetic identities, the loopback provider emulation and local
PostgreSQL.

## 1. Reconciliation (2026-10-17)

| Item | Finding |
| --- | --- |
| Starting point | `codex/taxguard-phase13b-mfa-session-security` = `origin/claude/taxguard-phase13b-security-workflow-completion` (`9a5c82a`), on top of Phase 13A and `origin/main` (`6c3390c`) |
| Uncommitted work found | Client existing-session assurance revalidation (C2 follow-up): `supabase-db.ts` verify path, provider emulator token expiry control, second synthetic client, `clientMfaSessionRevalidation.test.ts`, `11-client-mfa.e2e.test.ts`. Reviewed and kept |
| `d0c8173` (older branch: administrator recovery actions + re-enrolment screen) | **Superseded.** Not in `main`; `5e99c18` (in `main`) reimplemented the panel actions (complete / retry / cancel with confirmation), the re-enrolment flow (`staffRecoveryEnrollmentApi`, step-aware) and provider-mode browser E2E. Not cherry-picked |
| Genuine gaps | (1) No browser coverage of retry, cancellation, non-administrator refusal of complete / retry / cancel, or a recovered member attempting self-reactivation. (2) The recent-AAL2 check for invitation / membership changes ran in the service, outside the database transaction. (3) Production staff sign-in dead end (below) |

## 2. Changes

- **Browser E2E** (`provider/09-mfa-recovery-ui`, +4): permanent provider failure → `failed`; non-administrator 403 for
  retry / complete / cancel; stale administrator refused for retry; retry through the panel; recovered member
  cannot reactivate themselves by any route; cancellation through the panel with a recorded reason. Emulator
  control `/e2e/provider-admin-fault` injects provider errors (loopback, keyed, synthetic users only).
- **Proposal `20261017000000_taxguard_membership_session_proof.sql`** (not applied): `*_proven` wrappers verify the
  actor's live recent AAL2 session inside the change's transaction; the unproven functions are revoked from
  `service_role`. Services pass the hashed application token; recency refusals keep their own codes.
- **Client session assurance** (the kept uncommitted work): an existing AAL1 client session is checked against the
  current provider factor inventory on each request; once a verified factor exists the session is revoked through
  the audited revocation path; provider errors and malformed inventories deny. Operational cost: one provider
  admin factor-inventory call per request for each AAL1 client session (AAL2 sessions skip it); provider rate
  limits and latency must be reviewed before release, and an outage signs AAL1 clients out (fail closed).
- **Staff sign-in dead end**: see §3.
- **Durable client sign-in failure (found by the provider E2E)**: in durable configurations the session bridge
  reports `onboardingAvailability: unavailable` and `/api/case-authority/client-onboarding/*` answers 503 by
  design, but the browser ignored the flag, called the provisioner and aborted every durable client sign-in with
  `CASE_INITIALIZATION_FAILED`. The browser now skips that call when the server reports it unavailable; no
  onboarding case is fabricated.
- **Client authenticator enrolment removed its own factor**: the setup component's "cancel on unmount" effect
  depended on a default `api` object recreated each render, so the first re-render after *Start authenticator
  setup* deleted the new factor and every code was refused. The cleanup now runs on unmount only
  (`clientTotpEnrollmentLifecycle.test.tsx`; the previous effect fails it).
- The provider client MFA suite (`11-client-mfa`) now opens the *MFA & Credentials* tab, accepts `/portal` as the
  dashboard landing path and dumps the page on failure; its security assertions are unchanged.

### Client existing-session assurance — evidence

An AAL1 client session minted before enrolment (`durableSession(aal1)`) still works during setup and cancellation,
returns **401** immediately after the authenticator is verified (revoked through the audited path), a new AAL1
provider token is refused with `CLIENT_MFA_REQUIRED`, the next browser sign-in must pass the authenticator
challenge (a wrong code leaves no token), and logout revokes the AAL2 bearer. Unit:
`clientMfaSessionRevalidation.test.ts` (provider errors, malformed inventories, unverified factors, AAL2 bypass,
expired and cross-tenant sessions).

## 3. Live staff sign-in — source analysis (no production access)

A staff sign-in on the public site can only succeed when **all** of these hold; none is verified:

1. The Pages build is current and built with `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   (the workflow is manual and `main`-only; the last recorded deploy predates staff MFA).
2. The API host answers (`api.artaxserv.com` did not respond when last checked, 2026-10-12).
3. The session-assurance and later identity proposals are applied (session inserts need `taxguard_sessions.aal`;
   the server fails closed with `SESSION_STORE_UNAVAILABLE` otherwise).
4. The staff member has a durable membership in the deployment tenant **and an already verified TOTP factor**.

Defect fixed: production builds never enable staff self-enrolment (`isStaffIdentityDevelopmentConfigured()`
requires a development build). A staff member without a factor received `STAFF_MFA_ENROLLMENT_REQUIRED`, the
page kept the provider session and showed a setup panel whose first step always failed with "Authenticator
enrollment is unavailable in this environment". Now, where enrolment cannot run, the provider session is
signed out and the page says the account has no authenticator and to contact an administrator
(`staffEnrollmentOutcome.ts`, tested). Enabling production staff enrolment is a separately authorized decision
and was not done.

## 4. Remaining blockers

Production deployment, proposal application, provider MFA configuration, staff identity provisioning and API
hosting all require separate authorization. Real provider verification of the experimental admin MFA calls
against an authorized non-production project is outstanding.

## 5. Validation (2026-10-17, clean `npm ci`)

| Gate | Result |
| --- | --- |
| Unit / security (Vitest) | 341 files, 5,649 tests passed |
| PostgreSQL integration (`test:db`, embedded server) | 15 files, 51 tests passed |
| Browser E2E, default profile | 14 files, 80 tests passed |
| Browser E2E, provider-emulator profile | 3 files, 16 tests passed |
| Typecheck, build | passed |
| Migration manifests (`--check`, staging verify), composition, idempotent re-apply | current; new proposal orders after 034/035, re-applies cleanly, no hazards |
| Traceability | regenerated and verified |
| Secret scan (`security:secrets`), `git diff --check` | PASS, no findings |

The live staff sign-in is **not** repaired or verified: only source changes and local non-production tests were made.
