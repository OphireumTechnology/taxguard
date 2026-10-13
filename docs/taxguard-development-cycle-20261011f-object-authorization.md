# TaxGuard development cycle — 2026-10-11 (f) — object-level authorization across legacy routes, deliverable validation, honest provider status

**PRODUCTION STATUS: NO-GO.** Completion matrix: [taxguard-master-development-completion-matrix.md](taxguard-master-development-completion-matrix.md).

## Task A — baseline (verified)

| Item | Result |
| --- | --- |
| Branch / HEAD | `sync/taxguard-development-20261011` @ `846bbc1` = `origin`; `origin/main` @ `fc36cac` (unchanged) |
| Pending cycle (e) work | 12 files intact, uncommitted (awaiting approval), and checkpointed to `docs/checkpoints/cycle-f-start-20261011-145737/` (git-ignored) |
| Independent baseline | typecheck PASS, lint PASS, **186 files / 3,517 tests PASS**, build PASS |
| Reference paths | `D:\TaxGuardAutonomy\Workspace` and the architecture reference directory exist |

## Task D — production-path session tests

Already delivered in cycle (e), as 10 production-path tests in `durableSessionRevocation.test.ts`. Not repeated.

## Defects found and fixed (all reproduced by a failing test first)

| ID | Severity | Route(s) | Defect | Fix |
| --- | --- | --- | --- | --- |
| F-1 | High (integrity, BOLA) | `POST /api/accountant/tasks/:id/review`, `/reconciliations/:id/sign-off`, `/journal-entries/:id/review`, `/journal-entries/:id/post` | Acted on any record by ID: unassigned staff and other tenants' admins or reviewers could approve, sign off and post to the ledger | `canAccessStaffClient` on the record's client (18 reproductions → pass) |
| F-2 | High | `POST /api/accountant/reconciliations/:id/lock` | No client check and **no role check**: any accountant could unlock a signed-off period | Client check + sign-off authority (senior reviewer / admin) + boolean validation |
| F-3 | Medium | Task review | Missing `action` crashed (`toUpperCase` of undefined); unknown actions silently became `needs_client_input` | 400 `REVIEW_ACTION_INVALID` |
| F-4 | Medium | `POST /api/accountant/documents/upload-deliverable` | Type inferred from the name (`x.exe` became PDF); invented `'1.4 MB'` size; auto-`verified`; raw name in URL; `fileBase64` ignored; tax year defaulted to 2025 | Shared validator; strict base64; **file-signature check**; size from real bytes; `pending_review`; encoded URL; 503 in production (no vault) |
| F-5 | Medium (honesty) | `POST /api/accountant/ai-tax-assistant` | Returned a fixed IRC §162 / S-Corp / SC DOR paragraph for every question, labelled AI research; logged query text | 503 `AI_TAX_ASSISTANT_UNAVAILABLE`; audit records length only |
| F-6 | High (confidentiality and integrity) | `/api/integrations/*` | Staff listed every tenant's connections; any user could sync, disconnect or advance write stages on any connection; a client could self-perform Stage 2; one admin could perform Stages 1, 3 and 4; **sync and commit fabricated success** ("42 ledger accounts synchronized", "committed to remote ledger") | Object authorization (404); Stage 1 client-only; Stage 2 staff-only; Stage 3 independent of the preparer (actors recorded); connect records `pending_auth`; sync / commit 503 `ACCOUNTING_PROVIDER_NOT_COMMISSIONED` after all gates |
| F-7 | High | `/api/staging/*` | Listing and metrics exposed all tenants to staff (and to prospective clients for metrics); actions had no client check | Scoped by `canAccessClientRecord`; actions 404 when unauthorized |
| F-8 | Medium (ledger integrity) | `POST /api/staging/records/:id/rollback` | Rolling back a posted record left its ledger transaction in place; a re-post duplicated it | 409 `ROLLBACK_REQUIRES_REVERSAL` for posted / reconciled |
| F-9 | Low | Staging review | Accepted `NaN`, `Infinity` and negative amounts | 400 `AMOUNT_INVALID` |
| F-10 | Medium | `PATCH /api/messages/:id/read`, `PATCH /api/appointments/:id` | Any user could modify any record; appointment status unvalidated (crash on a non-string); clients could record staff outcomes | Ownership checks; status / date / field validation; clients may only cancel or reschedule |
| F-11 | Medium | `/api/practice-console/resolve-tax-year`, `/resolve-classification` | Any tenant's document; unvalidated year and category | `canAccessStaffClient`; validation |

**Refactor:** `canAccessStaffClient` and `getClientUser` moved from `accountant.routes.ts` to the new `src/server/clientAccess.ts` (plus `canAccessClientRecord`). Behaviour is unchanged: all prior accountant tests pass.

## Remaining scan findings (not changed this cycle)

A heuristic scan of all routers flagged further handlers. Triage:

- **Role-gated admin routes still missing a target-tenant check** (next cycle, P1-08): `assignments` suspend / restore / reassignment review; `onboarding` client review and staff activation; `calendar` admin override and disconnect.
- **Reviewed as low risk:** public `careers` pages; `intake` (looked up by `req.user.id`); the `payments` webhook (separate signature concern); `admin` service plans (catalogue).

## Files changed this cycle (in addition to the 12 pending cycle (e) files)

| File | Change |
| --- | --- |
| `src/server/clientAccess.ts` | **New** shared object-level authorization |
| `src/server/routes/accountant.routes.ts` | F-1 – F-5; uses `clientAccess` |
| `src/server/routes/integrations.routes.ts` | F-6 (rewritten) |
| `src/server/routes/staging.routes.ts` | F-7 – F-9 |
| `src/server/routes/messages.routes.ts`, `appointments.routes.ts`, `practice-console.routes.ts` | F-10, F-11 |
| `src/server/documentUploadValidation.ts` | + `decodeBase64Strict`, `matchesFileSignature` (pending file from cycle e, extended) |
| `src/types/index.ts` | Optional `clientAuthorizedBy` / `preparedBy` / `approvedBy` on `AccountingConnection.writeAuthorization` |
| Tests (new) | `accountantObjectAuthorization.test.ts` (37), `integrationsAuthorization.test.ts` (24), `stagingAuthorization.test.ts` (16), `legacyRouteObjectAuthorization.test.ts` (18) |
| Tests (extended) | `documentUploadValidation.test.ts` (+2) |
| Docs | Completion matrix (new), this report, traceability regenerated |

## Validation

| Check | Result |
| --- | --- |
| Lint / typecheck | PASS / PASS |
| Full suite | **190 files / 3,614 tests PASS** (+4 files, +97 tests vs. 3,517; 0 failures) |
| Build / `git diff --check` | PASS / PASS |
| Traceability | Regenerated; delta only `src/server/auth.ts` (the pending cycle (e) change). **Caught and fixed:** the generator walks `docs/` recursively and had inventoried two `.md` copies inside a git-ignored checkpoint folder, which a clean CI checkout would lack. The checkpoint was moved (not deleted) to `.taxguard-backups/` (git-ignored, outside `docs/`); the evidence now references no ignored files. |
| Secrets / taxpayer data | None (scan of changed and new files) |
| Browser / deployed database / providers | NOT VERIFIED (E06, E01, E04) |

## Next cycle

1. P1-08: tenant ownership checks on role-gated admin routes.
2. Payments webhook signature / replay review.
3. Reversing-entry workflow for posted staging records (ACC-01).
4. MFA / rate-limit audit (P1-09).
