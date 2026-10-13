# Provider MFA admin validation (non-production)

Status: **blocked — no separate non-production provider project is configured.** Nothing in this
repository has been run against a real provider project. The protected production project
(`cvrlhixxczerytiocxid`) must never be used and is refused by the tooling.

## SDK compatibility review (installed `@supabase/supabase-js` / `@supabase/auth-js` 2.117.3)

| Adapter call (`src/server/mfaResetProvider.ts`) | SDK method | HTTP | Notes |
|---|---|---|---|
| `listFactors(uid)` | `auth.admin.mfa.listFactors({ userId })` | `GET /auth/v1/admin/users/{userId}/factors` | SDK validates `userId` as a UUID (throws a plain `Error` otherwise; the adapter rejects earlier with `PROVIDER_ID_NOT_UUID`). The response array is wrapped as `{ factors }`. Marked experimental in the SDK. |
| `deleteFactor(uid, id)` | `auth.admin.mfa.deleteFactor({ id, userId })` | `DELETE /auth/v1/admin/users/{userId}/factors/{id}` | Both IDs validated as UUIDs. No documented "already removed" response, so the adapter never infers success from a delete: only an empty fresh inventory is a verified reset. A 404 is passed to that inventory decision. |
| error classification | `AuthRetryableFetchError` / `status` | — | network/0, 429 and 5xx retryable; 401/403 `PROVIDER_NOT_AUTHORIZED`; 404 `PROVIDER_USER_NOT_FOUND`; others rejected. |
| staff re-enrolment (browser) | `auth.mfa.enroll`, `challenge`, `verify`, `signInWithPassword` | `/auth/v1/factors…`, `/auth/v1/token` | Used by `TotpEnrollmentPanel` / `StaffMfaRecoveryEnrollmentFlow`; the server verifies the new factor via `listFactors`. |

Covered so far only by unit tests with SDK-shaped fakes (`mfaResetProvider.test.ts`) and by the
browser E2E against the loopback provider emulation (`scripts/e2e/providerEmulator.ts`), which
implements the same paths and payload shapes. Behaviour that only a real provider can confirm:
the repeated-delete status, whether unverified factors are listed, unknown-user responses, rate
limits, and whether access tokens minted before a factor deletion keep their `aal2` claim.

## Reproducible validation procedure

Prerequisites (decided by the project owner, not by this repository):

1. A **separate** provider project created for validation only, with no real users or data.
2. MFA (TOTP) enabled in that project; email confirmation may stay on (users are created confirmed).
3. Its URL, anon key and service-role key supplied **only** through the variables below for the
   duration of the run — never in `.env`, never committed, never the application's `SUPABASE_*`.

```bash
TAXGUARD_VALIDATION_CONFIRM=non-production TAXGUARD_VALIDATION_SUPABASE_URL=<url> TAXGUARD_VALIDATION_SERVICE_ROLE_KEY=<key> TAXGUARD_VALIDATION_ANON_KEY=<key> node node_modules/tsx/dist/cli.mjs scripts/provider-validation/mfa-admin-validation.ts
```

The guard (`src/server/providerValidationTarget.ts`, tested in `providerValidationTarget.test.ts`)
refuses with exit code 2 and sends nothing when: the confirmation is missing; `NODE_ENV=production`;
the URL is the protected project (any spelling), insecure (non-loopback http), carries credentials,
equals the application's `SUPABASE_URL`; or keys are missing or identical.

The run creates one synthetic user (random `example.com` address and password), enrols one TOTP
factor through the public MFA API, checks the adapter's inventory (unverified and verified),
deletes the factor through the adapter, confirms the empty inventory, records the repeated-delete
and unknown-user responses, records the `aal` claim of a pre-reset session, and **always deletes the
user**. The JSON report lists check names and outcomes only (no keys, secrets, codes or IDs).
Exit 0 = all checks passed, 1 = a check failed, 2 = refused.

Record the report, the SDK version and the date in the integration review before enabling
`TAXGUARD_MFA_RESET_PROVIDER=supabase-admin` anywhere outside local tests.
