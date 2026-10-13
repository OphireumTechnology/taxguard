# Staff session management (Milestone 1 slice) — development only

**PRODUCTION STATUS: NO-GO.** Proposal 023 is **not applied** anywhere. The routes are in the development-only `/api/staff-access` router (disabled by default; absent from `createProductionApp`). No production connection, migration, identity or deployment.

Worktree: `D:\TaxGuard\Development\123-claude`, branch `claude/taxguard-dev-20261012`, based on `37506f9`. This branch is isolated from the concurrent Codex workspace (`123`, `sync/taxguard-development-20261011`) and needs a reviewed merge into it.

## What it does

| Capability | Route | Enforcement |
| --- | --- | --- |
| List own live sessions | `GET /api/staff-access/sessions` | Durable `tg_live` bearer (its SHA-256 hash is the proof, taken from server authentication, never from the body); active coherent member + identity; staff session must be AAL2, outside an MFA re-enrolment gate and newer than the last status change. Token hashes are never returned; sessions are identified by row UUID |
| Revoke one other own session | `POST /sessions/:id/revoke` | Same proof; only the caller's own sessions in the tenant; the current session must use logout (`SESSION_CURRENT_USE_LOGOUT`); missing, foreign and repeated targets are indistinguishable (`{revoked:false}`); audited `SESSION_REVOKED_BY_OWNER` |
| Sign out all other sessions | `POST /sessions/revoke-others` | Same proof; current session kept; audited `SESSIONS_OTHER_REVOKED_BY_OWNER` with count |
| Administrator revokes a staff member's sessions | `POST /members/:uid/sessions/revoke` `{reasonCategory}` | AAL2 administrator of the same tenant; **step-up re-authentication**: the acting session's primary sign-in must be ≤ 15 minutes old (`STAFF_REAUTHENTICATION_REQUIRED`); targets are other staff members of the tenant (clients, unknown and cross-tenant targets → `SESSION_TARGET_NOT_FOUND`; self → `SESSION_TARGET_SELF`); super administrator targets only by a super administrator (`SESSION_TARGET_PROTECTED`); closed reason-category list, no free text; audited `STAFF_SESSIONS_REVOKED_BY_ADMIN` |

Revocation takes effect on the next request because durable authentication re-reads the session row on every request (an administrator-revoked user receives 401 and returns to sign-in).

Concurrency: lock order tenant → member → identity → session (as proposal 008); target-session locks use `NOWAIT`, so two administrators acting on each other get a retryable `409 SESSION_STORE_BUSY` instead of a deadlock. All functions are `SECURITY DEFINER`, executable by `service_role` only; the internal proof helper `taxguard_session_actor` is executable by no API role.

## UI

`StaffSessionsPanel` in Administrator → Practice Staff & Roles (below MFA recovery): own session list with revoke / sign out other sessions; for administrators, a member + reason form with a two-step confirmation and a specific message when step-up sign-in is required. Responses are discarded if the session changes while a request is in flight.

## Tests (synthetic)

- `staffSessionManagementSql.test.ts` (25): proposal composed with the real core schema and proposals 000–011 in PGlite; actor rechecks (revoked, expired, foreign tenant, suspended, identity mismatch, re-enrolment gate, status epoch, inactive tenant), AAL1 staff refusal, own/other/foreign targets, step-up window, protected targets, privileges. Mutation-checked (removing step-up, AAL2, current-session and protected-target conditions each fails a test).
- `staffSessionManagementHttp.test.ts` (14): HTTP → router → service → proposed SQL; revoked bearer loses access; admin revocation locks the target out; error mapping (503 generic, 409 busy, malformed rows refused).
- `staffSessionsPanel.test.tsx` (12): API client paths/body/no-store/protected host refusal; list validation; administrator-only form; self and super administrator targets never offered.

## Not done / limitations

- Device, browser and IP metadata are not recorded, so none is displayed (no invented values).
- A staff-wide account-security page for non-administrator roles is not built; the panel is mounted only in the administrator workspace.
- Step-up applies to administrator session revocation only. Extending it to invitation issuance, lifecycle changes and MFA recovery approval needs a change to those proposals (owned by the concurrent workstream).
- PGlite does not establish multi-connection PostgreSQL behaviour; a commissioned non-production database is required.
