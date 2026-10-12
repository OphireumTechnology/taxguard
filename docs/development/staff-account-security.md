# Staff account security (Module 5)

**PRODUCTION STATUS: NO-GO.** Builds on staff session management ([staff-session-management.md](staff-session-management.md)); proposal 023 (unapplied) gains `taxguard_list_own_security_events`. The staff-access API remains development-only.

## Delivered

| Capability | Where |
| --- | --- |
| Staff-wide account security page | `/staff/account-security` (`StaffAccountSecurityPage`), linked from the Accountant navigation (Tools → Account Security); clients are refused |
| Active sessions, revoke one, sign out others | `StaffSessionsPanel` (reused); administrators additionally see member-session revocation |
| Administrator revoke-all with 15-minute step-up | unchanged from the session-management slice |
| Security event history | `GET /api/staff-access/sessions/events?limit=` → own sign-ins and revocations, MFA and session events, and administrator actions that targeted the caller (`byAdministrator`); token-hash prefixes and proof fields removed in SQL and re-checked in the service |
| Suspension / re-enrolment / fresh sign-in messaging | `accountStatusMessage` maps `SESSION_AUTHORITY_DENIED`, `STAFF_MFA_REENROLLMENT_REQUIRED`, `STAFF_FRESH_SIGN_IN_REQUIRED` to plain guidance |
| Expiry and revocation | Revoked or expired sessions fail the acting-session proof (tests: expired, revoked, administrator revocation → 403 on the next call) |

## Session refresh (design, no new mechanism)

Durable TaxGuard sessions are short-lived (≤ 2 hours, `taxguard_create_session`). TaxGuard issues no refresh token. Continuing after expiry requires a new provider-verified AAL2 token exchanged through the session bridge, which re-checks membership, the MFA re-enrolment gate and the status epoch. This is the secure refresh path; adding silent refresh would weaken the AAL2 and epoch checks and is not recommended.

## Recent-sign-in (step-up) review — recommendations, not applied

The step-up rule (primary sign-in ≤ 15 minutes) is enforced for administrator session revocation. Recommended next (each requires editing proposals owned by the concurrent Codex workstream, so not changed here):

| Operation | Proposal | Recommendation |
| --- | --- | --- |
| Invitation issuance and revocation | 003 | Require step-up |
| Membership suspend / deactivate / reactivate | 004 | Require step-up |
| Activation approval | 002 | Require step-up |
| MFA recovery request and approval | 010 | Require step-up (approval especially) |
| Ledger period reopen, client archive, engagement cancellation | 024 / 025 (this branch) | Candidate once a shared step-up helper exists; today they require reviewer / manager roles and reasons |

A shared helper `taxguard_session_actor` (proposal 023) already returns the acting session's `auth_time`; the other proposals can reuse it.

## Tests

`staffSessionManagementSql.test.ts` (+1, history isolation and proof-field removal), `staffSessionManagementHttp.test.ts` (+1, history over HTTP and loss of access after administrator revocation), `staffAccountSecurityPage.test.tsx` (3).

## Limitations

The page is linked from the Accountant navigation only (other role shells reach it by URL); the history does not show device or location (not recorded); browser NOT VERIFIED.
