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

## Administrator and staff UI (proposal 037)

Proposal `20261012370000_taxguard_mfa_recovery_history.sql` (service_role only, pinned search_path):
`taxguard_mfa_recovery_history` returns a request's `STAFF_MFA_*` audit entries to an active AAL2
administrator (reading needs no recency) with whitelisted detail keys only — never the recorded reason,
factor IDs or provider material. `taxguard_mfa_recovery_step` returns a coarse step for the signed-in
staff member (`none`, `awaiting_approval`, `awaiting_reset`, `reset_failed`, `ready_for_enrollment`,
`awaiting_reactivation`). APIs: `GET /mfa-recoveries/:id/history`, `POST /mfa-recovery/status {providerAccessToken}`.

- **Administrator panel** (Practice Staff & Roles → Staff MFA recovery): request, independent approval,
  factor-reset status in the server's words, confirm forms for reactivation / reset retry / cancellation
  (reason of at least 10 characters) offered only when the server's action hints allow, per-request audit
  history, loading / empty / error states, and code-specific refusals (e.g. the 15-minute rule).
- **Staff re-enrolment** (staff portal → Complete MFA Recovery, shown only where provider identity is
  configured): provider password sign-in, recovery step, a new authenticator via `TotpEnrollmentPanel`,
  then the provider token goes to the server for verification. The flow holds the provider-only identity
  lease, so the app never bridges the recovery identity into a TaxGuard session or provisions anything;
  leaving the flow signs the provider session out.
- **Replays:** a repeated approval, enrolment proof or reactivation by the same actor returns the recorded
  result (`resumed` / `replayed`) with no further effect; any other actor, or a later-state action, is refused.

Browser E2E (provider profile, `src/tests-e2e/provider/09-mfa-recovery-ui.e2e.test.ts`, 8 tests): role
restriction; other-tenant and non-member refusal; request in the UI; a 20-minute-old sign-in refused for
approval with the 15-minute explanation; independent approval revoking the staff member's open session;
reset through the real adapter; audit history; re-enrolment with a wrong code refused and no TaxGuard
session created; reactivation; replays; a fresh staff sign-in with the new authenticator. The suite stays
within the staff-access rate limit (20 requests a minute per client address) instead of relaxing it.

## Remaining (not done here)

Real provider verification against an authorized non-production project; moving the recency check into
the 003/004 database functions (needs their session proof parameter); proposal 037 is unapplied.
