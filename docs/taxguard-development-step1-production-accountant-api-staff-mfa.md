# Step 1 — production-compatible Accountant API and mandatory staff MFA (development branch only)

**PRODUCTION STATUS: NO-GO.** Nothing was deployed, no migration was applied, no production identity was created, and production Supabase was not contacted.

## 1. Staff MFA (AAL2)

| Control | Implementation |
| --- | --- |
| Assurance level source | `verifySupabaseAccessToken` verifies the token with the Supabase Auth server (`auth.getUser`), then reads the token's `aal` claim and the user's verified factors. The level is never taken from the browser |
| Sign-in gate | `SupabaseDurableSessions.create` refuses to mint a session for any staff role (every role except client / prospective client) unless the verified token is **AAL2** with at least one verified factor: `STAFF_MFA_ENROLLMENT_REQUIRED` / `STAFF_MFA_REQUIRED` (403), audited, no session row written |
| Per-request gate | The durable session row records `aal`. `authenticateToken` refuses every staff request on a durable session that is not `aal2` (403 `STAFF_MFA_REQUIRED`, security event). Rows without the column default to AAL1 and fail closed |
| Session store integrity | A session row that cannot be written now fails the sign-in (503 `SESSION_STORE_UNAVAILABLE`) instead of silently reporting success |
| Browser | Staff sign-in uses the Supabase MFA API (`getAuthenticatorAssuranceLevel`, `challengeAndVerify`) to reach AAL2 before requesting the server session. A mid-session `STAFF_MFA_REQUIRED` ends the session; expired staff sessions return to the staff sign-in page |
| Clients | Not required to use MFA (role checks still apply) |

## 2. Production routes (`src/server/productionApp.ts`)

| Route | Access | Data |
| --- | --- | --- |
| `GET /api/accountant/dashboard` | Durable session, staff AAL2, role `accountant`, session tenant = deployment tenant | `taxguard_cases` where `preparer_uid` = user, client in the user's active `taxguard_staff_assignments`, tenant-scoped; names from `taxguard_clients`, titles from `taxguard_engagements`. Fields not recorded by the durable model are returned as `unavailableFields` (`dueDate`, `priority`, `documents`) and shown as unavailable |
| `GET /api/tax-forms`, `GET /api/tax-forms/forms/:id` | Durable session, staff AAL2, practice-staff roles | Reference catalog only |
| Not released | `/api/super-admin/*` (503 `API_NOT_RELEASED`), local login / local-login-status (410) | — |

## 3. Database and migration requirements (NOT APPLIED)

Proposed migration: [`docs/proposed-migrations/20261012000000_taxguard_staff_session_assurance.sql`](proposed-migrations/20261012000000_taxguard_staff_session_assurance.sql). It is kept outside `supabase/migrations/` so no pipeline can apply it before approval.

| Change | Purpose |
| --- | --- |
| `taxguard_sessions.aal VARCHAR(8) NOT NULL DEFAULT 'aal1'` + check (`aal1`, `aal2`) | Records the assurance level of each durable session |
| Index `idx_taxguard_cases_preparer (tenant_id, preparer_uid)` | Accountant case discovery |

**Deployment order (required):** apply the migration **before** releasing this server build. Without the column, session inserts fail and the server now refuses the sign-in (fail closed). Existing staff sessions default to AAL1 and must sign in again with MFA.

**Data prerequisites:** `taxguard_cases.preparer_uid` and active `taxguard_staff_assignments` rows must be populated for each accountant; `taxguard_members` must hold the `accountant` role in the deployment tenant.

## 4. Production hosting requirements

- Supabase project: MFA (TOTP) enabled; staff invitation flow with mandatory authenticator enrolment (no enrolment UI exists in TaxGuard yet).
- API host (Render, `api.artaxserv.com`): `NODE_ENV=production`, `TAXGUARD_TENANT_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` in the host secret store; health and readiness monitoring; the service did not respond on 2026-10-12.
- Frontend build variables (`VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); CORS already limited to `artaxserv.com`.

## 5. Tests

`staffMfaAccountantProductionApi.test.ts` (25, real production app, mutation-checked), `supabaseStaffMfaClient.test.ts` (4), dashboard unavailable-field test. Existing staff-session fixtures were updated to represent MFA-verified (AAL2) staff sign-ins; their assertions are unchanged.

## 6. Remaining blockers

H06 / H09 (role → MFA policy confirmation), E03 (Supabase MFA configuration and staff enrolment), E01 (durable case data population), production API availability, independent security and IRS §7216 review, migration approval.
