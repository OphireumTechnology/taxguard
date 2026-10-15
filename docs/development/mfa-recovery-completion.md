# Staff MFA recovery completion and privileged reauthentication

**PRODUCTION STATUS: NO-GO.** Proposal 034 (`20261012340000_taxguard_mfa_recovery_completion.sql`)
is **not applied**. The reset provider adapter is **disabled by default** and refuses production and
the protected production project. All tests use a synthetic provider; no real factor was touched.

Builds on proposals 010 (request + independent approval: suspend, gate, revoke sessions, queue job)
and 011 (directory). Those files are unchanged; 034 supersedes three of their functions with
generated, anchor-checked patches (see "Superseded functions").

## Recovery lifecycle

| Step | Who | What is verified |
| --- | --- | --- |
| Request | administrator ≠ target, recent AAL2 sign-in | one **open** request per member (earlier completed/cancelled ones no longer block) |
| Approve | administrator ≠ maker ≠ target, recent AAL2 sign-in | target suspended, re-enrolment gate set, every session revoked, job `pending` (010) |
| Reset job | server worker | claims with a **lease and monotonically increasing fence** (`FOR UPDATE SKIP LOCKED`); removes every provider factor; **re-lists** — only an empty inventory reports `reset_verified`; only hashes of factor IDs are kept |
| Failure | worker | classified provider errors; retryable → back-off 30 s · 2^(n-1) (≤ 1 h), at most 5 attempts → `failed`; a stale worker (expired lease / old fence) cannot report (`MFA_JOB_FENCE_LOST`); the member stays suspended and gated throughout |
| Re-queue | administrator ≠ target, recent sign-in | only a `failed` job |
| Re-enrolment proof | the target, with a **provider** access token (no TaxGuard session: suspended) | AAL2; primary sign-in after the reset and within 15 minutes; the newest verified factor created after the reset whose hash is not among the removed factors |
| Reactivation | administrator ≠ target, recent AAL2 sign-in | job `enrollment_verified`; member active, gate cleared, identity `mfaEnabled`; **status epoch moved**, so every earlier sign-in proof — including the re-enrolment sign-in — is stale and the member must sign in again; any session revoked |
| Cancel | administrator ≠ target, recent sign-in | only while awaiting approval; reason recorded |

Everything is audited (`STAFF_MFA_RESET_JOB_CLAIMED / RETRY_SCHEDULED / FAILED / REQUEUED`,
`STAFF_MFA_FACTORS_RESET`, `STAFF_MFA_REENROLLMENT_VERIFIED`, `STAFF_MFA_RECOVERY_COMPLETED / CANCELLED`)
without secrets, codes, seeds or raw factor IDs. Tables stay closed even to the service role; only
the audited functions change them.

## Provider adapter (`src/server/mfaResetProvider.ts`)

Built on the installed SDK's typed admin MFA API (`@supabase/auth-js` 2.117.3:
`auth.admin.mfa.listFactors({ userId })`, `auth.admin.mfa.deleteFactor({ id, userId })`, both marked
*experimental* by the SDK). The SDK does not document an "already removed" response, so a 404 on delete
is tolerated **only because** the worker then re-lists; success is never inferred from a delete call.
Enabled only by `TAXGUARD_MFA_RESET_PROVIDER=supabase-admin`, outside production, with a non-protected
project and a service key. Without it, reset is unavailable and members stay suspended.
**Integration requirement:** confirm these experimental admin calls against the target provider version
in a non-production project before commissioning.

## Privileged reauthentication (recent sign-in)

`taxguard_privileged_session(tenant, actor, sessionHash, roles)`: live durable AAL2 session named by
its token hash, identity consistent, sign-in after the actor's status epoch, and **no older than
`taxguard_privileged_max_age_seconds()` = 900 s**. Errors: `STAFF_ADMIN_REQUIRED`,
`STAFF_FRESH_SIGN_IN_REQUIRED`, `STAFF_RECENT_SIGN_IN_REQUIRED` (403).
- Enforced **in the database** by recovery request, approve, complete, cancel and re-queue.
- Enforced **by the service** before invitation create / revoke, activation approval and membership
  status changes (their 003/004 functions take no session proof; the check runs first and a refusal
  never reaches them).
- Administrator member-session revocation already required a 15-minute step-up (proposal 023).
- Local (non-durable) sessions never satisfy it.

## Superseded functions (generated from 010/011)

`taxguard_request_mfa_recovery` (recent sign-in; "outstanding" = open requests only),
`taxguard_approve_mfa_recovery` (recent sign-in; refuses completed/cancelled requests instead of
re-approving them — a latent defect once more statuses exist), `taxguard_list_mfa_recoveries` (new
statuses, job progress and action hints). The generator fails unless each anchor matches exactly once.
Applying 010/011 again **after** 034 would restore the old definitions; apply in name order.

## API (`/api/staff-access`, development only)

`POST /mfa-recoveries/:id/complete | /cancel {reason} | /retry`;
`POST /mfa-recovery/enrollment {providerAccessToken}` (provider-authenticated).
The browser recovery directory parser accepts the new statuses and actions.

## Tests

`mfaRecoveryCompletion.test.ts` (12; recency mutant and fence mutant both fail it), `mfaResetProvider.test.ts`
(9), real PostgreSQL `mfaRecovery.db.test.ts` (2: ten workers racing for three jobs — each claimed once;
re-claim vs stale report), composition (034 included, idempotent re-apply), updated
`staffAccessHttp` (privileged check runs first, refusal never reaches the membership RPC),
`staffRecoveryDirectory`, `staffMfaRecoveryHook`.

## Administrator actions and re-enrolment screen (added 2026-10-16)

- **Staff MFA recovery panel** (Practice Staff & Roles): each request shows its real reset state
  (queued, in progress, factors removed, new authenticator verified, failed with code and attempts,
  completed). *Review recovery completion*, *Re-queue failed reset* and *Cancel recovery request*
  appear only when the server's action hint, the row state and actor ≠ target all agree; each needs
  an explicit confirmation step, cancellation needs a 10–1,000 character reason, and success is shown
  only when the server result matches the row. A recent-sign-in refusal tells the administrator to
  sign in again with MFA. Completion asks the administrator to confirm the person's identity
  out-of-band first (firm procedure; not enforced by software).
- **Re-enrolment screen** (staff sign-in → *Administrator reset your authenticator? Set up a
  replacement*): provider password sign-in (fresh primary sign-in), new TOTP enrolment or challenge,
  assurance re-checked immediately before the proof, then `POST /mfa-recovery/enrollment` with the
  provider token only. It never requests a TaxGuard session (the provider-only identity guard
  suppresses the session bridge) and never reports reactivation; it signs out afterwards. Refusals the
  member can act on are explained; others stay neutral. Without the development provider
  configuration it reports that recovery is unavailable.

Tests: `staffMfaRecoveryFollowUpUi.test.tsx` (12), `staffMfaRecoveryEnrollmentClient.test.ts` (11);
mutants removing the actor ≠ target guard, result validation or the pre-proof assurance check each fail.
Browser: staff sign-in link, form, fail-closed message and 375 px layout checked on the local server;
the administrator panel was not exercised in a browser (needs a non-production provider project).

## Remaining (not done here)

Real provider verification; browser E2E of the full recovery against a provider emulator; moving the
recency check into the 003/004 database functions (needs their session proof parameter).
