# TaxGuard development cycle — 2026-10-12 (g) — tenant ownership on assignment, onboarding and calendar routes

**PRODUCTION STATUS: NO-GO.** Completion matrix: [taxguard-master-development-completion-matrix.md](taxguard-master-development-completion-matrix.md) (rows P1-08, P1-11).

## Starting state

| Item | Result |
| --- | --- |
| Branch / HEAD | `sync/taxguard-development-20261011` @ `b04a25c` = `origin`; working tree clean |
| `origin/main` | `fc36cac` (unchanged; Supabase vs Firebase conflict unresolved) |
| Checkpoint | `.taxguard-backups/cycle-g-start-20261012-000215/` (git-ignored; outside `docs/` so the traceability generator does not inventory it) |

## Findings and fixes

| ID | Severity | Route | Defect | Fix |
| --- | --- | --- | --- | --- |
| G-1 | Medium | `POST /api/assignments/reassignment-requests/:id/review` | A missing `action` crashed (`toUpperCase`); any other value silently became `rejected` | 400 `REVIEW_ACTION_INVALID`; notes bounded |
| G-2 | Medium (lifecycle integrity) | `POST /api/assignments/restore` | Restored **any** binding to `active`, including formally `unbound` ones, bypassing `/bind` checks | Only `suspended` bindings can be restored (409 `ASSIGNMENT_NOT_SUSPENDED`) |
| G-3 | High (cross-tenant integrity) | `POST /api/onboarding/client/review` | Another tenant's administrator, or any unassigned accountant, could approve a client's onboarding; a missing `decision` crashed; arbitrary decisions were stored | `canAccessStaffClient` (tenant for admins, assignment for accountants); decision limited to `approved` / `correction_requested` |
| G-4 | **High (privilege escalation)** | `POST /api/onboarding/staff/review-activate` | Another tenant's administrator could activate staff and set roles; `assignedRole` was unvalidated, so an administrator could grant `super_administrator` / `super_admin`; any dossier state could be activated; `permissions` unvalidated | Staff user must exist in the administrator's tenant; dossier must be `submitted`; role limited to the invitation vocabulary (shared `ACTIVATABLE_STAFF_ROLES`); permissions and notes validated |
| G-5 | High | `POST /api/calendar/reschedule`, `/cancel` | Only the `client` role was checked: any staff member in any tenant, and `prospective_client` users, could reschedule or cancel any appointment | `canManageAppointment` (owning client by id or booking e-mail, assigned staff, same-tenant admin, or staff authorized for the client) |
| G-6 | Medium (availability) | `POST /api/calendar/reschedule` | A non-`HH:MM` time slot (for example `2:00 PM`) crashed `formatSlotUtc` → 500 | `HH:MM` validation (matches what `/available-slots` and the UI send) → 400 |
| G-7 | High (confidentiality) | `GET /api/calendar/firm-overview`, `GET /connections` | Returned every tenant's appointments, staff configurations, holds and calendar connections to any administrator | Scoped to the caller's tenant via the staff member who owns each calendar |
| G-8 | Medium | `POST /api/calendar/disconnect-provider` | Any authenticated user could disconnect any staff calendar | Owner or same-tenant administrator only |
| G-9 | Medium (cross-tenant + honesty) | `POST /api/calendar/admin-override-booking` | Booked onto other tenants' (or nonexistent) staff; unvalidated date and time; invented client e-mail / phone and a **fabricated Google Meet link** | Staff must be a staff-role user in the admin's tenant; inputs validated; no invented contact details or meeting link |
| G-10 | Medium (honesty) | `POST /api/calendar/connect-provider` | Reported "connected successfully with 2-way sync enabled" with no provider (E04) | `authorization_pending`, `twoWaySyncEnabled: false`, honest message; provider and e-mail validated |
| G-11 | Medium | `POST /api/calendar/founder-controls` | Any tenant's administrator could rewrite the firm founder's scheduling controls with arbitrary input | Founder must be in the caller's tenant; controls must be an object |

### Next-priority item delivered in the same cycle

| ID | Severity | Route | Defect | Fix |
| --- | --- | --- | --- | --- |
| G-12 | **High (payment integrity)** | `POST /api/payments/webhook` (development / staging server) | Outside production, a request **without** a `stripe-signature` header skipped verification, so anyone could post `payment_intent.succeeded` and mark any invoice paid. With a header but no configured secret, a **hard-coded fallback secret** (in the source code) was used, so signatures were forgeable. Events without an `id` got a generated id, so replays were never deduplicated. | The secret is required in every environment (503 otherwise; no fallback); a signature is always required; a stable provider event id is required. The existing signed-webhook tests are unchanged and pass. +3 regression tests in `paymentsRouteAuthority.test.ts`. |

Remaining for payments (recorded, not changed): the signature scheme is an internal HMAC of the JSON body, not Stripe's `t=…,v1=…` format with timestamp tolerance. Adopting the real scheme belongs with commissioning the Stripe integration (E04).

**Reviewed, not changed** (no read or modification of another party's records; changing them would be speculative): calendar `/book` and `/hold-slot`, `GET /founder-controls`.

## Files changed

| File | Change |
| --- | --- |
| `src/server/routes/assignments.routes.ts` | G-1, G-2 |
| `src/server/routes/onboarding.routes.ts` | G-3, G-4; shared `ACTIVATABLE_STAFF_ROLES` also used by the invitation route |
| `src/server/routes/calendar.routes.ts` | G-5 – G-11 |
| `src/tests/assignmentsTenantOwnership.test.ts` | **New**, 18 tests |
| `src/tests/onboardingReviewAuthorization.test.ts` | **New**, 22 tests |
| `src/tests/calendarTenantOwnership.test.ts` | **New**, 27 tests |
| `src/server/routes/payments.routes.ts` | G-12 |
| `src/tests/paymentsRouteAuthority.test.ts` | +3 webhook regression tests |
| `docs/taxguard-master-development-completion-matrix.md` | P1-08 complete; new P1-11 |
| `docs/taxguard-development-cycle-20261012g-admin-route-tenancy.md` | This report |
| `docs/taxguard-master-traceability.json` | Regenerated by the project script |

## Validation

| Check | Result |
| --- | --- |
| Typecheck / lint | PASS / PASS |
| Full suite | **193 files / 3,684 tests PASS** (+3 files, +70 tests vs. 3,614; 0 failures) |
| Traceability integrity | PASS (12 / 12); hash delta only `src/tests/paymentsRouteAuthority.test.ts` (extended); evidence references no git-ignored files |
| Build / `git diff --check` | PASS / PASS |
| Intermediate failures | 1 type error in a new test (invalid dossier status literal, corrected); 3 reschedule tests exposed the pre-existing `HH:MM` crash (G-6), now fixed |
| Browser / deployed database / providers | NOT VERIFIED (E06, E01, E04) |

## Remaining blockers (unchanged)

- **Decisions:** H10 (stage list), H11 (stop deactivation), H06 (roles), H01a (agent names).
- **Platform conflict:** Supabase vs Firebase on `main`.
- **Dependencies:** E01–E08.

## Next cycle

1. Real Stripe signature scheme (`t=…,v1=…`, timestamp tolerance) when the provider is commissioned (E04).
2. Reversing-entry workflow for posted staging records (ACC-01).
3. MFA / rate-limit audit (P1-09).
